import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Zap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

const FREE_FEATURES = [
  { text: "1 narrative", included: true },
  { text: "Top 3 matches visible", included: true },
  { text: "Basic messaging", included: true },
  { text: "Unlimited matches", included: false },
  { text: "Profile photos visible", included: false },
  { text: "Email notifications", included: false },
  { text: "Priority support", included: false },
];

const PREMIUM_FEATURES = [
  { text: "Unlimited narratives", included: true },
  { text: "All matches unlocked", included: true },
  { text: "Full messaging", included: true },
  { text: "Profile photos visible", included: true },
  { text: "Email notifications", included: true },
  { text: "GPS proximity filter", included: true },
  { text: "Priority support", included: true },
];

export default function Subscription() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [authLoading, isAuthenticated, navigate]);

  const subscriptionQuery = trpc.subscription.getStatus.useQuery();
  const checkoutMutation = trpc.subscription.createCheckout.useMutation();
  const subscription = subscriptionQuery.data;
  const isPremium = subscription?.plan !== "free" && subscription?.status === "active";

  // Handle Stripe redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Payment successful! Your Premium plan is now active.");
      subscriptionQuery.refetch();
    }
    if (params.get("canceled") === "true") {
      toast.info("Payment cancelled — you can upgrade any time.");
    }
  }, []);

  if (authLoading || subscriptionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleUpgrade = async (plan: "premium_monthly" | "premium_annual") => {
    try {
      const result = await checkoutMutation.mutateAsync({ plan });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      toast.error("Failed to start checkout. Please try again.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Subscription Plans</h1>
          <p className="text-slate-500 text-sm">
            {isPremium ? "You're on Premium — enjoy unlimited matches!" : "Upgrade to unlock your full potential on FiL."}
          </p>
        </div>

        {isPremium && subscription && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Active Premium Subscription</p>
              <p className="text-sm text-green-700">
                {subscription.plan === "premium_monthly" ? "Monthly" : "Annual"} plan
                {subscription.currentPeriodEnd && ` · renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {/* Free */}
          <div className={`rounded-xl border p-6 ${!isPremium ? "border-rose-200 ring-2 ring-rose-100" : "border-slate-200"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Free</p>
            <p className="text-3xl font-bold text-slate-900 mb-1">£0 <span className="text-base font-normal text-slate-400">/ month</span></p>
            <p className="text-sm text-slate-500 mb-5">Get started with the basics</p>
            <ul className="space-y-2 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-2 text-sm">
                  <span className={f.included ? "text-green-500" : "text-slate-300"}>
                    {f.included ? "✓" : "×"}
                  </span>
                  <span className={f.included ? "text-slate-700" : "text-slate-400"}>{f.text}</span>
                </li>
              ))}
            </ul>
            {!isPremium && (
              <div className="w-full text-center text-sm text-slate-400 py-2 border border-slate-200 rounded-lg">Current plan</div>
            )}
          </div>

          {/* Premium */}
          <div className="rounded-xl border-2 border-rose-400 p-6 relative bg-white">
            <span className="absolute -top-3 left-5 bg-rose-500 text-white text-xs font-semibold px-3 py-1 rounded-full">Most popular</span>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-3">Premium</p>
            <div className="flex items-baseline gap-3 mb-1">
              <p className="text-3xl font-bold text-slate-900">£9.99 <span className="text-base font-normal text-slate-400">/ month</span></p>
            </div>
            <p className="text-sm text-slate-400 mb-5">or £79.99/year (save 33%)</p>
            <ul className="space-y-2 mb-6">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-2 text-sm">
                  <span className="text-green-500">✓</span>
                  <span className="text-slate-700">{f.text}</span>
                </li>
              ))}
            </ul>
            {!isPremium ? (
              <div className="space-y-2">
                <Button
                  onClick={() => handleUpgrade("premium_monthly")}
                  disabled={checkoutMutation.isPending}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                >
                  {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Upgrade Monthly — £9.99
                </Button>
                <Button
                  onClick={() => handleUpgrade("premium_annual")}
                  disabled={checkoutMutation.isPending}
                  variant="outline"
                  className="w-full border-rose-300 text-rose-600 hover:bg-rose-50"
                >
                  Upgrade Annually — £79.99
                </Button>
              </div>
            ) : (
              <div className="w-full text-center text-sm text-green-600 font-medium py-2 bg-green-50 border border-green-200 rounded-lg">
                ✓ Active plan
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">Secure payments via Stripe · Cancel any time · No hidden fees</p>
      </div>
    </DashboardLayout>
  );
}
