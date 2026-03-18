import Stripe from "stripe";
import type { Request, Response } from "express";
import { getDb } from "../db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/**
 * Mount this on POST /webhook/stripe in your Express app.
 * Requires raw body — see server/_core/index.ts for setup.
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  if (!sig || !webhookSecret) {
    console.warn("[Stripe Webhook] Missing signature or secret");
    return res.status(400).send("Webhook configuration error");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  const db = await getDb();
  if (!db) return res.status(500).send("Database unavailable");

  const { subscriptions } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
        const plan = (session.metadata?.plan ?? "premium_monthly") as "premium_monthly" | "premium_annual";
        const stripeSubId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        if (!userId) break;

        // Fetch subscription period from Stripe
        let periodStart: Date | null = null;
        let periodEnd: Date | null = null;
        if (stripeSubId) {
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
          periodStart = new Date(stripeSub.current_period_start * 1000);
          periodEnd = new Date(stripeSub.current_period_end * 1000);
        }

        // Upsert subscription record
        const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
        if (existing.length > 0) {
          await db.update(subscriptions).set({
            plan,
            status: "active",
            stripeCustomerId: customerId,
            stripeSubscriptionId: stripeSubId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            canceledAt: null,
          }).where(eq(subscriptions.userId, userId));
        } else {
          await db.insert(subscriptions).values({
            userId,
            plan,
            status: "active",
            stripeCustomerId: customerId,
            stripeSubscriptionId: stripeSubId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          });
        }
        console.log(`[Stripe Webhook] Activated ${plan} for user ${userId}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const status = sub.status === "active" ? "active"
          : sub.status === "canceled" ? "canceled"
          : sub.status === "past_due" ? "past_due"
          : "unpaid";

        await db.update(subscriptions).set({
          status: status as "active" | "canceled" | "past_due" | "unpaid",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        }).where(eq(subscriptions.stripeCustomerId, customerId));
        console.log(`[Stripe Webhook] Updated subscription status → ${status} for customer ${customerId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        await db.update(subscriptions).set({
          plan: "free",
          status: "canceled",
          canceledAt: new Date(),
          stripeSubscriptionId: null,
        }).where(eq(subscriptions.stripeCustomerId, customerId));
        console.log(`[Stripe Webhook] Subscription canceled for customer ${customerId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? "";
        await db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.stripeCustomerId, customerId));
        console.log(`[Stripe Webhook] Payment failed for customer ${customerId}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return res.status(500).send("Handler error");
  }

  res.json({ received: true });
}
