"use client";

import { useEffect, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";

export default function PwaInstallButton({ label = "Install App" }) {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) setInstalled(true);
    const ready = (event) => { event.preventDefault(); setPrompt(event); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (installed) return <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green"><CheckCircle2 size={14}/>App installed</span>;
  if (!prompt) return null;

  return (
    <button type="button" onClick={async () => { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setPrompt(null); }}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-aqua/30 bg-aquaSoft px-4 py-2.5 text-xs font-bold text-aqua hover:border-aqua">
      <Download size={15}/>{label}
    </button>
  );
}
