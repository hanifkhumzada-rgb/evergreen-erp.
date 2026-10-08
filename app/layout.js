import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import Script from "next/script";

export const metadata = {
  title: "Evergreen Water ERP",
  description: "Evergreen Water's digital headquarters",
  manifest: "/manifest.json",
  applicationName: "Evergreen Water ERP",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#073B3A",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Applies the saved Appearance (default: EW Ocean Blue) before first
            paint. The Customer Portal keeps its Evergreen identity: Ocean
            Blue is a staff-workspace theme. */}
        <Script id="evergreen-theme" strategy="beforeInteractive">{`try{var t=localStorage.getItem('ew-theme')||localStorage.getItem('theme')||'blue';if(['light','blue','dark','system'].indexOf(t)<0)t='blue';if(t==='blue'&&location.pathname.indexOf('/portal')===0)t='light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=t}catch(e){}`}</Script>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
