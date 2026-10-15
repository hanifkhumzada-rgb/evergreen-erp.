"use client";

import { useEffect, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";

export default function PwaInstallButton({ label = "Install App" }) {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) setInstalled(true);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
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
  if (!prompt && !isIos) return null;

  return (
    <span className="inline-flex flex-col items-center gap-2">
      <button type="button" onClick={async () => { if (isIos && !prompt) { setShowIosHelp((value) => !value); return; } await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setPrompt(null); }}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-aqua/30 bg-aquaSoft px-4 py-2.5 text-xs font-bold text-aqua hover:border-aqua">
        <Download size={15}/>{label}
      </button>
      {showIosHelp && <span className="max-w-xs rounded-xl bg-foam px-3 py-2 text-center text-[11px] text-slate">Open in Safari → Share → Add to Home Screen</span>}
    </span>
  );
}
