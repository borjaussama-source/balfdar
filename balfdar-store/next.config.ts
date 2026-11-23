import type { NextConfig } from "next";
const backend = (process.env.BALFDAR_API_URL || "http://localhost:3003").replace(/\/$/, "");
const nextConfig: NextConfig = {
  distDir: ".next-akker",
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
    ];
  },
};
export default nextConfig;

