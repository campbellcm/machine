import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  devIndicators: false,
  async rewrites() {
    return [{ source: "/marketing", destination: "/marketing.html" }];
  },
};
export default config;
