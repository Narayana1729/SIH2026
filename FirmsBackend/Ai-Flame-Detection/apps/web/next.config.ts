import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["globe.gl", "three-globe", "three-conic-polygon-geometry", "kframe", "three"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/weather/:path*",
        destination: `${backendUrl}/weather/:path*`,
      },
      {
        source: "/dispersion/:path*",
        destination: `${backendUrl}/dispersion/:path*`,
      },
      {
        source: "/events/:path*",
        destination: `${backendUrl}/events/:path*`,
      },
      {
        source: "/forests/:path*",
        destination: `${backendUrl}/forests/:path*`,
      },
      {
        source: "/gis/:path*",
        destination: `${backendUrl}/gis/:path*`,
      },
      {
        source: "/inference/:path*",
        destination: `${backendUrl}/inference/:path*`,
      },
      {
        source: "/sources/:path*",
        destination: `${backendUrl}/sources/:path*`,
      },
      {
        source: "/readiness/:path*",
        destination: `${backendUrl}/readiness/:path*`,
      },
      {
        source: "/historical/:path*",
        destination: `${backendUrl}/historical/:path*`,
      },
      {
        source: "/industrial/:path*",
        destination: `${backendUrl}/industrial/:path*`,
      },
      {
        source: "/hazmat/:path*",
        destination: `${backendUrl}/hazmat/:path*`,
      },
      {
        source: "/simulation/:path*",
        destination: `${backendUrl}/simulation/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendUrl}/media/:path*`,
      },
      {
        source: "/layers/:path*",
        destination: `${backendUrl}/layers/:path*`,
      },
      {
        source: "/dossier/:path*",
        destination: `${backendUrl}/dossier/:path*`,
      },
      {
        source: "/detections/:path*",
        destination: `${backendUrl}/detections/:path*`,
      },
      {
        source: "/responders/:path*",
        destination: `${backendUrl}/responders/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${backendUrl}/auth/:path*`,
      },
      {
        source: "/agni/:path*",
        destination: `${backendUrl}/agni/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
      {
        source: "/version",
        destination: `${backendUrl}/version`,
      },
    ];
  },
};

export default nextConfig;
