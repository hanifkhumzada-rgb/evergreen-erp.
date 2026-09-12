import { notFound } from "next/navigation";
import { restoreOwnerLogin } from "./actions";

const RECOVERY_TOKEN = "21926c69f0f69c26ce91f72b945899eafa3e7f9b50366574b6e3c8e9db3b7989";

export const dynamic = "force-dynamic";

export default function OwnerRecoveryPage({ searchParams }) {
  const token = String(searchParams?.token || "");
  if (token !== RECOVERY_TOKEN) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-[#052625] p-5">
      <section className="bg-card rounded-[28px] max-w-md w-full shadow-2xl p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-7">
          <img src="/icon-192.png" alt="Evergreen Water" className="w-11 h-11 rounded-xl shadow-lg" />
          <span className="font-display text-xl font-semibold">Evergreen Water</span>
        </div>
        <h1 className="font-display text-2xl font-semibold mb-2">Restore Owner Login</h1>
        <p className="text-sm text-slate mb-6">
          Email unchanged: <strong>owner@evergreenpluswater.pk</strong>
        </p>
        <form action={restoreOwnerLogin} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <label className="block">
            <span className="text-xs font-semibold text-slate block mb-1.5">Same old password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-2xl border border-line bg-card outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate block mb-1.5">Confirm same password</span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-2xl border border-line bg-card outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15"
            />
          </label>
          <button type="submit" className="w-full py-3 rounded-full bg-gradient-to-r from-navy to-navyLight text-white font-bold shadow-lg shadow-navy/25">
            Restore Owner Login
          </button>
        </form>
        <p className="text-xs text-slate mt-5">This private one-time page will be removed after login is restored.</p>
      </section>
    </main>
  );
}
