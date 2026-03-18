import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { z } from "zod";
import {
  upsertNarrative,
  getUserNarrative,
  getUserProfilePhotos,
  addProfilePhoto,
  getDb,
  getUserMatches,
  getUserMatchesWithDetails,
  getPublishedNarrativesForMatching,
  recordProfileView,
  createMatch,
  updateUserLocation,
  getUserLocation,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { uploadProfilePhoto, validateImageFile } from "./storage";
import { messagingRouter } from "./messaging";
import { eventsRouter } from "./events";
import { petsRouter } from "./pets";
import { experienceRouter } from "./experience";
import { roommateRouter } from "./roommate";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Narrative management
  narrative: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await getUserNarrative(ctx.user.id);
    }),

    save: protectedProcedure
      .input(
        z.object({
          content: z.string().min(10).max(5000),
          isPublished: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await upsertNarrative(
          ctx.user.id,
          input.content,
          input.isPublished
        );
      }),

    getSuggestions: protectedProcedure
      .input(z.object({ content: z.string().min(10) }))
      .mutation(async ({ ctx, input }) => {
        // Use LLM to generate narrative refinement suggestions
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a dating coach. Provide 3-5 specific, actionable suggestions to improve a partner preference narrative to make it more compelling and increase chances of finding compatible matches.",
            },
            {
              role: "user",
              content: `Here's my ideal partner description: ${input.content}\n\nProvide suggestions as a JSON array of strings.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "suggestions",
              strict: true,
              schema: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        });

        try {
          const content = response.choices[0]?.message.content;
          if (typeof content === "string") {
            return JSON.parse(content);
          }
        } catch (e) {
          console.error("Failed to parse suggestions:", e);
        }
        return [];
      }),
  }),

  // Subscription management
  subscription: router({
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { plan: "free", status: "active" };

      const { subscriptions } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const sub = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (!sub[0]) {
        return { plan: "free", status: "active" };
      }

      return {
        plan: sub[0].plan,
        status: sub[0].status,
        currentPeriodEnd: sub[0].currentPeriodEnd,
      };
    }),

    createCheckout: protectedProcedure
      .input(z.object({ plan: z.enum(["premium_monthly", "premium_annual"]) }))
      .mutation(async ({ ctx, input }) => {
        const { createCheckoutSession } = await import("./stripe/checkout");
        const origin = ctx.req.headers.origin ?? ctx.req.headers.host ?? "https://fil-app.com";
        const url = await createCheckoutSession(
          ctx.user.id,
          ctx.user.email ?? "",
          ctx.user.name ?? null,
          input.plan,
          `https://${origin}`
        );
        return { url };
      }),
  }),

  // Matching engine
  match: router({
    calculate: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get current user's narrative
        const userNarrative = await getUserNarrative(ctx.user.id);
        if (!userNarrative || !userNarrative.isPublished) {
          throw new Error("Please publish your narrative first");
        }

        // Fetch only mutually-compatible candidates
        // (gender × interestedIn mutual filter + no rejected connections + no existing match)
        const eligibleNarratives = await getPublishedNarrativesForMatching(
          ctx.user.id,
          input.limit
        );

        // Calculate compatibility for each eligible candidate
        for (const narrative of eligibleNarratives) {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "You are a dating compatibility expert. Analyze two partner preference narratives and rate their compatibility 0-100. Also extract 3-5 specific shared themes as short labels (e.g. 'Family values', 'Love of travel', 'Intellectual curiosity').",
              },
              {
                role: "user",
                content: `Person A's ideal partner: ${userNarrative.content}\n\nPerson B's ideal partner: ${narrative.content}\n\nProvide a compatibility score, a brief reason, and shared themes.`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "compatibility",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    score: { type: "integer", minimum: 0, maximum: 100 },
                    reason: { type: "string" },
                    sharedThemes: { type: "array", items: { type: "string" } },
                  },
                  required: ["score", "reason", "sharedThemes"],
                  additionalProperties: false,
                },
              },
            },
          });

          try {
            const content = response.choices[0]?.message.content;
            if (typeof content === "string") {
              const parsed = JSON.parse(content);
              if (parsed.score && parsed.reason) {
                await createMatch(
                  ctx.user.id,
                  narrative.userId,
                  parsed.score,
                  // Store reason + themes as JSON so the UI can render thread pills
                  JSON.stringify({
                    reason: parsed.reason,
                    sharedThemes: parsed.sharedThemes ?? [],
                  })
                );
              }
            }
          } catch (e) {
            console.error("Failed to parse compatibility response:", e);
          }
        }

        return { success: true, processed: eligibleNarratives.length };
      }),

    getMatches: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { matches: [], totalCount: 0, isPremium: false };

        const { subscriptions } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const sub = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, ctx.user.id))
          .limit(1);

        const isPremium = sub[0]?.plan !== "free" && sub[0]?.plan !== undefined && sub[0]?.status === "active";

        // Exclude anyone who has a rejected connection with this user
        const { connectionRequests } = await import("../drizzle/schema");
        const { or: orOp } = await import("drizzle-orm");
        const rejected = await db
          .select({ senderId: connectionRequests.senderId, receiverId: connectionRequests.receiverId })
          .from(connectionRequests)
          .where(
            and(
              eq(connectionRequests.status, "rejected"),
              orOp(
                eq(connectionRequests.senderId, ctx.user.id),
                eq(connectionRequests.receiverId, ctx.user.id)
              )
            )
          );
        const rejectedIds = new Set(
          rejected.flatMap(r =>
            r.senderId === ctx.user.id ? [r.receiverId] : [r.senderId]
          )
        );

        // Always fetch all matches so we can show the locked-count banner
        const allMatches = (await getUserMatchesWithDetails(ctx.user.id, input.limit))
          .filter(m => !rejectedIds.has(m.matchedUserId));
        const totalCount = allMatches.length;
        // Free users only get match data for top 3
        const visibleMatches = isPremium ? allMatches : allMatches.slice(0, 3);

        return { matches: visibleMatches, totalCount, isPremium };
      }),

    getDetail: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ ctx, input }) => {
        await recordProfileView(ctx.user.id, input.matchId);

        const matches = await getUserMatches(ctx.user.id);
        const match = matches.find(
          (m) =>
            (m.userId1 === input.matchId && m.userId2 === ctx.user.id) ||
            (m.userId2 === input.matchId && m.userId1 === ctx.user.id)
        );

        if (!match) {
          throw new Error("Match not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { users: usersTable, narratives: narrativesTable } = await import(
          "../drizzle/schema"
        );
        const { eq } = await import("drizzle-orm");

        const matchedUser = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, input.matchId))
          .limit(1);

        const matchedNarrative = await db
          .select()
          .from(narrativesTable)
          .where(eq(narrativesTable.userId, input.matchId))
          .limit(1);

        return {
          match,
          user: matchedUser[0],
          narrative: matchedNarrative[0],
          photos: await getUserProfilePhotos(input.matchId),
        };
      }),
  }),

  // Messaging
  messaging: messagingRouter,

  // Personalised event discovery (AI + web search)
  events: eventsRouter,

  // Pet profiles, preferences and AI compatibility
  pets: petsRouter,

  // Experience surveys, responses and community matching
  experience: experienceRouter,
  roommate: roommateRouter,

  // Profile photos
  photos: router({
    getPhotos: protectedProcedure.query(async ({ ctx }) => {
      return await getUserProfilePhotos(ctx.user.id);
    }),

    uploadPhoto: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          mimeType: z.string(),
          fileData: z.string(), // Base64 encoded
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Decode base64 to buffer
        const buffer = Buffer.from(input.fileData, "base64");

        // Validate file
        const file = new File([buffer], input.fileName, {
          type: input.mimeType,
        });
        const validation = validateImageFile(file);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Upload to storage
        const result = await uploadProfilePhoto(
          ctx.user.id,
          buffer,
          input.mimeType
        );

        return result;
      }),

    addPhoto: protectedProcedure
      .input(
        z.object({
          s3Key: z.string(),
          cdnUrl: z.string().url(),
          isMain: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await addProfilePhoto(
          ctx.user.id,
          input.s3Key,
          input.cdnUrl,
          input.isMain
        );
      }),

    setMainPhoto: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { profilePhotos: profilePhotosTable } = await import(
          "../drizzle/schema"
        );
        const { eq } = await import("drizzle-orm");

        // Clear previous main photo
        await db
          .update(profilePhotosTable)
          .set({ isMain: 0 })
          .where(eq(profilePhotosTable.userId, ctx.user.id));

        // Set new main photo
        await db
          .update(profilePhotosTable)
          .set({ isMain: 1 })
          .where(eq(profilePhotosTable.id, input.photoId));

        return { success: true };
      }),

    deletePhoto: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { profilePhotos: profilePhotosTable } = await import(
          "../drizzle/schema"
        );
        const { eq } = await import("drizzle-orm");

        // Get the photo to verify ownership
        const photo = await db
          .select()
          .from(profilePhotosTable)
          .where(eq(profilePhotosTable.id, input.photoId))
          .limit(1);

        if (!photo[0] || photo[0].userId !== ctx.user.id) {
          throw new Error("Photo not found or unauthorized");
        }

        // Delete from database
        await db
          .delete(profilePhotosTable)
          .where(eq(profilePhotosTable.id, input.photoId));

        return { success: true };
      }),

    reorderPhotos: protectedProcedure
      .input(
        z.object({
          photoIds: z.array(z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { profilePhotos: profilePhotosTable } = await import(
          "../drizzle/schema"
        );
        const { eq } = await import("drizzle-orm");

        // Update display order for each photo
        for (let i = 0; i < input.photoIds.length; i++) {
          await db
            .update(profilePhotosTable)
            .set({ displayOrder: i })
            .where(eq(profilePhotosTable.id, input.photoIds[i]));
        }

        return { success: true };
      }),
  }),
  // Onboarding — gender & attraction preferences
  onboarding: router({
    save: protectedProcedure
      .input(z.object({
        gender: z.enum(["man", "woman", "non_binary", "other"]),
        interestedIn: z.array(z.enum(["men", "women", "non_binary", "everyone"])).min(1),
        dateOfBirth: z.string(), // ISO date string
        bio: z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(usersTable).set({
          gender: input.gender,
          interestedIn: JSON.stringify(input.interestedIn),
          dateOfBirth: new Date(input.dateOfBirth),
          bio: input.bio ?? null,
          onboardingComplete: 1,
        }).where(eq(usersTable.id, ctx.user.id));
        return { success: true };
      }),

    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { complete: false };
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [u] = await db.select({
        onboardingComplete: usersTable.onboardingComplete,
        gender: usersTable.gender,
        interestedIn: usersTable.interestedIn,
      }).from(usersTable).where(eq(usersTable.id, ctx.user.id)).limit(1);
      return {
        complete: (u?.onboardingComplete ?? 0) === 1,
        gender: u?.gender ?? null,
        interestedIn: u?.interestedIn ? JSON.parse(u.interestedIn) : [],
      };
    }),
  }),

  // Connection requests — request, poke, accept/reject
  connections: router({
    request: protectedProcedure
      .input(z.object({ receiverId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { connectionRequests } = await import("../drizzle/schema");
        await db.insert(connectionRequests).values({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          status: "pending",
        });
        return { success: true };
      }),

    poke: protectedProcedure
      .input(z.object({ receiverId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { connectionRequests } = await import("../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        const [existing] = await db.select().from(connectionRequests)
          .where(and(eq(connectionRequests.senderId, ctx.user.id), eq(connectionRequests.receiverId, input.receiverId)))
          .limit(1);
        if (!existing) throw new Error("No pending request found");
        if (existing.status !== "pending") throw new Error("Request is no longer pending");
        if (existing.pokeCount >= 2) throw new Error("Maximum pokes reached (2)");
        await db.update(connectionRequests).set({
          pokeCount: existing.pokeCount + 1,
          lastPokedAt: new Date(),
        }).where(eq(connectionRequests.id, existing.id));
        return { pokeCount: existing.pokeCount + 1 };
      }),

    respond: protectedProcedure
      .input(z.object({ senderId: z.number(), accept: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { connectionRequests } = await import("../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        await db.update(connectionRequests).set({
          status: input.accept ? "accepted" : "rejected",
          respondedAt: new Date(),
        }).where(and(
          eq(connectionRequests.senderId, input.senderId),
          eq(connectionRequests.receiverId, ctx.user.id)
        ));
        return { success: true };
      }),

    getIncoming: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { connectionRequests, users: usersTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return await db.select({
        id: connectionRequests.id,
        senderId: connectionRequests.senderId,
        senderName: usersTable.name,
        pokeCount: connectionRequests.pokeCount,
        createdAt: connectionRequests.createdAt,
      }).from(connectionRequests)
        .innerJoin(usersTable, eq(usersTable.id, connectionRequests.senderId))
        .where(eq(connectionRequests.receiverId, ctx.user.id));
    }),

    getMyRequests: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { connectionRequests } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return await db.select().from(connectionRequests)
        .where(eq(connectionRequests.senderId, ctx.user.id));
    }),
  }),

  // Social media links
  social: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [u] = await db.select({
        socialX:           usersTable.socialX,
        socialInstagram:   usersTable.socialInstagram,
        socialLinkedin:    usersTable.socialLinkedin,
        socialFacebook:    usersTable.socialFacebook,
        socialVisibility:  usersTable.socialVisibility,
      }).from(usersTable).where(eq(usersTable.id, ctx.user.id)).limit(1);
      return u ?? null;
    }),

    save: protectedProcedure
      .input(z.object({
        socialX:           z.string().max(100).optional(),
        socialInstagram:   z.string().max(100).optional(),
        socialLinkedin:    z.string().max(200).optional(),
        socialFacebook:    z.string().max(200).optional(),
        socialVisibility:  z.enum(["connected_only", "everyone"]).default("connected_only"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        // Strip @ prefix and full URLs — store handles only
        const clean = (v?: string) =>
          v?.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter|instagram|linkedin|facebook)\.com\//i, "").replace(/\/$/, "") || null;

        await db.update(usersTable).set({
          socialX:          clean(input.socialX),
          socialInstagram:  clean(input.socialInstagram),
          socialLinkedin:   clean(input.socialLinkedin),
          socialFacebook:   clean(input.socialFacebook),
          socialVisibility: input.socialVisibility,
        }).where(eq(usersTable.id, ctx.user.id));

        return { success: true };
      }),

    // Get another user's social links — respects their visibility setting
    getForUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;
        const { users: usersTable, connectionRequests } = await import("../drizzle/schema");
        const { eq, and, or } = await import("drizzle-orm");

        const [target] = await db.select({
          socialX:          usersTable.socialX,
          socialInstagram:  usersTable.socialInstagram,
          socialLinkedin:   usersTable.socialLinkedin,
          socialFacebook:   usersTable.socialFacebook,
          socialVisibility: usersTable.socialVisibility,
        }).from(usersTable).where(eq(usersTable.id, input.userId)).limit(1);

        if (!target) return null;

        // Always visible if set to everyone
        if (target.socialVisibility === "everyone") return target;

        // Otherwise only show if they are connected (accepted request either direction)
        const [conn] = await db.select({ id: connectionRequests.id })
          .from(connectionRequests)
          .where(and(
            eq(connectionRequests.status, "accepted"),
            or(
              and(eq(connectionRequests.senderId, ctx.user.id), eq(connectionRequests.receiverId, input.userId)),
              and(eq(connectionRequests.senderId, input.userId), eq(connectionRequests.receiverId, ctx.user.id))
            )
          )).limit(1);

        return conn ? target : null;
      }),
  }),

  // GPS / Location
  location: router({
    update: protectedProcedure
      .input(z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        maxDistanceKm: z.number().min(1).max(20000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await updateUserLocation(ctx.user.id, input.latitude, input.longitude, input.maxDistanceKm);
      }),

    get: protectedProcedure.query(async ({ ctx }) => {
      return await getUserLocation(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
