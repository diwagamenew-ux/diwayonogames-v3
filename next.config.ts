import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't leak the Next.js version in response headers.
  poweredByHeader: false,

  // Tighter compression on the wire (Brotli on Vercel is automatic; this
  // ensures gzip is on for any host that doesn't do Brotli).
  compress: true,

  // Bundle the drizzle SQL migrations folder + uploads dir into every
  // serverless function so runtime migrations + uploads work on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*", "./public/uploads/**/*"],
  },

  // ---- Image Optimization -----------------------------------------------
  // Vercel's edge image optimizer will negotiate AVIF → WebP → original
  // per client, resize to the requested width, and cache the result.
  // `remotePatterns: [{ hostname: "**" }]` allows any HTTPS source — needed
  // because admins paste icons from i.ibb.co / imgur / Supabase Storage /
  // their own CDN into the game / post forms.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days at the edge
    deviceSizes: [420, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 256, 384],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  // ---- Long-term caching for static assets ------------------------------
  // Next already sets immutable cache on /_next/static; this extends it to
  // our own /images, /uploads and /manifest so repeat visits are instant.
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, immutable" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        // Security hardening headers — don't break embedded admin previews.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // Optimize package imports: tree-shake barrel exports from these libs
    // so we don't ship the whole package when we use one function.
    optimizePackageImports: ["drizzle-orm", "jose", "bcryptjs", "lucide-react"],
  },
};

export default nextConfig;
