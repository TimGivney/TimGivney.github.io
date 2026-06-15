import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// After a redeploy, a returning visitor may still have an old index.html cached
// that references hashed chunks which no longer exist, so lazy imports 404. Vite
// fires `vite:preloadError`; reload once to pick up the fresh build (guarded so a
// genuinely-missing chunk can't cause an infinite reload loop).
const RELOAD_KEY = "preload-error-reloaded-at";
window.addEventListener("vite:preloadError", () => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
