import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import {
  RedbackWeb,
  type RedbackMood,
  type RedbackStatus,
} from "@/lib/redback/RedbackWeb";

const INITIAL_STATUS: RedbackStatus = {
  mood: "watching",
  repairs: 0,
  repairLimit: 6,
  openHoles: 0,
};

const MOOD_COPY: Record<RedbackMood, string> = {
  watching: "Watching the web",
  rushing: "Damage detected — rushing over",
  repairing: "Rebuilding silk",
  annoyed: "Getting tired of this",
  "giving-up": "That is enough",
  "gave-up": "Webkeeper offline",
};

export default function Redback() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webRef = useRef<RedbackWeb | null>(null);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [interacted, setInteracted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const previousTitle = document.title;
    document.title = "Redback Webkeeper — Tim Givney";
    const web = new RedbackWeb(canvas, { onStatus: setStatus });
    webRef.current = web;
    const onFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      web.dispose();
      webRef.current = null;
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.title = previousTitle;
    };
  }, []);

  const reset = () => {
    webRef.current?.reset();
    setInteracted(false);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await rootRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  };

  const progress = Math.min(status.repairs / status.repairLimit, 1);
  const exhausted = status.mood === "gave-up" || status.mood === "giving-up";

  return (
    <main
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#030404] text-zinc-100"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        role="button"
        tabIndex={0}
        aria-label="Interactive spider web. Click, tap, or press Enter to tear holes in the silk."
        onKeyDown={event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          webRef.current?.tear(
            window.innerWidth * 0.5,
            window.innerHeight * 0.5
          );
          setInteracted(true);
        }}
        onPointerDown={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          webRef.current?.tear(
            event.clientX - rect.left,
            event.clientY - rect.top
          );
          setInteracted(true);
        }}
        onPointerMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          webRef.current?.setPointer(
            event.clientX - rect.left,
            event.clientY - rect.top,
            true
          );
        }}
        onPointerLeave={() => webRef.current?.setPointer(0, 0, false)}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 backdrop-blur-md transition hover:border-red-500/45 hover:text-white"
            >
              <ArrowLeft size={14} /> Home
            </Link>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-red-400 sm:text-[10px]">
                Latrodectus hasselti
              </p>
              <h1 className="font-mono text-base font-semibold uppercase tracking-[0.16em] text-zinc-100 sm:text-xl">
                Redback Webkeeper
              </h1>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300 backdrop-blur-md transition hover:border-white/30 hover:text-white"
            >
              <RotateCcw size={13} /> Reset
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/35 text-zinc-300 backdrop-blur-md transition hover:border-white/30 hover:text-white"
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </header>

        {!interacted && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-400">
                Disturb the structure
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
                Click or tap the silk to tear a hole. The redback will find the
                damage and try to repair it.
              </p>
              <div className="mx-auto mt-5 h-8 w-px animate-pulse bg-gradient-to-b from-red-500 to-transparent" />
            </div>
          </div>
        )}

        <footer className="flex items-end justify-between gap-4">
          <div
            role="status"
            aria-live="polite"
            className={`max-w-[18rem] rounded-2xl border bg-black/40 p-3 backdrop-blur-md transition-colors sm:max-w-sm sm:p-4 ${
              exhausted ? "border-red-500/35" : "border-white/12"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  exhausted
                    ? "bg-red-500"
                    : status.mood === "repairing"
                      ? "animate-pulse bg-emerald-300"
                      : "bg-zinc-400"
                }`}
              />
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-200">
                {MOOD_COPY[status.mood]}
              </p>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-[width] duration-500 ${
                  exhausted ? "bg-red-500" : "bg-red-400"
                }`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              <span>
                {status.openHoles} open{" "}
                {status.openHoles === 1 ? "tear" : "tears"}
              </span>
              <span>
                patience {status.repairs}/{status.repairLimit}
              </span>
            </div>
          </div>

          <p className="hidden max-w-[15rem] text-right font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-zinc-600 sm:block">
            Australian redback · reactive silk simulation
          </p>
        </footer>
      </div>
    </main>
  );
}
