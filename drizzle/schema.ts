import { double, int, mysqlEnum, mysqlTable, tinyint, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // Identity & preferences
  gender: mysqlEnum("gender", ["man", "woman", "non_binary", "other"]),
  interestedIn: text("interestedIn"), // JSON array: ["men","women","non_binary","everyone"]
  dateOfBirth: timestamp("dateOfBirth"),
  bio: text("bio"), // Short tagline shown on discovery cards
  onboardingComplete: tinyint("onboardingComplete").default(0).notNull(),
  // GPS
  latitude: double("latitude"),
  longitude: double("longitude"),
  maxDistanceKm: int("maxDistanceKm").default(50),
  // Social media handles (stored as plain handles/usernames, not full URLs)
  socialX: varchar("socialX", { length: 100 }),           // X / Twitter handle
  socialInstagram: varchar("socialInstagram", { length: 100 }),
  socialLinkedin: varchar("socialLinkedin", { length: 200 }), // LinkedIn vanity URL slug
  socialFacebook: varchar("socialFacebook", { length: 200 }), // Facebook username/slug
  socialVisibility: mysqlEnum("socialVisibility", ["connected_only", "everyone"]).default("connected_only"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User narratives - stores the ideal partner descriptions
 */
export const narratives = mysqlTable("narratives", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(), // The ideal partner narrative
  refinementSuggestions: text("refinementSuggestions"), // JSON array of LLM suggestions
  isPublished: int("isPublished").default(0).notNull(), // 0 = draft, 1 = published
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Narrative = typeof narratives.$inferSelect;
export type InsertNarrative = typeof narratives.$inferInsert;

/**
 * User subscriptions - tracks premium access
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  plan: mysqlEnum("plan", ["free", "premium_monthly", "premium_annual"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "unpaid"]).default("active").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  canceledAt: timestamp("canceledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Profile photos - stores metadata for user profile images
 */
export const profilePhotos = mysqlTable("profilePhotos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  s3Key: varchar("s3Key", { length: 512 }).notNull(), // S3 file key
  cdnUrl: varchar("cdnUrl", { length: 512 }).notNull(), // CDN URL for fast delivery
  displayOrder: int("displayOrder").default(0).notNull(), // For ordering multiple photos
  isMain: int("isMain").default(0).notNull(), // Primary profile photo
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProfilePhoto = typeof profilePhotos.$inferSelect;
export type InsertProfilePhoto = typeof profilePhotos.$inferInsert;

/**
 * Matches - stores compatibility scores between users
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  userId1: int("userId1").notNull().references(() => users.id, { onDelete: "cascade" }),
  userId2: int("userId2").notNull().references(() => users.id, { onDelete: "cascade" }),
  compatibilityScore: int("compatibilityScore").notNull(), // 0-100 score
  matchReason: text("matchReason"), // Summary of why they match
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Profile views - tracks when users view other profiles
 */
export const profileViews = mysqlTable("profileViews", {
  id: int("id").autoincrement().primaryKey(),
  viewerId: int("viewerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewedUserId: int("viewedUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
});

export type ProfileView = typeof profileViews.$inferSelect;
export type InsertProfileView = typeof profileViews.$inferInsert;

/**
 * Notifications - tracks email notifications sent to users
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["new_match", "profile_view", "subscription_update"]).notNull(),
  relatedUserId: int("relatedUserId").references(() => users.id, { onDelete: "set null" }),
  matchId: int("matchId").references(() => matches.id, { onDelete: "set null" }),
  emailSent: int("emailSent").default(0).notNull(),
  emailSentAt: timestamp("emailSentAt"),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Messages - stores direct messages between matched users
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("senderId").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: int("recipientId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(), // Message text
  isRead: int("isRead").default(0).notNull(), // 0 = unread, 1 = read
  readAt: timestamp("readAt"), // When the message was read
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Blocked users - tracks users who have blocked each other
 */
export const blockedUsers = mysqlTable("blockedUsers", {
  id: int("id").autoincrement().primaryKey(),
  blockerId: int("blockerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedUserId: int("blockedUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BlockedUser = typeof blockedUsers.$inferSelect;
export type InsertBlockedUser = typeof blockedUsers.$inferInsert;

/**
 * Connection requests — the gate before messaging is unlocked.
 * Poke count tracks gentle follow-up nudges (max 2).
 * Status = rejected → both parties never see each other again.
 */
export const connectionRequests = mysqlTable("connectionRequests", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("senderId").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: int("receiverId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  pokeCount: tinyint("pokeCount").default(0).notNull(), // max 2
  lastPokedAt: timestamp("lastPokedAt"),
  respondedAt: timestamp("respondedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConnectionRequest = typeof connectionRequests.$inferSelect;
export type InsertConnectionRequest = typeof connectionRequests.$inferInsert;

/**
 * Saved events — events bookmarked by users from their personalised feed.
 */
export const savedEvents = mysqlTable("savedEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventData: text("eventData").notNull(), // JSON blob of DiscoveredEvent
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

export type SavedEvent = typeof savedEvents.$inferSelect;
export type InsertSavedEvent = typeof savedEvents.$inferInsert;

/**
 * Pets — a user can have multiple pets, each with species, breed, and personality tags.
 */
export const pets = mysqlTable("pets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  species: mysqlEnum("species", ["dog", "cat", "rabbit", "bird", "fish", "reptile", "other"]).notNull(),
  breed: varchar("breed", { length: 100 }),
  ageYears: int("ageYears"),
  personalityTags: text("personalityTags"), // JSON string[]
  photoUrl: varchar("photoUrl", { length: 512 }),
  isMain: tinyint("isMain").default(0).notNull(), // Primary pet shown on card
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Pet = typeof pets.$inferSelect;
export type InsertPet = typeof pets.$inferInsert;

/**
 * Pet preferences — what kind of pet situation a user is looking for in a partner.
 */
export const petPreferences = mysqlTable("petPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  // What they want from a partner
  partnerPetPreference: mysqlEnum("partnerPetPreference", ["must_have", "open_to", "no_pets", "no_preference"]).default("no_preference").notNull(),
  // Species they are allergic to or incompatible with (JSON string[])
  incompatibleWith: text("incompatibleWith"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PetPreference = typeof petPreferences.$inferSelect;

/**
 * Survey questions — admin-defined, categorised experience questions.
 * Each question has a set of options stored as JSON.
 */
export const surveyQuestions = mysqlTable("surveyQuestions", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 60 }).notNull(), // e.g. "theatre", "travel", "music", "happiness"
  categoryIcon: varchar("categoryIcon", { length: 10 }),   // emoji
  question: text("question").notNull(),
  subtitle: text("subtitle"),
  options: text("options").notNull(),  // JSON: [{id, icon, label, sublabel, externalUrl?}]
  isActive: tinyint("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SurveyQuestion = typeof surveyQuestions.$inferSelect;

/**
 * Experience responses — what a user answered to each survey question.
 * Each selected option becomes a tag that feeds the experience matching engine.
 */
export const experienceResponses = mysqlTable("experienceResponses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => surveyQuestions.id, { onDelete: "cascade" }),
  selectedOptionIds: text("selectedOptionIds").notNull(), // JSON string[]
  skipped: tinyint("skipped").default(0).notNull(),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export type ExperienceResponse = typeof experienceResponses.$inferSelect;

/** Live events scraped from Athens sources */
export const eventsCatalog = mysqlTable("eventsCatalog", {
  id:            int("id").autoincrement().primaryKey(),
  city:          varchar("city", { length: 60 }).notNull().default("athens"),
  category:      varchar("category", { length: 40 }).notNull(),
  title:         varchar("title", { length: 255 }).notNull(),
  subtitle:      varchar("subtitle", { length: 255 }),
  venue:         varchar("venue", { length: 255 }).notNull(),
  neighbourhood: varchar("neighbourhood", { length: 100 }),
  dateStart:     date("dateStart"),
  dateEnd:       date("dateEnd"),
  ticketUrl:     text("ticketUrl"),
  sourceUrl:     text("sourceUrl").notNull(),
  icon:          varchar("icon", { length: 10 }).default("🎟️"),
  externalId:    varchar("externalId", { length: 255 }).unique(),
  isActive:      tinyint("isActive").notNull().default(1),
  scrapedAt:     timestamp("scrapedAt").defaultNow().notNull(),
});

export type EventCatalogItem = typeof eventsCatalog.$inferSelect;

/** Static venue data refreshed monthly from Google Places */
export const cityVenues = mysqlTable("cityVenues", {
  id:            int("id").autoincrement().primaryKey(),
  city:          varchar("city", { length: 60 }).notNull().default("athens"),
  placeId:       varchar("placeId", { length: 255 }).unique().notNull(),
  name:          varchar("name", { length: 255 }).notNull(),
  category:      varchar("category", { length: 60 }).notNull(),
  icon:          varchar("icon", { length: 10 }),
  neighbourhood: varchar("neighbourhood", { length: 100 }),
  lat:           varchar("lat", { length: 30 }),
  lng:           varchar("lng", { length: 30 }),
  rating:        varchar("rating", { length: 10 }),
  priceLevel:    varchar("priceLevel", { length: 5 }),
  googleMapsUrl: text("googleMapsUrl"),
  website:       text("website"),
  refreshedAt:   timestamp("refreshedAt").defaultNow().notNull(),
});

export type CityVenue = typeof cityVenues.$inferSelect;