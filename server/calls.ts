/**
 * server/calls.ts
 *
 * tRPC router for voice/video call signalling.
 * Actual media is handled by Agora.io or Daily.co —
 * this router only stores call metadata and handles notifications.
 *
 * Install:  npm install agora-access-token
 * Docs:     https://docs.agora.io/en/voice-calling/get-started/get-started-sdk
 */

import { z } from 'zod';
import { router, protectedProcedure } from './trpc';
import { db } from './db';
import { calls, users } from './db/schema';
import { eq, and, or, desc } from 'drizzle-orm';

// ─── Agora token generator (swap for Daily.co if preferred) ──────────────────
// import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
// const AGORA_APP_ID  = process.env.AGORA_APP_ID!;
// const AGORA_APP_CERT = process.env.AGORA_APP_CERT!;

function generateChannelName(callerId: number, calleeId: number): string {
  // Deterministic channel name from the two user IDs — same channel for both sides
  return `fil_call_${Math.min(callerId, calleeId)}_${Math.max(callerId, calleeId)}`;
}

// Stub token generation — replace with real Agora call in production
function generateAgoraToken(channelName: string, userId: number): string {
  // RtcTokenBuilder.buildTokenWithUid(AGORA_APP_ID, AGORA_APP_CERT, channelName, userId, RtcRole.PUBLISHER, Math.floor(Date.now()/1000) + 3600)
  return `demo_token_${channelName}_${userId}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const callsRouter = router({

  /**
   * Initiate a call — caller side.
   * Returns a channel name + token for Agora, and creates a pending call record.
   * Sends a push notification to the callee.
   */
  initiate: protectedProcedure
    .input(z.object({
      calleeId: z.number(),
      callType: z.enum(['voice', 'video']),
    }))
    .mutation(async ({ input, ctx }) => {
      const callerId = ctx.user.id;

      // Check callee exists and is premium
      const callee = await db.query.users.findFirst({
        where: eq(users.id, input.calleeId),
      });
      if (!callee) throw new Error('User not found');
      if (!callee.isPremium) throw new Error('CALLEE_NOT_PREMIUM');

      // Check caller is premium
      if (!ctx.user.isPremium) throw new Error('CALLER_NOT_PREMIUM');

      const channelName = generateChannelName(callerId, input.calleeId);
      const token = generateAgoraToken(channelName, callerId);

      // Create call record
      const [call] = await db.insert(calls).values({
        callerId,
        calleeId: input.calleeId,
        callType: input.callType,
        status: 'ringing',
        channelName,
      }).returning();

      // TODO: send push notification to callee via Expo Notifications
      // await sendCallPushNotification({
      //   expoPushToken: callee.expoPushToken,
      //   callerName: ctx.user.name,
      //   callType: input.callType,
      //   callId: call.id,
      //   channelName,
      // });

      return { callId: call.id, channelName, token, appId: process.env.AGORA_APP_ID ?? 'demo' };
    }),

  /**
   * Accept a call — callee side.
   * Returns token for callee to join the same Agora channel.
   */
  accept: protectedProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const call = await db.query.calls.findFirst({
        where: and(eq(calls.id, input.callId), eq(calls.calleeId, ctx.user.id)),
      });
      if (!call) throw new Error('Call not found');
      if (call.status !== 'ringing') throw new Error('Call no longer available');

      await db.update(calls)
        .set({ status: 'active', acceptedAt: new Date() })
        .where(eq(calls.id, input.callId));

      const token = generateAgoraToken(call.channelName, ctx.user.id);
      return { channelName: call.channelName, token, appId: process.env.AGORA_APP_ID ?? 'demo' };
    }),

  /**
   * Accept as voice only — callee converts incoming video call to voice.
   */
  acceptAsVoice: protectedProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(calls)
        .set({ status: 'active', callType: 'voice', acceptedAt: new Date() })
        .where(and(eq(calls.id, input.callId), eq(calls.calleeId, ctx.user.id)));

      const call = await db.query.calls.findFirst({ where: eq(calls.id, input.callId) });
      if (!call) throw new Error('Call not found');

      const token = generateAgoraToken(call.channelName, ctx.user.id);
      return { channelName: call.channelName, token, appId: process.env.AGORA_APP_ID ?? 'demo' };
    }),

  /**
   * Decline a call.
   */
  decline: protectedProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(calls)
        .set({ status: 'declined', endedAt: new Date() })
        .where(and(eq(calls.id, input.callId), eq(calls.calleeId, ctx.user.id)));
      return { ok: true };
    }),

  /**
   * End a call — either side can end it.
   */
  end: protectedProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const call = await db.query.calls.findFirst({
        where: and(
          eq(calls.id, input.callId),
          or(eq(calls.callerId, ctx.user.id), eq(calls.calleeId, ctx.user.id))
        ),
      });
      if (!call) throw new Error('Call not found');

      const durationSec = call.acceptedAt
        ? Math.floor((Date.now() - call.acceptedAt.getTime()) / 1000)
        : 0;

      await db.update(calls)
        .set({ status: 'ended', endedAt: new Date(), durationSec })
        .where(eq(calls.id, input.callId));

      return { durationSec };
    }),

  /**
   * Get call history for a conversation.
   */
  history: protectedProcedure
    .input(z.object({ otherUserId: z.number() }))
    .query(async ({ input, ctx }) => {
      return db.query.calls.findMany({
        where: or(
          and(eq(calls.callerId, ctx.user.id), eq(calls.calleeId, input.otherUserId)),
          and(eq(calls.callerId, input.otherUserId), eq(calls.calleeId, ctx.user.id)),
        ),
        orderBy: [desc(calls.createdAt)],
        limit: 20,
      });
    }),
});
