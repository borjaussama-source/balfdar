import type { NextConfig } from "next";
const nextConfig: NextConfig = { distDir: ".next-akker", images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] } };
export default nextConfig;

