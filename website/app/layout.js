import "./globals.css";

const siteUrl = "https://evergreen-water-web.vercel.app";
export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "Evergreen Water | Pure Drinking Water Delivered in Karachi",
  description: "Request 19-litre Evergreen Water bottle delivery in Karachi. Send your delivery request online and our team will confirm area availability, price and delivery.",
  applicationName: "Evergreen Water",
  openGraph: {
    title: "Evergreen Water — Pure Drinking Water",
    description: "19-litre drinking water delivery requests for homes in Karachi.",
    url: siteUrl,
    siteName: "Evergreen Water",
    locale: "en_PK",
    type: "website",
    images: [{ url: "/ew-logo.jpeg", width: 1242, height: 1242, alt: "Evergreen Water EW logo" }],
  },
  twitter: { card: "summary_large_image", title: "Evergreen Water", description: "Pure drinking water delivered to your doorstep in Karachi." },
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
