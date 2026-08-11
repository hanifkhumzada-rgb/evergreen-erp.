import "./globals.css";

export const metadata = {
  title: "Evergreen Plus Water — ERP",
  description: "Evergreen Plus Water's digital headquarters",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
