import { QueryClient, timeoutManager } from "@tanstack/react-query";

// Build-time page pre-rendering: let query timers not hold the build open.
if (typeof process !== "undefined" && process.env?.TSS_PRERENDERING === "true") {
  const unref = <T,>(id: T) => {
    (id as { unref?: () => void }).unref?.();
    return id;
  };
  timeoutManager.setTimeoutProvider({
    setTimeout: (cb, ms) => unref(setTimeout(cb, ms)),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (cb, ms) => unref(setInterval(cb, ms)),
    clearInterval: (id) => clearInterval(id),
  });
}
import { createRouter, parseSearchWith, stringifySearchWith } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // defaultOptions ported from the pre-migration src/main.tsx QueryClient
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15 * 60 * 1000, // 15 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        retry: 1, // Reduce retries for faster failures
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Build-time pre-rendering requests "/page/"; preserve avoids a redirect loop there.
    trailingSlash: "preserve",
    defaultPreloadStaleTime: 0,
    // Keep query-string values as plain strings (?guests=1, not ?guests=%221%22)
    parseSearch: parseSearchWith((value) => value),
    stringifySearch: stringifySearchWith((value) =>
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  });

  return router;
};
