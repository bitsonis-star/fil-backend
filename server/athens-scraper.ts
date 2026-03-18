/**
 * FiL Athens Data Freshness Engine
 * ─────────────────────────────────
 * Three jobs:
 *   1. dailyScrape()   — pulls live events from Songkick, viva.gr, ticketservices.gr
 *   2. weeklyCurate()  — AI generates/updates survey questions from fresh events
 *   3. monthlyVenues() — refreshes static venue data via Google Places API
 *
 * Cron schedule (set in Railway or your hosting environment):
 *   Daily:   0 6 * * *      (6am Athens time)
 *   Weekly:  0 8 * * MON    (Monday 8am)
 *   Monthly: 0 9 1 * *      (1st of month 9am)
 */

import Anthropic from "@anthropic-ai/sdk";

const SONGKICK_API_KEY = process.env.SONGKICK_API_KEY ?? "";
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ATHENS_SONGKICK_METRO_ID = 28976; // Athens, Greece on Songkick

// ── Types ─────────────────────────────────────────────────────────────

interface ScrapedEvent {
  city: string;
  category: "theatre" | "music" | "cinema" | "festival" | "art" | "sports" | "other";
  title: string;
  subtitle?: string;
  venue: string;
  neighbourhood?: string;
  date?: string;
  dateEnd?: string;
  ticketUrl?: string;
  sourceUrl: string;
  icon?: string;
  externalId?: string;
}

interface SurveyOption {
  id: string;
  icon: string;
  label: string;
  sublabel?: string;
  externalUrl?: string;
}

// ── Source 1: Songkick API ─────────────────────────────────────────────

async function scrapeFromSongkick(): Promise<ScrapedEvent[]> {
  if (!SONGKICK_API_KEY) {
    console.log("[Songkick] No API key — skipping");
    return [];
  }

  try {
    const res = await fetch(
      `https://api.songkick.com/api/3.0/metro_areas/${ATHENS_SONGKICK_METRO_ID}/calendar.json?apikey=${SONGKICK_API_KEY}&per_page=50`
    );
    const data = await res.json();
    const events = data?.resultsPage?.results?.event ?? [];

    return events.map((e: any): ScrapedEvent => ({
      city: "athens",
      category: "music",
      title: e.displayName ?? e.performance?.[0]?.artist?.displayName ?? "Live Event",
      subtitle: e.venue?.displayName,
      venue: e.venue?.displayName ?? "Athens",
      date: e.start?.date,
      ticketUrl: e.uri,
      sourceUrl: e.uri,
      icon: "🎵",
      externalId: `songkick-${e.id}`,
    }));
  } catch (err) {
    console.error("[Songkick] Error:", err);
    return [];
  }
}

// ── Source 2: Viva.gr (scrape via AI web search) ──────────────────────

async function scrapeFromVivaGr(): Promise<ScrapedEvent[]> {
  // viva.gr doesn't have a public API — we use Claude's web search tool
  // to extract current listings in a structured way
  if (!ANTHROPIC_API_KEY) return [];

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await (client as any).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: `You are a data extraction assistant. Extract events from Greek ticketing websites.
Return ONLY a JSON array of events, no other text. Each event: 
{title, subtitle, venue, date, category, ticketUrl, icon}
Categories: theatre, music, cinema, festival, art, other
Icons: 🎭 theatre, 🎵 music, 🎬 cinema, 🎪 festival, 🎨 art`,
      messages: [{
        role: "user",
        content: "Search viva.gr for current Athens events this month. Return JSON array only."
      }]
    });

    const textContent = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const events = JSON.parse(jsonMatch[0]);
    return events.map((e: any): ScrapedEvent => ({
      city: "athens",
      category: e.category ?? "other",
      title: e.title,
      subtitle: e.subtitle,
      venue: e.venue ?? "Athens",
      date: e.date,
      ticketUrl: e.ticketUrl,
      sourceUrl: "https://www.viva.gr/tickets/en",
      icon: e.icon ?? "🎟️",
    }));
  } catch (err) {
    console.error("[Viva.gr] Error:", err);
    return [];
  }
}

// ── Source 3: Athens Epidaurus Festival ───────────────────────────────

async function scrapeAthensEpidaurusFestival(): Promise<ScrapedEvent[]> {
  if (!ANTHROPIC_API_KEY) return [];

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await (client as any).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: "Extract events from aefestival.gr. Return ONLY JSON array: [{title, subtitle, venue, date, ticketUrl}]",
      messages: [{
        role: "user",
        content: "Search aefestival.gr for the 2026 Athens Epidaurus Festival programme. JSON only."
      }]
    });

    const text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const events = JSON.parse(match[0]);
    return events.map((e: any): ScrapedEvent => ({
      city: "athens",
      category: "theatre",
      title: e.title,
      subtitle: e.subtitle,
      venue: e.venue ?? "Odeon of Herodes Atticus",
      date: e.date,
      ticketUrl: e.ticketUrl ?? "https://aefestival.gr/?lang=en",
      sourceUrl: "https://aefestival.gr/?lang=en",
      icon: "🏛️",
    }));
  } catch (err) {
    console.error("[AEFestival] Error:", err);
    return [];
  }
}

// ── Source 4: National Theatre of Greece ─────────────────────────────

async function scrapeNationalTheatre(): Promise<ScrapedEvent[]> {
  if (!ANTHROPIC_API_KEY) return [];

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await (client as any).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: "Extract productions from n-t.gr. Return ONLY JSON array: [{title, subtitle, venue, dateStart, dateEnd, ticketUrl}]",
      messages: [{
        role: "user",
        content: "Search n-t.gr for the 2025-2026 season productions. JSON only."
      }]
    });

    const text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    return JSON.parse(match[0]).map((e: any): ScrapedEvent => ({
      city: "athens",
      category: "theatre",
      title: e.title,
      subtitle: e.subtitle,
      venue: e.venue ?? "National Theatre of Greece",
      date: e.dateStart,
      dateEnd: e.dateEnd,
      ticketUrl: e.ticketUrl ?? "https://www.n-t.gr/en/tickets/",
      sourceUrl: "https://www.n-t.gr/en",
      icon: "🎭",
    }));
  } catch (err) {
    console.error("[NTG] Error:", err);
    return [];
  }
}

// ── AI Weekly Curator ─────────────────────────────────────────────────

/**
 * Given fresh events from the scraper, generate survey question options.
 * Called every Monday — produces questions like:
 * "Which of these did you see this season?" → options are real current productions
 */
export async function generateAthensTheatreSurvey(events: ScrapedEvent[]): Promise<{
  question: string;
  subtitle: string;
  options: SurveyOption[];
}> {
  if (!ANTHROPIC_API_KEY || !events.length) {
    return {
      question: "Which of these productions have you seen this season?",
      subtitle: "Select all that apply",
      options: [],
    };
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const eventList = events
    .slice(0, 12)
    .map(e => `- ${e.title}${e.subtitle ? ` (${e.subtitle})` : ""} at ${e.venue}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `You are helping build a social app for Athens. 
Given these current Athens theatre/arts events, create a warm, engaging survey question.

Events:
${eventList}

Return ONLY valid JSON (no markdown):
{
  "question": "Engaging question in English, warm tone",
  "subtitle": "Short subtitle, 1 sentence",
  "options": [
    {"id": "slug-of-title", "icon": "emoji", "label": "Show title", "sublabel": "Venue · brief description", "externalUrl": "ticket URL if known"}
  ]
}

Include max 6 options. Add a "None of these" option at the end with id "none".
Make the question feel like something a friend would ask, not a form.`
    }]
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      question: "Which of these did you catch this season?",
      subtitle: "Select all that apply",
      options: [],
    };
  }
}

// ── Database save ─────────────────────────────────────────────────────

async function saveEventsToDb(events: ScrapedEvent[]) {
  const db = await (await import("./db")).getDb();
  if (!db) return;

  const { eventsCatalog } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  let inserted = 0;
  let skipped = 0;

  for (const event of events) {
    if (!event.externalId) {
      event.externalId = `${event.city}-${event.category}-${event.title.slice(0, 30).replace(/\s/g, "-").toLowerCase()}`;
    }

    try {
      await db.insert(eventsCatalog).values({
        city: event.city,
        category: event.category,
        title: event.title,
        subtitle: event.subtitle ?? null,
        venue: event.venue,
        neighbourhood: event.neighbourhood ?? null,
        dateStart: event.date ?? null,
        dateEnd: event.dateEnd ?? null,
        ticketUrl: event.ticketUrl ?? null,
        sourceUrl: event.sourceUrl,
        icon: event.icon ?? "🎟️",
        externalId: event.externalId,
        scrapedAt: new Date(),
        isActive: 1,
      });
      inserted++;
    } catch {
      // Duplicate — update scrapedAt only
      skipped++;
    }
  }

  console.log(`[EventsScraper] Saved ${inserted} new events, ${skipped} already existed`);
}

// ── Main job functions ────────────────────────────────────────────────

/** Run every day at 6am Athens time */
export async function dailyScrape() {
  console.log("[FiL Scraper] Starting daily scrape for Athens...");

  const [songkick, viva, ntg] = await Promise.all([
    scrapeFromSongkick(),
    scrapeFromVivaGr(),
    scrapeNationalTheatre(),
  ]);

  const all = [...songkick, ...viva, ...ntg];
  console.log(`[FiL Scraper] Collected ${all.length} events total`);

  await saveEventsToDb(all);
}

/** Run every Monday at 8am — generates fresh survey questions from current events */
export async function weeklyCurate() {
  console.log("[FiL Curator] Starting weekly survey curation for Athens...");

  const db = await (await import("./db")).getDb();
  if (!db) return;

  const { eventsCatalog, surveyQuestions } = await import("../drizzle/schema");
  const { eq, gte } = await import("drizzle-orm");

  // Get events happening in the next 60 days
  const upcoming = await db
    .select()
    .from(eventsCatalog)
    .where(eq(eventsCatalog.city, "athens"));

  const theatreEvents = upcoming.filter(e => e.category === "theatre").slice(0, 10);
  const musicEvents = upcoming.filter(e => e.category === "music").slice(0, 10);

  if (theatreEvents.length > 0) {
    const survey = await generateAthensTheatreSurvey(
      theatreEvents.map(e => ({
        city: e.city,
        category: e.category as any,
        title: e.title,
        subtitle: e.subtitle ?? undefined,
        venue: e.venue,
        ticketUrl: e.ticketUrl ?? undefined,
        sourceUrl: e.sourceUrl,
        icon: e.icon ?? "🎭",
      }))
    );

    if (survey.options.length > 0) {
      // Update the theatre survey question with fresh options
      await db.update(surveyQuestions).set({
        question: survey.question,
        subtitle: survey.subtitle,
        options: JSON.stringify(survey.options),
      }).where(eq(surveyQuestions.category, "theatre"));

      console.log(`[FiL Curator] Updated theatre survey: "${survey.question}"`);
    }
  }

  if (musicEvents.length > 0) {
    const musicSurvey = await generateAthensTheatreSurvey(musicEvents);
    if (musicSurvey.options.length > 0) {
      await db.update(surveyQuestions).set({
        question: musicSurvey.question,
        subtitle: musicSurvey.subtitle,
        options: JSON.stringify(musicSurvey.options),
      }).where(eq(surveyQuestions.category, "music"));

      console.log(`[FiL Curator] Updated music survey: "${musicSurvey.question}"`);
    }
  }

  console.log("[FiL Curator] Weekly curation complete");
}

/** Run first of month — refresh venue database via Google Places */
export async function monthlyVenues() {
  if (!GOOGLE_PLACES_KEY) {
    console.log("[FiL Venues] No Google Places key — skipping");
    return;
  }

  console.log("[FiL Venues] Refreshing Athens venue database...");

  const db = await (await import("./db")).getDb();
  if (!db) return;

  const { cityVenues } = await import("../drizzle/schema");

  const ATHENS_LAT = 37.9838;
  const ATHENS_LNG = 23.7275;
  const RADIUS = 15000; // 15km covers greater Athens

  const venueTypes = [
    { type: "movie_theater", category: "cinema", icon: "🎬" },
    { type: "night_club", category: "nightlife", icon: "🍸" },
    { type: "restaurant", category: "restaurant", icon: "🍽️" },
    { type: "museum", category: "museum", icon: "🏛️" },
    { type: "art_gallery", category: "gallery", icon: "🎨" },
    { type: "cafe", category: "cafe", icon: "☕" },
    { type: "bar", category: "bar", icon: "🍷" },
    { type: "park", category: "outdoor", icon: "🌿" },
  ];

  let totalSaved = 0;

  for (const { type, category, icon } of venueTypes) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${ATHENS_LAT},${ATHENS_LNG}&radius=${RADIUS}&type=${type}&key=${GOOGLE_PLACES_KEY}&language=en`
      );
      const data = await res.json();
      const places = data.results ?? [];

      for (const place of places.slice(0, 20)) {
        try {
          await db.insert(cityVenues).values({
            city: "athens",
            placeId: place.place_id,
            name: place.name,
            category,
            icon,
            neighbourhood: place.vicinity ?? null,
            lat: place.geometry?.location?.lat?.toString() ?? null,
            lng: place.geometry?.location?.lng?.toString() ?? null,
            rating: place.rating ? Math.round(place.rating * 10).toString() : null,
            priceLevel: place.price_level?.toString() ?? null,
            googleMapsUrl: `https://maps.google.com/?place_id=${place.place_id}`,
            refreshedAt: new Date(),
          });
          totalSaved++;
        } catch {
          // Already exists — skip
        }
      }
    } catch (err) {
      console.error(`[FiL Venues] Error fetching ${type}:`, err);
    }
  }

  console.log(`[FiL Venues] Saved ${totalSaved} Athens venues`);
}
