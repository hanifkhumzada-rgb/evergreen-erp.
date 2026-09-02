"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Droplet } from "lucide-react";

// Supabase Auth already rate-limits sign-in attempts server-side (per
// project, not configurable from app code) — this is an additional
// client-side layer: after repeated failures in this browser tab, slow
// further attempts down instead of letting a script hammer the form.
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("signin"); // "signin" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-[#072430] p-5">
      <div className="flex bg-card rounded-3xl overflow-hidden max-w-3xl w-full shadow-2xl">
        <div className="flex-1 bg-gradient-to-br from-navy to-navyLight text-white p-10 hidden sm:flex flex-col justify-between min-w-[240px]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-aqua flex items-center justify-center"><Droplet size={20} /></div>
              <span className="font-display text-lg font-semibold">Evergreen Plus Water</span>
            </div>
            <p className="text-[#AFD3D0] text-sm leading-relaxed mt-6">
              Real login, real database. Every sale, payment, and delivery here is stored in Postgres and visible to your whole team instantly.
            </p>
          </div>
          <div className="font-mono-num text-xs text-[#7FA6A2]">Karachi · Pakistan</div>
        </div>
        <div className="flex-[1.15] p-10">
          {mode === "signin" ? (
            <>
              <h2 className="font-display text-2xl font-semibold mb-1">Sign in</h2>
              <p className="text-sm text-slate mb-6">Use the email and password your admin created for you.</p>
              {resetSuccess && <p className="text-green text-xs mb-3 bg-greenSoft px-3 py-2 rounded-lg">Password updated — sign in with your new password.</p>}
              <form onSubmit={handleLogin}>
                <label className="block mb-3">
                  <span className="text-xs font-semibold text-slate block mb-1">Email</span>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-line text-sm outline-none focus:border-aqua" placeholder="owner@evergreenplus.pk" />
                </label>
                <label className="block mb-2">
                  <span className="text-xs font-semibold text-slate block mb-1">Password</span>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-line text-sm outline-none focus:border-aqua" placeholder="••••••••" />
                </label>
                <button type="button" onClick={() => { setMode("forgot"); setError(""); setResetSent(false); }} className="text-xs text-aqua font-semibold mb-4 inline-block">
                  Forgot password?
                </button>
                {error && <p className="text-coral text-xs mb-3">{isLocked ? `Too many failed attempts. Try again in ${lockCountdown}s.` : error}</p>}
                <button disabled={loading || isLocked} type="submit"
                  className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
                  {isLocked ? `Try again in ${lockCountdown}s` : loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
              <p className="text-xs text-slate mt-4">No account yet? Run <code>npm run seed</code> from the project to create the first Owner login.</p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold mb-1">Reset your password</h2>
              <p className="text-sm text-slate mb-6">Enter your email and we&apos;ll send a link to reset your password.</p>
              {resetSent ? (
                <p className="text-sm bg-greenSoft text-green px-3 py-2.5 rounded-lg">
                  If that email exists in our system, a reset link has been sent. Check your inbox (and spam folder).
                </p>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <label className="block mb-4">
                    <span className="text-xs font-semibold text-slate block mb-1">Email</span>
                    <input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-line text-sm outline-none focus:border-aqua" placeholder="owner@evergreenplus.pk" />
                  </label>
                  {error && <p className="text-coral text-xs mb-3">{error}</p>}
                  <button disabled={loading} type="submit"
                    className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              )}
              <button type="button" onClick={() => { setMode("signin"); setError(""); }} className="text-xs text-aqua font-semibold mt-4 inline-block">
                ← Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
