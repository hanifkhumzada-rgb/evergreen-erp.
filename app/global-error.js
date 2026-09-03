"use client";
import { useEffect } from "react";

// Catches an error thrown by the root layout itself (rare — error.js can't
// catch that, since it lives inside the layout it would need to replace).
// Must render its own <html>/<body>; can't rely on globals.css/Tailwind
// having loaded, so this stays inline-styled and dependency-free.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F4FAF8", color: "#0B1F1D" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #DCEAE6", borderRadius: 16, padding: 32, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 4px 16px rgba(15,32,39,0.08)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: "#5C7D78", marginBottom: 20, lineHeight: 1.5 }}>
              The app hit an unexpected error loading this page. Your data is safe — nothing was lost.
            </p>
            {error?.digest && <p style={{ fontSize: 11, color: "#5C7D78", marginBottom: 20 }}>Reference: {error.digest}</p>}
            <button type="button"
              onClick={() => reset()}
              style={{ padding: "10px 20px", borderRadius: 12, background: "#059669", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
