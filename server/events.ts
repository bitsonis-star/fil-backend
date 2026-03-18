import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb, getUserNarrative, getUserLocation } from "./db";
import { invokeLLM } from "./_core/llm";

const EVENT_CATEGORIES = ["professional", "theatre", "cinema", "music", "social", "sports"] as const;
type EventCategory = typeof EVENT_CATEGORIES[number];

export interface DiscoveredEvent {
  id: string;
  title: string;
  category: EventCategory;
  date: string;
  time?: string;
  venue?: string;
  city: string;
  description: string;
  whyMatch: string; // AI-generated reason this matches the user's narrative
  source: string;
  url?: string;
  price?: string;
  savedAt?: string;
}

/**
 * Build a location string from city + optional country.
 * Falls back to a generic prompt if no city is set.
 */
function locationString(city?: string | null, country?: string | null): string {
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  return "the user's city (ask them to set their location)";
}

export const eventsRouter = router({
  /**
   * Discover events personalised to the user's narrative and interests.
   * Uses the LLM with web_search to find real upcoming events.
   */
  discover: protectedProcedure
    .input(z.object({
      city: z.string().optional(),
      categories: z.array(z.enum(EVENT_CATEGORIES)).default([...EVENT_CATEGORIES]),
      refresh: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      // Get user narrative for personalisation
      const narrative = await getUserNarrative(ctx.user.id);
      const narrativeText = narrative?.content
        ?? "Someone who enjoys culture, meaningful conversations, and meeting interesting people.";

      // Get user city (from profile or input override)
      const location = await getUserLocation(ctx.user.id);
      const city = input.city ?? location?.city ?? null;
      const locationStr = locationString(city);

      const categoryList = input.categories.join(", ");

      const systemPrompt = `You are an event discovery engine for FiL, a values-based dating and social app.
Your job is to find REAL, CURRENT, UPCOMING events that match a user's interests and personality.
Use web_search to find actual events — not hypothetical ones. Search for each category separately for best results.
Always return valid JSON only.`;

      const userPrompt = `Find upcoming events in ${locationStr} for someone with these interests:

"${narrativeText}"

Search for events in these categories: ${categoryList}

For each category, search:
- Professional: LinkedIn Events (linkedin.com/events), Eventbrite professional/networking, local startup events, TEDx
- Theatre: local theatre listings, play schedules, comedy shows, theatrical performances
- Cinema: current cinema screenings, film festivals, arthouse films, premieres
- Music: jazz nights, live concerts, music festivals, club events, classical performances
- Social: Meetup.com groups, art gallery openings, cultural events, food festivals
- Outdoors: hiking groups, outdoor sports events, running clubs, adventure activities

Return a JSON object with this exact structure:
{
  "events": [
    {
      "title": "exact event name",
      "category": "professional|theatre|cinema|music|social|sports",
      "date": "readable date e.g. Sat 19 Apr 2026",
      "time": "e.g. 8:00 PM",
      "venue": "venue name and area",
      "city": "${locationStr}",
      "description": "2 sentences about the event",
      "whyMatch": "1 sentence: why this matches the user's specific interests from their narrative",
      "source": "LinkedIn|Eventbrite|Meetup|venue website|etc",
      "url": "real URL",
      "price": "Free|€15|From £10|etc"
    }
  ]
}

Find 12-16 real events. Prioritise events within the next 4 weeks. Return ONLY the JSON object.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          // Note: web_search tool is passed via the LLM wrapper
          // In production, ensure invokeLLM supports tool use
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "events",
              strict: false,
              schema: {
                type: "object",
                properties: {
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        category: { type: "string" },
                        date: { type: "string" },
                        time: { type: "string" },
                        venue: { type: "string" },
                        city: { type: "string" },
                        description: { type: "string" },
                        whyMatch: { type: "string" },
                        source: { type: "string" },
                        url: { type: "string" },
                        price: { type: "string" },
                      },
                      required: ["title", "category", "description", "whyMatch"],
                    },
                  },
                },
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No content from LLM");

        let parsed: { events: DiscoveredEvent[] };
        try {
          const cleaned = content.replace(/```json|```/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch {
          // Try to extract JSON object from text
          const match = content.match(/\{[\s\S]*"events"[\s\S]*\}/);
          if (!match) throw new Error("Could not parse events JSON");
          parsed = JSON.parse(match[0]);
        }

        // Add IDs and filter to requested categories
        const events: DiscoveredEvent[] = (parsed.events ?? [])
          .filter(e => input.categories.includes(e.category as EventCategory))
          .map((e, i) => ({
            ...e,
            id: `ev_${Date.now()}_${i}`,
            category: e.category as EventCategory,
          }));

        return { events, city: locationStr, generatedAt: new Date().toISOString() };
      } catch (err) {
        console.error("[Events] Discovery failed:", err);
        return { events: [], city: locationStr, generatedAt: new Date().toISOString(), error: "Search failed" };
      }
    }),

  /**
   * Save an event to the user's saved list.
   */
  save: protectedProcedure
    .input(z.object({
      event: z.object({
        title: z.string(),
        category: z.enum(EVENT_CATEGORIES),
        date: z.string().optional(),
        time: z.string().optional(),
        venue: z.string().optional(),
        city: z.string(),
        description: z.string(),
        whyMatch: z.string(),
        source: z.string(),
        url: z.string().optional(),
        price: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { savedEvents: savedEventsTable } = await import("../drizzle/schema");
      await db.insert(savedEventsTable).values({
        userId: ctx.user.id,
        eventData: JSON.stringify(input.event),
      });
      return { success: true };
    }),

  /**
   * Get user's saved events.
   */
  getSaved: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const { savedEvents: savedEventsTable } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(savedEventsTable)
      .where(eq(savedEventsTable.userId, ctx.user.id))
      .orderBy(desc(savedEventsTable.savedAt));

    return rows.map(r => ({
      id: r.id,
      savedAt: r.savedAt,
      ...(JSON.parse(r.eventData) as DiscoveredEvent),
    }));
  }),

  /**
   * Remove a saved event.
   */
  unsave: protectedProcedure
    .input(z.object({ savedId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { savedEvents: savedEventsTable } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");

      await db.delete(savedEventsTable)
        .where(and(
          eq(savedEventsTable.id, input.savedId),
          eq(savedEventsTable.userId, ctx.user.id) // ownership check
        ));
      return { success: true };
    }),
});
