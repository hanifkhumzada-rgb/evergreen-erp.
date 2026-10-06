"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from "@/lib/rememberMe";
import { User, Lock, Eye, EyeOff, Check, Mail, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";
import PwaInstallButton from "@/components/PwaInstallButton";

// Supabase Auth already rate-limits sign-in attempts server-side (per
// project, not configurable from app code) — this is an additional
// client-side layer: after repeated failures in this browser tab, slow
// further attempts down instead of letting a script hammer the form.
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function BrandMark({ size = 40 }) {
  const [failed, setFailed] = useState(false);
  // Bypass the image optimizer/cache for this tiny bundled asset and keep a
  // bundled SVG fallback, so a stale optimizer response can never leave a
  // broken-image icon on the login screen.
  return <Image src={failed ? "/ew-mark.svg" : "/icon-192.png"} width={size} height={size} alt="Evergreen Water" className="rounded-xl shadow-lg flex-shrink-0" priority unoptimized onError={() => setFailed(true)} />;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("signin"); // "signin" | "forgot"
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

  // Read without useSearchParams() so this page can stay statically
  // prerendered (useSearchParams would force a Suspense boundary here).
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reset") === "success") {
      setResetSuccess(true);
    }
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
    // Persist (or clear) the "remember me" choice as a first-party cookie
    // BEFORE signing in. lib/supabase/client.js's cookie writer reads this
    // synchronously while writing the real session cookies signInWithPassword
    // is about to trigger, and lib/supabase/server.js / middleware.js read
    // the same cookie on every later request — so a token refreshed there
    // keeps the same lifetime instead of silently reverting to session-only.
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
      } else {
        setError(error.message);
      }
      return;
    }
    setFailedAttempts(0);
    // Best-effort audit trail — never blocks the login itself. If RLS on
    // audit_logs doesn't permit a regular user to insert their own login
    // event (unverifiable from this sandbox), this just silently no-ops.
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
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Supabase deliberately doesn't reveal whether the email exists (no
    // error either way for that case) — only show a real error for actual
    // send failures (rate limit, malformed address, SMTP/API issues), never
    // "no account found", so this can't be used to enumerate logins.
    if (error) { setError(error.message); return; }
    setResetSent(true);
  };

  return (
    <div className="ew-login-bg min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-[#073b3a]/55 pointer-events-none" />
      <div className="absolute inset-0 ew-login-pattern pointer-events-none" aria-hidden="true" />
      <div className="absolute top-5 right-5 z-10"><ThemeToggle className="text-white/80 hover:bg-white/10" /></div>

      <main className="login-card-in relative z-[1] w-full max-w-[410px] rounded-[24px] bg-card px-7 py-8 shadow-[0_24px_70px_rgba(2,31,30,.32)] sm:px-10 sm:py-10">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandMark size={54} />
          <p className="mt-3 font-display text-lg font-bold text-ink">Evergreen Water</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.19em] text-slate">Your Business in Your Pocket</p>
        </div>

          {mode === "signin" ? (
            <>
              <h1 className="font-display text-center text-xl font-bold text-ink">Login to your account</h1>
              <p className="mb-7 mt-1.5 text-center text-xs text-slate">Enter your registered email and password</p>
              {resetSuccess && <p className="text-green text-xs mb-4 bg-greenSoft px-3 py-2 rounded-lg">Password updated — sign in with your new password.</p>}
              <form onSubmit={handleLogin}>
                <label className="block mb-4">
                  <span className="text-xs font-semibold text-slate block mb-1.5">Email / Username</span>
                  <div className="relative">
                    <User size={17} className="absolute left-1 top-1/2 -translate-y-1/2 text-aqua pointer-events-none" />
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full border-0 border-b border-line bg-transparent py-2.5 pl-8 pr-2 text-sm outline-none transition-colors focus:border-aqua"
                      placeholder="name@evergreenwater.com"
                    />
                  </div>
                </label>
                <label className="block mb-2">
                  <span className="text-xs font-semibold text-slate block mb-1.5">Password</span>
                  <div className="relative">
                    <Lock size={17} className="absolute left-1 top-1/2 -translate-y-1/2 text-aqua pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full border-0 border-b border-line bg-transparent py-2.5 pl-8 pr-10 text-sm outline-none transition-colors focus:border-aqua"
                      placeholder="••••••••"
                    />
                    <button
                      type="button" onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate hover:text-ink"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between mt-3 mb-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only peer" />
                    <span className="w-[17px] h-[17px] rounded-[5px] border border-line flex items-center justify-center flex-shrink-0 transition-colors peer-checked:bg-aqua peer-checked:border-aqua peer-focus-visible:ring-2 peer-focus-visible:ring-aqua/30">
                      {rememberMe && <Check size={12} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="text-xs text-slate font-medium">Remember me</span>
                  </label>
                  <button type="button" onClick={() => { setMode("forgot"); setError(""); setResetSent(false); }} className="text-xs text-aqua font-semibold">
                    Forgot password?
                  </button>
                </div>

                {error && <p className="text-coral text-xs mb-3 bg-coralSoft px-3 py-2 rounded-lg">{isLocked ? `Too many failed attempts. Try again in ${lockCountdown}s.` : error}</p>}
                <button
                  disabled={loading || isLocked} type="submit"
                  className="login-btn mx-auto block min-w-32 rounded-full bg-gradient-to-r from-navy to-navyLight px-8 py-3 text-sm font-bold text-white shadow-lg shadow-navy/25 transition-all hover:shadow-xl hover:shadow-navy/30 disabled:opacity-60"
                >
                  {isLocked ? `Try again in ${lockCountdown}s` : loading ? "Signing in…" : "Sign In"}
                </button>
              </form>
              <div className="mt-6 flex justify-center"><PwaInstallButton label="Install EW ERP App" /></div>
              <p className="mt-5 text-center text-[12px] text-slate">
                Are you a customer?{' '}
                <a href="/portal/login" className="font-semibold text-aqua transition-colors hover:text-teal-700">
                  Customer Portal
                </a>
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold mb-1">Reset your password</h2>
              <p className="text-sm text-slate mb-7">Enter your email and we&apos;ll send a link to reset your password.</p>
              {resetSent ? (
                <p className="text-sm bg-greenSoft text-green px-3 py-2.5 rounded-lg">
                  If that email exists in our system, a reset link has been sent. Check your inbox (and spam folder).
                </p>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <label className="block mb-4">
                    <span className="text-xs font-semibold text-slate block mb-1.5">Email</span>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
                      <input
                        type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all"
                        placeholder="owner@yourcompany.com"
                      />
                    </div>
                  </label>
                  {error && <p className="text-coral text-xs mb-3 bg-coralSoft px-3 py-2 rounded-lg">{error}</p>}
                  <button
                    disabled={loading} type="submit"
                    className="login-btn w-full py-3 rounded-full bg-gradient-to-r from-navy to-navyLight hover:shadow-xl hover:shadow-navy/30 text-white font-bold text-sm disabled:opacity-60 shadow-lg shadow-navy/25 transition-all"
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              )}
              <button type="button" onClick={() => { setMode("signin"); setError(""); }} className="text-xs text-aqua font-semibold mt-4 inline-block">
                ← Back to sign in
              </button>
            </>
          )}
        <div className="mt-7 border-t border-line pt-5 text-center text-[11px] text-slate">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-aqua"/> Secure &amp; role protected</span>
          <p className="mt-2">Powered by <span className="font-semibold text-ink">Evergreen Water</span></p>
        </div>
      </main>
    </div>
  );
}
