export const metadata = {
  title: "Evergreen Water Customer",
  description: "Evergreen Water — Pure Drinking Water customer portal.",
  manifest: "/portal-manifest.json",
  applicationName: "Evergreen Water Customer",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/ew-mark.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = { themeColor: "#103B64" };

export default function PortalLayout({ children }) {
  return children;
}
