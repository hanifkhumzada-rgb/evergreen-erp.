export const metadata = {
  title: "Evergreen Water Customer",
  description: "View your approved Evergreen Water deliveries, bottles, invoices and statements.",
  manifest: "/portal-manifest.json",
  applicationName: "Evergreen Water Customer",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport = { themeColor: "#075E55" };

export default function PortalLayout({ children }) {
  return children;
}
