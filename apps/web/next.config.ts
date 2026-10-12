import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole product is client-driven (token auth in memory, API fetched in the
  // browser), so route-level Activity preservation / PPR buys nothing here.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
