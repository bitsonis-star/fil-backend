import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

const SPECIES = ["dog", "cat", "rabbit", "bird", "fish", "reptile", "other"] as const;
const PARTNER_PREFS = ["must_have", "open_to", "no_pets", "no_preference"] as const;

export const petsRouter = router({

  // ── My pets ────────────────────────────────────────────

  getMyPets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const { pets: petsTable } = await import("../drizzle/schema");
    const { eq, asc } = await import("drizzle-orm");
    return await db.select().from(petsTable)
      .where(eq(petsTable.userId, ctx.user.id))
      .orderBy(asc(petsTable.createdAt));
  }),

  addPet: protectedProcedure
    .input(z.object({
      name:            z.string().min(1).max(60),
      species:         z.enum(SPECIES),
      breed:           z.string().max(100).optional(),
      ageYears:        z.number().int().min(0).max(30).optional(),
      personalityTags: z.array(z.string()).max(8).optional(),
      isMain:          z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { pets: petsTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // If setting as main, clear existing main
      if (input.isMain) {
        await db.update(petsTable).set({ isMain: 0 }).where(eq(petsTable.userId, ctx.user.id));
      }

      await db.insert(petsTable).values({
        userId:          ctx.user.id,
        name:            input.name,
        species:         input.species,
        breed:           input.breed ?? null,
        ageYears:        input.ageYears ?? null,
        personalityTags: input.personalityTags ? JSON.stringify(input.personalityTags) : null,
        isMain:          input.isMain ? 1 : 0,
      });
      return { success: true };
    }),

  deletePet: protectedProcedure
    .input(z.object({ petId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { pets: petsTable } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      await db.delete(petsTable).where(
        and(eq(petsTable.id, input.petId), eq(petsTable.userId, ctx.user.id))
      );
      return { success: true };
    }),

  // ── Preferences ────────────────────────────────────────

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const { petPreferences } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [pref] = await db.select().from(petPreferences)
      .where(eq(petPreferences.userId, ctx.user.id)).limit(1);
    return pref ?? null;
  }),

  savePreferences: protectedProcedure
    .input(z.object({
      partnerPetPreference: z.enum(PARTNER_PREFS),
      incompatibleWith:     z.array(z.enum(SPECIES)).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { petPreferences } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const incompatibleJson = input.incompatibleWith
        ? JSON.stringify(input.incompatibleWith) : null;

      const existing = await db.select().from(petPreferences)
        .where(eq(petPreferences.userId, ctx.user.id)).limit(1);

      if (existing.length) {
        await db.update(petPreferences).set({
          partnerPetPreference: input.partnerPetPreference,
          incompatibleWith: incompatibleJson,
        }).where(eq(petPreferences.userId, ctx.user.id));
      } else {
        await db.insert(petPreferences).values({
          userId: ctx.user.id,
          partnerPetPreference: input.partnerPetPreference,
          incompatibleWith: incompatibleJson,
        });
      }
      return { success: true };
    }),

  // ── Get another user's pets (for match cards) ──────────

  getPetsForUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const { pets: petsTable } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return await db.select().from(petsTable)
        .where(eq(petsTable.userId, input.userId))
        .orderBy(desc(petsTable.isMain));
    }),

  // ── AI pet compatibility score ─────────────────────────

  /**
   * Given two users' pets, return a compatibility score + explanation.
   * Called client-side when rendering a match card with pet data.
   */
  getCompatibility: protectedProcedure
    .input(z.object({
      myPets:    z.array(z.object({ name: z.string(), species: z.string(), breed: z.string().optional(), personalityTags: z.array(z.string()).optional() })),
      theirPets: z.array(z.object({ name: z.string(), species: z.string(), breed: z.string().optional(), personalityTags: z.array(z.string()).optional() })),
    }))
    .query(async ({ ctx, input }) => {
      if (!input.myPets.length && !input.theirPets.length) {
        return { score: null, explanation: null, dateSuggestion: null };
      }

      const myDesc = input.myPets.map(p =>
        `${p.name} (${p.breed ?? p.species}${p.personalityTags?.length ? ", " + p.personalityTags.join(", ") : ""})`
      ).join("; ");

      const theirDesc = input.theirPets.map(p =>
        `${p.name} (${p.breed ?? p.species}${p.personalityTags?.length ? ", " + p.personalityTags.join(", ") : ""})`
      ).join("; ");

      const noMyPets  = !input.myPets.length;
      const noTheirPets = !input.theirPets.length;

      const prompt = noMyPets || noTheirPets
        ? `One person has pets and the other doesn't. Pets: ${myDesc || theirDesc}. Write a brief, warm note about whether they could be compatible and what to discuss early in the relationship. Keep to 2 sentences.`
        : `Rate the pet compatibility between these two people's pets:
Person A's pets: ${myDesc}
Person B's pets: ${theirDesc}

Consider: species compatibility, energy matching, temperament. Return a score 0-100 and a 2-sentence explanation. Also suggest one specific date idea that involves both pets.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a friendly pet compatibility advisor. Be warm, specific, and practical. Return JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pet_compat",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score:          { type: ["integer", "null"] },
                explanation:    { type: "string" },
                dateSuggestion: { type: ["string", "null"] },
              },
              required: ["score", "explanation", "dateSuggestion"],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const content = response.choices[0]?.message?.content;
        if (content) return JSON.parse(content);
      } catch { /* fall through */ }

      return { score: null, explanation: "Could not calculate pet compatibility.", dateSuggestion: null };
    }),
});
