"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const businessPhone = "923470155210";
const callPhone = "+923470155210";
const secondPhone = "+923160155210";

function Icon({ name }) {
  const paths = {
    drop: <><path d="M12 3.2S5.5 10 5.5 14.7a6.5 6.5 0 0 0 13 0C18.5 10 12 3.2 12 3.2Z"/><path d="M9.2 15.3a3 3 0 0 0 3 3"/></>,
    chat: <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 19.7l1.2-4.4A8 8 0 1 1 20 11.5Z"/><path d="M8.5 9c.5 2 2 3.8 4.2 4.6l1-1 1.8.8c-.1 1-.8 1.5-1.8 1.5-3.2-.3-6-3.1-6.2-6 0-.8.5-1.4 1.3-1.6l.8 1.7-.9 1Z"/></>,
    pin: <><path d="M19 10.3c0 5.1-7 10.4-7 10.4S5 15.4 5 10.3a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></>,
    check: <path d="m5 12.5 4.3 4.1L19 7"/>,
    arrow: <><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
    phone: <><path d="M7.3 3.8h2.5l1.3 4-1.8 1.2a14.8 14.8 0 0 0 5.6 5.6l1.2-1.8 4 1.3v2.5a2 2 0 0 1-2.2 2A15.6 15.6 0 0 1 5.3 6a2 2 0 0 1 2-2.2Z"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function HomePage() {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("customer_name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const address = String(data.get("delivery_address") || "").trim();
    const qty = Number(data.get("bottle_quantity"));
    const note = String(data.get("note") || "").trim();
    const trap = String(data.get("website_check") || "").trim();

    // Honeypot: quietly ignore automated submissions.
    if (trap) {
      setStatus("Your request has been received. Our team will confirm the details shortly.");
      return;
    }

    setSending(true);
    setStatus("");
    setWhatsappUrl("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Order requests are temporarily unavailable. Please call us or send a WhatsApp message.");
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error } = await supabase.from("website_order_requests").insert({
        customer_name: name,
        phone,
        delivery_address: address,
        bottle_quantity: qty,
        note: note || null,
      });
      if (error) throw error;

      const message = [
        "Assalam-o-Alaikum Evergreen Water, I have submitted a delivery request.",
        "Name: " + name,
        "Phone: " + phone,
        "Area / address: " + address,
        "19L bottles: " + qty,
        note ? "Note: " + note : "",
      ].filter(Boolean).join("\n");
      setWhatsappUrl("https://wa.me/" + businessPhone + "?text=" + encodeURIComponent(message));
      setStatus("Your request has reached Evergreen Water. You can also message us on WhatsApp to confirm.");
      form.reset();
    } catch (error) {
      console.error("Website order request failed", error);
      setStatus("We couldn't send your request just now. Please contact us directly by WhatsApp or phone.");
    } finally {
      setSending(false);
    }
  }

  const directWhatsApp = "https://wa.me/" + businessPhone + "?text=" + encodeURIComponent("Assalam-o-Alaikum, I would like to ask about Evergreen Water 19L delivery.");

  return (
    <main>
      <div className="topline">Karachi home delivery <span>•</span> 19-litre drinking water</div>
      <header className="header">
        <a className="brand" href="#home" aria-label="Evergreen Water home">
          <span className="brand-mark">EW</span>
          <span className="brand-name">Evergreen <b>Water</b><small>PURE WATER, EVERYDAY</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#service">Our service</a><a href="#how">How it works</a><a href="#faq">FAQs</a>
          <a className="nav-cta" href="#order">Order water <Icon name="arrow" /></a>
        </nav>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy reveal">
          <span className="eyebrow"><i /> EVERYDAY WATER, MADE EASY</span>
          <h1>Pure drinking water,<br/><em>delivered to your home.</em></h1>
          <p>Request your 19-litre bottle delivery in a few simple steps. Our team will confirm your area and order with you.</p>
          <div className="hero-actions"><a className="button button-primary" href="#order">Request a delivery <Icon name="arrow" /></a><a className="call-link" href={"tel:" + callPhone}><Icon name="phone" /> Call 0347 7104010</a></div>
          <div className="hero-points"><span><Icon name="check" /> 19L bottles</span><span><Icon name="check" /> WhatsApp support</span></div>
        </div>
        <div className="hero-art reveal"><div className="hero-halo"/><img src="/evergreen-19l-bottle.png" alt="A reusable 19-litre Evergreen Water bottle" fetchPriority="high"/><div className="bottle-card"><span className="card-icon"><Icon name="drop"/></span><span><b>19-litre bottle</b><small>Home delivery request</small></span></div></div>
        <a className="scroll-link" href="#service">SCROLL TO EXPLORE <span>↓</span></a>
      </section>

      <section className="service-section" id="service">
        <div className="section-heading"><span className="eyebrow">A SERVICE FOR YOUR HOME</span><h2>Water delivery,<br/>made simple.</h2><p>Request what you need and let us confirm delivery for your Karachi area.</p></div>
        <div className="benefits">
          <article><span className="feature-icon"><Icon name="drop"/></span><h3>19-litre bottles</h3><p>Request the number of bottles that suits your household.</p><b className="feature-index">01</b></article>
          <article><span className="feature-icon"><Icon name="chat"/></span><h3>Easy to order</h3><p>Send your request online or contact our team on WhatsApp.</p><b className="feature-index">02</b></article>
          <article><span className="feature-icon"><Icon name="pin"/></span><h3>Serving Karachi</h3><p>Message us to confirm availability for your delivery area.</p><b className="feature-index">03</b></article>
        </div>
      </section>

      <section className="product-section">
        <div className="product-art"><img src="/evergreen-19l-bottle.png" alt="" loading="lazy"/></div>
        <div className="product-copy"><span className="eyebrow">EVERGREEN WATER • EW</span><h2>A simple way to keep<br/>your home supplied.</h2><p>Tell us your contact details, delivery address and bottle quantity. We’ll receive your request and get back to you to confirm the next steps.</p><a className="light-link" href="#order">Request your delivery <Icon name="arrow"/></a><div className="product-points"><span><Icon name="check"/> Convenient home service</span><span><Icon name="check"/> Delivery confirmed by our team</span></div></div>
      </section>

      <section className="steps-section" id="how">
        <div className="section-heading centered"><span className="eyebrow">THREE EASY STEPS</span><h2>From request to doorstep.</h2></div>
        <div className="steps"><article><b>01</b><h3>Share your request</h3><p>Enter your name, phone, area and bottle quantity.</p></article><article><b>02</b><h3>We’ll confirm</h3><p>Your request is sent securely to Evergreen Water for follow-up.</p></article><article><b>03</b><h3>Arrange delivery</h3><p>Our team checks availability and confirms the delivery with you.</p></article></div>
      </section>

      <section className="order-section" id="order">
        <div className="order-copy"><span className="eyebrow">READY WHEN YOU ARE</span><h2>Request your<br/><em>water delivery.</em></h2><p>Fill in the form and we’ll receive your request in the Evergreen Water system.</p><div className="contact-prompt"><span className="contact-icon"><Icon name="chat"/></span><span><b>Prefer to speak with us?</b><a href={directWhatsApp} target="_blank" rel="noreferrer">Message us on WhatsApp <Icon name="arrow"/></a></span></div></div>
        <form className="order-form" onSubmit={handleSubmit}>
          <div className="form-title"><h3>Delivery request</h3><span>19L bottles</span></div>
          <label htmlFor="customer_name">Your name</label><input id="customer_name" name="customer_name" type="text" autoComplete="name" maxLength="100" required placeholder="Enter your name"/>
          <div className="form-row"><div><label htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength="20" required placeholder="03xx xxxxxxx"/></div><div><label htmlFor="bottle_quantity">Number of bottles</label><input id="bottle_quantity" name="bottle_quantity" type="number" min="1" max="50" defaultValue="1" required/></div></div>
          <label htmlFor="delivery_address">Area and delivery address</label><input id="delivery_address" name="delivery_address" type="text" autoComplete="street-address" maxLength="300" required placeholder="Area, street, building or house"/>
          <label htmlFor="note">Delivery note <span>(optional)</span></label><textarea id="note" name="note" maxLength="500" rows="3" placeholder="Landmark or helpful instructions"/>
          <div className="honeypot" aria-hidden="true"><label htmlFor="website_check">Leave this field empty</label><input id="website_check" name="website_check" tabIndex="-1" autoComplete="off"/></div>
          <button className="button button-primary submit" type="submit" disabled={sending}>{sending ? "Sending request…" : "Send delivery request"} <Icon name="arrow"/></button>
          <p className="privacy">Your request is shared with Evergreen Water for delivery follow-up. This form does not collect payment details.</p>
          {status && <div className={status.startsWith("We couldn't") ? "form-status error" : "form-status"} role="status">{status}{whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">Confirm in WhatsApp <Icon name="arrow"/></a>}</div>}
        </form>
      </section>

      <section className="faq-section" id="faq"><div className="section-heading"><span className="eyebrow">GOOD TO KNOW</span><h2>Questions, answered.</h2></div><div className="faq-list">
        <details><summary>Which areas do you deliver to?<span>+</span></summary><p>We serve Karachi. Send your area to our team and we’ll confirm delivery availability.</p></details>
        <details><summary>How do I place an order?<span>+</span></summary><p>Submit the delivery request form above. Your request goes to Evergreen Water, and our team will contact you to confirm.</p></details>
        <details><summary>What bottle size do you provide?<span>+</span></summary><p>Evergreen Water currently offers 19-litre bottles. Contact us if you have questions about your request.</p></details>
      </div></section>

      <footer className="footer"><div className="footer-main"><a className="brand footer-brand" href="#home"><span className="brand-mark">EW</span><span className="brand-name">Evergreen <b>Water</b><small>PURE WATER, EVERYDAY</small></span></a><p>Pure drinking water, delivered to your home.</p><div className="footer-contact"><a href={"tel:" + callPhone}>0347 7104010</a><a href={"tel:" + secondPhone}>0316 0155210</a><a href="mailto:evergreenpluswater@gmail.com">evergreenpluswater@gmail.com</a></div><a className="button button-light" href={directWhatsApp} target="_blank" rel="noreferrer">Message us on WhatsApp <Icon name="arrow"/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Evergreen Water · Karachi, Pakistan</span><a href="#home">Back to top ↑</a></div></footer>
      <a className="whatsapp-float" href={directWhatsApp} target="_blank" rel="noreferrer" aria-label="Contact Evergreen Water on WhatsApp"><Icon name="chat"/></a>
    </main>
  );
}
