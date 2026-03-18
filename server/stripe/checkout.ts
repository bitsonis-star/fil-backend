import Stripe from "stripe";
import type { Stripe as StripeType } from "stripe";
import { ENV } from "../_core/env";

const stripe = new Stripe(ENV.stripeSecretKey);

export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  userName: string | null,
  plan: "premium_monthly" | "premium_annual",
  origin: string
) {
  // Map plan to Stripe price ID
  // Note: These price IDs should be configured in your Stripe dashboard
  // For now, we'll use the product/price information from products.ts
  
  const priceMap: Record<string, number> = {
    premium_monthly: 999, // $9.99 in cents
    premium_annual: 9588, // $95.88 in cents
  };

  const price = priceMap[plan];
  if (!price) {
    throw new Error(`Invalid plan: ${plan}`);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: userEmail,
      client_reference_id: userId.toString(),
      metadata: {
        user_id: userId.toString(),
        customer_email: userEmail,
        customer_name: userName || "Unknown",
        plan,
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan === "premium_monthly" ? "Premium Monthly" : "Premium Annual",
              description: "Unlimited matches and premium dating features",
            },
            unit_amount: price,
            recurring: {
              interval: plan === "premium_monthly" ? "month" : "year",
              interval_count: 1,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/subscription?success=true`,
      cancel_url: `${origin}/subscription?canceled=true`,
      allow_promotion_codes: true,
    });

    return session.url;
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    throw error;
  }
}

export async function getCustomerSubscriptions(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });
    return subscriptions.data;
  } catch (error) {
    console.error("Failed to get customer subscriptions:", error);
    throw error;
  }
}

export async function cancelSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    throw error;
  }
}
