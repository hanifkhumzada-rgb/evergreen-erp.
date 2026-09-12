"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Droplet, Phone, KeyRound, ArrowLeft } from "lucide-react";
import { requestPortalOtp, verifyPortalOtpAndSignIn } from "@/app/portal/actions";
import Image from "next/image";

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState("identify"); // "identify" | "otp"
  const [customerCode, setCustomerCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef(null);

  const startResendTimer = () => {
    setResendIn(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await requestPortalOtp(customerCode, mobile);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    if (res.testingMode) {
      router.replace("/portal");
      router.refresh();
      return;
    }
    setStep("otp");
    startResendTimer();
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError("");
    setLoading(true);
    const res = await requestPortalOtp(customerCode, mobile);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    startResendTimer();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await verifyPortalOtpAndSignIn(mobile, code);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    router.replace("/portal");
    router.refresh();
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-navy via-[#064C48] to-[#052625] p-5 overflow-hidden">
      <div className="absolute -top-32 -right-20 w-96 h-96 rounded-full bg-[#9EF0D0]/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-aqua/15 blur-3xl" />
      <div className="login-card-in w-full max-w-sm bg-card rounded-[30px] shadow-2xl p-7 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-aqua via-[#9EF0D0] to-aqua" />
        <div className="flex flex-col items-center text-center mb-6">
          <Image src="/ew-mark.svg" width={60} height={60} alt="Evergreen Water" className="rounded-2xl shadow-lg mb-3" priority unoptimized />
          <h1 className="font-display text-xl font-semibold">My Evergreen Water</h1>
          <p className="text-xs text-slate mt-1 max-w-[260px]">Deliveries, payments, bottles and statements—securely in your pocket.</p>
        </div>

        {step === "identify" ? (
          <form onSubmit={handleRequestOtp}>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate block mb-1.5">Customer ID</span>
              <div className="relative">
                <Droplet size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
                <input
                  required value={customerCode} onChange={(e) => setCustomerCode(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all"
                  placeholder="e.g. EW-0042"
                />
              </div>
            </label>
            <label className="block mb-2">
              <span className="text-xs font-semibold text-slate block mb-1.5">Registered mobile number</span>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
                <input
                  required type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all"
                  placeholder="03001234567"
                />
              </div>
            </label>
            <p className="text-[11px] text-slate mb-2">Your number must match the one registered with Evergreen Water.</p>
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mb-4">Testing mode: SMS verification is temporarily disabled.</p>
            {error && <p className="text-coral text-xs mb-3 bg-coralSoft px-3 py-2 rounded-lg">{error}</p>}
            <button
              disabled={loading} type="submit"
              className="w-full py-3 rounded-full bg-gradient-to-r from-navy to-navyLight hover:shadow-xl text-white font-bold text-sm disabled:opacity-60 shadow-lg transition-all"
            >
              {loading ? "Opening portal…" : "Open customer portal"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <button type="button" onClick={() => { setStep("identify"); setError(""); setCode(""); }} className="flex items-center gap-1 text-xs text-slate mb-4">
              <ArrowLeft size={13} /> Change details
            </button>
            <p className="text-xs text-slate mb-4">We sent a 6-digit code by SMS to your registered mobile number.</p>
            <label className="block mb-2">
              <span className="text-xs font-semibold text-slate block mb-1.5">Verification code</span>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
                <input
                  required inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-line bg-card text-sm tracking-[0.4em] outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 transition-all"
                  placeholder="••••••"
                />
              </div>
            </label>
            <div className="flex justify-end mb-4">
              <button type="button" onClick={handleResend} disabled={resendIn > 0 || loading} className="text-xs text-aqua font-semibold disabled:text-slate disabled:opacity-70">
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </div>
            {error && <p className="text-coral text-xs mb-3 bg-coralSoft px-3 py-2 rounded-lg">{error}</p>}
            <button
              disabled={loading || code.length !== 6} type="submit"
              className="w-full py-3 rounded-full bg-gradient-to-r from-navy to-navyLight hover:shadow-xl text-white font-bold text-sm disabled:opacity-60 shadow-lg transition-all"
            >
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
          </form>
        )}

        <div className="grid grid-cols-3 gap-2 mt-7 text-center"><div><p className="font-bold text-xs text-aqua">Live</p><p className="text-[9px] text-slate">Deliveries</p></div><div className="border-x"><p className="font-bold text-xs text-aqua">Secure</p><p className="text-[9px] text-slate">OTP Login</p></div><div><p className="font-bold text-xs text-aqua">24/7</p><p className="text-[9px] text-slate">Statements</p></div></div>
        <p className="text-center text-[11px] text-slate mt-6">
          Not a customer? <a href="/login" className="text-aqua font-semibold">Staff sign in</a>
        </p>
      </div>
    </div>
  );
}
