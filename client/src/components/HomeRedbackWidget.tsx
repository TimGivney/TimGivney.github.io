import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

export default function HomeRedbackWidget() {
  const spokes = Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2;
    return {
      x: 310 + Math.cos(angle) * 330,
      y: 185 + Math.sin(angle) * 205,
    };
  });

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#050606] shadow-inner">
      <div className="relative h-[22rem] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_44%,#1b2020_0%,#080a0a_48%,#020303_100%)]" />
        <svg
          viewBox="0 0 620 370"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <g fill="none" stroke="rgba(211,230,222,.43)" strokeWidth="1">
            {spokes.map((point, index) => (
              <path
                key={`spoke-${index}`}
                d={`M310 185 L${point.x} ${point.y}`}
              />
            ))}
            {[0.18, 0.32, 0.47, 0.63, 0.8, 1].map(radius => (
              <ellipse
                key={radius}
                cx="310"
                cy="185"
                rx={330 * radius}
                ry={205 * radius}
                opacity={1 - radius * 0.45}
              />
            ))}
          </g>
          <g className="origin-center animate-[pulse_2.4s_ease-in-out_infinite]">
            <path
              d="M430 94 C421 80 410 72 397 65 M431 100 C416 96 401 96 386 100 M432 108 C418 116 407 126 399 139 M445 94 C455 79 466 69 480 63 M447 100 C463 94 478 95 493 101 M446 108 C459 117 469 128 476 143"
              fill="none"
              stroke="#080a0a"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <ellipse cx="439" cy="105" rx="14" ry="19" fill="#080a0a" />
            <ellipse cx="439" cy="88" rx="9" ry="10" fill="#111515" />
            <path
              d="M434 98 Q439 92 444 98 L442 110 Q439 116 436 110Z"
              fill="#e0202d"
            />
          </g>
        </svg>

        <div className="absolute left-4 top-4 rounded-lg border border-red-500/20 bg-black/45 px-3 py-2 backdrop-blur">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-red-400">
            Interactive organism
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-100">
            Redback Webkeeper
          </p>
        </div>

        <p className="absolute inset-x-4 bottom-4 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">
          Tear the silk · watch her repair it · test her patience
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-500">
          Procedural web · reactive spider · permanent damage
        </p>
        <Link
          href="/redback"
          className="inline-flex items-center gap-1 text-sm font-semibold text-red-400 transition hover:text-red-300"
        >
          Enter the web <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
