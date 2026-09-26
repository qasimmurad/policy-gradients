import path from "node:path";

import type { NextConfig } from "next";

// Where the site is served from. Empty for Vercel and local development, and
// "/<repo>" for a GitHub Pages project site, injected by the deploy workflow.
// Next applies this to next/link and to the _next asset URLs on its own.
// assetPrefix is deliberately not set: the Next docs recommend against it for
// sub-path hosting, and setting both would prefix every asset twice.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),

  // Static export. `next build` writes plain HTML, CSS and JS to `out/`, so the
  // deploy needs no server and no database. Everything the pages show is read
  // from `public/data` and `content` while the site is being built.
  output: "export",

  // A static host cannot run the image optimiser, so images are served as they are.
  images: { unoptimized: true },

  // Pin the workspace root. Without this Turbopack walks up the filesystem
  // looking for a lockfile and can latch onto an unrelated one in the home
  // directory, which makes builds depend on whatever else is on the machine.
  turbopack: { root: path.resolve(__dirname) },

  // Each route becomes a folder with an index.html inside it, which is the
  // arrangement static hosts handle most predictably.
  trailingSlash: true,
};

export default nextConfig;
