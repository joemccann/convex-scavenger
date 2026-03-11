import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
