import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    // Run the bank scraper (Puppeteer) in the Node.js runtime, not edge/WASM
    "israeli-bank-scrapers",
    "puppeteer",
    "puppeteer-core",
  ],
};

export default nextConfig;
