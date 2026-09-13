"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from "@/lib/rememberMe";
import { User, Lock, Eye, EyeOff, Check, Mail, Droplet, MessageCircleHeart, BarChart3, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function BrandMark({ size = 40 }) {
  return <Image src="/ew-mark.svg" width={size} height={size} alt="Evergreen Water" className="rounded-xl shadow-lg flex-shrink-0" priority unoptimized />;
}

function WaterBottleMotion() {
  return (
    <div className="pointer-events-none absolute right-4 bottom-2 hidden h-44 w-36 md:block" aria-hidden="true">
      <div className="ew-3d-bottle absolute inset-0 [perspective:900px]">
        <div className="ew-bottle-shell absolute left-1/2 top-1/2 h-36 w-24 -translate-x-1/2 -translate-y-1/2 rounded-[42%_42%_34%_34%] border border-white/25 bg-gradient-to-br from-white/20 via-white/5 to-aqua/10 shadow-[inset_10px_0_18px_rgba(255,255,255,.08),inset_-12px_-18px_26px_rgba(0,0,0,.22),0_18px_38px_rgba(0,0,0,.28)] backdrop-blur-sm [transform-style:preserve-3d]">
          <div className="absolute left-1/2 top-[-18px] h-7 w-10 -translate-x-1/2 rounded-t-xl border border-white/20 bg-white/15 shadow-[inset_0_3px_6px_rgba(255,255,255,.12)]" />
          <div className="absolute left-1/2 top-[-23px] h-2.5 w-8 -translate-x-1/2 rounded-full bg-aqua/35 shadow-[0_0_14px_rgba(84,210,190,.35)]" />
          <div className="ew-liquid absolute inset-x-1 bottom-1 h-[58%] overflow-hidden rounded-[38%_38%_30%_30%] bg-gradient-to-t from-[#0CA78F]/55 via-[#4AD6BE]/35 to-[#A9F7E8]/20">
            <div className="ew-liquid-wave absolute -left-5 -top-2 h-7 w-32 rounded-[50%] bg-[#BFF7EC]/35 blur-[1px]" />
            <span className="ew-bubble absolute left-5 bottom-4 h-2 w-2 rounded-full bg-white/55" />
            <span className="ew-bubble ew-bubble-2 absolute right-4 bottom-8 h-1.5 w-1.5 rounded-full bg-white/50" />
            <span className="ew-bubble ew-bubble-3 absolute left-10 bottom-2 h-1 w-1 rounded-full bg-white/45" />
          </div>
          <div className="absolute left-3 top-5 h-20 w-3 rounded-full bg-white/15 blur-[1px]" />
          <div className="absolute right-3 top-8 h-16 w-2 rounded-full bg-aqua/10 blur-[1px]" />
          <Droplet size={28} className="ew-drop absolute left-1/2 top-10 -translate-x-1/2 text-[#B8FFE9] drop-shadow-[0_0_8px_rgba(184,255,233,.45)]" />
        </div>
        <div className="ew-orbit absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aqua/15" />
        <div className="ew-glow absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-aqua/15 blur-2xl" />
      </div>
      <style jsx>{`
        .ew-bottle-shell{animation:ewBottleFloat 5.4s ease-in-out infinite;transform-origin:50% 70%}
        .ew-liquid{animation:ewLiquidTilt 4.6s ease-in-out infinite}
        .ew-liquid-wave{animation:ewWave 3.1s ease-in-out infinite}
        .ew-drop{animation:ewDropFloat 3s ease-in-out infinite}
        .ew-bubble{animation:ewBubble 3.2s ease-in-out infinite}
        .ew-bubble-2{animation-delay:.8s}.ew-bubble-3{animation-delay:1.6s}
        .ew-orbit{animation:ewOrbit 8s linear infinite}.ew-glow{animation:ewGlow 3.8s ease-in-out infinite}
        @keyframes ewBottleFloat{0%,100%{transform:translate(-50%,-50%) rotateY(-7deg) rotateX(2deg) translateY(0)}50%{transform:translate(-50%,-50%) rotateY(8deg) rotateX(-2deg) translateY(-8px)}}
        @keyframes ewLiquidTilt{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(2deg)}}
        @keyframes ewWave{0%,100%{transform:translateX(-8px) rotate(0)}50%{transform:translateX(10px) rotate(4deg)}}
        @keyframes ewDropFloat{0%,100%{transform:translateX(-50%) translateY(0) scale(1)}50%{transform:translateX(-50%) translateY(-6px) scale(1.05)}}
        @keyframes ewBubble{0%{transform:translateY(10px) scale(.75);opacity:.25}55%{opacity:.8}100%{transform:translateY(-36px) scale(1.1);opacity:0}}
        @keyframes ewOrbit{to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes ewGlow{0%,100%{opacity:.45;transform:translate(-50%,-50%) scale(.9)}50%{opacity:.85;transform:translate(-50%,-50%) scale(1.15)}}
        @media (prefers-reduced-motion:reduce){.ew-bottle-shell,.ew-liquid,.ew-liquid-wave,.ew-drop,.ew-bubble,.ew-orbit,.ew-glow{animation:none!important}}
      `}</style>
    </div>
  );
}

const HERO_FEATURES = [
  { icon: BarChart3, text: "Live sales & profit, updated the moment they happen" },
  { icon: Droplet, text: "Every bottle tracked — out, back, and outstanding" },
  { icon: MessageCircleHeart, text: "One-tap WhatsApp reminders for customers" },
  { icon: ShieldCheck, text: "Your data, backed up and role-protected" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [resetSent, setResetSent] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reset") === "success") setResetSuccess(true);
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => setLockCountdown(Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = lockCountdown > 0;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setError("");
    setLoading(true);
    document.cookie = rememberMe
      ? `${REMEMBER_ME_COOKIE}=1; path=/; max-age=${REMEMBER_ME_MAX_AGE}; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`
      : `${REMEMBER_ME_COOKIE}=; path=/; max-age=0`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
        setFailedAttempts(0);
        setError(`Too many failed attempts. Try again in ${LOCKOUT_SECONDS} seconds.`);
      } else setError(error.message);
      return;
    }
    setFailedAttempts(0);
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) supabase.from("audit_logs").insert({ user_id: data.user.id, action: "LOGIN", module: "auth" }).then(() => {}, () => {});
    });
    router.replace("/dashboard");
    router.refresh();
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setResetSent(true);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-navy to-[#052625] p-5 overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-aqua/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-aqua/10 blur-3xl pointer-events-none" />
      <div className="absolute top-5 right-5 z-10"><ThemeToggle className="text-white/80 hover:bg-white/10" /></div>

      <div className="login-card-in flex bg-card rounded-[28px] overflow-hidden max-w-4xl w-full shadow-2xl relative">
        <div className="flex-1 relative bg-gradient-to-br from-navy via-navy to-navyLight text-white p-10 hidden md:flex flex-col justify-between min-w-[300px] overflow-hidden">
          <div className="absolute -right-14 -top-14 w-64 h-64 rounded-full bg-aqua/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-10 bottom-16 w-44 h-44 rounded-full bg-aqua/10 blur-2xl pointer-events-none" />
          <svg className="absolute left-0 right-0 bottom-0 w-full h-24 opacity-[0.08] pointer-events-none" viewBox="0 0 400 100" preserveAspectRatio="none"><path d="M0,50 C60,90 140,10 200,50 C260,90 340,10 400,50 L400,100 L0,100 Z" fill="#FFFFFF" /></svg>
          <WaterBottleMotion />
          <div className="relative">
            <div className="flex items-center gap-2.5"><BrandMark size={44} /><span className="font-display text-xl font-semibold leading-tight">Evergreen Water</span></div>
            <h1 className="font-display text-[1.7rem] leading-tight font-semibold mt-8 max-w-[280px]">Your whole business, in one friendly place.</h1>
            <p className="text-[#AFD3D0] text-sm leading-relaxed mt-3 max-w-[270px]">Real login, real database — every sale, payment, and delivery is stored instantly and visible to your whole team.</p>
            <div className="flex flex-col gap-3 mt-8">
              {HERO_FEATURES.map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><Icon size={14} className="text-aqua" /></span><span className="text-[#D8ECE9] text-xs leading-snug">{text}</span></div>)}
            </div>
          </div>
          <div className="relative font-mono-num text-xs text-[#7FA6A2]">Karachi · Pakistan</div>
        </div>

        <div className="flex-[1.15] p-8 sm:p-12 flex flex-col justify-center">
          <div className="flex md:hidden items-center gap-2.5 mb-7"><BrandMark size={32} /><span className="font-display text-base font-semibold">Evergreen Water</span></div>

          {mode === "signin" ? (
            <>
              <h2 className="font-display text-2xl font-semibold mb-1">Welcome back 👋</h2>
              <p className="text-sm text-slate mb-7">Use the email and password your admin created for you.</p>
              {resetSuccess && <p className="text-green text-xs mb-4 bg-greenSoft px-3 py-2 rounded-lg">Password updated — sign in with your new password.</p>}
              <form onSubmit={handleLogin}>
                <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1.5">Email</span><div className="relative"><User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all" placeholder="owner@yourcompany.com" /></div></label>
                <label className="block mb-2"><span className="text-xs font-semibold text-slate block mb-1.5">Password</span><div className="relative"><Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" /><input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all" placeholder="••••••••" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate hover:text-ink">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
                <div className="flex items-center justify-between mt-3 mb-5"><label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only peer" /><span className="w-[17px] h-[17px] rounded-[5px] border border-line flex items-center justify-center flex-shrink-0 transition-colors peer-checked:bg-aqua peer-checked:border-aqua peer-focus-visible:ring-2 peer-focus-visible:ring-aqua/30">{rememberMe && <Check size={12} className="text-white" strokeWidth={3} />}</span><span className="text-xs text-slate font-medium">Remember me</span></label><button type="button" onClick={() => { setMode("forgot"); setError(""); setResetSent(false); }} className="text-xs text-aqua font-semibold">Forgot password?</button></div>
                {error && <p className="text-coral text-xs mb-3 bg-coralSoft px-3 py-2 rounded-lg">{isLocked ? `Too many failed attempts. Try again in ${lockCountdown}s.` : error}</p>}
                <button disabled={loading || isLocked} type="submit" className="login-btn w-full py-3 rounded-full bg-gradient-to-r from-navy to-navyLight hover:shadow-xl hover:shadow-navy/30 text-white font-bold text-sm disabled:opacity-60 shadow-lg shadow-navy/25 transition-all">{isLocked ? `Try again in ${lockCountdown}s` : loading ? "Signing in…" : "Sign In"}</button>
              </form>
              <div className="mt-7 pt-5 border-t border-line flex items-center justify-between text-[11px] text-slate"><span>Secure business workspace</span><span className="inline-flex items-center gap-1"><ShieldCheck size={12} className="text-aqua"/> Role protected</span></div>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold mb-1">Reset your password</h2>
              <p className="text-sm text-slate mb-7">Enter your email and we&apos;ll send a link to reset your password.</p>
              {resetSent ? <p className="text-sm bg-greenSoft text-green px-3 py-2.5 rounded-lg">If that email exists in our system, a reset link has been sent. Check your inbox (and spam folder).</p> : (
                <form onSubmit={handleForgotPassword}>
                  <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1.5">Email</span><div className="relative"><Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" /><input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all" placeholder="owner@yourcompany.com" /></div></label>
                  {error && <p className="text-coral text-xs mb-3 bg-coralSoft px-3 py-2 rounded-lg">{error}</p>}
                  <button disabled={loading} type="submit" className="login-btn w-full py-3 rounded-full bg-gradient-to-r from-navy to-navyLight hover:shadow-xl hover:shadow-navy/30 text-white font-bold text-sm disabled:opacity-60 shadow-lg shadow-navy/25 transition-all">{loading ? "Sending…" : "Send reset link"}</button>
                </form>
              )}
              <button type="button" onClick={() => { setMode("signin"); setError(""); }} className="text-xs text-aqua font-semibold mt-4 inline-block">← Back to sign in</button>
              <p className="text-center text-[11px] text-slate mt-9">Powered by <span className="font-semibold text-ink">Evergreen Water</span></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
