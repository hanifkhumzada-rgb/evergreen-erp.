export const metadata = {
  title: "Evergreen Water Customer",
  description: "Evergreen Water — Pure Drinking Water customer portal.",
  manifest: "/portal-manifest.json",
  applicationName: "Evergreen Water Customer",
  icons: {
    icon: [
      { url: "/favicon-32.png?v=5", sizes: "32x32", type: "image/png" },
      { url: "/ew-mark.svg?v=5", sizes: "any", type: "image/svg+xml" },
      { url: "/icon-192.png?v=5", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=5", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png?v=5",
  },
};

export const viewport = { themeColor: "#103B64" };

export default function PortalLayout({ children }) {
  return children;
}
