import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Bookmark, BookmarkCheck, ExternalLink, RefreshCw, Calendar, MapPin, Tag } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import type { DiscoveredEvent } from "../../server/events";

const CATEGORIES = [
  { key: "professional", label: "Professional", color: "bg-teal-50 text-teal-800 border-teal-200", accent: "bg-teal-600" },
  { key: "theatre",      label: "Theatre",      color: "bg-purple-50 text-purple-800 border-purple-200", accent: "bg-purple-600" },
  { key: "cinema",       label: "Cinema",       color: "bg-amber-50 text-amber-800 border-amber-200", accent: "bg-amber-500" },
  { key: "music",        label: "Music",        color: "bg-pink-50 text-pink-800 border-pink-200", accent: "bg-pink-500" },
  { key: "social",       label: "Social",       color: "bg-green-50 text-green-800 border-green-200", accent: "bg-green-600" },
  { key: "sports",       label: "Outdoors",     color: "bg-blue-50 text-blue-800 border-blue-200", accent: "bg-blue-500" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

export default function Events() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [authLoading, isAuthenticated, navigate]);

  const [selectedCats, setSelectedCats] = useState<CategoryKey[]>([...CATEGORIES.map(c => c.key)]);
  const [activeFilter, setActiveFilter] = useState<CategoryKey | "all">("all");
  const [cityOverride, setCityOverride] = useState("");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const eventsQuery = trpc.events.discover.useQuery(
    { categories: selectedCats, city: cityOverride || undefined },
    { enabled: false, staleTime: 1000 * 60 * 15 } // cache 15 min
  );

  const saveMutation = trpc.events.save.useMutation();
  const savedQuery = trpc.events.getSaved.useQuery();

  const handleSearch = () => {
    eventsQuery.refetch();
  };

  const handleSave = async (ev: DiscoveredEvent) => {
    if (savedIds.has(ev.id)) return;
    try {
      await saveMutation.mutateAsync({ event: ev });
      setSavedIds(prev => new Set([...prev, ev.id]));
      toast.success("Event saved!");
    } catch {
      toast.error("Failed to save event.");
    }
  };

  const toggleCat = (cat: CategoryKey) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const allEvents = eventsQuery.data?.events ?? [];
  const filtered = activeFilter === "all" ? allEvents : allEvents.filter(e => e.category === activeFilter);

  const getCatStyle = (cat: string) => CATEGORIES.find(c => c.key === cat);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Events for you</h1>
          <p className="text-slate-500 text-sm">Personalised from your narrative · searches LinkedIn, Eventbrite, Meetup and more</p>
        </div>

        {/* Config */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Your city</label>
            <input
              type="text"
              value={cityOverride}
              onChange={e => setCityOverride(e.target.value)}
              placeholder="Override city (uses profile location by default)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-teal-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => toggleCat(cat.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedCats.includes(cat.key)
                      ? `${cat.color} border-current`
                      : "bg-white text-slate-400 border-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={eventsQuery.isFetching || selectedCats.length === 0}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {eventsQuery.isFetching
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching the web…</>
              : <><RefreshCw className="w-4 h-4" /> {allEvents.length ? "Refresh events" : "Find my events"}</>
            }
          </button>
        </div>

        {/* Search status */}
        {eventsQuery.isFetching && (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-700">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            Searching LinkedIn, Eventbrite, Meetup and local listings…
          </div>
        )}

        {/* Filter chips */}
        {allEvents.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border flex-shrink-0 transition-all ${activeFilter === "all" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-500 border-slate-200"}`}
            >
              All ({allEvents.length})
            </button>
            {CATEGORIES.filter(c => allEvents.some(e => e.category === c.key)).map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveFilter(cat.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex-shrink-0 transition-all ${activeFilter === cat.key ? `${cat.color} border-current` : "bg-white text-slate-500 border-slate-200"}`}
              >
                {cat.label} ({allEvents.filter(e => e.category === cat.key).length})
              </button>
            ))}
          </div>
        )}

        {/* Event cards */}
        <div className="space-y-3">
          {filtered.map(ev => {
            const catStyle = getCatStyle(ev.category);
            const isSaved = savedIds.has(ev.id);
            return (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                <div className="flex">
                  {/* Category accent bar */}
                  <div className={`w-1.5 flex-shrink-0 ${catStyle?.accent ?? "bg-slate-300"}`} />
                  <div className="flex-1 p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug flex-1">{ev.title}</h3>
                      <button
                        onClick={() => handleSave(ev)}
                        className={`flex-shrink-0 transition-colors ${isSaved ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}
                        title="Save event"
                      >
                        {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catStyle?.color}`}>
                        {catStyle?.label ?? ev.category}
                      </span>
                      {ev.date && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {ev.date}{ev.time ? ` · ${ev.time}` : ""}
                        </span>
                      )}
                      {ev.venue && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3 h-3" />
                          {ev.venue}
                        </span>
                      )}
                      {ev.price && (
                        <span className="text-xs text-teal-600 font-medium">{ev.price}</span>
                      )}
                    </div>

                    {/* Description */}
                    {ev.description && (
                      <p className="text-xs text-slate-500 leading-relaxed mb-2">{ev.description}</p>
                    )}

                    {/* Why it matches */}
                    {ev.whyMatch && (
                      <div className="flex items-start gap-2 bg-teal-50 rounded-lg px-3 py-2 text-xs text-slate-600 mb-2">
                        <span className="text-teal-500 mt-0.5 flex-shrink-0">✦</span>
                        <span><span className="font-medium text-teal-700">Why for you:</span> {ev.whyMatch}</span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-300">via {ev.source}</span>
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-teal-600 font-medium hover:underline"
                        >
                          View event <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {!eventsQuery.isFetching && allEvents.length === 0 && !eventsQuery.data && (
          <div className="text-center py-12 text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">Click "Find my events" to discover personalised events near you.</p>
          </div>
        )}

        {eventsQuery.data && filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">No events found for this category.</div>
        )}

        {eventsQuery.isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            Search failed. Check your internet connection and try again.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
