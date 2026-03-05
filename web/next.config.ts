import type { NextConfig } from "next";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  outputFileTracingRoot: resolve(__dirname, ".."),
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias["@tools"] = resolve(__dirname, "..", "lib", "tools");
    return config;
  },
};

export default config;
