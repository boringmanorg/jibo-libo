// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Top public pages are identical for every visitor; build them once at publish
    // so visitors skip the server render wait. Never list personalised/private pages.
    pages: [
      "/", "/stays/experience-by-xtsy", "/tours", "/stays/workation", "/tours/destination-wedding-shillong",
      "/stays/best-hostel-in-shillong", "/tours/xtsy-rentals", "/tours/meghalaya-tour-packages", "/guides", "/faq",
    ].map((path) => ({ path, prerender: { outputPath: path === "/" ? "/index.html" : `${path}/index.html` } })),
    prerender: { enabled: true, autoStaticPathsDiscovery: false },
  },
  // CI only: hidden source maps so the bundle report can attribute bytes to modules.
  // Normal (Lovable) builds are unchanged.
  vite: {
    build: {
      sourcemap: process.env.ANALYZE_BUNDLE === "1" ? "hidden" : false,
    },
    // Unique per build: the server page cache keys on it, so a new publish never serves old pages.
    define: { __XTSY_BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  },
});
