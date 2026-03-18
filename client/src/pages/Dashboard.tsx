import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Heart, Zap, Lock, Camera } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { FiLLogo } from "@/components/FiLLogo";
import LocationCapture from "@/components/LocationCapture";

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const narrativeQuery = trpc.narrative.get.useQuery();
  const subscriptionQuery = trpc.subscription.getStatus.useQuery();
  const matchesQuery = trpc.match.getMatches.useQuery({ limit: 50 });
  const photosQuery = trpc.photos.getPhotos.useQuery();

  if (authLoading || narrativeQuery.isLoading || subscriptionQuery.isLoading || photosQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const narrative = narrativeQuery.data;
  const subscription = subscriptionQuery.data;
  const matches = matchesQuery.data || [];
  const photos = photosQuery.data || [];
  const isPremium = subscription?.plan !== "free";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <LocationCapture />
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-6 border border-rose-200">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome, {user?.name || "Friend"}!
          </h1>
          <p className="text-slate-600">
            {narrative?.isPublished
              ? "Your narrative is live. Start discovering matches!"
              : "Let's get started by creating your ideal partner narrative."}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          {/* Narrative Card */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/narrative")}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-rose-500" />
              </div>
              {narrative?.isPublished && (
                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded">
                  Published
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Your Narrative</h3>
            <p className="text-sm text-slate-600 mb-4">
              {narrative
                ? narrative.content.substring(0, 60) + "..."
                : "Create your ideal partner description"}
            </p>
            <Button size="sm" variant="outline" className="w-full">
              {narrative ? "Edit" : "Create"}
            </Button>
          </Card>

          {/* Matches Card */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/matches")}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              {!isPremium && matches.length >= 3 && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded">
                  Limited
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Your Matches</h3>
            <p className="text-sm text-slate-600 mb-4">
              {matches.length > 0
                ? `${matches.length} compatible ${matches.length === 1 ? "match" : "matches"} found`
                : "No matches yet"}
            </p>
            <Button size="sm" variant="outline" className="w-full">
              View Matches
            </Button>
          </Card>

          {/* Photos Card */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/photos")}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Camera className="w-5 h-5 text-purple-500" />
              </div>
              {photos.length > 0 && (
                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded">
                  {photos.length} photos
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Profile Photos</h3>
            <p className="text-sm text-slate-600 mb-4">
              {photos.length > 0
                ? `${photos.length} photo${photos.length === 1 ? "" : "s"} uploaded`
                : "Upload your best photos"}
            </p>
            <Button size="sm" variant="outline" className="w-full">
              {photos.length > 0 ? "Manage" : "Upload"}
            </Button>
          </Card>

          {/* Subscription Card */}
          <Card className={`p-6 hover:shadow-lg transition-shadow cursor-pointer ${!isPremium ? "border-amber-200 bg-amber-50" : ""}`} onClick={() => navigate("/subscription")}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPremium ? "bg-purple-100" : "bg-slate-100"}`}>
                <Lock className={`w-5 h-5 ${isPremium ? "text-purple-500" : "text-slate-500"}`} />
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${isPremium ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"}`}>
                {isPremium ? "Premium" : "Free"}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Subscription</h3>
            <p className="text-sm text-slate-600 mb-4">
              {isPremium
                ? "Unlimited matches and features"
                : "See top 3 matches. Upgrade for unlimited."}
            </p>
            <Button size="sm" variant={isPremium ? "outline" : "default"} className={!isPremium ? "w-full bg-rose-500 hover:bg-rose-600" : "w-full"}>
              {isPremium ? "Manage" : "Upgrade"}
            </Button>
          </Card>
        </div>

        {/* Status Messages */}
        {!narrative?.isPublished && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Next Step:</strong> Create and publish your ideal partner narrative to start getting matches.
            </p>
          </div>
        )}

        {narrative?.isPublished && matches.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-900">
              <strong>No matches yet.</strong> More users are joining every day. Check back soon!
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
