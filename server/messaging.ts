import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { sendMessage, getConversation, markMessageAsRead, getUnreadMessageCount, blockUser, isUserBlocked } from "./db";

export const messagingRouter = router({
  /**
   * Send a message to another user
   */
  sendMessage: protectedProcedure
    .input(z.object({
      recipientId: z.number(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if recipient has blocked the sender
      const isBlocked = await isUserBlocked(input.recipientId, ctx.user.id);
      if (isBlocked) {
        throw new Error("User has blocked you");
      }

      const message = await sendMessage(ctx.user.id, input.recipientId, input.content);
      return message;
    }),

  /**
   * Get conversation between two users
   */
  getConversation: protectedProcedure
    .input(z.object({
      otherUserId: z.number(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const messages = await getConversation(ctx.user.id, input.otherUserId, input.limit);
      return messages;
    }),

  /**
   * Mark a message as read
   */
  markAsRead: protectedProcedure
    .input(z.object({
      messageId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await markMessageAsRead(input.messageId);
      return { success: true };
    }),

  /**
   * Get unread message count
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const count = await getUnreadMessageCount(ctx.user.id);
      return { unreadCount: count };
    }),

  /**
   * Block a user
   */
  blockUser: protectedProcedure
    .input(z.object({
      blockedUserId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await blockUser(ctx.user.id, input.blockedUserId);
      return { success: true };
    }),
});
