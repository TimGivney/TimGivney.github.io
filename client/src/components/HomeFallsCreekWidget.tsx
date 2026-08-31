import { ArrowUpRight } from "lucide-react";

export default function HomeFallsCreekWidget() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#09131f] shadow-inner">
      <a
        href="/falls-creek"
        aria-label="Open the interactive Falls Creek 3D snow map"
        className="group block overflow-hidden bg-[#09131f]"
      >
        <img
          src="/assets/falls-creek-3d-preview.webp"
          alt="Oblique 3D view of the snow-covered Falls Creek alpine terrain and forecast controls"
          loading="lazy"
          className="aspect-[1200/794] w-full object-cover transition duration-500 group-hover:scale-[1.015]"
        />
      </a>

      <div className="flex items-center justify-between gap-3 border-t border-slate-700 px-4 py-3">
        <p className="text-xs text-slate-400">
          Actual 3D terrain · live hourly forecast
        </p>
        <a
          href="/falls-creek"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-cyan-300 transition hover:text-cyan-100"
        >
          Open snow map <ArrowUpRight size={15} />
        </a>
      </div>
    </div>
  );
}
