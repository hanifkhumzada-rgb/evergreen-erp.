"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The email link lands here carrying a recovery token that the Supabase
  // client (detectSessionInUrl, on by default) picks up automatically and
  // turns into a temporary session — signaled by the PASSWORD_RECOVERY
  // auth event. getSession() covers the case where that already happened
  // by the time this effect runs.
  useEffect(() => {
    let settled = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        settled = true;
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      if (data.session) { setReady(true); }
      else {
        // Give the URL-token exchange a moment to complete before giving up.
        setTimeout(() => {
          if (!settled) {
            supabase.auth.getSession().then(({ data: retry }) => {
              if (retry.session) setReady(true);
              else setInvalid(true);
            });
          }
        }, 1500);
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    await supabase.auth.signOut();
    router.replace("/login?reset=success");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-[#052625] p-5">
      <div className="bg-card rounded-[28px] overflow-hidden max-w-md w-full shadow-2xl p-10">
        <div className="flex items-center gap-2.5 mb-7">
          <img src="/icon-192.png" alt="Evergreen Water" className="w-9 h-9 rounded-xl shadow-lg flex-shrink-0" />
          <span className="font-display text-lg font-semibold">Evergreen Water</span>
        </div>

        {invalid ? (
          <>
            <h2 className="font-display text-xl font-semibold mb-1">Link invalid or expired</h2>
            <p className="text-sm text-slate mb-5">This password reset link no longer works. Request a new one from the sign-in page.</p>
            <a href="/login" className="inline-block px-4 py-2.5 rounded-full bg-gradient-to-r from-navy to-navyLight text-white font-bold text-sm shadow-lg shadow-navy/25">Back to sign in</a>
          </>
        ) : !ready ? (
          <>
            <h2 className="font-display text-xl font-semibold mb-1">Checking your link…</h2>
            <p className="text-sm text-slate">One moment.</p>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold mb-1">Set a new password</h2>
            <p className="text-sm text-slate mb-6">Choose a new password for your account.</p>
            <form onSubmit={handleSubmit}>
              <label className="block mb-4">
                <span className="text-xs font-semibold text-slate block mb-1.5">New password</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
                  <input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate hover:text-ink">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="block mb-5">
                <span className="text-xs font-semibold text-slate block mb-1.5">Confirm password</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
                  <input type={showPassword ? "text" : "password"} required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all" placeholder="••••••••" />
                </div>
              </label>
              {error && <p className="text-coral text-xs mb-3 bg-coralSoft px-3 py-2 rounded-lg">{error}</p>}
              <button disabled={loading} type="submit"
                className="w-full py-3 rounded-full bg-gradient-to-r from-navy to-navyLight hover:shadow-xl hover:shadow-navy/30 text-white font-bold text-sm disabled:opacity-60 shadow-lg shadow-navy/25 transition-all">
                {loading ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
