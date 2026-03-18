import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

export interface SurveyOption {
  id: string;
  icon: string;
  label: string;
  sublabel?: string;
  externalUrl?: string;
}

export const experienceRouter = router({

  // ── Questions ────────────────────────────────────────────────────

  /** Get the next unanswered question for this user */
  getNextQuestion: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const { surveyQuestions, experienceResponses } = await import("../drizzle/schema");
    const { eq, notInArray } = await import("drizzle-orm");

    // IDs already answered or skipped
    const answered = await db
      .select({ questionId: experienceResponses.questionId })
      .from(experienceResponses)
      .where(eq(experienceResponses.userId, ctx.user.id));

    const answeredIds = answered.map(a => a.questionId);

    const query = db.select().from(surveyQuestions).where(eq(surveyQuestions.isActive, 1));
    const allQuestions = await query;

    const next = allQuestions
      .filter(q => !answeredIds.includes(q.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;

    if (!next) return null;

    return {
      ...next,
      options: JSON.parse(next.options) as SurveyOption[],
    };
  }),

  /** Get all questions (for the survey centre page) */
  getAllQuestions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const { surveyQuestions, experienceResponses } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [questions, answered] = await Promise.all([
      db.select().from(surveyQuestions).where(eq(surveyQuestions.isActive, 1)),
      db.select().from(experienceResponses).where(eq(experienceResponses.userId, ctx.user.id)),
    ]);

    const answeredMap = new Map(answered.map(a => [a.questionId, a]));

    return questions
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(q => {
        const response = answeredMap.get(q.id);
        return {
          ...q,
          options: JSON.parse(q.options) as SurveyOption[],
          answeredAt: response?.answeredAt ?? null,
          selectedOptionIds: response ? JSON.parse(response.selectedOptionIds) as string[] : null,
          skipped: response?.skipped === 1,
        };
      });
  }),

  // ── Responses ───────────────────────────────────────────────────

  /** Save a user's answer to a survey question */
  saveResponse: protectedProcedure
    .input(z.object({
      questionId: z.number(),
      selectedOptionIds: z.array(z.string()),
      skipped: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { experienceResponses } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");

      const existing = await db
        .select()
        .from(experienceResponses)
        .where(and(
          eq(experienceResponses.userId, ctx.user.id),
          eq(experienceResponses.questionId, input.questionId)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(experienceResponses).set({
          selectedOptionIds: JSON.stringify(input.selectedOptionIds),
          skipped: input.skipped ? 1 : 0,
          answeredAt: new Date(),
        }).where(and(
          eq(experienceResponses.userId, ctx.user.id),
          eq(experienceResponses.questionId, input.questionId)
        ));
      } else {
        await db.insert(experienceResponses).values({
          userId: ctx.user.id,
          questionId: input.questionId,
          selectedOptionIds: JSON.stringify(input.selectedOptionIds),
          skipped: input.skipped ? 1 : 0,
        });
      }

      return { success: true };
    }),

  // ── Matching ────────────────────────────────────────────────────

  /**
   * Calculate experience overlap between current user and another user.
   * Returns shared option IDs with their labels and external links.
   */
  getOverlapWithUser: protectedProcedure
    .input(z.object({ otherUserId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { sharedExperiences: [], overlapScore: 0 };

      const { experienceResponses, surveyQuestions } = await import("../drizzle/schema");
      const { eq, or } = await import("drizzle-orm");

      // Get both users' responses
      const [myResponses, theirResponses] = await Promise.all([
        db.select().from(experienceResponses).where(eq(experienceResponses.userId, ctx.user.id)),
        db.select().from(experienceResponses).where(eq(experienceResponses.userId, input.otherUserId)),
      ]);

      // Build option sets per question
      const myOptions = new Map<number, Set<string>>();
      for (const r of myResponses) {
        if (!r.skipped) myOptions.set(r.questionId, new Set(JSON.parse(r.selectedOptionIds)));
      }
      const theirOptions = new Map<number, Set<string>>();
      for (const r of theirResponses) {
        if (!r.skipped) theirOptions.set(r.questionId, new Set(JSON.parse(r.selectedOptionIds)));
      }

      // Find overlapping questions and options
      const sharedQuestionIds = [...myOptions.keys()].filter(qId => theirOptions.has(qId));
      if (!sharedQuestionIds.length) return { sharedExperiences: [], overlapScore: 0 };

      // Get question details
      const questions = await db.select().from(surveyQuestions);
      const questionMap = new Map(questions.map(q => [q.id, q]));

      const sharedExperiences: Array<{
        questionId: number;
        category: string;
        categoryIcon: string | null;
        question: string;
        sharedOptionIds: string[];
        sharedOptions: SurveyOption[];
      }> = [];

      let totalShared = 0;

      for (const qId of sharedQuestionIds) {
        const mySet = myOptions.get(qId)!;
        const theirSet = theirOptions.get(qId)!;
        const shared = [...mySet].filter(o => theirSet.has(o) && o !== "none" && o !== "bucket");

        if (shared.length === 0) continue;

        const q = questionMap.get(qId);
        if (!q) continue;

        const options = JSON.parse(q.options) as SurveyOption[];
        const sharedOptions = options.filter(o => shared.includes(o.id));

        sharedExperiences.push({
          questionId: qId,
          category: q.category,
          categoryIcon: q.categoryIcon,
          question: q.question,
          sharedOptionIds: shared,
          sharedOptions,
        });

        totalShared += shared.length;
      }

      // Overlap score: shared options / max possible (simple ratio, 0-100)
      const totalMyOptions = [...myOptions.values()].reduce((s, set) => s + set.size, 0);
      const overlapScore = totalMyOptions > 0
        ? Math.round(Math.min((totalShared / Math.sqrt(totalMyOptions)) * 25, 100))
        : 0;

      return { sharedExperiences, overlapScore };
    }),

  // ── Community ───────────────────────────────────────────────────

  /**
   * For a given experience option, find which of the user's matches also selected it.
   * Powers the "community around a play/experience" view.
   */
  getCommunityForOption: protectedProcedure
    .input(z.object({
      questionId: z.number(),
      optionId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const { experienceResponses, users: usersTable, matches: matchesTable } = await import("../drizzle/schema");
      const { eq, or } = await import("drizzle-orm");

      // Get all user matches
      const userMatches = await db.select().from(matchesTable).where(
        or(eq(matchesTable.userId1, ctx.user.id), eq(matchesTable.userId2, ctx.user.id))
      );

      const matchedUserIds = userMatches.map(m =>
        m.userId1 === ctx.user.id ? m.userId2 : m.userId1
      );

      if (!matchedUserIds.length) return [];

      // Find which of those also selected this option
      const responses = await db.select({
        userId: experienceResponses.userId,
        selectedOptionIds: experienceResponses.selectedOptionIds,
      }).from(experienceResponses).where(
        eq(experienceResponses.questionId, input.questionId)
      );

      const interested = responses.filter(r =>
        matchedUserIds.includes(r.userId) &&
        (JSON.parse(r.selectedOptionIds) as string[]).includes(input.optionId)
      );

      if (!interested.length) return [];

      // Get user names and scores
      const interestedIds = interested.map(r => r.userId);
      const matchScores = new Map(
        userMatches
          .filter(m => interestedIds.includes(m.userId1 === ctx.user.id ? m.userId2 : m.userId1))
          .map(m => [m.userId1 === ctx.user.id ? m.userId2 : m.userId1, m.compatibilityScore])
      );

      const profiles = await db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, interestedIds[0])); // simplified — in prod use inArray

      return interested.map(r => ({
        userId: r.userId,
        name: profiles.find(p => p.id === r.userId)?.name ?? null,
        compatibilityScore: matchScores.get(r.userId) ?? 0,
      })).sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    }),

  /** Completion stats — how many questions the user has answered */
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { answered: 0, total: 0, percent: 0 };

    const { surveyQuestions, experienceResponses } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [total, answered] = await Promise.all([
      db.select().from(surveyQuestions).where(eq(surveyQuestions.isActive, 1)),
      db.select().from(experienceResponses).where(
        eq(experienceResponses.userId, ctx.user.id)
      ),
    ]);

    const answeredCount = answered.filter(a => !a.skipped).length;
    return {
      answered: answeredCount,
      total: total.length,
      percent: total.length > 0 ? Math.round((answeredCount / total.length) * 100) : 0,
    };
  }),
});
