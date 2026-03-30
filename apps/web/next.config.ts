import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

const sentryConfig = {
  // Suppresses source map upload logs during build
  silent: true,
};

export default withSentryConfig(nextConfig, sentryConfig);
