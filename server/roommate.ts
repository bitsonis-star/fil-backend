/**
 * server/roommate.ts
 * Roommate matching feature — profile management + discovery + scoring
 */

import { z } from 'zod';
import { router, protectedProcedure } from './trpc';
import { db } from './db';
import { roommateProfiles, users } from './db/schema';
import { eq, and, ne, between, sql } from 'drizzle-orm';

// ─── Athens neighbourhoods ────────────────────────────────────────────────────

export const ATHENS_NEIGHBOURHOODS = [
  { slug: 'kolonaki',     label: 'Kolonaki' },
  { slug: 'exarchia',     label: 'Exarchia' },
  { slug: 'pagrati',      label: 'Pagrati' },
  { slug: 'koukaki',      label: 'Koukaki' },
  { slug: 'monastiraki',  label: 'Monastiraki' },
  { slug: 'psiri',        label: 'Psiri' },
  { slug: 'glyfada',      label: 'Glyfada' },
  { slug: 'kifisia',      label: 'Kifisia' },
  { slug: 'chalandri',    label: 'Chalandri' },
  { slug: 'piraeus',      label: 'Piraeus' },
  { slug: 'nea_smyrni',   label: 'Nea Smyrni' },
  { slug: 'kallithea',    label: 'Kallithea' },
  { slug: 'neo_psychiko', label: 'Neo Psychiko' },
  { slug: 'marousi',      label: 'Marousi' },
  { slug: 'zografou',     label: 'Zografou' },
];

// ─── Compatibility scoring ────────────────────────────────────────────────────

const SLEEP_ORDER = ['early', 'normal', 'late', 'very_late'] as const;
const CLEAN_ORDER = ['spotless', 'clean', 'relaxed', 'lived_in'] as const;
const NOISE_ORDER = ['silent', 'background', 'music', 'loud'] as const;
const GUESTS_ORDER = ['rarely', 'occasional', 'regular', 'partner_stays'] as const;

function scaleScore(indexA: number, indexB: number, maxIndex: number): number {
  const diff = Math.abs(indexA - indexB);
  return Math.round((1 - diff / maxIndex) * 100);
}

export function getRoommateScore(
  a: typeof roommateProfiles.$inferSelect,
  b: typeof roommateProfiles.$inferSelect,
): {
  total: number;
  breakdown: { sleep: number; cleanliness: number; noise: number; guests: number; budget: number; neighbourhoods: number };
} {
  // Sleep schedule — 30% weight
  const sleepA = SLEEP_ORDER.indexOf(a.sleepSchedule as any);
  const sleepB = SLEEP_ORDER.indexOf(b.sleepSchedule as any);
  const sleep = scaleScore(sleepA, sleepB, SLEEP_ORDER.length - 1);

  // Cleanliness — 25% weight
  const cleanA = CLEAN_ORDER.indexOf(a.cleanliness as any);
  const cleanB = CLEAN_ORDER.indexOf(b.cleanliness as any);
  const cleanliness = scaleScore(cleanA, cleanB, CLEAN_ORDER.length - 1);

  // Noise — 20% weight
  const noiseA = NOISE_ORDER.indexOf(a.noiseLevel as any);
  const noiseB = NOISE_ORDER.indexOf(b.noiseLevel as any);
  const noise = scaleScore(noiseA, noiseB, NOISE_ORDER.length - 1);

  // Guests — 15% weight
  const guestsA = GUESTS_ORDER.indexOf(a.guestsPolicy as any);
  const guestsB = GUESTS_ORDER.indexOf(b.guestsPolicy as any);
  const guests = scaleScore(guestsA, guestsB, GUESTS_ORDER.length - 1);

  // Budget overlap — 10% weight
  const overlapMin = Math.max(a.budgetMin, b.budgetMin);
  const overlapMax = Math.min(a.budgetMax, b.budgetMax);
  const budget = overlapMax >= overlapMin
    ? Math.round((overlapMax - overlapMin) / Math.max(a.budgetMax - a.budgetMin, b.budgetMax - b.budgetMin, 1) * 100)
    : 0;

  // Neighbourhood overlap — bonus signal
  const nA: string[] = (a.neighbourhoods as string[]) ?? [];
  const nB: string[] = (b.neighbourhoods as string[]) ?? [];
  const shared = nA.filter(n => nB.includes(n));
  const neighbourhoods = nA.length > 0 && nB.length > 0
    ? Math.round((shared.length / Math.min(nA.length, nB.length)) * 100)
    : 50; // neutral if not set

  const total = Math.round(
    sleep        * 0.30 +
    cleanliness  * 0.25 +
    noise        * 0.20 +
    guests       * 0.15 +
    budget       * 0.10
  );

  return { total, breakdown: { sleep, cleanliness, noise, guests, budget, neighbourhoods } };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const roommateRouter = router({

  /** Get all Athens neighbourhoods for the UI */
  getNeighbourhoods: protectedProcedure.query(() => ATHENS_NEIGHBOURHOODS),

  /** Save or update roommate profile */
  saveProfile: protectedProcedure
    .input(z.object({
      hasRoom:       z.boolean(),
      sleepSchedule: z.enum(['early', 'normal', 'late', 'very_late']),
      cleanliness:   z.enum(['spotless', 'clean', 'relaxed', 'lived_in']),
      noiseLevel:    z.enum(['silent', 'background', 'music', 'loud']),
      guestsPolicy:  z.enum(['rarely', 'occasional', 'regular', 'partner_stays']),
      budgetMin:     z.number().min(100).max(5000),
      budgetMax:     z.number().min(100).max(5000),
      neighbourhoods: z.array(z.string()).max(6),
      petsOk:        z.boolean().default(true),
      smokingOk:     z.boolean().default(false),
      bio:           z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Upsert roommate profile
      await db.insert(roommateProfiles).values({
        userId,
        hasRoom:       input.hasRoom,
        sleepSchedule: input.sleepSchedule,
        cleanliness:   input.cleanliness,
        noiseLevel:    input.noiseLevel,
        guestsPolicy:  input.guestsPolicy,
        budgetMin:     input.budgetMin,
        budgetMax:     input.budgetMax,
        neighbourhoods: input.neighbourhoods,
        petsOk:        input.petsOk,
        smokingOk:     input.smokingOk,
        bio:           input.bio ?? null,
      }).onDuplicateKeyUpdate({
        set: {
          hasRoom:       input.hasRoom,
          sleepSchedule: input.sleepSchedule,
          cleanliness:   input.cleanliness,
          noiseLevel:    input.noiseLevel,
          guestsPolicy:  input.guestsPolicy,
          budgetMin:     input.budgetMin,
          budgetMax:     input.budgetMax,
          neighbourhoods: input.neighbourhoods,
          petsOk:        input.petsOk,
          smokingOk:     input.smokingOk,
          bio:           input.bio ?? null,
          updatedAt:     new Date(),
        },
      });

      // Mark user as seeking roommate
      await db.update(users)
        .set({ intentRoommate: true })
        .where(eq(users.id, userId));

      return { ok: true };
    }),

  /** Get my roommate profile */
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    return db.query.roommateProfiles.findFirst({
      where: eq(roommateProfiles.userId, ctx.user.id),
    });
  }),

  /** Discover roommate matches */
  discover: protectedProcedure
    .input(z.object({
      budgetMin:       z.number().optional(),
      budgetMax:       z.number().optional(),
      neighbourhoods:  z.array(z.string()).optional(),
      hasRoom:         z.boolean().optional(), // filter by has_room / needs_room
      cursor:          z.number().default(0),
      limit:           z.number().default(10),
    }))
    .query(async ({ input, ctx }) => {
      const myProfile = await db.query.roommateProfiles.findFirst({
        where: eq(roommateProfiles.userId, ctx.user.id),
      });
      if (!myProfile) throw new Error('Complete your roommate profile first');

      // Fetch candidates — opposite has_room status (has room ↔ needs room)
      const candidates = await db.query.roommateProfiles.findMany({
        where: and(
          ne(roommateProfiles.userId, ctx.user.id),
          // Match opposite type: if I have a room, show people who need one
          eq(roommateProfiles.hasRoom, !myProfile.hasRoom),
        ),
        with: { user: true },
        limit: 50,
        offset: input.cursor,
      });

      // Score, filter, sort
      const scored = candidates
        .map(candidate => {
          const { total, breakdown } = getRoommateScore(myProfile, candidate);
          return { candidate, score: total, breakdown };
        })
        .filter(({ candidate }) => {
          // Budget overlap filter
          if (input.budgetMin && candidate.budgetMax < input.budgetMin) return false;
          if (input.budgetMax && candidate.budgetMin > input.budgetMax) return false;
          // Neighbourhood filter
          if (input.neighbourhoods?.length) {
            const cn: string[] = (candidate.neighbourhoods as string[]) ?? [];
            if (!input.neighbourhoods.some(n => cn.includes(n))) return false;
          }
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);

      return scored;
    }),
});
