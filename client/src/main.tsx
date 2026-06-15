import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// After a redeploy, a returning visitor may still have an old index.html cached
// that references hashed chunks which no longer exist, so lazy imports 404. Vite
// fires `vite:preloadError`; reload once to pick up the fresh build. GitHub Pages
// serves index.html with `max-age=600`, so a plain reload would just re-serve the
// stale HTML — we reload with a cache-busting query param to force a fresh fetch.
// A sessionStorage guard prevents an infinite loop if a chunk is genuinely gone.
const RELOAD_KEY = "preload-error-reloaded-at";
const BUST_PARAM = "_r";
window.addEventListener("vite:preloadError", () => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  const url = new URL(window.location.href);
  url.searchParams.set(BUST_PARAM, Date.now().toString());
  window.location.replace(url.toString());
});

// Once the fresh build has loaded, drop the cache-busting param to keep the URL clean.
if (new URL(window.location.href).searchParams.has(BUST_PARAM)) {
  const url = new URL(window.location.href);
  url.searchParams.delete(BUST_PARAM);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

createRoot(document.getElementById("root")!).render(<App />);
