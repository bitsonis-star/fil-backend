/**
 * FiL Logo — Option C visual, new brand meaning
 * "A" whispers above · "new chapter" bold teal below · "FiL · tagline" micro
 * F = Full · i = in · L = Life
 * Tagline: "A new chapter starts here."
 */
export function FiLLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { top: "text-[9px]",  main: "text-[15px]", micro: "text-[8px]"  },
    md: { top: "text-[11px]", main: "text-[22px]",  micro: "text-[9px]"  },
    lg: { top: "text-sm",     main: "text-[38px]",  micro: "text-[10px]" },
  };
  const s = sizes[size];
  return (
    <div className="flex flex-col leading-none select-none">
      <span className={`${s.top} font-normal text-slate-400 uppercase tracking-[.07em]`}>
        A new chapter
      </span>
      <span className={`${s.main} font-bold text-teal-600 tracking-tight leading-[1]`}>
        starts here.
      </span>
      <span className={`${s.micro} text-slate-400 tracking-[.05em] uppercase mt-[3px]`}>
        FiL · Full in Life
      </span>
    </div>
  );
}
