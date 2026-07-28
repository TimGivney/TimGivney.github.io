import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Brush, RefreshCw } from "lucide-react";

type PainterlyStyle = 0 | 1 | 2;

const STYLES: { id: PainterlyStyle; label: string }[] = [
  { id: 0, label: "Natural" },
  { id: 1, label: "Painterly" },
  { id: 2, label: "Van Gogh" },
];

export default function HomePainterlyWidget() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [style, setStyle] = useState<PainterlyStyle>(1);

  useEffect(() => {
    const element = mountRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting) return;
        setMounted(true);
        observer.disconnect();
      },
      { rootMargin: "200px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const send = (message: object) => {
    frameRef.current?.contentWindow?.postMessage(
      message,
      window.location.origin
    );
  };

  const selectStyle = (next: PainterlyStyle) => {
    setStyle(next);
    send({ type: "painterly-style", style: next });
  };

  const reseed = () => send({ type: "painterly-reseed" });

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          A world made from code
        </p>
        <span className="text-xs text-gray-400">
          One self-contained HTML file
        </span>
      </div>

      <div
        ref={mountRef}
        className="relative flex-1 overflow-hidden rounded-xl bg-[#081321] ring-1 ring-gray-200"
      >
        {mounted && (
          <iframe
            ref={frameRef}
            src="/painterly/?embed=1"
            title="Painterly World live preview"
            className="h-full min-h-[24rem] w-full border-0"
            loading="lazy"
            onLoad={() => {
              setReady(true);
              send({ type: "painterly-style", style });
            }}
          />
        )}
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Growing a procedural meadow…
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md bg-[#EEF3F9] p-1">
          {STYLES.map(item => (
            <button
              key={item.id}
              type="button"
              disabled={!ready}
              onClick={() => selectStyle(item.id)}
              className="rounded px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
              style={
                style === item.id
                  ? { backgroundColor: "#1B3F6B", color: "white" }
                  : { color: "#1B3F6B" }
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={reseed}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-40"
        >
          <RefreshCw size={14} /> New world
        </button>
        <a
          href="/painterly/"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Painterly World <ArrowUpRight size={15} />
        </a>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
        <Brush size={13} /> Walk an endless procedural meadow — drag to orbit,
        stir the grass, and switch painting styles live.
      </p>
    </div>
  );
}
