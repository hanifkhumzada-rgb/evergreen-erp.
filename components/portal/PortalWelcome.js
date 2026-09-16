import styles from "./PortalWelcome.module.css";

export default function PortalWelcome({ name, code, date }) {
  return <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-navy via-[#075E68] to-[#098877] text-white p-5 sm:p-6">
    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[24px] border-white/5" />
    <div className="relative flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[.18em] text-[#B5FFF0] font-bold">Your water, made simple</p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2 break-words">Hi, {name?.split(" ")[0] || "there"} 👋</h1>
        <p className="text-xs text-[#E0F7F3] mt-2">Deliveries, bottles &amp; your account—in one place.</p>
        <div className="mt-3 inline-flex flex-wrap gap-x-2 gap-y-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white"><span className="font-semibold">{code || "My account"}</span><span>· {date}</span></div>
      </div>
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.bottle}><div className={styles.water}/><div className={styles.label}>EW</div></div>
        <span className={styles.bubble}/><span className={styles.bubble}/>
      </div>
    </div>
  </section>;
}
