import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
