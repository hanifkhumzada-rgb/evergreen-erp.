"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const ORDER_PHONE = "923160155210";
const CALL_PHONE = "+923160155210";
const SECOND_PHONE = "+923477104010";
const PORTAL = "https://evergreen-erp.vercel.app/portal";

const icons = {
  arrow: <><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
  drop: <><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9 15a3 3 0 0 0 3 3"/></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
  phone: <path d="M7 4h3l1 4-2 1.5a15 15 0 0 0 5.5 5.5L16 13l4 1v3a2 2 0 0 1-2 2A16 16 0 0 1 5 6a2 2 0 0 1 2-2Z"/>,
  chat: <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.2-4.3A8 8 0 1 1 20 11.5Z"/><path d="M8.5 9c.5 2 2 3.8 4.2 4.6l1-1 1.8.8c-.1 1-.8 1.5-1.8 1.5-3.2-.3-6-3.1-6.2-6 0-.8.5-1.4 1.3-1.6l.8 1.7-.9 1Z"/></>,
  check: <path d="m5 12.5 4 4L19 7"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  shield: <><path d="M12 21s8-4 8-11V5l-8-3-8 3v5c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
};

function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}
function Logo({ footer = false }) {
  return <a className={"brand" + (footer ? " brand-footer" : "")} href="#home" aria-label="Evergreen Water home">
    <img src="/ew-logo.jpeg" alt="" width="58" height="58" />
    <span><strong>EVERGREEN <b>WATER</b></strong><small>PURE DRINKING WATER</small></span>
  </a>;
}

const waLink = (message) => "https://wa.me/" + ORDER_PHONE + "?text=" + encodeURIComponent(message);

export default function HomePage() {
  const [qty, setQty] = useState(1);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [ref, setRef] = useState("");
  const [headerSolid, setHeaderSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wa, setWa] = useState("");

  useEffect(() => {
    const onScroll = () => setHeaderSolid(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const els = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    els.forEach((el) => observer.observe(el));
    return () => { window.removeEventListener("scroll", onScroll); observer.disconnect(); };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (String(data.get("website_check") || "").trim()) return;
    const name = String(data.get("customer_name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const cleanPhone = phone.replace(/[\s()+-]/g, "");
    const area = String(data.get("area") || "").trim();
    const building = String(data.get("building") || "").trim();
    const house = String(data.get("house") || "").trim();
    const addressLine = String(data.get("address") || "").trim();
    const customerId = String(data.get("customer_id") || "").trim();
    const slot = String(data.get("delivery_window") || "").trim();
    const payment = String(data.get("payment_method") || "").trim();
    const instructions = String(data.get("instructions") || "").trim();
    const quantity = Number(data.get("bottle_quantity"));
    if (name.length < 2 || cleanPhone.length < 10 || quantity < 1 || quantity > 50 || !area || !addressLine) {
      setStatus("Please check your name, phone number, quantity and delivery address.");
      return;
    }
    let reference = "";
    try { reference = sessionStorage.getItem("ew_pending_request_reference") || ""; } catch {}
    if (!reference) {
      reference = "EW-" + crypto.randomUUID().toUpperCase();
      try { sessionStorage.setItem("ew_pending_request_reference", reference); } catch {}
    }
    const deliveryAddress = [
      "Area / Zone: " + area,
      building ? "Building / Society: " + building : "",
      house ? "Flat / House: " + house : "",
      "Address: " + addressLine,
      "Preferred delivery window: " + (slot || "To be confirmed"),
      "Preferred payment: " + (payment || "To be confirmed"),
    ].filter(Boolean).join("\n");
    const note = [
      "Website request ref: " + reference,
      customerId ? "Customer ID supplied (staff verification required): " + customerId : "",
      instructions ? "Delivery instructions: " + instructions : "",
      "Customer preference only. Pending staff confirmation; no payment or ERP financial posting was made.",
    ].filter(Boolean).join("\n");
    setSending(true); setStatus(""); setRef(""); setWa("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Unavailable");
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await supabase.from("website_order_requests").insert({
        customer_name: name, phone, delivery_address: deliveryAddress, bottle_quantity: quantity, note, request_reference: reference,
      });
      if (error) throw error;
      setRef(reference);
      setStatus("Your request is in the Evergreen Water ERP queue, pending confirmation from our team.");
      const message = ["Assalam-o-Alaikum Evergreen Water, my website delivery request is pending confirmation.", "Request: " + reference, "Name: " + name, "Phone: " + phone, "Area: " + area, "Address: " + [building, house, addressLine].filter(Boolean).join(", "), "19L bottles: " + quantity].join("\n");
      setWa(waLink(message)); form.reset(); setQty(1);
    } catch (error) {
      console.error("Website delivery request failed", error);
      setStatus("We couldn't send this request. Please try again or contact Evergreen Water by phone or WhatsApp.");
    } finally { setSending(false); }
  }

  const directWhatsApp = waLink("Assalam-o-Alaikum, I would like to ask about Evergreen Water 19L delivery.");
  const navItems = [["Home", "#home"], ["Our water", "#water"], ["How it works", "#how"], ["Delivery areas", "#areas"], ["Track order", PORTAL], ["Customer login", PORTAL], ["Contact", "#contact"]];

  return <main id="home">
    <div className="announcement"><span className="announcement-dot" />Karachi delivery requests are open <i /> <a href="#order">Request your 19L delivery <Icon name="arrow" size={14}/></a></div>
    <header className={"site-header" + (headerSolid ? " is-solid" : "")}>
      <div className="header-inner">
        <Logo />
        <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} /></button>
        <nav className={menuOpen ? "nav-open" : ""} aria-label="Main navigation">
          {navItems.map(([label, href]) => <a key={label} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
          <a className="button button-nav" href="#order" onClick={() => setMenuOpen(false)}>Order now <Icon name="arrow" size={16}/></a>
        </nav>
      </div>
    </header>

    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy reveal">
          <div className="hero-kicker"><span><Icon name="drop" size={16}/></span> PURE WATER. SIMPLE DELIVERY.</div>
          <h1>Pure drinking water.<br/><em>At your doorstep.</em></h1>
          <p className="hero-lead">A fresh, dependable way to keep your home supplied with 19-litre water bottles. Tell us what you need and our Karachi team will confirm the details.</p>
          <div className="hero-buttons"><a className="button button-primary" href="#order">Order your water <Icon name="arrow" size={17}/></a><a className="button button-outline" href={directWhatsApp} target="_blank" rel="noreferrer"><Icon name="chat" size={17}/> WhatsApp us</a></div>
          <div className="hero-trust">
            <span><Icon name="check" size={16}/> Home delivery requests</span>
            <span><Icon name="check" size={16}/> 19-litre returnable bottles</span>
          </div>
        </div>
        <div className="hero-visual reveal">
          <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
          <div className="water-disc"><span className="water-disc-label">EW <i>•</i> 19 LITRES</span></div>
          <img className="hero-bottle" src="/evergreen-19l-bottle-ew.png" alt="Temporary illustrative Evergreen Water 19 litre bottle visual; actual product photo pending" fetchPriority="high"/>
          <div className="photo-note"><span className="photo-note-icon"><Icon name="drop" size={16}/></span><span><strong>19 litre returnable bottle</strong><small>Product photo to be updated from your actual bottle</small></span></div>
          <div className="visual-spark spark-a"/><div className="visual-spark spark-b"/>
        </div>
      </div>
      <div className="hero-bottom"><span><Icon name="pin" size={16}/> KARACHI, PAKISTAN</span><span>EVERGREEN WATER <b>—</b> PURE DRINKING WATER</span><a href="#water">Discover our service <span>↓</span></a></div>
    </section>

    <section className="benefit-strip reveal" aria-label="Service highlights">
      <div><span className="strip-icon"><Icon name="drop"/></span><span><b>19L water bottles</b><small>For everyday home needs</small></span></div>
      <div><span className="strip-icon"><Icon name="clock"/></span><span><b>Easy delivery request</b><small>Our team confirms your order</small></span></div>
      <div><span className="strip-icon"><Icon name="shield"/></span><span><b>Local support</b><small>Talk to the Evergreen team</small></span></div>
      <a href="#order" className="strip-link">Start an order <Icon name="arrow" size={16}/></a>
    </section>

    <section className="water-section section-wrap" id="water">
      <div className="section-top reveal"><div><span className="eyebrow">OUR WATER SERVICE</span><h2>Everyday water,<br/><em>made effortless.</em></h2></div><p>From your first request to your next refill, Evergreen Water keeps ordering clear and convenient.</p></div>
      <div className="service-cards">
        <article className="service-card service-card-blue reveal"><span className="card-number">01 / FOR HOME</span><span className="card-illustration"><Icon name="drop" size={28}/></span><h3>19 litres for your routine</h3><p>Choose the bottle quantity that suits your household. Our team will confirm current availability.</p><a href="#order">Choose quantity <Icon name="arrow" size={15}/></a></article>
        <article className="service-card service-card-white reveal"><span className="card-number">02 / EASY REQUEST</span><span className="card-illustration"><Icon name="chat" size={28}/></span><h3>Order in a few steps</h3><p>Share your contact and address once. We’ll confirm the details with you before delivery.</p><a href="#how">See how it works <Icon name="arrow" size={15}/></a></article>
        <article className="service-card service-card-aqua reveal" id="areas"><span className="card-number">03 / KARACHI</span><span className="card-illustration"><Icon name="pin" size={28}/></span><h3>Area availability confirmed</h3><p>Delivery coverage can vary by location. Add your area and our team will check it.</p><a href="#order">Check my area <Icon name="arrow" size={15}/></a></article>
      </div>
    </section>

    <section className="product-band">
      <div className="product-inner">
        <div className="product-visual reveal"><div className="product-ring"/><img src="/evergreen-19l-bottle-ew.png" alt="" loading="lazy"/><span className="product-stamp">19L<br/><small>REUSABLE</small></span></div>
        <div className="product-info reveal"><span className="eyebrow eyebrow-light">EVERGREEN WATER • EW</span><h2>One bottle.<br/><em>More ease at home.</em></h2><p>Request your 19-litre bottle delivery online. We’ll confirm availability, price and payment details with you—no guessed pricing and no payment collected on this form.</p>
          <div className="product-specs"><span><b>19 L</b><small>Capacity</small></span><span><b>Reusable</b><small>Returnable bottle</small></span><span><b>Karachi</b><small>Service location</small></span></div>
          <a className="button button-light" href="#order">Request this product <Icon name="arrow" size={17}/></a>
          <small className="image-disclaimer">Bottle image is a temporary visual; final product photography awaits the actual Evergreen bottle photo.</small>
        </div>
      </div>
    </section>

    <section className="process-section section-wrap" id="how">
      <div className="process-head reveal"><span className="eyebrow">HOW IT WORKS</span><h2>From request to<br/><em>your doorstep.</em></h2><p>A simple flow with a human confirmation before your delivery is arranged.</p></div>
      <div className="process-list">
        <article className="process-step reveal"><span className="step-count">01</span><div><h3>Tell us what you need</h3><p>Choose your bottle quantity and share a delivery address.</p></div><Icon name="arrow" size={20}/></article>
        <article className="process-step reveal"><span className="step-count">02</span><div><h3>We check the details</h3><p>Your request reaches our ERP as pending confirmation. Our team verifies the customer, area and current price.</p></div><Icon name="arrow" size={20}/></article>
        <article className="process-step reveal"><span className="step-count">03</span><div><h3>Confirm your delivery</h3><p>Evergreen Water contacts you to confirm availability and arrange the delivery.</p></div><Icon name="check" size={20}/></article>
      </div>
    </section>

    <section className="order-section" id="order">
      <div className="order-intro reveal"><span className="eyebrow eyebrow-light">ONLINE DELIVERY REQUEST</span><h2>Let’s get water<br/><em>to your home.</em></h2><p>Share a few details and our team will confirm availability, pricing and delivery with you.</p>
        <div className="request-benefits"><span><Icon name="check" size={16}/> Your request goes to our ERP queue</span><span><Icon name="check" size={16}/> No payment is taken online</span><span><Icon name="check" size={16}/> Staff confirms before delivery</span></div>
        <div className="order-help"><span><Icon name="chat" size={18}/></span><div><b>Prefer WhatsApp?</b><a href={directWhatsApp} target="_blank" rel="noreferrer">Chat with our team <Icon name="arrow" size={14}/></a></div></div>
      </div>
      <form className="order-form reveal" onSubmit={handleSubmit}>
        <div className="form-heading"><div><span>START YOUR REQUEST</span><h3>Delivery details</h3></div><span className="pending-pill"><i/> Pending confirmation</span></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="customer_name">Customer name <b>*</b></label><input id="customer_name" name="customer_name" autoComplete="name" minLength="2" maxLength="100" required placeholder="Your full name"/></div>
          <div className="field"><label htmlFor="phone">Mobile number <b>*</b></label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength="24" required placeholder="03xx xxxxxxx"/></div>
          <div className="field"><label htmlFor="customer_id">Customer ID <small>optional</small></label><input id="customer_id" name="customer_id" maxLength="40" placeholder="For existing customers"/></div>
          <div className="field"><label>Number of bottles <b>*</b></label><div className="quantity-control"><button type="button" aria-label="Reduce quantity" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><input aria-label="Number of 19 litre bottles" id="bottle_quantity" name="bottle_quantity" type="number" min="1" max="50" value={qty} onChange={(e) => setQty(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} required/><button type="button" aria-label="Add one bottle" onClick={() => setQty(Math.min(50, qty + 1))}>+</button></div></div>
          <div className="field"><label htmlFor="area">Area / Zone <b>*</b></label><input id="area" name="area" maxLength="100" required placeholder="e.g. your Karachi area"/></div>
          <div className="field"><label htmlFor="building">Building / Society</label><input id="building" name="building" maxLength="120" placeholder="Building or society name"/></div>
          <div className="field"><label htmlFor="house">Flat / House number</label><input id="house" name="house" maxLength="50" placeholder="Flat or house number"/></div>
          <div className="field field-wide"><label htmlFor="address">Full address <b>*</b></label><input id="address" name="address" autoComplete="street-address" maxLength="300" required placeholder="Street, block, landmark and directions"/></div>
          <div className="field"><label htmlFor="delivery_window">Preferred delivery window</label><select id="delivery_window" name="delivery_window" defaultValue=""><option value="">Let our team confirm</option><option>Morning (9am–12pm)</option><option>Afternoon (12pm–4pm)</option><option>Evening (4pm–8pm)</option></select></div>
          <div className="field"><label htmlFor="payment_method">Payment preference</label><select id="payment_method" name="payment_method" defaultValue=""><option value="">Let our team confirm</option><option>Cash on delivery</option><option>Bank transfer (details to be confirmed)</option><option>Other (discuss with team)</option></select></div>
          <div className="field field-wide"><label htmlFor="instructions">Delivery instructions <small>optional</small></label><textarea id="instructions" name="instructions" maxLength="400" rows="2" placeholder="Landmark, access notes or other helpful details"/></div>
        </div>
        <div className="order-summary"><div><span>Order summary</span><b>{qty} × 19L bottle{qty > 1 ? "s" : ""}</b></div><div><span>Pricing</span><b className="price-note">Confirmed by our team</b></div><div><span>Next step</span><b>Pending confirmation</b></div></div>
        <div className="honeypot" aria-hidden="true"><label htmlFor="website_check">Leave blank</label><input id="website_check" name="website_check" tabIndex="-1" autoComplete="off"/></div>
        <button className="button button-submit" type="submit" disabled={sending}>{sending ? "Sending request…" : "Send delivery request"} <Icon name="arrow" size={17}/></button>
        <p className="form-privacy"><Icon name="shield" size={15}/> Your details are sent to Evergreen Water for follow-up. We don’t collect card or payment details here.</p>
        {status && <div className={status.startsWith("We couldn't") || status.startsWith("Please check") ? "form-feedback is-error" : "form-feedback"} role="status" aria-live="polite"><b>{status.startsWith("Your request") ? "Request received" : "Check your request"}</b><span>{status}{ref && <strong className="request-ref">Reference: {ref}</strong>}</span>{wa && <a href={wa} target="_blank" rel="noreferrer">Continue in WhatsApp <Icon name="arrow" size={14}/></a>}</div>}
      </form>
    </section>

    <section className="faq-section section-wrap">
      <div className="faq-intro reveal"><span className="eyebrow">GOOD TO KNOW</span><h2>Clear answers.<br/><em>Simple service.</em></h2><p>Have another question? Our team is a message away.</p><a href={directWhatsApp} target="_blank" rel="noreferrer">Ask us on WhatsApp <Icon name="arrow" size={15}/></a></div>
      <div className="faq-list reveal">
        <details><summary>Which Karachi areas do you cover?<span>+</span></summary><p>Availability depends on your location. Submit your area and our team will confirm whether delivery is available.</p></details>
        <details><summary>How much does a bottle cost?<span>+</span></summary><p>Prices can change. We don’t display an unverified fixed price; Evergreen Water will confirm current pricing with you before arranging the order.</p></details>
        <details><summary>Is the order confirmed as soon as I submit?<span>+</span></summary><p>Your submission is a delivery request. It stays pending confirmation until Evergreen Water staff verify the details and contact you.</p></details>
        <details><summary>Can I use my existing customer account?<span>+</span></summary><p>Yes. Add your optional customer ID so the team can verify and reuse your existing customer record. Customer account access remains in the existing portal.</p></details>
      </div>
    </section>

    <section className="contact-banner" id="contact"><div><span className="eyebrow eyebrow-light">WE’RE HERE TO HELP</span><h2>Good water starts<br/>with a simple hello.</h2></div><div className="contact-actions"><a href={directWhatsApp} target="_blank" rel="noreferrer" className="button button-light"><Icon name="chat" size={17}/> WhatsApp Evergreen</a><a href={"tel:" + CALL_PHONE}><Icon name="phone" size={17}/> 0316 0155210</a></div></section>

    <footer className="site-footer">
      <div className="footer-grid"><div className="footer-about"><Logo footer/><p>Pure drinking water, delivered to your doorstep in Karachi.</p><a href="#order" className="button button-footer">Order now <Icon name="arrow" size={16}/></a></div>
        <div className="footer-col"><h3>Explore</h3><a href="#home">Home</a><a href="#water">Our water</a><a href="#how">How it works</a><a href="#areas">Delivery areas</a><a href="#contact">Contact</a></div>
        <div className="footer-col"><h3>Customer care</h3><a href={PORTAL}>Track order</a><a href={PORTAL}>Customer login</a><a href={PORTAL}>Feedback & support</a><a href="#order">Repeat order request</a></div>
        <div className="footer-col footer-contact"><h3>Talk to Evergreen</h3><a href="tel:+923160155210">0316 0155210</a><a href="tel:+923477104010">0347 7104010</a><a href="mailto:evergreenpluswater@gmail.com">evergreenpluswater@gmail.com</a><span>Karachi, Pakistan</span><a href={directWhatsApp} target="_blank" rel="noreferrer">WhatsApp us <Icon name="arrow" size={14}/></a></div>
      </div>
      <div className="footer-legal"><span>© {new Date().getFullYear()} Evergreen Water. Pure Drinking Water.</span><div><a href="/privacy">Privacy policy</a><a href="/terms">Terms & conditions</a></div><a className="back-top" href="#home">Back to top ↑</a></div>
    </footer>
    <a className="floating-whatsapp" href={directWhatsApp} target="_blank" rel="noreferrer" aria-label="Contact Evergreen Water on WhatsApp"><Icon name="chat" size={23}/></a>
    <a className="mobile-order" href="#order">Order now <Icon name="arrow" size={16}/></a>
  </main>;
}
