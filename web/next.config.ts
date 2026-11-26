import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the development badge out of the final black frame during local demos.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
