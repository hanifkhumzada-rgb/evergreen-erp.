import "./globals.css";

export const metadata = {
  title: "Evergreen Water | 19L Home Delivery in Karachi",
  description: "Request 19-litre drinking water delivery from Evergreen Water in Karachi.",
  applicationName: "Evergreen Water",
  openGraph: {
    title: "Evergreen Water | 19L Home Delivery in Karachi",
    description: "Request 19-litre drinking water delivery from Evergreen Water in Karachi.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
