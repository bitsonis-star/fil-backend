import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lightbulb, Check, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Narrative() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const narrativeQuery = trpc.narrative.get.useQuery();
  const saveMutation = trpc.narrative.save.useMutation();
  const suggestMutation = trpc.narrative.getSuggestions.useMutation();
  

  // Load existing narrative
  useEffect(() => {
    if (narrativeQuery.data) {
      setContent(narrativeQuery.data.content);
      setIsPublished(narrativeQuery.data.isPublished === 1);
      if (narrativeQuery.data.refinementSuggestions) {
        try {
          setSuggestions(JSON.parse(narrativeQuery.data.refinementSuggestions));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [narrativeQuery.data]);

  const handleSave = async () => {
    if (content.length < 10) {
      toast.error("Narrative must be at least 10 characters");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        content,
        isPublished,
      });
      toast.success(isPublished ? "Narrative published!" : "Narrative saved!");
    } catch (error) {
      toast.error("Failed to save narrative");
    }
  };

  const handleGetSuggestions = async () => {
    if (content.length < 10) {
      toast.error("Please write at least 10 characters first");
      return;
    }

    try {
      const result = await suggestMutation.mutateAsync({ content });
      setSuggestions(result);
      setShowSuggestions(true);
      toast.success("Suggestions generated!");
    } catch (error) {
      toast.error("Failed to generate suggestions");
    }
  };

  if (authLoading || narrativeQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const charCount = content.length;
  const charLimit = 5000;
  const isValid = charCount >= 10;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Your Ideal Partner Narrative
          </h1>
          <p className="text-slate-600">
            Describe the partner you're looking for in your own words. Be specific, authentic, and thoughtful.
          </p>
        </div>

        {/* Main Editor Card */}
        <Card className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Ideal Partner Description
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share what you're looking for in a partner. Consider their values, personality, interests, life goals, and what makes them special to you..."
              className="min-h-64 resize-none"
              maxLength={charLimit}
            />
            <div className="flex justify-between items-center mt-2 text-sm text-slate-600">
              <span>{charCount} / {charLimit} characters</span>
              {isValid && <span className="text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> Good length</span>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              onClick={handleSave}
              disabled={!isValid || saveMutation.isPending}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {isPublished ? "Update & Publish" : "Save as Draft"}
                </>
              )}
            </Button>

            <Button
              onClick={handleGetSuggestions}
              disabled={!isValid || suggestMutation.isPending}
              variant="outline"
            >
              {suggestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Get AI Suggestions
                </>
              )}
            </Button>

            {isPublished && (
              <div className="ml-auto flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Published</span>
              </div>
            )}
          </div>
        </Card>

        {/* Publish Status */}
        {!isPublished && isValid && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Ready to publish?</p>
              <p className="text-sm text-blue-800 mt-1">
                Click "Save as Draft" to save, then click again to publish your narrative and start getting matches.
              </p>
            </div>
          </div>
        )}

        {/* AI Suggestions Section */}
        {suggestions.length > 0 && (
          <Card className="p-6 space-y-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-slate-900">AI Refinement Suggestions</h3>
            </div>
            <div className="space-y-3">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 text-sm text-slate-700">
                  <span className="font-medium text-amber-700 mr-2">•</span>
                  {suggestion}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 pt-2 border-t border-amber-200">
              Consider these suggestions to make your narrative more compelling and increase your chances of finding compatible matches.
            </p>
          </Card>
        )}

        {/* Tips Section */}
        <Card className="p-6 bg-slate-50 border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">Tips for a Great Narrative</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span><strong>Be specific:</strong> Instead of "kind person," say "someone who volunteers and cares deeply about social justice."</span>
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span><strong>Share values:</strong> Describe what matters most to you in a partner and in life.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span><strong>Be authentic:</strong> Write in your own voice. Authenticity is attractive.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span><strong>Mention interests:</strong> What hobbies and activities would you enjoy together?</span>
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span><strong>Describe chemistry:</strong> What kind of personality or energy attracts you?</span>
            </li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  );
}
