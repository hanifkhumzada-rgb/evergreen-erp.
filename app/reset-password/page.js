"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Droplet } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-[#072430] p-5">
      <div className="bg-card rounded-3xl overflow-hidden max-w-md w-full shadow-2xl p-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-aqua flex items-center justify-center"><Droplet size={20} /></div>
          <span className="font-display text-lg font-semibold">Evergreen Plus Water</span>
        </div>

        {invalid ? (
          <>
            <h2 className="font-display text-xl font-semibold mb-1">Link invalid or expired</h2>
            <p className="text-sm text-slate mb-5">This password reset link no longer works. Request a new one from the sign-in page.</p>
            <a href="/login" className="inline-block px-4 py-2.5 rounded-xl bg-aqua text-white font-bold text-sm">Back to sign in</a>
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
              <label className="block mb-3">
                <span className="text-xs font-semibold text-slate block mb-1">New password</span>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-line text-sm outline-none focus:border-aqua" placeholder="••••••••" />
              </label>
              <label className="block mb-4">
                <span className="text-xs font-semibold text-slate block mb-1">Confirm password</span>
                <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-line text-sm outline-none focus:border-aqua" placeholder="••••••••" />
              </label>
              {error && <p className="text-coral text-xs mb-3">{error}</p>}
              <button disabled={loading} type="submit"
                className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
                {loading ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
