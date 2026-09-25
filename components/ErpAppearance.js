"use client";

import { useEffect, useState } from "react";

const DEFAULT = "#059669";
const ALLOWED = new Set([DEFAULT, "#087F9C", "#2563EB", "#334155"]);

function themeVariables(colour) {
  const safeColour = ALLOWED.has(colour) ? colour : DEFAULT;
  const rgb = [1, 3, 5].map((index) => parseInt(safeColour.slice(index, index + 2), 16));
  const brightness = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  const scale = brightness > 105 ? 105 / brightness : 1;
  const scaled = rgb.map((value) => Math.round(value * scale));

  return {
    "--erp-accent": safeColour === DEFAULT ? DEFAULT : `rgb(${scaled.join(",")})`,
    "--erp-accent-soft": `rgba(${scaled.join(",")},.12)`,
    "--erp-navy": safeColour === DEFAULT ? "#073B3A" : `rgb(${rgb.map((value) => Math.round(value * 0.3)).join(",")})`,
    "--erp-navy-light": safeColour === DEFAULT ? "#0B5552" : `rgb(${scaled.join(",")})`,
  };
}

export default function ErpAppearance({ children }) {
  const [colour, setColour] = useState(DEFAULT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ew-erp-accent");
      setColour(ALLOWED.has(saved) ? saved : DEFAULT);
    } catch {
      setColour(DEFAULT);
    }

    const syncAppearance = (event) => {
      if (event.detail && ALLOWED.has(event.detail)) setColour(event.detail);
    };
    window.addEventListener("ew:appearance-change", syncAppearance);
    return () => window.removeEventListener("ew:appearance-change", syncAppearance);
  }, []);

  return (
    <div className="erp-appearance min-h-screen" style={themeVariables(colour)}>
      {children}
    </div>
  );
}
