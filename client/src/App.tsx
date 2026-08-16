import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const Cube = lazy(() => import("./pages/Cube"));
const Fractal = lazy(() => import("./pages/Fractal"));
const Fractal3D = lazy(() => import("./pages/Fractal3D"));
const Sky = lazy(() => import("./pages/Sky"));
const Toxic = lazy(() => import("./pages/Toxic"));
const AusEngine = lazy(() => import("./pages/AusEngine"));
const Foundation = lazy(() => import("./pages/Foundation"));
const FallsCreek = lazy(() => import("./pages/FallsCreek"));
const Redback = lazy(() => import("./pages/Redback"));

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/cube"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#0a0c11] font-mono text-sm text-zinc-400">
              Loading Cube Studio…
            </div>
          }
        >
          <Cube />
        </Suspense>
      </Route>
      <Route path={"/fractal"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#05060a] font-mono text-sm text-zinc-400">
              Loading Fractal Lab…
            </div>
          }
        >
          <Fractal />
        </Suspense>
      </Route>
      <Route path={"/fractal3d"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#05060a] font-mono text-sm text-zinc-400">
              Loading Fractal Lab 3D…
            </div>
          }
        >
          <Fractal3D />
        </Suspense>
      </Route>
      <Route path={"/sky"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#05060a] font-mono text-sm text-zinc-400">
              Loading Night Sky…
            </div>
          }
        >
          <Sky />
        </Suspense>
      </Route>
      <Route path={"/toxic"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#05060a] font-mono text-sm text-zinc-400">
              Loading Toxic…
            </div>
          }
        >
          <Toxic />
        </Suspense>
      </Route>
      <Route path={"/ausengine"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#05060a] font-mono text-sm text-zinc-400">
              Loading Aus Engines…
            </div>
          }
        >
          <AusEngine />
        </Suspense>
      </Route>
      <Route path={"/foundation"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#05060a] font-mono text-sm text-zinc-400">
              Loading Foundation Studio…
            </div>
          }
        >
          <Foundation />
        </Suspense>
      </Route>
      <Route path={"/falls-creek"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#0a111a] font-mono text-sm text-slate-400">
              Loading Falls Creek snow map…
            </div>
          }
        >
          <FallsCreek />
        </Suspense>
      </Route>
      <Route path={"/redback"}>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#030404] font-mono text-sm text-zinc-500">
              Spinning the web…
            </div>
          }
        >
          <Redback />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
