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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

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
    router.replace("/dashboard");
    router.refresh();
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
          <h2 className="font-display text-2xl font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-slate mb-6">Use the email and password your admin created for you.</p>
          <form onSubmit={handleLogin}>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-line text-sm outline-none focus:border-aqua" placeholder="owner@evergreenplus.pk" />
            </label>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate block mb-1">Password</span>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-line text-sm outline-none focus:border-aqua" placeholder="••••••••" />
            </label>
            {error && <p className="text-coral text-xs mb-3">{isLocked ? `Too many failed attempts. Try again in ${lockCountdown}s.` : error}</p>}
            <button disabled={loading || isLocked} type="submit"
              className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
              {isLocked ? `Try again in ${lockCountdown}s` : loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-xs text-slate mt-4">No account yet? Run <code>npm run seed</code> from the project to create the first Owner login.</p>
        </div>
      </div>
    </div>
  );
}
