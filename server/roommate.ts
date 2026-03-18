import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc';
import { getDb } from './db';
import { roommateProfiles } from '../drizzle/schema';
import { eq, and, ne } from 'drizzle-orm';

export const ATHENS_NEIGHBOURHOODS = [
  { slug: 'kolonaki', label: 'Kolonaki' },
  { slug: 'exarchia', label: 'Exarchia' },
  { slug: 'pagrati', label: 'Pagrati' },
  { slug: 'koukaki', label: 'Koukaki' },
  { slug: 'monastiraki', label: 'Monastiraki' },
  { slug: 'glyfada', label: 'Glyfada' },
  { slug: 'kifisia', label: 'Kifisia' },
];

const SLEEP = ['early','normal','late','very_late'];
const CLEAN = ['spotless','clean','relaxed','lived_in'];
const NOISE = ['silent','background','music','loud'];
const GUESTS = ['rarely','occasional','regular','partner_stays'];

function score(a: number, b: number, max: number) {
  return Math.round((1 - Math.abs(a - b) / max) * 100);
}

export function getRoommateScore(a: any, b: any) {
  const sleep = score(SLEEP.indexOf(a.sleepSchedule), SLEEP.indexOf(b.sleepSchedule), SLEEP.length - 1);
  const clean = score(CLEAN.indexOf(a.cleanliness), CLEAN.indexOf(b.cleanliness), CLEAN.length - 1);
  const noise = score(NOISE.indexOf(a.noiseLevel), NOISE.indexOf(b.noiseLevel), NOISE.length - 1);
  const guests = score(GUESTS.indexOf(a.guestsPolicy), GUESTS.indexOf(b.guestsPolicy), GUESTS.length - 1);
  const total = Math.round(sleep * 0.30 + clean * 0.25 + noise * 0.20 + guests * 0.25);
  return { total, breakdown: { sleep, cleanliness: clean, noise, guests } };
}

export const roommateRouter = router({
  getNeighbourhoods: protectedProcedure.query(() => ATHENS_NEIGHBOURHOODS),

  saveProfile: protectedProcedure
    .input(z.object({
      hasRoom: z.boolean(),
      sleepSchedule: z.enum(['early','normal','late','very_late']),
      cleanliness: z.enum(['spotless','clean','relaxed','lived_in']),
      noiseLevel: z.enum(['silent','background','music','loud']),
      guestsPolicy: z.enum(['rarely','occasional','regular','partner_stays']),
      budgetMin: z.number(),
      budgetMax: z.number(),
      neighbourhoods: z.array(z.string()),
      petsOk: z.boolean().default(true),
      smokingOk: z.boolean().default(false),
      bio: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db.insert(roommateProfiles).values({
        userId: ctx.user.id,
        hasRoom: input.hasRoom ? 1 : 0,
        sleepSchedule: input.sleepSchedule,
        cleanliness: input.cleanliness,
        noiseLevel: input.noiseLevel,
        guestsPolicy: input.guestsPolicy,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        neighbourhoods: JSON.stringify(input.neighbourhoods),
        petsOk: input.petsOk ? 1 : 0,
        smokingOk: input.smokingOk ? 1 : 0,
        bio: input.bio ?? null,
      }).onDuplicateKeyUpdate({
        set: {
          hasRoom: input.hasRoom ? 1 : 0,
          sleepSchedule: input.sleepSchedule,
          cleanliness: input.cleanliness,
          noiseLevel: input.noiseLevel,
          guestsPolicy: input.guestsPolicy,
          budgetMin: input.budgetMin,
          budgetMax: input.budgetMax,
          neighbourhoods: JSON.stringify(input.neighbourhoods),
          petsOk: input.petsOk ? 1 : 0,
          smokingOk: input.smokingOk ? 1 : 0,
          bio: input.bio ?? null,
        },
      });
      return { ok: true };
    }),

  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const rows = await db.select().from(roommateProfiles)
      .where(eq(roommateProfiles.userId, ctx.user.id)).limit(1);
    return rows[0] ?? null;
  }),

  discover: protectedProcedure
    .input(z.object({ cursor: z.number().default(0), limit: z.number().default(10) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const myRows = await db.select().from(roommateProfiles)
        .where(eq(roommateProfiles.userId, ctx.user.id)).limit(1);
      const my = myRows[0];
      if (!my) throw new Error('Complete your roommate profile first');
      const candidates = await db.select().from(roommateProfiles)
        .where(and(
          ne(roommateProfiles.userId, ctx.user.id),
          eq(roommateProfiles.hasRoom, my.hasRoom === 1 ? 0 : 1),
        ))
        .limit(input.limit).offset(input.cursor);
      return candidates.map(c => ({ candidate: c, ...getRoommateScore(my, c) }))
        .sort((a, b) => b.total - a.total);
    }),
});
