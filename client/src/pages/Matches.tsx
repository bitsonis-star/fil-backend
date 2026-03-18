import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, X, Heart, MapPin, Zap, Lock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

const AVATAR_PALETTES = [
  { bg: "bg-teal-100", text: "text-teal-700", grad: "from-teal-100 to-teal-50" },
  { bg: "bg-purple-100", text: "text-purple-700", grad: "from-purple-100 to-purple-50" },
  { bg: "bg-amber-100", text: "text-amber-700", grad: "from-amber-100 to-amber-50" },
  { bg: "bg-pink-100", text: "text-pink-700", grad: "from-pink-100 to-pink-50" },
  { bg: "bg-blue-100", text: "text-blue-700", grad: "from-blue-100 to-blue-50" },
];

const MOODS = ["✨ All", "♡ Romance", "☺ Friends", "🐾 Pet parents", "📍 Near me"];

type MatchWithDetails = {
  id: number;
  matchedUserId: number;
  matchedUserName: string | null;
  matchedUserPhoto: string | null;
  matchedUserNarrativeSnippet: string | null;
  compatibilityScore: number;
  matchReason: string | null;
  socialX?: string | null;
  socialInstagram?: string | null;
};

function PersonCard({
  match,
  index,
  onPass,
  onConnect,
  isPeek,
  onClick,
}: {
  match: MatchWithDetails;
  index: number;
  onPass?: () => void;
  onConnect?: () => void;
  isPeek?: boolean;
  onClick?: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const [pokeCount, setPokeCount] = useState(0);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const palette = AVATAR_PALETTES[index % AVATAR_PALETTES.length];
  const name = match.matchedUserName ?? "Someone";
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  // Parse shared themes from matchReason (stored as JSON)
  let sharedThemes: string[] = [];
  let reasonText = match.matchReason ?? "";
  try {
    const parsed = JSON.parse(match.matchReason ?? "{}");
    sharedThemes = parsed.sharedThemes ?? [];
    reasonText = parsed.reason ?? match.matchReason ?? "";
  } catch { /* plain text fallback */ }

  const themeColors = [
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-pink-50 text-pink-700 border-pink-200",
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-green-50 text-green-700 border-green-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-amber-50 text-amber-700 border-amber-200",
  ];

  if (isPeek) {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-3xl p-4 flex items-center gap-3 cursor-pointer opacity-60 scale-[0.97] hover:opacity-85 hover:scale-[0.99] transition-all shadow-sm mb-3"
      >
        <div className={`w-11 h-11 rounded-full ${palette.bg} ${palette.text} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
          {match.matchedUserPhoto
            ? <img src={match.matchedUserPhoto} className="w-full h-full rounded-full object-cover" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{name}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{match.matchedUserNarrativeSnippet ?? "—"}</div>
        </div>
        <div className={`text-lg font-bold ${palette.text}`}>{match.compatibilityScore}%</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-md mb-4 transition-transform hover:-translate-y-0.5">

      {/* Avatar area */}
      <div className={`relative h-52 bg-gradient-to-br ${palette.grad} flex items-center justify-center`}>
        {match.matchedUserPhoto ? (
          <img src={match.matchedUserPhoto} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className={`w-28 h-28 rounded-full ${palette.bg} ${palette.text} flex items-center justify-center text-5xl font-bold shadow-lg border-4 border-white/80`}>
            {initials}
          </div>
        )}
        {/* Online dot */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold text-green-600 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Online now
        </div>
        {/* Score */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-2xl px-3 py-1.5 shadow-sm text-center">
          <div className={`text-lg font-bold ${palette.text} leading-none`}>{match.compatibilityScore}%</div>
          <div className="text-[10px] text-slate-400 leading-tight">narrative<br />match</div>
        </div>
        {/* Distance */}
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 text-xs text-slate-500 shadow-sm">
          <MapPin className="w-3 h-3" />
          nearby
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Name */}
        <div className="flex items-end justify-between mb-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">{name}</h2>
        </div>

        {/* Tagline — their voice, first */}
        {match.matchedUserNarrativeSnippet && (
          <p className="text-sm text-slate-500 italic leading-relaxed mb-4">
            "{match.matchedUserNarrativeSnippet}"
          </p>
        )}

        {/* Shared themes */}
        {sharedThemes.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">What you have in common</p>
            <div className="flex flex-wrap gap-2">
              {sharedThemes.map((theme, i) => (
                <button
                  key={theme}
                  onClick={() => setOpenThread(openThread === theme ? null : theme)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition-all hover:scale-105 ${themeColors[i % themeColors.length]}`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expanded thread — warm quote reveal */}
        {openThread && reasonText && (
          <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">Why you connect</p>
            <p className="text-sm text-slate-600 leading-relaxed italic">"{reasonText}"</p>
          </div>
        )}

        {/* Conversation starter */}
        {reasonText && (
          <div className="bg-gradient-to-br from-teal-50 to-amber-50 rounded-2xl p-4 mb-5 border border-teal-100/60">
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1.5">✦ Start the conversation</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Based on your narratives — ask about what excites them most about life right now.
            </p>
          </div>
        )}
      </div>

      {/* Poke state */}
      {connected && (
        <div className="mx-5 mb-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">Request sent ✓</p>
            <p className="text-xs text-slate-400 mt-0.5">Waiting for {name} to respond</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className={`w-2 h-2 rounded-full transition-colors ${pokeCount >= 1 ? "bg-teal-500" : "bg-slate-200"}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${pokeCount >= 2 ? "bg-teal-500" : "bg-slate-200"}`} />
            </div>
            <button
              onClick={() => {
                if (pokeCount >= 2) return;
                setPokeCount(p => p + 1);
                toast.success(pokeCount === 0 ? "Poke sent! 👋" : "Last poke sent! 👋");
              }}
              disabled={pokeCount >= 2}
              className="text-xs font-semibold bg-teal-600 text-white px-3 py-1.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pokeCount >= 2 ? "Max reached" : "Poke 👋"}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!connected && (
        <div className="grid grid-cols-[1fr_2fr] gap-3 px-5 pb-5">
          <button
            onClick={onPass}
            className="h-14 rounded-2xl border-[1.5px] border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-400 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setConnected(true); onConnect?.(); }}
            className="h-14 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98]"
          >
            <Heart className="w-4 h-4" />
            Request to connect
          </button>
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeMood, setActiveMood] = useState(0);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [authLoading, isAuthenticated, navigate]);

  const narrativeQuery = trpc.narrative.get.useQuery();
  const matchesQuery = trpc.match.getMatches.useQuery({ limit: 50 });
  const calculateMutation = trpc.match.calculate.useMutation();

  const narrative = narrativeQuery.data;
  const data = matchesQuery.data;
  const allMatches = (data?.matches ?? []).filter(m => !dismissed.has(m.id));
  const totalCount = data?.totalCount ?? 0;
  const isPremium = data?.isPremium ?? false;
  const lockedCount = Math.max(0, totalCount - (data?.matches ?? []).length);

  const [currentIdx, setCurrentIdx] = useState(0);
  const visibleMatch = allMatches[currentIdx];
  const peekMatches = allMatches.slice(currentIdx + 1, currentIdx + 3);

  const handleCalculate = async () => {
    if (!narrative?.isPublished) {
      toast.error("Publish your narrative first");
      navigate("/narrative");
      return;
    }
    try {
      await calculateMutation.mutateAsync({ limit: 50 });
      await matchesQuery.refetch();
      toast.success("New matches found!");
    } catch {
      toast.error("Failed to calculate matches");
    }
  };

  if (authLoading || narrativeQuery.isLoading || matchesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      {/* Full-bleed discover layout — no max-w constraint */}
      <div className="max-w-sm mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Discover</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isPremium ? `${totalCount} people in your chapter` : `Top 3 of ${totalCount} — upgrade for more`}
            </p>
          </div>
          <button
            onClick={handleCalculate}
            disabled={!narrative?.isPublished || calculateMutation.isPending}
            className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 hover:bg-teal-100 transition-colors disabled:opacity-40"
          >
            {calculateMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />}
          </button>
        </div>

        {/* Mood filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
          {MOODS.map((m, i) => (
            <button
              key={m}
              onClick={() => setActiveMood(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeMood === i
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Narrative prompt */}
        {!narrative?.isPublished && (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 mb-5 text-sm text-teal-800">
            <strong>Write your narrative first</strong> — it's how FiL finds people whose chapter complements yours.{" "}
            <button onClick={() => navigate("/narrative")} className="underline font-semibold">Write it now →</button>
          </div>
        )}

        {/* Main card */}
        {visibleMatch ? (
          <>
            <PersonCard
              match={visibleMatch}
              index={currentIdx}
              onPass={() => {
                setDismissed(d => new Set([...d, visibleMatch.id]));
                setCurrentIdx(i => i + 1);
              }}
              onConnect={() => {}}
            />

            {/* Peek cards */}
            {peekMatches.map((m, i) => (
              <PersonCard
                key={m.id}
                match={m}
                index={currentIdx + i + 1}
                isPeek
                onClick={() => setCurrentIdx(currentIdx + i + 1)}
              />
            ))}

            {/* Locked peek cards */}
            {!isPremium && lockedCount > 0 && (
              <div
                className="bg-white rounded-3xl p-4 flex items-center gap-3 opacity-50 scale-[0.97] mb-3 cursor-pointer"
                onClick={() => navigate("/subscription")}
              >
                <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-500">{lockedCount} more waiting</div>
                  <div className="text-xs text-slate-400">Upgrade to unlock</div>
                </div>
                <div className="text-xs font-semibold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">Upgrade →</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🌱</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">You're all caught up</h3>
            <p className="text-sm text-slate-400 mb-6">New people join every day — check back soon or recalculate.</p>
            <button
              onClick={handleCalculate}
              disabled={!narrative?.isPublished || calculateMutation.isPending}
              className="bg-teal-600 text-white px-6 py-3 rounded-2xl text-sm font-semibold disabled:opacity-40"
            >
              Find new matches
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
