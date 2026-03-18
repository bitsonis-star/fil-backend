import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Shield, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

const PLATFORMS = [
  {
    key: "socialX" as const,
    label: "X (Twitter)",
    placeholder: "yourhandle",
    prefix: "x.com/",
    urlBase: "https://x.com/",
    color: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "socialInstagram" as const,
    label: "Instagram",
    placeholder: "yourhandle",
    prefix: "instagram.com/",
    urlBase: "https://instagram.com/",
    color: "#e1306c",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    key: "socialLinkedin" as const,
    label: "LinkedIn",
    placeholder: "in/yourname",
    prefix: "linkedin.com/",
    urlBase: "https://linkedin.com/",
    color: "#0a66c2",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    key: "socialFacebook" as const,
    label: "Facebook",
    placeholder: "yourprofile",
    prefix: "facebook.com/",
    urlBase: "https://facebook.com/",
    color: "#1877f2",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
];

export default function Social() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [authLoading, isAuthenticated, navigate]);

  const socialQuery = trpc.social.get.useQuery();
  const saveMutation = trpc.social.save.useMutation();

  const [form, setForm] = useState({
    socialX: "",
    socialInstagram: "",
    socialLinkedin: "",
    socialFacebook: "",
    socialVisibility: "connected_only" as "connected_only" | "everyone",
  });

  // Populate form once data loads
  useEffect(() => {
    if (socialQuery.data) {
      setForm({
        socialX:          socialQuery.data.socialX ?? "",
        socialInstagram:  socialQuery.data.socialInstagram ?? "",
        socialLinkedin:   socialQuery.data.socialLinkedin ?? "",
        socialFacebook:   socialQuery.data.socialFacebook ?? "",
        socialVisibility: socialQuery.data.socialVisibility ?? "connected_only",
      });
    }
  }, [socialQuery.data]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(form);
      toast.success("Social links saved!");
      socialQuery.refetch();
    } catch {
      toast.error("Failed to save social links.");
    }
  };

  const setField = (key: keyof typeof form, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  if (authLoading || socialQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const connectedCount = PLATFORMS.filter(p => form[p.key]).length;

  return (
    <DashboardLayout>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Social Media</h1>
          <p className="text-slate-500 text-sm">
            Link your profiles so connections can find you outside the app.
          </p>
        </div>

        {/* Visibility control */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-800">Who can see your links?</span>
          </div>
          <div className="flex gap-3">
            {[
              { val: "connected_only", icon: <Users className="w-3.5 h-3.5" />, label: "Connections only", sub: "Only people you've connected with" },
              { val: "everyone",       icon: <ExternalLink className="w-3.5 h-3.5" />, label: "Everyone",          sub: "Visible on your discovery card" },
            ].map(opt => (
              <div
                key={opt.val}
                onClick={() => setField("socialVisibility", opt.val as typeof form.socialVisibility)}
                className={`flex-1 rounded-lg border p-3 cursor-pointer transition-all text-sm ${
                  form.socialVisibility === opt.val
                    ? "border-teal-400 bg-teal-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`flex items-center gap-1.5 font-medium mb-0.5 ${form.socialVisibility === opt.val ? "text-teal-700" : "text-slate-700"}`}>
                  {opt.icon}{opt.label}
                </div>
                <div className="text-xs text-slate-400">{opt.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform inputs */}
        <div className="space-y-3">
          {PLATFORMS.map(p => (
            <div key={p.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center">
                {/* Icon badge */}
                <div
                  className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                  style={{ color: p.color }}
                >
                  {p.icon}
                </div>
                {/* Label + input */}
                <div className="flex-1 py-2 pr-3">
                  <div className="text-xs text-slate-400 mb-0.5">{p.label}</div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 whitespace-nowrap">{p.prefix}</span>
                    <input
                      type="text"
                      value={form[p.key]}
                      onChange={e => setField(p.key, e.target.value)}
                      placeholder={p.placeholder}
                      className="flex-1 text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-300 min-w-0"
                    />
                  </div>
                </div>
                {/* Preview link */}
                {form[p.key] && (
                  <a
                    href={`${p.urlBase}${form[p.key]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pr-3 text-slate-300 hover:text-slate-500 transition-colors"
                    title="Preview"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary + save */}
        {connectedCount > 0 && (
          <p className="text-xs text-slate-400">
            {connectedCount} {connectedCount === 1 ? "platform" : "platforms"} linked ·{" "}
            {form.socialVisibility === "connected_only"
              ? "visible to connections only"
              : "visible to everyone on your card"}
          </p>
        )}

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {saveMutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
            : "Save social links"}
        </Button>

        {/* Privacy note */}
        <div className="flex items-start gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
          <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            We store only your handle or username — never your password or private data.
            Links are verified against your own accounts; we never post on your behalf.
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
