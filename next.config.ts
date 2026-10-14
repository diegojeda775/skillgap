import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Resume uploads go through a server action; allow up to the 5 MB file limit plus form overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
