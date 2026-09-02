/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Applies to every route. Vercel already redirects HTTP -> HTTPS at
        // the edge for all deployments; HSTS is a complementary header so
        // browsers enforce HTTPS for this origin even before that first
        // redirect. A strict script/style-src CSP is deliberately not
        // included here — this app has no way to verify one against a real
        // browser session in this environment, and a wrong CSP fails
        // closed (blank pages, broken hydration) rather than open, which is
        // worse than not having one; the directives below are the ones
        // that are safe to add without that risk.
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
