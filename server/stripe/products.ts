/**
 * Stripe Products and Pricing Configuration
 * These are the subscription plans available to users
 */

export const STRIPE_PRODUCTS = {
  PREMIUM_MONTHLY: {
    name: "Premium Monthly",
    description: "Unlimited matches and premium features",
    price: 999, // $9.99 in cents
    interval: "month" as const,
    currency: "usd",
  },
  PREMIUM_ANNUAL: {
    name: "Premium Annual",
    description: "Unlimited matches and premium features - Save 20%",
    price: 9588, // $95.88 in cents (20% discount from monthly)
    interval: "year" as const,
    currency: "usd",
  },
};

export const PLAN_FEATURES = {
  free: {
    name: "Free",
    price: 0,
    features: [
      "Create your narrative",
      "AI refinement suggestions",
      "Top 3 matches",
      "Profile photos",
    ],
  },
  premium_monthly: {
    name: "Premium Monthly",
    price: 9.99,
    features: [
      "Unlimited matches",
      "See all match details",
      "Priority notifications",
      "Advanced filtering",
      "Priority support",
      "Ad-free experience",
    ],
  },
  premium_annual: {
    name: "Premium Annual",
    price: 95.88,
    features: [
      "Unlimited matches",
      "See all match details",
      "Priority notifications",
      "Advanced filtering",
      "Priority support",
      "Ad-free experience",
    ],
  },
};
