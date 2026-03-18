// Add to server/db/schema.ts
// (append these exports to your existing schema file)

import {
  mysqlTable, int, varchar, mysqlEnum,
  datetime, boolean, index,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ─── calls ────────────────────────────────────────────────────────────────────

export const calls = mysqlTable('calls', {
  id:          int('id').autoincrement().primaryKey(),
  callerId:    int('caller_id').notNull(),
  calleeId:    int('callee_id').notNull(),
  callType:    mysqlEnum('call_type', ['voice', 'video']).notNull().default('voice'),
  status:      mysqlEnum('status', ['ringing','active','ended','declined','missed','failed'])
                 .notNull().default('ringing'),
  channelName: varchar('channel_name', { length: 128 }).notNull(),
  acceptedAt:  datetime('accepted_at'),
  endedAt:     datetime('ended_at'),
  durationSec: int('duration_sec'),
  createdAt:   datetime('created_at').notNull().default(sql`NOW()`),
  updatedAt:   datetime('updated_at').notNull().default(sql`NOW()`),
}, t => ({
  callerIdx:  index('idx_calls_caller').on(t.callerId),
  calleeIdx:  index('idx_calls_callee').on(t.calleeId),
  statusIdx:  index('idx_calls_status').on(t.status),
  createdIdx: index('idx_calls_created').on(t.createdAt),
}));

// ─── users additions ──────────────────────────────────────────────────────────
// Add these columns to your existing users table definition:
//
//   isPremium:      boolean('is_premium').notNull().default(false),
//   premiumSince:   datetime('premium_since'),
//   expoPushToken:  varchar('expo_push_token', { length: 256 }),
