import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { FiLLogo } from "@/components/FiLLogo";
import { useState } from "react";

// Floating person card shown on landing — same warmth as Discover
function LandingPersonCard({
  initials, bg, text, name, age, score, tagline, themes, isActive
}: {
  initials: string; bg: string; text: string; name: string; age: number;
  score: number; tagline: string; themes: string[]; isActive: boolean;
}) {
  return (
    <div className={`bg-white rounded-3xl overflow-hidden shadow-xl transition-all duration-500 ${isActive ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none absolute"}`}>
      {/* Avatar */}
      <div className={`relative h-44 ${bg} flex items-center justify-center`}>
        <div className={`w-24 h-24 rounded-full bg-white/70 ${text} flex items-center justify-center text-4xl font-bold shadow-lg border-4 border-white/90`}>
          {initials}
        </div>
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-2xl px-3 py-1.5 text-center shadow-sm">
          <div className={`text-base font-bold ${text} leading-none`}>{score}%</div>
          <div className="text-[9px] text-slate-400 leading-tight">match</div>
        </div>
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 text-xs font-semibold text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Online
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-xl font-bold text-slate-900 mb-1">{name}, {age}</h3>
        <p className="text-xs text-slate-400 italic leading-relaxed mb-3">"{tagline}"</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {themes.map((t, i) => {
            const colors = ["bg-teal-50 text-teal-700","bg-pink-50 text-pink-700","bg-blue-50 text-blue-700","bg-amber-50 text-amber-700"];
            return <span key={t} className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors[i % colors.length]}`}>{t}</span>;
          })}
        </div>
        <button className="w-full h-11 rounded-2xl bg-teal-600 text-white text-sm font-semibold flex items-center justify-center gap-2">
          <span>♡</span> Request to connect
        </button>
      </div>
    </div>
  );
}

const DEMO_PEOPLE = [
  { initials:"SA", bg:"bg-teal-100", text:"text-teal-700", name:"Sophia", age:31, score:94, tagline:"Looking for someone who makes ordinary moments feel extraordinary — and doesn't mind muddy paws.", themes:["Deep values","Family-first","Curious minds"] },
  { initials:"LK", bg:"bg-purple-100", text:"text-purple-700", name:"Laura", age:29, score:88, tagline:"I believe every relationship is a shared project — built with intention and laughter.", themes:["Personal growth","Authenticity","Balance"] },
  { initials:"JM", bg:"bg-amber-100", text:"text-amber-700", name:"Jordan", age:34, score:82, tagline:"New to the city — looking for genuine connections with curious, warm people.", themes:["Adventure","Books","Jazz"] },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeCard, setActiveCard] = useState(0);

  if (isAuthenticated && user) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">

      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <FiLLogo size="md" />
          <div className="flex items-center gap-3">
            <a href={getLoginUrl()} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Sign in</a>
            <a href={getLoginUrl()}>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl">
                Start your chapter →
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — two column: words left, live demo right */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Left — words */}
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              For people ready for what comes next
            </div>

            <div className="mb-7">
              <FiLLogo size="lg" />
            </div>

            <p className="text-lg text-slate-500 leading-relaxed mb-8">
              FiL matches you with people who complement who you are — through narratives, not selfies. For romance, friendship, community, or just someone to share the next chapter with.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <a href={getLoginUrl()}>
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white rounded-2xl gap-2 h-13 px-7 text-base w-full sm:w-auto">
                  Begin your chapter <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </div>
            <p className="text-xs text-slate-400">Free · No credit card · 2 minutes</p>

            {/* Social proof inline */}
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["bg-teal-200","bg-purple-200","bg-amber-200","bg-pink-200"].map((c,i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-white`} />
                ))}
              </div>
              <p className="text-xs text-slate-500">
                <strong className="text-slate-700">People across 12 cities</strong> started their new chapter this week
              </p>
            </div>
          </div>

          {/* Right — live card demo */}
          <div className="relative">
            {/* Selector dots */}
            <div className="flex justify-center gap-2 mb-4">
              {DEMO_PEOPLE.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveCard(i)}
                  className={`w-2 h-2 rounded-full transition-all ${activeCard === i ? "bg-teal-600 w-5" : "bg-slate-300"}`}
                />
              ))}
            </div>

            {/* Cards stacked */}
            <div className="relative">
              {DEMO_PEOPLE.map((p, i) => (
                <LandingPersonCard key={p.name} {...p} isActive={i === activeCard} />
              ))}
            </div>

            <p className="text-center text-xs text-slate-400 mt-3">
              Real cards from the app · tap dots to see more
            </p>
          </div>
        </div>
      </section>

      {/* F · i · L */}
      <section className="bg-slate-900 py-14">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-slate-500 text-xs uppercase tracking-widest text-center mb-8">What FiL stands for</p>
          <div className="grid grid-cols-3 gap-px bg-slate-700 rounded-3xl overflow-hidden">
            {[
              { letter:"F", color:"text-white", word:"Full", desc:"A full life — not a half-lived one. You're here because you know that connection, depth, and joy aren't optional extras." },
              { letter:"i", color:"text-teal-400", word:"in", desc:"The lowercase i is you — fully in. Present, intentional, and ready for what comes next." },
              { letter:"L", color:"text-white", word:"Life", desc:"Life in all its dimensions — partnership, friendship, community, adventure. All of it, not just the safe parts." },
            ].map(item => (
              <div key={item.letter} className="bg-slate-900 px-8 py-10">
                <div className={`text-5xl font-bold ${item.color} leading-none mb-3`}>{item.letter}</div>
                <div className="text-sm font-semibold text-white mb-2">{item.word}</div>
                <div className="text-sm text-slate-400 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — warm, benefit-led */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Every chapter needs the right <span className="text-teal-600">cast</span>
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto">FiL isn't just a dating app. It's everything you need to fill your life with people who actually matter.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon:"♡", bg:"bg-teal-50",   border:"border-teal-100", title:"Narratives, not selfies",  desc:"Write what you're looking for in your own words. Our AI reads between the lines and finds who truly fits — not just who looks good." },
            { icon:"☺", bg:"bg-purple-50", border:"border-purple-100", title:"Romance or friendship",    desc:"Tell FiL what your chapter needs. A partner, a dog-walking friend, a community — you choose, we find." },
            { icon:"🐾", bg:"bg-amber-50",  border:"border-amber-100", title:"The whole family matches", desc:"Your pet is part of your story. FiL matches them too — compatibility score, first date suggestions and all." },
            { icon:"⭕", bg:"bg-blue-50",   border:"border-blue-100", title:"Circles",                  desc:"Small groups of 8–20 around shared interests. The first page of a new chapter often starts in a crowd." },
            { icon:"📅", bg:"bg-green-50",  border:"border-green-100", title:"Events built for you",    desc:"Jazz nights, hiking trails, theatre — sourced live from the web each week and matched to your narrative." },
            { icon:"🏳️‍🌈", bg:"bg-pink-50", border:"border-pink-100", title:"Inclusive by design",      desc:"All orientations, all identities. Every new chapter deserves to begin on equal ground, full stop." },
          ].map(f => (
            <div key={f.title} className={`${f.bg} border ${f.border} rounded-3xl p-6 hover:-translate-y-1 transition-transform`}>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote — full width, emotional */}
      <section className="bg-teal-600 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="text-4xl text-white/30 mb-4 font-serif">"</div>
          <blockquote className="text-xl font-semibold text-white leading-relaxed mb-6">
            We matched on values. Our dogs matched on energy. First date was a dog park in Athens.
          </blockquote>
          <cite className="text-teal-200 text-sm not-italic">Sophia & George · matched via FiL</cite>

          <div className="grid grid-cols-4 gap-6 mt-12 pt-10 border-t border-teal-500/50">
            {[
              { n:"94%",  l:"avg match quality" },
              { n:"21+",  l:"community age" },
              { n:"3 min", l:"to first match" },
              { n:"🏳️‍🌈",  l:"fully inclusive" },
            ].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-2xl font-bold text-white">{s.n}</div>
                <div className="text-xs text-teal-200 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="bg-slate-900 rounded-3xl p-14 text-center">
          <div className="inline-flex flex-col items-center leading-none mb-6">
            <span className="text-xs font-normal text-slate-500 uppercase tracking-widest">A new chapter</span>
            <span className="text-5xl font-bold text-teal-400 tracking-tight leading-none mt-1">starts here.</span>
            <span className="text-xs text-slate-600 uppercase tracking-widest mt-2">FiL · Full in Life</span>
          </div>
          <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
            You're not here because something is wrong.<br />You're here because something better is possible.
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" className="bg-teal-600 hover:bg-teal-500 text-white rounded-2xl px-8 h-14 text-base gap-2">
              Begin your chapter <ArrowRight className="w-5 h-5" />
            </Button>
          </a>
          <p className="text-xs text-slate-600 mt-4">Free · No credit card · Cancel any time</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 bg-white">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4 text-xs text-slate-400">
          <FiLLogo size="sm" />
          <span>© 2026 FiL · fil.social · All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
