import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { connectionRequests, InsertUser, users, narratives, profilePhotos, matches } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get a user's narrative
 */
export async function getUserNarrative(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(narratives)
    .where(eq(narratives.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create or update a user's narrative
 */
export async function upsertNarrative(
  userId: number,
  content: string,
  isPublished: boolean = false,
  refinementSuggestions?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserNarrative(userId);

  if (existing) {
    await db
      .update(narratives)
      .set({
        content,
        isPublished: isPublished ? 1 : 0,
        refinementSuggestions,
        updatedAt: new Date(),
      })
      .where(eq(narratives.id, existing.id));
    return { ...existing, content, isPublished: isPublished ? 1 : 0, refinementSuggestions, updatedAt: new Date() };
  } else {
    await db.insert(narratives).values({
      userId,
      content,
      isPublished: isPublished ? 1 : 0,
      refinementSuggestions,
    });
    const created = await getUserNarrative(userId);
    return created || {
      id: 0,
      userId,
      content,
      isPublished: isPublished ? 1 : 0,
      refinementSuggestions,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

/**
 * Get or create a user's subscription record
 */
export async function getOrCreateSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { subscriptions: subscriptionsTable } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  if (result.length > 0) {
    return result[0];
  }

  // Create default free subscription
  await db.insert(subscriptionsTable).values({
    userId,
    plan: "free",
    status: "active",
  });

  return {
    id: 0,
    userId,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    plan: "free",
    status: "active",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Map interestedIn values ("men","women","non_binary","everyone")
 * to gender column values ("man","woman","non_binary","other")
 */
function gendersWantedBy(interestedIn: string[]): string[] | "everyone" {
  if (interestedIn.includes("everyone")) return "everyone";
  const map: Record<string, string[]> = {
    men:        ["man"],
    women:      ["woman"],
    non_binary: ["non_binary", "other"],
  };
  const result = new Set<string>();
  for (const pref of interestedIn) {
    for (const g of (map[pref] ?? [])) result.add(g);
  }
  return [...result];
}

/**
 * Does person B's interestedIn include person A's gender?
 */
function personBWantsA(bInterestedIn: string[], aGender: string | null): boolean {
  if (!aGender) return true; // no gender set → don't filter out
  if (bInterestedIn.includes("everyone")) return true;
  const map: Record<string, string[]> = {
    men:        ["man"],
    women:      ["woman"],
    non_binary: ["non_binary", "other"],
  };
  return bInterestedIn.some(pref => (map[pref] ?? []).includes(aGender));
}

/**
 * Get published narratives eligible for matching against a given user.
 * Filters:
 *   1. User A is interested in user B's gender
 *   2. User B is interested in user A's gender  (mutual)
 *   3. No existing rejected connection between them
 *   4. No existing match already calculated
 */
export async function getPublishedNarrativesForMatching(
  userId: number,
  limit: number = 100
) {
  const db = await getDb();
  if (!db) return [];

  const {
    narratives: narrativesTable,
    users: usersTable,
    connectionRequests: connectionRequestsTable,
    matches: matchesTable,
  } = await import("../drizzle/schema");
  const { and: andOp, eq: eqOp, ne: neOp, or: orOp } = await import("drizzle-orm");

  // Get current user's gender and preferences
  const [currentUser] = await db
    .select({ gender: usersTable.gender, interestedIn: usersTable.interestedIn })
    .from(usersTable)
    .where(eqOp(usersTable.id, userId))
    .limit(1);

  const myGender: string | null = currentUser?.gender ?? null;
  const myInterestedIn: string[] = currentUser?.interestedIn
    ? JSON.parse(currentUser.interestedIn)
    : [];

  // Genders I am looking for
  const wantedGenders = gendersWantedBy(myInterestedIn);

  // Get all rejected connection IDs (either direction)
  const rejected = await db
    .select({ senderId: connectionRequestsTable.senderId, receiverId: connectionRequestsTable.receiverId })
    .from(connectionRequestsTable)
    .where(
      andOp(
        eqOp(connectionRequestsTable.status, "rejected"),
        orOp(
          eqOp(connectionRequestsTable.senderId, userId),
          eqOp(connectionRequestsTable.receiverId, userId)
        )
      )
    );

  const rejectedUserIds = new Set<number>(
    rejected.flatMap(r =>
      r.senderId === userId ? [r.receiverId] : [r.senderId]
    )
  );

  // Get already-matched user IDs so we don't re-calculate
  const existingMatches = await db
    .select({ userId1: matchesTable.userId1, userId2: matchesTable.userId2 })
    .from(matchesTable)
    .where(
      orOp(
        eqOp(matchesTable.userId1, userId),
        eqOp(matchesTable.userId2, userId)
      )
    );

  const alreadyMatchedIds = new Set<number>(
    existingMatches.flatMap(m =>
      m.userId1 === userId ? [m.userId2] : [m.userId1]
    )
  );

  // Fetch candidates: published narratives + their owner's gender/preferences
  const candidates = await db
    .select({
      narrativeId: narrativesTable.id,
      narrativeUserId: narrativesTable.userId,
      content: narrativesTable.content,
      gender: usersTable.gender,
      interestedIn: usersTable.interestedIn,
    })
    .from(narrativesTable)
    .innerJoin(usersTable, eqOp(usersTable.id, narrativesTable.userId))
    .where(
      andOp(
        eqOp(narrativesTable.isPublished, 1),
        neOp(narrativesTable.userId, userId)
      )
    )
    .limit(limit * 3); // fetch more, we'll filter down

  // Apply mutual attraction filter in JS (flexible, handles edge cases)
  const eligible = candidates.filter(c => {
    // Skip rejected
    if (rejectedUserIds.has(c.narrativeUserId)) return false;
    // Skip already matched
    if (alreadyMatchedIds.has(c.narrativeUserId)) return false;

    // Am I interested in their gender?
    if (wantedGenders !== "everyone" && c.gender) {
      if (!wantedGenders.includes(c.gender)) return false;
    }

    // Are they interested in my gender? (mutual)
    const theirPrefs: string[] = c.interestedIn ? JSON.parse(c.interestedIn) : [];
    if (theirPrefs.length > 0 && myGender) {
      if (!personBWantsA(theirPrefs, myGender)) return false;
    }

    return true;
  });

  return eligible.slice(0, limit).map(c => ({
    id: c.narrativeId,
    userId: c.narrativeUserId,
    content: c.content,
  }));
}

/**
 * Store a match result
 */
export async function createMatch(
  userId1: number,
  userId2: number,
  compatibilityScore: number,
  matchReason?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { matches: matchesTable } = await import("../drizzle/schema");
  return await db.insert(matchesTable).values({
    userId1,
    userId2,
    compatibilityScore,
    matchReason,
  });
}

/**
 * Get matches for a user (basic, no enrichment)
 */
export async function getUserMatches(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  const { matches: matchesTable } = await import("../drizzle/schema");
  return await db
    .select()
    .from(matchesTable)
    .where(
      or(
        eq(matchesTable.userId1, userId),
        eq(matchesTable.userId2, userId)
      )
    )
    .orderBy(desc(matchesTable.compatibilityScore))
    .limit(limit);
}

/**
 * Get matches enriched with matched user's name, main photo, and narrative snippet
 */
export async function getUserMatchesWithDetails(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  const { matches: matchesTable, users: usersTable, profilePhotos: photosTable, narratives: narrativesTable } = await import("../drizzle/schema");

  const rawMatches = await db
    .select()
    .from(matchesTable)
    .where(or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId)))
    .orderBy(desc(matchesTable.compatibilityScore))
    .limit(limit);

  const enriched = await Promise.all(rawMatches.map(async (m) => {
    const matchedUserId = m.userId1 === userId ? m.userId2 : m.userId1;

    const [matchedUser] = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      socialX:          usersTable.socialX,
      socialInstagram:  usersTable.socialInstagram,
      socialLinkedin:   usersTable.socialLinkedin,
      socialFacebook:   usersTable.socialFacebook,
      socialVisibility: usersTable.socialVisibility,
    })
      .from(usersTable).where(eq(usersTable.id, matchedUserId)).limit(1);

    const [mainPhoto] = await db.select({ cdnUrl: photosTable.cdnUrl })
      .from(photosTable)
      .where(and(eq(photosTable.userId, matchedUserId), eq(photosTable.isMain, 1)))
      .limit(1);

    // Fallback to first photo if no main set
    const [firstPhoto] = mainPhoto ? [mainPhoto] : await db.select({ cdnUrl: photosTable.cdnUrl })
      .from(photosTable).where(eq(photosTable.userId, matchedUserId))
      .orderBy(photosTable.displayOrder).limit(1);

    const [narrative] = await db.select({ content: narrativesTable.content })
      .from(narrativesTable).where(eq(narrativesTable.userId, matchedUserId)).limit(1);

    return {
      ...m,
      matchedUserId,
      matchedUserName: matchedUser?.name ?? null,
      matchedUserPhoto: firstPhoto?.cdnUrl ?? null,
      matchedUserNarrativeSnippet: narrative?.content ? narrative.content.slice(0, 120) + "…" : null,
      // Social links — only include if visibility allows
      socialX:          matchedUser?.socialX ?? null,
      socialInstagram:  matchedUser?.socialInstagram ?? null,
      socialLinkedin:   matchedUser?.socialLinkedin ?? null,
      socialFacebook:   matchedUser?.socialFacebook ?? null,
      socialVisibility: matchedUser?.socialVisibility ?? "connected_only",
      // Note: experience overlap is fetched separately via experience.getOverlapWithUser
      // to keep this query fast. The Discover page fetches it lazily per card.
    };
  }));

  return enriched;
}

/**
 * Update a user's GPS location and max distance preference
 */
export async function updateUserLocation(userId: number, latitude: number, longitude: number, maxDistanceKm?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, unknown> = { latitude, longitude };
  if (maxDistanceKm !== undefined) updateData.maxDistanceKm = maxDistanceKm;

  await db.update(users).set(updateData).where(eq(users.id, userId));
  return { success: true };
}

/**
 * Get a user's location preferences
 */
export async function getUserLocation(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({ latitude: users.latitude, longitude: users.longitude, maxDistanceKm: users.maxDistanceKm })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Record a profile view
 */
export async function recordProfileView(viewerId: number, viewedUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { profileViews: profileViewsTable } = await import("../drizzle/schema");
  return await db.insert(profileViewsTable).values({
    viewerId,
    viewedUserId,
  });
}

/**
 * Get profile photos for a user
 */
export async function getUserProfilePhotos(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const { profilePhotos: profilePhotosTable } = await import("../drizzle/schema");
  return await db
    .select()
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, userId))
    .orderBy(profilePhotosTable.displayOrder);
}

/**
 * Add a profile photo
 */
export async function addProfilePhoto(
  userId: number,
  s3Key: string,
  cdnUrl: string,
  isMain: boolean = false
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { profilePhotos: profilePhotosTable } = await import("../drizzle/schema");
  return await db.insert(profilePhotosTable).values({
    userId,
    s3Key,
    cdnUrl,
    isMain: isMain ? 1 : 0,
  });
}


/**
 * Send a message between two users
 */
export async function sendMessage(senderId: number, recipientId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { messages: messagesTable } = await import("../drizzle/schema");
  await db.insert(messagesTable).values({
    senderId,
    recipientId,
    content,
  });
  
  return {
    id: 0,
    senderId,
    recipientId,
    content,
    isRead: 0,
    readAt: null,
    createdAt: new Date(),
  };
}

/**
 * Get messages between two users
 */
export async function getConversation(userId1: number, userId2: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  const { messages: messagesTable } = await import("../drizzle/schema");
  return await db
    .select()
    .from(messagesTable)
    .where(
      or(
        and(eq(messagesTable.senderId, userId1), eq(messagesTable.recipientId, userId2)),
        and(eq(messagesTable.senderId, userId2), eq(messagesTable.recipientId, userId1))
      )
    )
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(messageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { messages: messagesTable } = await import("../drizzle/schema");
  return await db
    .update(messagesTable)
    .set({
      isRead: 1,
      readAt: new Date(),
    })
    .where(eq(messagesTable.id, messageId));
}

/**
 * Get unread message count for a user
 */
export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const { messages: messagesTable } = await import("../drizzle/schema");
  const result = await db
    .select({ count: sql`COUNT(*)` })
    .from(messagesTable)
    .where(and(eq(messagesTable.recipientId, userId), eq(messagesTable.isRead, 0)));

  return result.length > 0 ? 1 : 0;
}

/**
 * Block a user
 */
export async function blockUser(blockerId: number, blockedUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { blockedUsers: blockedUsersTable } = await import("../drizzle/schema");
  return await db.insert(blockedUsersTable).values({
    blockerId,
    blockedUserId,
  });
}

/**
 * Check if a user is blocked
 */
export async function isUserBlocked(blockerId: number, blockedUserId: number) {
  const db = await getDb();
  if (!db) return false;

  const { blockedUsers: blockedUsersTable } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(blockedUsersTable)
    .where(
      and(
        eq(blockedUsersTable.blockerId, blockerId),
        eq(blockedUsersTable.blockedUserId, blockedUserId)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Create a notification
 */
export async function createNotification(
  userId: number,
  type: "new_match" | "profile_view" | "subscription_update",
  relatedUserId?: number,
  matchId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { notifications: notificationsTable } = await import("../drizzle/schema");
  return await db.insert(notificationsTable).values({
    userId,
    type,
    relatedUserId,
    matchId,
  });
}

/**
 * Get recent notifications for a user
 */
export async function getUserNotifications(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const { notifications: notificationsTable } = await import("../drizzle/schema");
  return await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { notifications: notificationsTable } = await import("../drizzle/schema");
  return await db
    .update(notificationsTable)
    .set({ isRead: 1 })
    .where(eq(notificationsTable.id, notificationId));
}
