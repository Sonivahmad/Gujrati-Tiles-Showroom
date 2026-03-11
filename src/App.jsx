import { useState, useEffect, useRef, useMemo } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { auth, db } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { sendReminderSms } from "./utils/sms";

const getLocalDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// SaaS-ready: each record has shopId. 
// Initially null until Firebase Auth finishes loading
let SHOP_ID = null;

const initialInventory = [
  { id: "t1", shopId: SHOP_ID, name: "Italian Marble", size: "2x4", shade: "Shade A", purchaseRate: 72, sellingRate: 95, stock: 73, unit: "box" },
  { id: "t2", shopId: SHOP_ID, name: "Italian Marble", size: "2x2", shade: "Shade B", purchaseRate: 58, sellingRate: 78, stock: 40, unit: "box" },
  { id: "t3", shopId: SHOP_ID, name: "Italian White", size: "2x4", shade: "Shade C", purchaseRate: 80, sellingRate: 105, stock: 12, unit: "box" },
  { id: "t4", shopId: SHOP_ID, name: "Kajaria Matt", size: "2x2", shade: "Grey", purchaseRate: 45, sellingRate: 62, stock: 88, unit: "box" },
  { id: "t5", shopId: SHOP_ID, name: "Kajaria Glossy", size: "2x4", shade: "White", purchaseRate: 55, sellingRate: 75, stock: 6, unit: "box" },
  { id: "t6", shopId: SHOP_ID, name: "Somany Wood", size: "2x4", shade: "Walnut", purchaseRate: 90, sellingRate: 120, stock: 34, unit: "box" },
  { id: "t7", shopId: SHOP_ID, name: "Somany Wood", size: "2x2", shade: "Oak", purchaseRate: 82, sellingRate: 108, stock: 0, unit: "box" },
  { id: "t8", shopId: SHOP_ID, name: "Nitco Pearl", size: "2x4", shade: "Beige", purchaseRate: 68, sellingRate: 89, stock: 55, unit: "box" },
];

const initialSales = [
  { id: "s1", shopId: SHOP_ID, billNo: "TPS-000001", date: "2025-03-01", type: "Invoice", customerId: "c1", customerName: "Ramesh Sharma", items: [{ name: "Italian Marble 2x4 Shade A", qty: 10, rate: 95, total: 950 }], gross: 950, discount: 50, gst: 162, net: 1062, paid: 1062, pending: 0, paymentMethod: "UPI" },
  { id: "s2", shopId: SHOP_ID, billNo: "TPS-000002", date: "2025-03-03", type: "Invoice", customerId: "c2", customerName: "Contractor Suresh", items: [{ name: "Kajaria Matt 2x2 Grey", qty: 25, rate: 62, total: 1550 }], gross: 1550, discount: 0, gst: 279, net: 1829, paid: 1000, pending: 829, paymentMethod: "Cash" },
  { id: "s3", shopId: SHOP_ID, billNo: "TPS-000003", date: "2025-03-05", type: "Invoice", customerId: "c3", customerName: "Builder Anand", items: [{ name: "Somany Wood 2x4 Walnut", qty: 15, rate: 120, total: 1800 }, { name: "Italian White 2x4 Shade C", qty: 8, rate: 105, total: 840 }], gross: 2640, discount: 140, gst: 450.6, net: 2950, paid: 2950, pending: 0, paymentMethod: "Bank Transfer" },
];

const initialCustomers = [
  { id: "c1", shopId: SHOP_ID, name: "Ramesh Sharma", phone: "9876543210", address: "123 Main St", type: "Retail", totalSpent: 1062, totalPending: 0 },
  { id: "c2", shopId: SHOP_ID, name: "Contractor Suresh", phone: "8765432109", address: "Plot 44, Industrial Area", type: "Contractor", totalSpent: 1829, totalPending: 829 },
  { id: "c3", shopId: SHOP_ID, name: "Builder Anand", phone: "7654321098", address: "Skyline Towers Site", type: "Builder", totalSpent: 2950, totalPending: 0 },
];

const initialExpenses = [];
const initialPurchases = [];
const initialSuppliers = [
  { id: "sup1", shopId: SHOP_ID, name: "Kajaria Distributors", phone: "9876543210", totalBought: 14500, totalPending: 2500 },
  { id: "sup2", shopId: SHOP_ID, name: "Somany Hub", phone: "8765432109", totalBought: 8200, totalPending: 0 }
];

const TILES_PER_BOX = { "2x2": 16, "2x4": 8 }; // pieces per box
const SQ_FT_PER_BOX = { "2x2": 4, "2x4": 8 }; // approx sq.ft per box

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ─── SAAS LANDING PAGE & AUTHENTICATION ──────────────────────────────────────
function LandingPage({ onLogin }) {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login" or "signup"

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [gst, setGst] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Only init Recaptcha if we haven't already and we are in the Auth screen
    if (showAuth) {
      const container = document.getElementById('recaptcha-container');
      if (container && !window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': (response) => {
            // reCAPTCHA solved
          }
        });
        setRecaptchaVerifier(window.recaptchaVerifier);
      }
    }
    
    return () => {
      // Clear out the recaptcha instance if the auth modal closes to prevent detachment errors
      if (!showAuth && window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
        setRecaptchaVerifier(null);
      }
    };
  }, [showAuth]);

  const openAuth = (mode) => {
    setAuthMode(mode);
    setStep(1);
    setPhone("");
    setShopName("");
    setGst("");
    setOtp(["", "", "", "", "", ""]);
    setShowAuth(true);
  };

  const handleNavClick = (e, sectionId) => {
    e.preventDefault();
    setIsMenuOpen(false);
    if (showAuth) {
      setShowAuth(false);
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (authMode === "signup" && !shopName.trim()) return alert("Please enter your Shop Name");
    if (phone.length < 10) return alert("Please enter a valid 10-digit mobile number");

    setIsLoading(true);
    let formattedPhone = "+91" + phone;

    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': (response) => {
            // reCAPTCHA solved, allow signInWithPhoneNumber.
          },
          'expired-callback': () => {
             // Response expired. Ask user to solve reCAPTCHA again.
             if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
             window.recaptchaVerifier = null;
          }
        });
      }
      
      const appVerifier = window.recaptchaVerifier;
      // Pre-render before calling send
      await appVerifier.render();
      
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setStep(2);
      setIsLoading(false);
    } catch (error) {
      console.error("SMS Error:", error);
      
      // If the recaptcha failed or detached, reset it forcefully so they can try again
      if (window.recaptchaVerifier) {
         window.recaptchaVerifier.clear();
         window.recaptchaVerifier = null;
      }
      
      alert("Error sending OTP: " + error.message);
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const enteredOtp = otp.join("");
    if (enteredOtp.length < 6) return alert("Please enter the complete 6-digit OTP");

    setIsLoading(true);
    try {
      if (confirmationResult) {
        // Enforce Local Persistence for the session so `onAuthStateChanged` triggers cleanly
        await setPersistence(auth, browserLocalPersistence);
        
        // Live Firebase verification
        const result = await confirmationResult.confirm(enteredOtp);
        const user = result.user;

        // If it's a signup, we pass the setup data to the parent so it can be pushed to Firestore
        setIsLoading(false);
        if (authMode === "signup") {
          onLogin(user, shopName, gst);
        } else {
          onLogin(user);
        }
      } else {
        throw new Error("Confirmation Result missing. Please resend the OTP.");
      }
    } catch (error) {
      console.error("OTP Verification Error:", error);
      alert("Invalid OTP Code. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-container" id="home">
      {/* PERSISTENT NAVBAR */}
      <nav className="landing-nav">
        <div className="landing-logo" style={{ cursor: "pointer" }} onClick={(e) => handleNavClick(e, "home")}>
          🪨 TileSync <span style={{ fontSize: 12, background: "#1e3a8a", color: "#93c5fd", padding: "2px 6px", borderRadius: 4, marginLeft: 8 }}>SaaS</span>
        </div>
        
        {/* Mobile Hamburger Button */}
        <button className="hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ display: "none", background: "transparent", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>
          {isMenuOpen ? "✕" : "☰"}
        </button>

        <div className={`landing-links ${isMenuOpen ? "open" : ""}`}>
          <a href="#home" onClick={(e) => handleNavClick(e, "home")} style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: 500 }}>Home</a>
          <a href="#features" onClick={(e) => handleNavClick(e, "features")} style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: 500 }}>Features</a>
          <a href="#pricing" onClick={(e) => handleNavClick(e, "pricing")} style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: 500 }}>Pricing</a>
          {!showAuth && <button className="nav-login-btn" onClick={() => { setIsMenuOpen(false); openAuth("login"); }}>Login</button>}
          <button className="nav-signup-btn" onClick={() => { setIsMenuOpen(false); openAuth("signup"); }}>Start Free Trial</button>
        </div>
      </nav>

      {showAuth ? (
        <div className="auth-container">
          <div className="auth-card">
            <button onClick={() => setShowAuth(false)} className="auth-back-btn">← Back</button>
            <div className="auth-header">
              <div className="auth-logo">🪨</div>
              <h2>{authMode === "signup" ? "Create Account" : "Welcome Back"}</h2>
              <p>{authMode === "signup" ? "Register your showroom on TileSync" : "Login to your TileSync dashboard"}</p>
            </div>

            {step === 1 ? (
              <form onSubmit={handleSendOtp} className="auth-form">
                {authMode === "signup" && (
                  <>
                    <div className="auth-input-group">
                      <label>🏪 Shop / Showroom Name *</label>
                      <div className="phone-input-wrapper">
                        <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Gujrati Tiles" autoFocus required />
                      </div>
                    </div>
                    <div className="auth-input-group">
                      <label>📄 GST Number (Optional)</label>
                      <div className="phone-input-wrapper">
                        <input type="text" value={gst} onChange={e => setGst(e.target.value)} placeholder="15 alphanumeric characters" />
                      </div>
                    </div>
                  </>
                )}

                <div className="auth-input-group">
                  <label>📱 Mobile Number *</label>
                  <div className="phone-input-wrapper">
                    <span className="country-code">+91</span>
                    <input type="number" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 10))} placeholder="Enter your 10-digit number" autoFocus={authMode === "login"} required />
                  </div>
                </div>

                <button type="submit" className="auth-button" disabled={isLoading || phone.length < 10 || (authMode === "signup" && shopName.length < 3)}>
                  {isLoading ? "Sending OTP..." : `Continue to ${authMode === "signup" ? "Sign Up" : "Login"}`}
                </button>

                <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#9ca3af" }}>
                  {authMode === "login" ? (
                    <>New to TileSync? <span onClick={() => setAuthMode("signup")} style={{ color: "#f59e0b", cursor: "pointer", fontWeight: 600 }}>Create an account</span></>
                  ) : (
                    <>Already have an account? <span onClick={() => setAuthMode("login")} style={{ color: "#f59e0b", cursor: "pointer", fontWeight: 600 }}>Login here</span></>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="auth-form">
                <div className="auth-input-group">
                  <label>Enter 6-Digit Verification Code</label>
                  <p className="otp-subtitle">Sent to +91 {phone} <span onClick={() => setStep(1)} className="otp-edit">Edit</span></p>
                  <div className="otp-inputs">
                    {otp.map((digit, index) => (
                      <input key={index} id={`otp-${index}`} type="number" value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} className="otp-digit" />
                    ))}
                  </div>
                </div>
                <button type="submit" className="auth-button" disabled={isLoading || otp.join("").length < 6}>
                  {isLoading ? "Verifying..." : "Verify & Enter Dashboard"}
                </button>
              </form>
            )}
            <div id="recaptcha-container"></div>
          </div>
        </div>
      ) : (
        <>
          <header className="landing-hero">
            <div className="hero-content">
              <h1>The Ultimate Operating System for <br /><span className="highlight-text">Tile Showrooms 🚀</span></h1>
              <p>Manage your inventory, generate instant beautiful GST invoices, and perfectly track all your customer dues and ledgers from one elegant SaaS dashboard.</p>
              <div className="hero-buttons">
                <button className="hero-primary-btn" onClick={() => openAuth("signup")}>✨ Get Started Now</button>
                <button className="hero-secondary-btn" onClick={() => openAuth("login")}>Existing User Login</button>
              </div>
              <div style={{ marginTop: 24, fontSize: 13, color: "#6b7280", display: "flex", gap: 16, alignItems: "center" }}>
                <span>✔️ No Credit Card Required</span>
                <span>✔️ 10 Free Invoices Forever</span>
              </div>
            </div>
            <div className="hero-image-wrapper">
              <img src="/tilesync_hero.png" alt="TileSync Showroom Dashboard Platform" className="hero-image" />
            </div>
          </header>

          <section id="features" style={{ padding: "80px 20px", background: "#0b0c10", textAlign: "center", borderTop: "1px solid #1e2130" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>
              <h2 style={{ fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: 16 }}>How TileSync Helps Your Business</h2>
              <p style={{ fontSize: 18, color: "#9ca3af", marginBottom: 48 }}>Stop using paper diaries and scattered ledgers. Transition to a smart ecosystem built specifically for tile showrooms.</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
                {[
                  { icon: "📦", title: "Smart Inventory", desc: "Instantly track stock across boxes and square feet. Never oversell what you don't have." },
                  { icon: "📄", title: "GST Invoices in Seconds", desc: "Generate professional bills and estimates. Share instantly via WhatsApp as clean PDFs." },
                  { icon: "💰", title: "Ledger & Dues", desc: "Track customer outstandings precisely. Instantly see who owes you, replacing loose sticky notes." },
                  { icon: "🔁", title: "Seamless Returns", desc: "Process item returns, restock inventory, and update payment ledgers with a single click." },
                  { icon: "📊", title: "Profit Tracking", desc: "Log purchases, calculate selling margins, track expenses, and view accurate monthly net profits." },
                  { icon: "📱", title: "Auto-Reminders", desc: "Automatically send SMS reminders to customers with pending payments over 7 days." }
                ].map((feat, i) => (
                  <div key={i} style={{ background: "#12151f", padding: 32, borderRadius: 16, border: "1px solid #1e2130", textAlign: "left" }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>{feat.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{feat.title}</div>
                    <div style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.6 }}>{feat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="pricing" style={{ padding: "80px 20px", background: "#12151f", textAlign: "center", borderTop: "1px solid #1e2130" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>
              <h2 style={{ fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Simple, Transparent Pricing</h2>
              <p style={{ fontSize: 18, color: "#9ca3af", marginBottom: 48 }}>Choose the plan that fits your showroom size. No hidden fees.</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "stretch" }}>
                <div style={{ background: "#1a1d2e", padding: "40px 24px", borderRadius: 24, border: "1px solid #2a2d3e", textAlign: "left", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#fff" }}>Free Tier</div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", margin: "16px 0" }}>₹0</div>
                  <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>Perfect for trying out the platform.</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "#cbd5e1", fontSize: 14, flex: 1 }}>
                    <li style={{ marginBottom: 12 }}>✔️ 10 Bills / Invoices Total</li>
                    <li style={{ marginBottom: 12 }}>✔️ Basic Inventory Tracking</li>
                    <li style={{ marginBottom: 12 }}>✔️ Single User Access</li>
                    <li style={{ marginBottom: 12, color: "#6b7280" }}>✖️ Unlimited Invoices</li>
                    <li style={{ marginBottom: 12, color: "#6b7280" }}>✖️ SMS Reminders</li>
                  </ul>
                  <button onClick={() => openAuth("signup")} style={{ width: "100%", padding: 14, marginTop: 32, background: "transparent", border: "1px solid #475569", color: "#fff", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Start Free</button>
                </div>

                <div style={{ background: "#1a1d2e", padding: "40px 24px", borderRadius: 24, border: "1px solid #2a2d3e", textAlign: "left", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#fff" }}>Standard</div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", margin: "16px 0" }}>₹499<span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>/mo</span></div>
                  <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>For active showrooms with regular sales.</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "#cbd5e1", fontSize: 14, flex: 1 }}>
                    <li style={{ marginBottom: 12 }}>✔️ Unlimited Bills & Quotes</li>
                    <li style={{ marginBottom: 12 }}>✔️ Complete Inventory & Purchases</li>
                    <li style={{ marginBottom: 12 }}>✔️ Ledger & Return Management</li>
                    <li style={{ marginBottom: 12 }}>✔️ Profit & Loss Analytics</li>
                    <li style={{ marginBottom: 12, color: "#6b7280" }}>✖️ SMS Reminders</li>
                  </ul>
                  <button onClick={() => openAuth("signup")} style={{ width: "100%", padding: 14, marginTop: 32, background: "transparent", border: "1px solid #cbd5e1", color: "#fff", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Get Standard</button>
                </div>

                <div style={{ background: "linear-gradient(180deg, #1f1406, #12151f)", padding: "40px 24px", borderRadius: 24, border: "1px solid #92400e", textAlign: "left", position: "relative", display: "flex", flexDirection: "column" }}>
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>MOST POPULAR</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#f59e0b" }}>TileSync Pro</div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", margin: "16px 0" }}>₹999<span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>/mo</span></div>
                  <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>The ultimate upgrade with smart automations.</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "#cbd5e1", fontSize: 14, flex: 1 }}>
                    <li style={{ marginBottom: 12 }}>✔️ All Standard Features</li>
                    <li style={{ marginBottom: 12, fontWeight: 700, color: "#10b981" }}>✔️ Auto SMS Reminders (₹500 value)</li>
                    <li style={{ marginBottom: 12 }}>✔️ Instant WhatsApp Links</li>
                    <li style={{ marginBottom: 12 }}>✔️ Dedicated Server Resources</li>
                    <li style={{ marginBottom: 12 }}>✔️ Priority Support</li>
                  </ul>
                  <button onClick={() => openAuth("signup")} style={{ width: "100%", padding: 14, marginTop: 32, background: "linear-gradient(135deg, #f59e0b, #ef4444)", border: "none", color: "#fff", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Upgrade to Pro</button>
                </div>
              </div>
            </div>
          </section>

          <footer className="landing-footer">
            <div className="footer-links">
              <span onClick={() => alert("Data strictly confidential.")}>Privacy Policy</span>
              <span onClick={() => alert("Terms strictly enforced.")}>Terms of Service</span>
              <span onClick={() => window.open('mailto:support@tilesync.com')}>Contact ✉️</span>
            </div>
            <p>&copy; 2026 TileSync SaaS by Gujrati Tiles Demo. All rights reserved.</p>
          </footer>
        </>
      )}
    </div>
  );
}

// ─── SUBSCRIPTION PAYWALL MODAL ──────────────────────────────────────────────
function SubscriptionModal({ onClose, onSuccess }) {
  const [planName, setPlanName] = useState("Standard"); // "Standard" or "Pro"
  const [isProcessing, setIsProcessing] = useState(false);

  // User's Live Keys: rzp_live_SNrNPYsyvE80KR / EUm1qtOpEo8y5Ox1q88bULbq
  const handleSubscribe = () => {
    setIsProcessing(true);
    const amount = planName === "Standard" ? 49900 : 99900; // Amount in paise
    
    // Safety check just in case the CDN script failed to load
    if (!window.Razorpay) {
      alert("Razorpay SDK failed to load. Please check your internet connection.");
      setIsProcessing(false);
      return;
    }

    const options = {
      key: "rzp_live_SNrNPYsyvE80KR", // Live Key ID
      amount: amount.toString(),
      currency: "INR",
      name: "TileSync SaaS",
      description: `TileSync ${planName} Subscription`,
      image: "https://cdn-icons-png.flaticon.com/512/3063/3063065.png", // Generic Tile icon
      handler: function (response) {
        // Payment Succeeded
        // response.razorpay_payment_id
        onSuccess(planName.toLowerCase(), response.razorpay_payment_id);
      },
      prefill: {
        name: "TileSync Business User",
      },
      theme: {
        color: "#f59e0b"
      },
      modal: {
        ondismiss: function() {
          setIsProcessing(false);
        }
      }
    };
    
    const rzp1 = new window.Razorpay(options);
    rzp1.on('payment.failed', function (response){
      alert("Payment Failed: " + response.error.description);
      setIsProcessing(false);
    });
    
    rzp1.open();
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div className="subscription-modal-card" style={{ background: "#12151f", border: "1px solid #2a2d3e", borderRadius: 24, width: "100%", maxWidth: 600, padding: "40px 32px", position: "relative", textAlign: "center", boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "transparent", border: "none", color: "#6b7280", fontSize: 24, cursor: "pointer" }}>✕</button>

        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, background: "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: 16, fontSize: 32, marginBottom: 24, padding: 10 }}>
          🚀
        </div>

        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 12, letterSpacing: "-0.5px" }}>Upgrade to TileSync {planName}</h2>
        <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 32, lineHeight: 1.5, maxWidth: "80%", margin: "0 auto 32px auto" }}>
          You've reached the free limit of 10 invoices. Upgrade now to unlock unlimited invoices, advanced analytics, and premium CRM features!
        </p>

        <div style={{ display: "flex", background: "#1a1d2e", borderRadius: 12, padding: 6, margin: "0 auto 32px auto", maxWidth: 300, border: "1px solid #2a2d3e" }}>
          <button onClick={() => setPlanName("Standard")} style={{ flex: 1, padding: "10px", borderRadius: 8, background: planName === "Standard" ? "#374151" : "transparent", color: planName === "Standard" ? "#fff" : "#9ca3af", border: "none", cursor: "pointer", fontWeight: 600, transition: "0.2s" }}>Standard</button>
          <button onClick={() => setPlanName("Pro")} style={{ flex: 1, padding: "10px", borderRadius: 8, background: planName === "Pro" ? "#374151" : "transparent", color: planName === "Pro" ? "#fff" : "#9ca3af", border: "none", cursor: "pointer", fontWeight: 600, transition: "0.2s" }}>
            Pro <span style={{ background: "#10b981", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 10, marginLeft: 4 }}>+ SMS</span>
          </button>
        </div>

        <div style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05))", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 16, padding: "32px", marginBottom: 32 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: "#fff", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
            ₹{planName === "Standard" ? "499" : "999"}
            <span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 500 }}> / mo</span>
          </div>
          <div style={{ fontSize: 14, color: "#f59e0b", fontWeight: 600 }}>+ Applicable GST</div>

          <ul style={{ textAlign: "left", display: "inline-block", margin: "24px 0 0 0", padding: 0, listStyle: "none", gap: 12, display: "flex", flexDirection: "column", color: "#e8e8e8", fontSize: 15 }}>
            <li>✅ <span style={{ marginLeft: 8 }}>Unlimited Invoices & Estimates</span></li>
            <li>✅ <span style={{ marginLeft: 8 }}>Unlimited Cloud Storage & Backup</span></li>
            <li>✅ <span style={{ marginLeft: 8 }}>Premium CRM Tracking & Ledger Updates</span></li>
            {planName === "Pro" && <li>✅ <span style={{ marginLeft: 8, color: "#10b981", fontWeight: 700 }}>Automated Text/SMS Reminders</span></li>}
          </ul>
        </div>

        <button disabled={isProcessing} onClick={handleSubscribe} style={{ width: "100%", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", border: "none", padding: "16px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: isProcessing ? "wait" : "pointer", transition: "transform 0.1s, filter 0.2s", opacity: isProcessing ? 0.7 : 1 }} onMouseEnter={e => {if(!isProcessing) e.currentTarget.style.filter = "brightness(1.1)"}} onMouseLeave={e => {if(!isProcessing) e.currentTarget.style.filter = "brightness(1)"}}>
          {isProcessing ? "Connecting to Bank..." : "Subscribe Now & Unlock"}
        </button>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 16 }}>Secure payments powered by Stripe & Razorpay</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function TilesApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [tab, setTab] = useState("billing");
  const [showSubscription, setShowSubscription] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        SHOP_ID = user.uid; // Dynamically set the global SHOP_ID to this user's unique Firebase auth ID
        setIsAuthenticated(true);
      } else {
        SHOP_ID = null;
        setIsAuthenticated(false);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isPro, setIsPro] = useState(false);
  const [isAutoSmsEnabled, setIsAutoSmsEnabled] = useState(false);
  const [viewedBill, setViewedBill] = useState(null);
  const [shopData, setShopData] = useState({ name: "TileSync Store", gst: "" });

  useEffect(() => {
    if (!SHOP_ID) return;

    const shopRef = doc(db, "shops", SHOP_ID);

    // Live Sync
    const unsubscribe = onSnapshot(shopRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setInventory(data.inventory || []);
        setSales(data.sales || []);
        setCustomers(data.customers || []);
        setExpenses(data.expenses || []);
        setPurchases(data.purchases || []);
        setSuppliers(data.suppliers || []);
        
        if (data.subscription && data.subscription.status === "active") {
          setIsPro(true);
        } else {
          setIsPro(false);
        }
        
        // Load custom shop meta
        setShopData({ name: data.shopName || "TileSync Store", gst: data.gst || "" });
        
        // Auto SMS is ONLY available for the "pro" plan. 
        if (data.subscription && data.subscription.plan === "pro") {
          setIsAutoSmsEnabled(data.isAutoSmsEnabled || false);
        } else {
          setIsAutoSmsEnabled(false);
        }
        setIsDataLoaded(true);
      } else {
        // First time login -> Migrate Data
        console.log("No cloud data found. Migrating local data to Firebase...");

        let invToSetup = localStorage.getItem("tiles_inventory") ? JSON.parse(localStorage.getItem("tiles_inventory")) : initialInventory;
        let salesToSetup = localStorage.getItem("tiles_sales") ? JSON.parse(localStorage.getItem("tiles_sales")) : initialSales;
        let cusToSetup = localStorage.getItem("tiles_customers") ? JSON.parse(localStorage.getItem("tiles_customers")) : initialCustomers;
        let expToSetup = localStorage.getItem("tiles_expenses") ? JSON.parse(localStorage.getItem("tiles_expenses")) : initialExpenses;
        let purToSetup = localStorage.getItem("tiles_purchases") ? JSON.parse(localStorage.getItem("tiles_purchases")) : initialPurchases;
        let supToSetup = localStorage.getItem("tiles_suppliers") ? JSON.parse(localStorage.getItem("tiles_suppliers")) : initialSuppliers;

        // Ensure everything is tied to the new SHOP_ID
        invToSetup = invToSetup.map(i => ({ ...i, shopId: SHOP_ID }));
        salesToSetup = salesToSetup.map(i => ({ ...i, shopId: SHOP_ID }));
        cusToSetup = cusToSetup.map(i => ({ ...i, shopId: SHOP_ID }));
        expToSetup = expToSetup.map(i => ({ ...i, shopId: SHOP_ID }));
        purToSetup = purToSetup.map(i => ({ ...i, shopId: SHOP_ID }));
        supToSetup = supToSetup.map(i => ({ ...i, shopId: SHOP_ID }));

        const cloudData = {
          inventory: invToSetup,
          sales: salesToSetup,
          customers: cusToSetup,
          expenses: expToSetup,
          purchases: purToSetup,
          suppliers: supToSetup,
        };

        await setDoc(shopRef, cloudData);
        // Snapshot will naturally trigger again and load the state.
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Fast2SMS Auto Reminders (7-Day Dues)
  useEffect(() => {
    if (!isDataLoaded || !isPro || !isAutoSmsEnabled) return;
    
    const checkAndSendReminders = async () => {
      const todayStr = getLocalDateString();
      let updatedSales = [...sales];
      let hasChanges = false;
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      
      for (let i = 0; i < updatedSales.length; i++) {
        let bill = updatedSales[i];
        if (bill.type === "Invoice" && bill.pending > 0 && bill.customerId) {
          const billDate = new Date(bill.date).getTime();
          const todayDate = new Date().getTime();
          if (todayDate - billDate >= SEVEN_DAYS_MS) {
            // Check if already reminded today
            if (bill.lastRemindedDate !== todayStr) {
               const customer = customers.find(c => c.id === bill.customerId);
               if (customer && customer.phone && customer.phone.length >= 10) {
                 const res = await sendReminderSms(customer.phone, bill.pending, "our showroom");
                 if (res) {
                   bill.lastRemindedDate = todayStr;
                   hasChanges = true;
                   console.log(`Sent auto-reminder to ${customer.phone} for ₹${bill.pending}`);
                 }
               }
            }
          }
        }
      }
      
      if (hasChanges) {
        setSales(updatedSales);
        pushToCloud({ sales: updatedSales });
      }
    };
    
    const timer = setTimeout(() => {
       checkAndSendReminders();
    }, 5000); // Check 5s after boot
    
    return () => clearTimeout(timer);
  }, [isDataLoaded, isPro, isAutoSmsEnabled, sales, customers]);

  const pushToCloud = async (overrideData) => {
    if (!SHOP_ID) return;
    const shopRef = doc(db, "shops", SHOP_ID);

    // We merge the provided override changes with whatever state might be lagging
    const payload = {
      inventory: overrideData.inventory || inventory,
      sales: overrideData.sales || sales,
      customers: overrideData.customers || customers,
      expenses: overrideData.expenses || expenses,
      purchases: overrideData.purchases || purchases,
      suppliers: overrideData.suppliers || suppliers,
    };

    if (overrideData.isAutoSmsEnabled !== undefined) {
      payload.isAutoSmsEnabled = overrideData.isAutoSmsEnabled;
    }
    if (overrideData.subscription !== undefined) {
      payload.subscription = overrideData.subscription;
    }
    if (overrideData.shopName !== undefined) {
      payload.shopName = overrideData.shopName;
    }
    if (overrideData.gst !== undefined) {
      payload.gst = overrideData.gst;
    }

    try {
      await setDoc(shopRef, payload, { merge: true });
    } catch (e) {
      console.error("Cloud push failed:", e);
    }
  };

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addSale = (sale) => {
    const isEstimate = sale.type === "Estimate";

    if (!isEstimate && !isPro) {
      const generatedInvoiceCount = sales.filter(s => s.type === "Invoice" || s.type === "Tax Invoice").length;
      if (generatedInvoiceCount >= 10) {
        setShowSubscription(true);
        return false;
      }
    }

    // Deduct stock only if it's an Invoice
    let nextInventory = inventory;
    if (!isEstimate) {
      nextInventory = inventory.map(tile => {
        const item = sale.items.find(i => i.tileId === tile.id);
        if (item) return { ...tile, stock: tile.stock - item.qty };
        return tile;
      });
      setInventory(nextInventory);
    }

    let nextCustomers = customers;
    if (!customerId) {
      const existingCus = customers.find(c => c.phone && c.phone === sale.customerPhone);
      if (existingCus) {
        customerId = existingCus.id;
      } else {
        customerId = "c" + Date.now();
        const newCustomer = {
          id: customerId, shopId: SHOP_ID, name: sale.customerName, phone: sale.customerPhone,
          address: "", type: "Retail", totalSpent: isEstimate ? 0 : sale.net, totalPending: isEstimate ? 0 : sale.pending
        };
        nextCustomers = [newCustomer, ...customers];
        setCustomers(nextCustomers);
      }
    }

    if (customerId && !isEstimate) {
      nextCustomers = nextCustomers.map(c => c.id === customerId ? {
        ...c, totalSpent: (c.totalSpent || 0) + sale.net, totalPending: (c.totalPending || 0) + sale.pending
      } : c);
      setCustomers(nextCustomers);
    }

    if (!isEstimate) {
      let existingInvoiceIndex = sales.findIndex(s => s.customerId === customerId && s.type === "Invoice");
      if (existingInvoiceIndex >= 0) {
        let updatedSales = [...sales];
        let existingInv = { ...updatedSales[existingInvoiceIndex] };

        let mergedItems = [...existingInv.items];
        sale.items.forEach(newItem => {
          let foundItem = mergedItems.find(i => i.tileId === newItem.tileId);
          if (foundItem) {
            foundItem.qty += newItem.qty;
            foundItem.total += newItem.total;
            // Move updated item to the top
            mergedItems = [foundItem, ...mergedItems.filter(i => i.tileId !== newItem.tileId)];
          } else {
            mergedItems.unshift({ ...newItem });
          }
        });

        existingInv.items = mergedItems;
        existingInv.gross += sale.gross;
        existingInv.discount += sale.discount;
        existingInv.gst += sale.gst;
        existingInv.net += sale.net;
        existingInv.pending += sale.pending;
        existingInv.paid = (existingInv.paid || 0) + (sale.paid || 0);
        existingInv.date = getLocalDateString();

        updatedSales.splice(existingInvoiceIndex, 1);
        let nextSales = [existingInv, ...updatedSales];
        setSales(nextSales);

        pushToCloud({ inventory: nextInventory, customers: nextCustomers, sales: nextSales });
        showToast("✅ Items auto-grouped into Customer's Existing Bill!");
        return true;
      }
    }

    const newSale = {
      ...sale,
      id: "s" + Date.now(),
      shopId: SHOP_ID,
      customerId,
      date: getLocalDateString()
    };

    let nextSales = [newSale, ...sales];
    setSales(nextSales);
    pushToCloud({ inventory: nextInventory, customers: nextCustomers, sales: nextSales });
    showToast(isEstimate ? "📝 Estimate saved!" : "✅ Bill saved successfully!");
    return true;
  };

  const deleteBillItem = (billId, itemIndex) => {
    setSales(prev => {
      let updated = [...prev];
      let billIndex = updated.findIndex(b => b.id === billId);
      if (billIndex === -1) return prev;

      let bill = { ...updated[billIndex] };
      let item = bill.items[itemIndex];

      let confirmDelete = window.confirm(`Are you sure you want to remove ${item.name} from this bill?`);
      if (!confirmDelete) return prev;

      // 1. Add stock back
      setInventory(inv => inv.map(t => t.id === item.tileId ? { ...t, stock: t.stock + item.qty } : t));

      // 2. Adjust Bill Totals
      let removedTotal = item.total;
      bill.items = bill.items.filter((_, i) => i !== itemIndex);

      let newGross = bill.items.reduce((s, i) => s + i.total, 0);
      let gstAmount = bill.gst > 0 ? (newGross - bill.discount) * 0.18 : 0;
      let newNet = newGross - bill.discount + gstAmount;

      let netDiff = bill.net - newNet; // How much lower the bill is now
      bill.gross = newGross;
      bill.gst = gstAmount;
      bill.net = newNet;

      // Reduce pending balance if applicable, otherwise reduce amountPaid
      if (bill.pending >= netDiff) {
        bill.pending -= netDiff;
      } else {
        let extra = netDiff - bill.pending;
        bill.pending = 0;
        bill.paid = Math.max(0, bill.paid - extra);
      }

      // 3. Adjust Customer Totals
      setCustomers(custs => custs.map(c => {
        if (c.id === bill.customerId) {
          let newPending = c.totalPending;
          if (newPending >= netDiff) {
            newPending -= netDiff;
          } else {
            newPending = 0;
          }
          return { ...c, totalSpent: Math.max(0, c.totalSpent - netDiff), totalPending: newPending };
        }
        return c;
      }));

      // If bill is empty now, remove it
      if (bill.items.length === 0) {
        updated.splice(billIndex, 1);
      } else {
        updated[billIndex] = bill;
      }

      // We will perform the push to cloud outside the hook, but for safety in useState callbacks we trigger slightly delayed
      setTimeout(() => {
        pushToCloud({ sales: updated });
      }, 500);

      showToast("🗑️ Item successfully removed from Bill and Stock updated!");
      return updated;
    });
  };

  const recordPayment = (customerId, paidAmt) => {
    let remaining = paidAmt;
    let updatedSales = [...sales];

    // Sort customer's unpaid invoices by oldest first
    let cusInvoices = updatedSales.filter(s => s.customerId === customerId && s.type === "Invoice" && s.pending > 0).sort((a, b) => a.id.localeCompare(b.id));

    cusInvoices.forEach(inv => {
      if (remaining <= 0) return;
      let payAmount = Math.min(inv.pending, remaining);
      inv.pending -= payAmount;
      inv.paid = (inv.paid || 0) + payAmount;
      remaining -= payAmount;
    });

    let nextCustomers = customers.map(c => c.id === customerId ? { ...c, totalPending: c.totalPending - paidAmt } : c);

    setSales(updatedSales);
    setCustomers(nextCustomers);
    pushToCloud({ sales: updatedSales, customers: nextCustomers });
    showToast("💰 Payment recorded successfully!");
  };

  const processReturn = (returnData) => {
    // 1. Update Inventory
    const updatedInv = inventory.map(t => {
      const returnedItem = returnData.items.find(i => i.tileId === t.id || i.name === `${t.name} ${t.size} - ${t.shade}` || i.name === `${t.name} ${t.size} ${t.shade}`);
      if (returnedItem) return { ...t, stock: t.stock + returnedItem.qtyReturned };
      return t;
    });
    setInventory(updatedInv);

    // 2. Adjust Customer Ledger
    let nextCustomers = customers;
    if (returnData.customerId) {
      nextCustomers = customers.map(c => {
        if (c.id === returnData.customerId) {
          let newPending = c.totalPending;
          let diff = returnData.totalRefund;
          if (newPending >= diff) {
            newPending -= diff;
          } else {
            newPending = 0;
          }
          return { ...c, totalSpent: Math.max(0, c.totalSpent - returnData.totalRefund), totalPending: newPending };
        }
        return c;
      });
      setCustomers(nextCustomers);
    }

    // 3. Save as Return Receipt
    const newReturn = {
      id: "r" + Date.now(),
      shopId: SHOP_ID,
      type: "Return",
      billNo: "RET-" + Date.now().toString().slice(-6),
      originalBillId: returnData.originalBillId,
      customerId: returnData.customerId,
      customerName: returnData.customerName,
      items: returnData.items.map(i => ({ ...i, qty: -i.qtyReturned, total: -i.refundAmount })),
      gross: -returnData.totalRefund,
      discount: 0,
      gst: 0,
      net: -returnData.totalRefund,
      paid: -returnData.totalRefund,
      pending: 0,
      paymentMethod: returnData.refundMethod || "Adjusted against due",
      date: getLocalDateString()
    };

    setSales(prev => [newReturn, ...prev]);
    pushToCloud({ inventory: updatedInv, customers: nextCustomers, sales: [newReturn, ...sales] });
    showToast("✅ Return processed successfully!");
  };

  const addInventory = (item) => {
    let nextInv;
    const existing = inventory.find(t =>
      t.id === item.id ||
      (t.name.toLowerCase().trim() === item.name.toLowerCase().trim() &&
        t.shade.toLowerCase().trim() === item.shade.toLowerCase().trim() &&
        t.size === item.size)
    );
    if (existing) {
      nextInv = inventory.map(t =>
        t.id === existing.id
          ? { ...t, stock: t.stock + item.addStock, purchaseRate: item.purchaseRate, sellingRate: item.sellingRate }
          : t
      );
      setInventory(nextInv);
    } else {
      nextInv = [...inventory, { ...item, shopId: SHOP_ID }];
      setInventory(nextInv);
    }
    pushToCloud({ inventory: nextInv });
    showToast("📦 Inventory updated!");
  };

  const deleteSale = (saleId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    if (sale.type === "Invoice") {
      // Restock inventory
      const updated = inventory.map(tile => {
        const item = sale.items.find(i => i.tileId === tile.id || i.name === `${tile.name} ${tile.size} ${tile.shade}`);
        if (item) return { ...tile, stock: tile.stock + item.qty };
        return tile;
      });
      setInventory(updated);

      let nextCustomers = customers;
      // Revert customer balances
      if (sale.customerId) {
        nextCustomers = customers.map(c => c.id === sale.customerId ? {
          ...c, totalSpent: Math.max(0, c.totalSpent - sale.net), totalPending: Math.max(0, c.totalPending - sale.pending)
        } : c);
        setCustomers(nextCustomers);
      }

      let nextSales = sales.filter(s => s.id !== saleId);
      setSales(nextSales);
      pushToCloud({ inventory: updated, customers: nextCustomers, sales: nextSales });
    } else {
      let nextSales = sales.filter(s => s.id !== saleId);
      setSales(nextSales);
      pushToCloud({ sales: nextSales });
    }

    showToast(`🗑️ ${sale.type} deleted successfully!`);
  };

  const deleteInventory = (id) => {
    if (!window.confirm("Are you sure you want to delete this tile from inventory?")) return;
    let nextInv = inventory.filter(t => t.id !== id);
    setInventory(nextInv);
    pushToCloud({ inventory: nextInv });
    showToast("🗑️ Tile deleted successfully!");
  };

  const tabs = [
    { id: "billing", label: "Billing / Est.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { id: "inventory", label: "Stock", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { id: "calculator", label: "Calculator", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" },
    { id: "returns", label: "Returns", icon: "M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" },
    { id: "customers", label: "Customers", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
    { id: "expenses", label: "Expenses", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "purchases", label: "Purchases", icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
    { id: "reports", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  ];

  const lowStock = inventory.filter(t => t.shopId === SHOP_ID && t.stock <= 10 && t.stock > 0);
  const deadStock = inventory.filter(t => t.shopId === SHOP_ID && t.stock === 0);

  if (isAuthLoading) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0c10", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>Loading Secure Environment...</div>;
  }

  if (!isAuthenticated || !SHOP_ID) {
    return (
      <LandingPage onLogin={async (user, newShopName, newShopGst) => {
        // user object passed from handleVerifyOtp
        console.log("Logged in gracefully:", user.uid);
        SHOP_ID = user.uid;
        
        // If this is a new signup, immediately tag the shop name to the cloud document
        if (newShopName) {
           const shopRef = doc(db, "shops", SHOP_ID);
           await setDoc(shopRef, { shopName: newShopName, gst: newShopGst }, { merge: true });
        }
        
        setIsAuthenticated(true);
        setIsAuthLoading(false);
      }} />
    );
  }

  if (!isDataLoaded) {
    return <div style={{ height: "100vh", display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center", background: "#0b0c10", color: "#e8e8e8", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 40 }}>☁️</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Syncing Cloud Data...</div>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>Connecting to TileSync datacenters</div>
    </div>;
  }

  return (
    <div className="app-container">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* GLOBAL BILL VIEWER OVERLAY */}
      {viewedBill && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyItems: "center", padding: "20px", overflowY: "auto" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 500, margin: "auto" }}>
            <button onClick={() => setViewedBill(null)} className="no-print" style={{ position: "absolute", top: -40, right: 0, background: "transparent", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>✕</button>
            <BillPreview bill={viewedBill} shopData={shopData} onClose={() => setViewedBill(null)} />
          </div>
        </div>
      )}

      {/* SUBSCRIPTION PROMPT MODAL */}
      {showSubscription && <SubscriptionModal 
        onClose={() => setShowSubscription(false)} 
        onSuccess={(plan, paymentId) => {
          console.log(`Successfully upgraded to ${plan} with ID ${paymentId}`);
          pushToCloud({ 
            subscription: { 
              status: "active", 
              plan: plan, 
              paymentId: paymentId, 
              startDate: getLocalDateString() 
            }
          });
          setShowSubscription(false);
          alert(`Success! Your account is now upgraded to TileSync ${plan.charAt(0).toUpperCase() + plan.slice(1)}.`);
        }}
      />}

      {/* Header */}
      <div className="header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #f59e0b, #ef4444)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🪨</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-0.3px" }}>Gujrati Tiles</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Showroom Management</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lowStock.length > 0 && (
            <div style={{ background: "#451a03", border: "1px solid #92400e", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "#fbbf24", display: "flex", alignItems: "center", gap: 4 }}>
              ⚠️ {lowStock.length} Low Stock
            </div>
          )}
          {deadStock.length > 0 && (
            <div style={{ background: "#1f1315", border: "1px solid #7f1d1d", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
              🚫 {deadStock.length} Out of Stock
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      {/* Tabs */}
      <div className="tabs-container">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab-button ${tab === t.id ? 'active' : ''}`}
          >
            <Icon d={t.icon} size={15} color={tab === t.id ? "#f59e0b" : "#6b7280"} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="content-wrapper">
        {tab === "billing" && <BillingTab inventory={inventory.filter(t => t.shopId === SHOP_ID)} customers={customers.filter(c => c.shopId === SHOP_ID)} onSave={addSale} mViewBill={(bill) => setViewedBill(bill)} />}
        {tab === "inventory" && <InventoryTab inventory={inventory.filter(t => t.shopId === SHOP_ID)} onAdd={addInventory} onDelete={deleteInventory} />}
        {tab === "calculator" && <CalculatorTab inventory={inventory.filter(t => t.shopId === SHOP_ID)} />}
        {tab === "returns" && <ReturnsTab sales={sales.filter(s => s.shopId === SHOP_ID)} onProcessReturn={processReturn} />}
        {tab === "customers" && <CustomersTab customers={customers.filter(c => c.shopId === SHOP_ID)} sales={sales.filter(s => s.shopId === SHOP_ID)} onRecordPayment={recordPayment} onViewBill={(bill) => setViewedBill(bill)} onViewStatement={(cus) => setViewedBill({ isStatement: true, customer: cus, sales: sales.filter(s => s.customerId === cus.id && s.type === "Invoice") })} onDeleteBillItem={deleteBillItem} onDeleteBill={deleteSale} isPro={isPro} isAutoSmsEnabled={isAutoSmsEnabled} onToggleAutoSms={(val) => { setIsAutoSmsEnabled(val); pushToCloud({ isAutoSmsEnabled: val }); showToast(val ? "🔔 7-Day Auto SMS Enabled!" : "🔕 Auto SMS Disabled"); }} />}
        {tab === "expenses" && <ExpensesTab expenses={expenses.filter(e => e.shopId === SHOP_ID)} onAdd={(e) => { setExpenses(prev => [{ ...e, id: "e" + Date.now(), shopId: SHOP_ID }, ...prev]); showToast("💸 Expense recorded"); }} onDelete={(id) => { setExpenses(prev => prev.filter(e => e.id !== id)); showToast("🗑️ Expense deleted"); }} />}
        {tab === "purchases" && (
          <PurchasesTab purchases={purchases.filter(p => p.shopId === SHOP_ID)} suppliers={suppliers.filter(s => s.shopId === SHOP_ID)} inventory={inventory.filter(t => t.shopId === SHOP_ID)} onUpdateSupplier={(sup) => setSuppliers(prev => prev.map(s => s.id === sup.id ? sup : s))} onAddPurchase={(p, newTileObj) => {
          let currentInv = inventory;
          if (newTileObj) {
            currentInv = [...currentInv, newTileObj];
          }
          const updatedInv = currentInv.map(t => {
            const item = p.items.find(i => i.tileId === t.id);
            if (item) return { ...t, stock: t.stock + item.qty };
            return t;
          });
          setInventory(updatedInv);
          let supId = p.supplierId;
          if (!supId) {
            supId = "sup" + Date.now();
            setSuppliers(prev => [...prev, { id: supId, shopId: SHOP_ID, name: p.supplierName, phone: p.supplierPhone, totalBought: p.net, totalPending: p.pending }]);
          } else {
            setSuppliers(prev => prev.map(s => s.id === supId ? { ...s, totalBought: s.totalBought + p.net, totalPending: s.totalPending + p.pending } : s));
          }
          setPurchases(prev => [{ ...p, id: "p" + Date.now(), shopId: SHOP_ID, supplierId: supId, date: getLocalDateString() }, ...prev]);
          showToast("📦 Purchase recorded!");
        }} />
        )}
        {tab === "reports" && <ReportsTab sales={sales.filter(s => s.shopId === SHOP_ID)} inventory={inventory.filter(t => t.shopId === SHOP_ID)} expenses={expenses.filter(e => e.shopId === SHOP_ID)} onDelete={deleteSale} />}
        {tab === "settings" && <SettingsTab shopData={shopData} isPro={isPro} pushToCloud={pushToCloud} onUpgrade={() => setShowSubscription(true)} onLogout={() => { if (window.confirm("Are you sure you want to log out?")) auth.signOut(); }} />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? "#7f1d1d" : "#064e3b",
          border: `1px solid ${toast.type === "error" ? "#ef4444" : "#10b981"}`,
          color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 999, whiteSpace: "nowrap"
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── BILLING TAB ─────────────────────────────────────────────────────────────
function BillingTab({ inventory, customers, onSave, mViewBill }) {
  const [docType, setDocType] = useState("Invoice"); // Invoice or Estimate

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);

  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(true);

  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [qty, setQty] = useState(1);
  const [selectedTile, setSelectedTile] = useState(null);
  const [billDone, setBillDone] = useState(null);
  const searchRef = useRef();

  useEffect(() => {
    if (customerName.length < 2) { setCustomerSuggestions([]); return; }
    // Avoid showing suggestions if we just selected one
    if (customers.find(c => c.name === customerName && c.id === selectedCustomerId)) return;

    const q = customerName.toLowerCase();
    const results = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    setCustomerSuggestions(results);
  }, [customerName, customers, selectedCustomerId]);

  useEffect(() => {
    if (search.length < 1) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    const results = inventory.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.shade.toLowerCase().includes(q) ||
      t.size.toLowerCase().includes(q)
    );
    setSuggestions(results);
  }, [search, inventory]);

  const selectTile = (tile) => {
    setSelectedTile(tile);
    setSearch(`${tile.name} ${tile.size} ${tile.shade}`);
    setSuggestions([]);
    setQty(1);
  };

  const addToCart = () => {
    if (!selectedTile) return;
    const inCart = cart.find(c => c.tileId === selectedTile.id);
    const totalQty = (inCart ? inCart.qty : 0) + qty;
    if (totalQty > selectedTile.stock) {
      alert(`⚠️ Only ${selectedTile.stock} boxes available in stock!`); return;
    }
    if (inCart) {
      setCart(cart.map(c => c.tileId === selectedTile.id ? { ...c, qty: c.qty + qty, total: (c.qty + qty) * c.rate } : c));
    } else {
      setCart([...cart, {
        tileId: selectedTile.id, name: `${selectedTile.name} ${selectedTile.size} ${selectedTile.shade}`,
        qty, rate: selectedTile.sellingRate, total: qty * selectedTile.sellingRate
      }]);
    }
    setSearch(""); setSelectedTile(null); setQty(1);
  };

  const gross = cart.reduce((s, c) => s + c.total, 0);
  const afterDiscount = gross - (Number(discount) || 0);
  const gstAmt = gstEnabled ? afterDiscount * 0.18 : 0;
  const net = afterDiscount + gstAmt;

  useEffect(() => {
    // If it's an estimate, or if user hasn't explicitly typed an amount, default amountPaid to net (full payment)
    if (docType === "Estimate") setAmountPaid("0");
    else if (amountPaid === "" || Number(amountPaid) > net) setAmountPaid(net.toFixed(2));
  }, [net, docType]);

  const handleSave = () => {
    if (!customerName || cart.length === 0) { alert("Customer name & items required!"); return; }

    let paid = docType === "Estimate" ? 0 : Number(amountPaid);
    if (isNaN(paid)) paid = 0;

    // Safety check - can't pay more than net
    if (paid > net) {
      alert("Amount paid cannot be more than the net total.");
      return;
    }

    const pending = net - paid;
    const billNo = (docType === "Estimate" ? "EST-" : "TPS-") + Date.now().toString().slice(-6);

    const sale = {
      type: docType,
      billNo,
      customerId: selectedCustomerId,
      customerName,
      customerPhone,
      items: cart,
      gross,
      discount: (Number(discount) || 0),
      gst: gstAmt,
      net,
      paid,
      pending,
      paymentMethod
    };

    const success = onSave(sale);
    if (!success) return;

    setBillDone({ ...sale, date: new Date().toLocaleDateString("en-IN") });

    // Reset Form
    setCustomerName(""); setCustomerPhone(""); setSelectedCustomerId(null);
    setCart([]); setDiscount(0); setSearch(""); setAmountPaid("");
  };

  if (billDone) return <BillPreview bill={billDone} onNew={() => setBillDone(null)} />;

  return (
    <div className="billing-layout">

      {/* ─── LEFT COLUMN ─── Main form: toggle, search, cart ─── */}
      <div className="billing-main">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Create Document</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Add items to bill or estimate</div>
          </div>

          {/* Toggle Invoice vs Estimate */}
          <div style={{ display: "flex", background: "#1a1d2e", padding: 4, borderRadius: 8, border: "1px solid #2a2d3e" }}>
            <button
              onClick={() => setDocType("Invoice")}
              className={`btn ${docType === "Invoice" ? "btn-primary" : ""}`}
            >
              Invoice
            </button>
            <button
              onClick={() => setDocType("Estimate")}
              className={`btn ${docType === "Estimate" ? "btn-accent" : ""}`}
            >
              Estimate
            </button>
          </div>
        </div>

        {/* Smart Search */}
        <div style={{ marginBottom: 24, position: "relative" }}>
          <label className="label">Search Inventory</label>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 14, top: 12, color: "#9ca3af" }}>🔍</div>
            <input
              ref={searchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedTile(null); }}
              placeholder="Type tile name, shade, or size..."
              className="input"
              style={{ paddingLeft: 40, paddingRight: 40 }}
            />
            {search && (
              <div
                style={{ position: "absolute", right: 14, top: 12, fontSize: 18, cursor: "pointer", color: "#6b7280" }}
                onClick={() => { setSearch(""); setSuggestions([]); setSelectedTile(null); }}
              >
                ×
              </div>
            )}
          </div>
          {/* Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10, zIndex: 50, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              {suggestions.map(tile => (
                <div key={tile.id} onClick={() => selectTile(tile)}
                  style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #1e2130", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#252837"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>{tile.name} <span style={{ color: "#9ca3af", fontWeight: 400 }}>{tile.size} — {tile.shade}</span></div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>MRP: ₹{tile.sellingRate}/box</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>₹{tile.sellingRate}</div>
                    <div style={{
                      fontSize: 11, marginTop: 2, padding: "2px 8px", borderRadius: 20,
                      background: tile.stock === 0 ? "#7f1d1d" : tile.stock <= 10 ? "#451a03" : "#064e3b",
                      color: tile.stock === 0 ? "#f87171" : tile.stock <= 10 ? "#fbbf24" : "#6ee7b7"
                    }}>
                      {tile.stock === 0 ? "Out of Stock" : `${tile.stock} boxes`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Tile + Qty */}
        {selectedTile && (
          <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>Selected</div>
              <div style={{ fontWeight: 600, color: "#fff" }}>{selectedTile.name} {selectedTile.size} — {selectedTile.shade}</div>
              <div style={{ fontSize: 12, color: "#10b981", marginTop: 2 }}>₹{selectedTile.sellingRate}/box · {selectedTile.stock} boxes available</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} style={qtyBtnStyle}>−</button>
              <span style={{ minWidth: 32, textAlign: "center", fontWeight: 700, color: "#fff", fontSize: 16, fontFamily: "'DM Mono', monospace" }}>{qty}</span>
              <button onClick={() => setQty(Math.min(selectedTile.stock, qty + 1))} style={qtyBtnStyle}>+</button>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Total</div>
              <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 18, fontFamily: "'DM Mono', monospace" }}>₹{(qty * selectedTile.sellingRate).toLocaleString("en-IN")}</div>
            </div>
            <button onClick={addToCart} style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700 }}>
              + Add
            </button>
          </div>
        )}

        {/* Cart */}
        {cart.length > 0 && (
          <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 16px", background: "#1a1d2e", fontSize: 12, color: "#6b7280", display: "flex", justifyContent: "space-between" }}>
              <span>ITEM</span><span>QTY × RATE</span><span>TOTAL</span><span></span>
            </div>
            {cart.map((item, i) => (
              <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #1e2130", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, fontSize: 14, color: "#e8e8e8", fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "#9ca3af", fontFamily: "'DM Mono', monospace", marginRight: 24 }}>{item.qty} × ₹{item.rate}</div>
                <div style={{ fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace", marginRight: 16 }}>₹{item.total.toLocaleString("en-IN")}</div>
                <button onClick={() => setCart(cart.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Customer & Payment Details */}
      <div className="billing-sidebar">
        {/* Customer Details block */}
        <div className="card">
          <div className="card-header">Customer Details</div>

          <div style={{ position: "relative", marginBottom: 12 }}>
            <label className="label">Customer Name *</label>
            <input
              value={customerName}
              onChange={e => { setCustomerName(e.target.value); setSelectedCustomerId(null); }}
              placeholder="e.g. Ramesh Sharma"
              className="input"
            />

            {customerSuggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#252837", border: "1px solid #374151", borderRadius: 8, zIndex: 60, marginTop: 4, overflow: "hidden" }}>
                {customerSuggestions.map(cus => (
                  <div key={cus.id} onClick={() => { setCustomerName(cus.name); setCustomerPhone(cus.phone); setSelectedCustomerId(cus.id); setCustomerSuggestions([]); }}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #374151" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#374151"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ color: "#fff", fontSize: 14 }}>{cus.name}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{cus.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="input"
            />
          </div>
        </div>

        {/* Payment Summary */}
        <div className="card">
          <div className="card-header">Billing Summary</div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Gross Amount</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#fff" }}>₹{gross.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Discount</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#9ca3af" }}>₹</span>
              <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={0} max={gross}
                style={{ width: 80, background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, padding: "4px 8px", color: "#f87171", fontFamily: "'DM Mono', monospace", textAlign: "right", fontSize: 13 }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#9ca3af", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} style={{ accentColor: "#f59e0b" }} />
              GST (18%)
            </label>
            <span style={{ fontFamily: "'DM Mono', monospace", color: gstEnabled ? "#fbbf24" : "#4b5563" }}>₹{gstAmt.toFixed(2)}</span>
          </div>

          <div style={{ borderTop: "1px solid #2a2d3e", paddingTop: 16, marginBottom: docType === "Estimate" ? 0 : 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Net Payable</span>
              <span style={{ fontWeight: 700, fontSize: 22, color: "#10b981", fontFamily: "'DM Mono', monospace" }}>₹{net.toFixed(2)}</span>
            </div>
          </div>

          {docType === "Invoice" && (
            <>
              <div style={{ background: "#1a1d2e", padding: 12, borderRadius: 8, border: "1px solid #2a2d3e", marginBottom: 16 }}>
                <label style={{ ...labelStyle, color: "#fbbf24", marginBottom: 8 }}>Amount Paid Now (₹)</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} max={net} style={{ ...inputStyle, fontSize: 18, fontWeight: 700, color: "#f59e0b", textAlign: "right", padding: "12px 14px", border: "1px solid #451a03", background: "#2d1606" }} />

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13 }}>
                  <span style={{ color: "#9ca3af" }}>Pending Balance:</span>
                  <span style={{ color: "#f87171", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>₹{(net - (Number(amountPaid) || 0)).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Payment Method</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {["Cash", "UPI", "Bank Transfer", "Credit Card"].map(m => (
                    <div key={m} onClick={() => setPaymentMethod(m)} style={{
                      padding: "8px", textAlign: "center", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid",
                      background: paymentMethod === m ? "#10b98122" : "#1a1d2e",
                      borderColor: paymentMethod === m ? "#10b981" : "#2a2d3e",
                      color: paymentMethod === m ? "#10b981" : "#9ca3af"
                    }}>
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <button onClick={handleSave} className="btn btn-primary" style={{ width: "100%", padding: "14px", fontSize: 15 }}>
            {docType === "Estimate" ? "📄 Provide Estimate" : "💾 Save Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BILL PREVIEW ─────────────────────────────────────────────────────────────
function BillPreview({ bill, onNew, onClose, shopData = { name: "TileSync Store", gst: "" } }) {
  const billRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const element = billRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      let imgWidth = pdfWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > pdfHeight) {
        const ratio = pdfHeight / imgHeight;
        imgHeight = pdfHeight;
        imgWidth = imgWidth * ratio;
      }

      pdf.addImage(imgData, "PNG", (pdfWidth - imgWidth) / 2, 0, imgWidth, imgHeight);
      setIsGenerating(false);
      return pdf;
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      alert("Failed to generate PDF.");
      return null;
    }
  };

  const handleWhatsApp = async () => {
    const pdf = await generatePDF();
    if (pdf) {
      const safeShopName = shopData.name.replace(/\s+/g, "_");
      if (bill.isStatement) {
        pdf.save(`${safeShopName}_Statement_${bill.customer.name}.pdf`);
        const text = encodeURIComponent(`Hello ${bill.customer.name || "Customer"},\n\nThank you for shopping at ${shopData.name}! Attached is your Account Statement showing a total pending due of ₹${bill.customer.totalPending.toLocaleString("en-IN")}. Please see the downloaded document for full details.\n\nWarm regards,\n${shopData.name}`);
        window.open(`https://wa.me/${bill.customer.phone || ""}?text=${text}`, "_blank");
      } else {
        pdf.save(`${safeShopName}_Bill_${bill.billNo}.pdf`);
        const text = encodeURIComponent(`Hello ${bill.customerName || "Customer"},\n\nThank you for shopping at ${shopData.name}! Your bill ${bill.billNo} for ₹${bill.net.toFixed(2)} has been saved to your device as a PDF file. Please see the downloaded document for full details.\n\nWarm regards,\n${shopData.name}`);
        window.open(`https://wa.me/${bill.customerPhone || ""}?text=${text}`, "_blank");
      }
    }
  };

  const statementData = useMemo(() => {
    if (!bill.isStatement) return { unique: [], totalDue: 0 };
    const unique = [];
    const seen = new Set();
    bill.sales.forEach(s => {
      if (!seen.has(s.billNo)) {
        seen.add(s.billNo);
        unique.push(s);
      }
    });
    const totalDue = unique.reduce((sum, s) => sum + s.pending, 0);
    return { unique: unique.sort((a, b) => a.id.localeCompare(b.id)), totalDue };
  }, [bill]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div ref={billRef} className="print-section" style={{ background: "#0d1f17", border: "1px solid #166534", borderRadius: 16, padding: 28, maxWidth: 500, margin: "0 auto", color: "#e8e8e8" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{shopData.name}</div>
          {shopData.gst && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>GSTIN: {shopData.gst}</div>}
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            {bill.isStatement ? "Account Statement" : <>Bill No: <span style={{ color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{bill.billNo}</span></>}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{bill.isStatement ? getLocalDateString() : bill.date}</div>
        </div>

        {bill.isStatement ? (
          <div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Customer: <span style={{ color: "#fff", fontWeight: 600 }}>{bill.customer.name}</span></div>
            {statementData.unique.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>No invoices found.</div> : statementData.unique.map((s, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #1e2130" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e8e8e8", marginBottom: 4 }}>
                  <span>{s.date} <span style={{ color: "#f59e0b", fontSize: 11 }}>({s.billNo})</span></span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>₹{s.net.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af" }}>
                  <span>Paid: ₹{(s.paid || 0).toFixed(2)}</span>
                  <span style={{ color: s.pending > 0 ? "#f87171" : "#10b981", fontWeight: 600 }}>Due: ₹{s.pending.toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "16px", background: "#451a03", borderRadius: 8, border: "1px solid #92400e" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#fcd34d", fontSize: 15, fontWeight: 700 }}>
                <span>Total Outstanding</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>₹{statementData.totalDue.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: "#12151f", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>Customer: <span style={{ color: "#fff", fontWeight: 600 }}>{bill.customerName}</span></div>
            {bill.items.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e8e8e8", padding: "6px 0", borderBottom: "1px solid #1e2130" }}>
                <span>{item.name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>{item.qty} box × ₹{item.rate} = ₹{item.total}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 13, color: "#9ca3af" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Gross</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{bill.gross}</span></div>
              {bill.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#f87171" }}><span>Discount</span><span style={{ fontFamily: "'DM Mono', monospace" }}>-₹{bill.discount}</span></div>}
              {bill.gst > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#fbbf24" }}><span>GST (18%)</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{bill.gst.toFixed(2)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, color: "#10b981", marginTop: 8, borderTop: "1px solid #1e2130", paddingTop: 8 }}>
                <span>Net Total</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{bill.net.toFixed(2)}</span>
              </div>

              {(bill.paid !== undefined || bill.pending > 0) && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #2a2d3e" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#e8e8e8", marginBottom: 4 }}>
                    <span>Amount Paid</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{(bill.paid || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#f87171", fontWeight: 600 }}>
                    <span>Balance Due</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{(bill.pending || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="print-thank-you" style={{ textAlign: "center", fontSize: 13, color: "#10b981", marginTop: 24, fontWeight: 600 }}>
          Thank you for choosing {shopData.name}!
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 10, maxWidth: 500, margin: "20px auto 0" }}>
        <button onClick={handleWhatsApp} disabled={isGenerating} style={{ ...btnStyle, flex: 1, background: "#1a1d2e", border: "1px solid #2a2d3e", color: "#10b981", fontSize: 13, fontWeight: 600 }}>
          {isGenerating ? "⏳ Generating..." : "📱 WhatsApp PDF"}
        </button>
        <button onClick={handlePrint} style={{ ...btnStyle, flex: 1, background: "#1a1d2e", border: "1px solid #2a2d3e", color: "#9ca3af", fontSize: 13 }}>
          🖨️ Print
        </button>
        {onNew ? (
          <button onClick={onNew} style={{ ...btnStyle, flex: 1, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 13 }}>
            + New Bill
          </button>
        ) : (
          <button onClick={onClose} style={{ ...btnStyle, flex: 1, background: "#1a1d2e", border: "1px solid #2a2d3e", color: "#fff", fontWeight: 600, fontSize: 13 }}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ─── INVENTORY TAB ───────────────────────────────────────────────────────────
function InventoryTab({ inventory, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", size: "2x4", shade: "", purchaseRate: "", sellingRate: "", addStock: "" });
  const [filter, setFilter] = useState("");

  const filtered = inventory.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.shade.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.name || !form.purchaseRate || !form.sellingRate || !form.addStock) { alert("Fill all fields!"); return; }
    const id = form.id || `t${Date.now()}`;
    onAdd({ ...form, id, purchaseRate: Number(form.purchaseRate), sellingRate: Number(form.sellingRate), addStock: Number(form.addStock), stock: Number(form.addStock), unit: "box" });
    setForm({ id: "", name: "", size: "2x4", shade: "", purchaseRate: "", sellingRate: "", addStock: "" });
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Stock Inventory</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{inventory.length} designs · {inventory.reduce((s, t) => s + t.stock, 0)} boxes total</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700 }}>
          + Add Stock
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Add / Restock Tile</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Tile Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Italian Marble" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Shade / Batch *</label>
              <input value={form.shade} onChange={e => setForm({ ...form, shade: e.target.value })} placeholder="e.g. Shade A / Lot 24" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Size</label>
              <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} style={inputStyle}>
                <option>2x2</option><option>2x4</option><option>1x1</option><option>2x3</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Boxes to Add *</label>
              <input type="number" value={form.addStock} onChange={e => setForm({ ...form, addStock: e.target.value })} placeholder="e.g. 100" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Purchase Rate (₹/box) *</label>
              <input type="number" value={form.purchaseRate} onChange={e => setForm({ ...form, purchaseRate: e.target.value })} placeholder="e.g. 70" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Selling Rate (₹/box) *</label>
              <input type="number" value={form.sellingRate} onChange={e => setForm({ ...form, sellingRate: e.target.value })} placeholder="e.g. 95" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={handleSubmit} style={{ ...btnStyle, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700 }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ ...btnStyle, background: "#12151f", border: "1px solid #2a2d3e", color: "#9ca3af" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search inventory..." style={{ ...inputStyle, marginBottom: 16 }} />

      {/* Stock Table */}
      <div className="table-wrapper" style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, overflow: "hidden" }}>
        <div className="table-header inventory-header" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 0.5fr", padding: "10px 16px", background: "#1a1d2e", fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.5px" }}>
          <span>TILE</span><span>SIZE</span><span>SHADE</span><span>PURCHASE</span><span>SELLING</span><span>STOCK</span><span></span>
        </div>
        {filtered.map((tile, i) => (
          <div key={tile.id} className="table-row inventory-row" style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 0.5fr",
            padding: "12px 16px", borderBottom: "1px solid #1e2130",
            background: i % 2 === 0 ? "transparent" : "#0a0c14",
            alignItems: "center"
          }}>
            <span style={{ fontWeight: 600, color: "#e8e8e8", fontSize: 14 }}>{tile.name}</span>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>{tile.size}</span>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>{tile.shade}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#9ca3af", fontSize: 13 }}>₹{tile.purchaseRate}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#10b981", fontSize: 13, fontWeight: 600 }}>₹{tile.sellingRate}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
              color: tile.stock === 0 ? "#f87171" : tile.stock <= 10 ? "#fbbf24" : "#6ee7b7"
            }}>
              {tile.stock === 0 ? "OUT" : `${tile.stock} box`}
              {tile.stock > 0 && tile.stock <= 10 && <span style={{ marginLeft: 4, fontSize: 10 }}>⚠️</span>}
            </span>
            <button onClick={() => onDelete(tile.id)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, textAlign: "right", display: "flex", justifyContent: "flex-end", alignItems: "center" }} title="Delete Tile">
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CALCULATOR TAB ──────────────────────────────────────────────────────────
function CalculatorTab({ inventory }) {
  const [area, setArea] = useState("");
  const [wastage, setWastage] = useState(10);
  const [selectedSize, setSelectedSize] = useState("2x4");
  const [result, setResult] = useState(null);

  const calculate = () => {
    if (!area) return;
    const sqft = Number(area);
    const withWastage = sqft * (1 + wastage / 100);
    const boxesNeeded = Math.ceil(withWastage / SQ_FT_PER_BOX[selectedSize]);
    const available = inventory.filter(t => t.size === selectedSize && t.stock > 0);
    setResult({ sqft, withWastage, boxesNeeded, available });
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Area Calculator</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Customer ka area daalo — kitne box chahiye sab calculate hoga</div>
      </div>

      <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div className="three-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Room Area (sq.ft)</label>
            <input type="number" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. 450" style={{ ...inputStyle, fontSize: 18, fontWeight: 700, color: "#f59e0b" }} />
          </div>
          <div>
            <label style={labelStyle}>Tile Size</label>
            <select value={selectedSize} onChange={e => setSelectedSize(e.target.value)} style={inputStyle}>
              <option value="2x2">2×2</option>
              <option value="2x4">2×4</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Wastage % (cuts + breakage)</label>
            <input type="number" value={wastage} onChange={e => setWastage(e.target.value)} min={0} max={30} style={inputStyle} />
          </div>
        </div>
        <button onClick={calculate} style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 15, width: "100%", padding: "13px" }}>
          📐 Calculate
        </button>
      </div>

      {result && (
        <div>
          <div className="three-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Base Area", value: `${result.sqft} sq.ft`, color: "#9ca3af" },
              { label: `+${wastage}% Wastage`, value: `${result.withWastage.toFixed(1)} sq.ft`, color: "#fbbf24" },
              { label: "Boxes Required", value: `${result.boxesNeeded} boxes`, color: "#10b981" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Available {selectedSize} Tiles in Stock</div>
          {result.available.map(tile => {
            const enough = tile.stock >= result.boxesNeeded;
            return (
              <div key={tile.id} style={{ background: "#12151f", border: `1px solid ${enough ? "#166534" : "#7f1d1d"}`, borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "#fff" }}>{tile.name} — {tile.shade}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>₹{tile.sellingRate}/box · Est. total: ₹{(result.boxesNeeded * tile.sellingRate).toLocaleString("en-IN")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: enough ? "#10b981" : "#f87171", fontFamily: "'DM Mono', monospace" }}>{tile.stock} box</div>
                  <div style={{ fontSize: 11, color: enough ? "#6ee7b7" : "#f87171", marginTop: 2 }}>{enough ? "✅ Enough stock" : `⚠️ Short by ${result.boxesNeeded - tile.stock} boxes`}</div>
                </div>
              </div>
            );
          })}
          {result.available.length === 0 && <div style={{ color: "#f87171", padding: 16 }}>No {selectedSize} tiles in stock.</div>}
        </div>
      )}
    </div>
  );
}

// ─── CUSTOMERS & CRM TAB ─────────────────────────────────────────────────────
function CustomersTab({ customers, sales, onRecordPayment, onViewStatement, onUpdateCustomer, onViewBill, onDeleteBillItem, onDeleteBill, isPro, isAutoSmsEnabled, onToggleAutoSms }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSmsLogs, setShowSmsLogs] = useState(false);
  const smsHistory = sales.filter(s => s.lastRemindedDate).sort((a,b) => new Date(b.lastRemindedDate).getTime() - new Date(a.lastRemindedDate).getTime());

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerSales = selectedCustomer ? sales.filter(s => s.customerId === selectedCustomer.id && s.type === "Invoice") : [];

  const handlePayBalance = () => {
    const amt = prompt(`Enter amount paid by ${selectedCustomer.name} towards pending balance of ₹${selectedCustomer.totalPending}:`);
    if (!amt || isNaN(amt)) return;

    const paid = Number(amt);
    if (paid <= 0 || paid > selectedCustomer.totalPending) {
      alert("Invalid amount."); return;
    }

    onRecordPayment(selectedCustomer.id, paid);
  };

  if (selectedCustomer) {
    return (
      <div>
        <button onClick={() => setSelectedCustomerId(null)} style={{ ...btnStyle, background: "transparent", color: "#6b7280", padding: 0, marginBottom: 20 }}>
          ← Back to Directory
        </button>

        <div className="split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
          <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 24 }}>
            <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", fontWeight: 700, marginBottom: 16 }}>
              {selectedCustomer.name.charAt(0)}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{selectedCustomer.name}</div>
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>{selectedCustomer.phone}</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <span style={{ padding: "4px 10px", background: "#1e3a8a", color: "#93c5fd", borderRadius: 20, fontSize: 12 }}>{selectedCustomer.type}</span>
            </div>

            <div style={{ borderTop: "1px solid #2a2d3e", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Lifetime Value</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981", fontFamily: "'DM Mono', monospace" }}>₹{selectedCustomer.totalSpent.toLocaleString("en-IN")}</div>
            </div>

            <div style={{ background: selectedCustomer.totalPending > 0 ? "#451a03" : "#12151f", border: `1px solid ${selectedCustomer.totalPending > 0 ? "#92400e" : "#2a2d3e"}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: selectedCustomer.totalPending > 0 ? "#fcd34d" : "#6b7280", marginBottom: 4 }}>Pending Due</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: selectedCustomer.totalPending > 0 ? "#fbbf24" : "#e8e8e8", fontFamily: "'DM Mono', monospace" }}>₹{selectedCustomer.totalPending.toLocaleString("en-IN")}</div>

              {selectedCustomer.totalPending > 0 && (
                <button onClick={handlePayBalance} style={{ ...btnStyle, width: "100%", background: "#f59e0b", color: "#000", fontWeight: 700, marginTop: 12, padding: "8px" }}>
                  💰 Receive Payment
                </button>
              )}

              {customerSales.length > 0 && (
                <button onClick={() => onViewStatement(selectedCustomer)} style={{ ...btnStyle, width: "100%", background: "transparent", border: "1px dashed #6366f1", color: "#818cf8", fontWeight: 600, marginTop: 12, padding: "8px" }}>
                  📄 Share Account Statement
                </button>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Purchase History ({customerSales.length})</div>
            {customerSales.length === 0 ? <div style={{ color: "#6b7280" }}>No purchases yet.</div> : (
              customerSales.map(bill => (
                <div key={bill.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8, alignItems: "center", gap: 8 }}>
                    <div>
                      <span style={{ color: "#f59e0b", fontFamily: "'DM Mono', monospace", fontWeight: 600, marginRight: 12 }}>{bill.billNo}</span>
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>{bill.date}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <button onClick={() => onViewBill(bill)} style={{ background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>📄 View Bill</button>
                      <button onClick={() => onDeleteBill(bill.id)} style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#ef4444", padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>🗑️ Delete Bill</button>
                      <div style={{ fontWeight: 700, color: "#10b981", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{bill.net.toFixed(2)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {bill.items.map((i, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #2a2d3e", paddingBottom: 4, marginBottom: 4 }}>
                        <span>{i.name} ({i.qty})</span>
                        <button onClick={() => onDeleteBillItem(bill.id, idx)} style={{ ...btnStyle, background: "transparent", color: "#ef4444", padding: "2px 6px", fontSize: 12 }}>🗑️ Remove</button>
                      </div>
                    ))}
                  </div>
                  {bill.pending > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", fontFamily: "'DM Mono', monospace" }}>
                      ⚠️ Unpaid: ₹{bill.pending.toFixed(2)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div>
      {showSmsLogs && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#12151f", border: "1px solid #2a2d3e", borderRadius: 16, padding: 24, width: "100%", maxWidth: 600, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>SMS Reminder Logs</div>
              <button onClick={() => setShowSmsLogs(false)} style={{ background: "transparent", color: "#9ca3af", border: "none", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>&times;</button>
            </div>
            
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              This list details all customers who have automatically received a 7-Day overdue payment reminder via Fast2SMS.
            </div>

            {smsHistory.length === 0 ? (
              <div style={{ color: "#6b7280", textAlign: "center", padding: 40, background: "#1a1d2e", borderRadius: 12, border: "1px dashed #2a2d3e" }}>No SMS reminders have been sent automatically yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {smsHistory.map(bill => {
                   const c = customers.find(c => c.id === bill.customerId);
                   return (
                     <div key={bill.id} style={{ background: "#1a1d2e", padding: 16, borderRadius: 10, border: "1px solid #2a2d3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                       <div>
                         <div style={{ color: "#e8e8e8", fontWeight: 600, marginBottom: 4 }}>{c ? c.name : "Unknown Customer"}</div>
                         <div style={{ fontSize: 13, color: "#9ca3af" }}>Bill No: <span style={{ color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{bill.billNo}</span>  •  Sent: {bill.lastRemindedDate}</div>
                       </div>
                       <div style={{ textAlign: "right" }}>
                         <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>Reminder For</div>
                         <div style={{ color: "#f87171", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>₹{bill.pending.toFixed(2)} Due</div>
                       </div>
                     </div>
                   );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Customer Directory Dashboard</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{customers.length} total customers · ₹{customers.reduce((s, c) => s + c.totalPending, 0).toLocaleString("en-IN")} pending in market</div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {isPro && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1d2e", padding: "8px 12px", borderRadius: 8, border: "1px solid #2a2d3e" }}>
              <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>Auto-Reminders</span>
              <div onClick={() => onToggleAutoSms(!isAutoSmsEnabled)} style={{ width: 40, height: 20, background: isAutoSmsEnabled ? "#10b981" : "#374151", borderRadius: 20, position: "relative", cursor: "pointer", transition: "background 0.3s" }} title="Send automatic SMS to 7-Day overdue customers">
                <div style={{ position: "absolute", top: 2, left: isAutoSmsEnabled ? 22 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left 0.3s" }}></div>
              </div>
              <button onClick={() => setShowSmsLogs(true)} style={{ marginLeft: 8, background: "transparent", border: "1px dashed #6366f1", color: "#818cf8", fontSize: 12, padding: "4px 8px", borderRadius: 6, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.target.style.background = "rgba(99,102,241,0.1)"} onMouseLeave={e => e.target.style.background = "transparent"}>📜 View Logs</button>
            </div>
          )}
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customers..."
            className="input"
            style={{ width: "250px", background: "#1a1d2e" }}
          />
        </div>
      </div>

      <div className="table-wrapper" style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, overflow: "hidden" }}>
        <div className="table-header customers-header" style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", padding: "12px 20px", background: "#1a1d2e", fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.5px" }}>
          <span>CUSTOMER</span><span>PHONE</span><span>TYPE</span><span>LIFETIME SPENT</span><span>PENDING DUE</span>
        </div>
        {filteredCustomers.map((c, i) => (
          <div key={c.id} className="table-row customers-row" onClick={() => setSelectedCustomerId(c.id)} style={{
            display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
            padding: "16px 20px", borderBottom: "1px solid #1e2130",
            background: i % 2 === 0 ? "transparent" : "#0a0c14",
            alignItems: "center", cursor: "pointer", transition: "background 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "#1a1d2e"} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#0a0c14"}>
            <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>{c.name}</div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>{c.phone}</div>
            <div><span style={{ padding: "4px 8px", background: "#1e3a8a", color: "#93c5fd", borderRadius: 20, fontSize: 11 }}>{c.type}</span></div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#10b981", fontSize: 14, fontWeight: 600 }}>₹{c.totalSpent.toLocaleString("en-IN")}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: c.totalPending > 0 ? "#f87171" : "#6ee7b7", fontSize: 14, fontWeight: 600 }}>
              {c.totalPending > 0 ? `₹${c.totalPending.toLocaleString("en-IN")}` : "Paid"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EXPENSES TAB ────────────────────────────────────────────────────────────
function ExpensesTab({ expenses, onAdd, onDelete }) {
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [cat, setCat] = useState("Transport");

  const cats = ["Transport", "Rent", "Electricity", "Staff Salary", "Tea/Snacks", "Marketing", "Other"];

  const handleSave = () => {
    if (!desc || !amt) return alert("Fill all details");
    onAdd({ desc, amount: Number(amt), category: cat, date: getLocalDateString() });
    setDesc(""); setAmt(""); setCat("Transport");
  };

  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Log Expense</div>
        <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Expense Title / Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Tempo load" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Amount (₹)</label>
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="e.g. 500" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Category</label>
            <select value={cat} onChange={e => setCat(e.target.value)} style={inputStyle}>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={handleSave} style={{ ...btnStyle, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700, width: "100%", padding: "12px" }}>
            Add Expense
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Recent Expenses</div>
          <div style={{ fontSize: 16, color: "#f87171", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>Total: ₹{totalExp.toLocaleString("en-IN")}</div>
        </div>

        {expenses.length === 0 ? <div style={{ color: "#6b7280" }}>No expenses recorded.</div> : expenses.map(e => (
          <div key={e.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, color: "#fff", fontSize: 15, marginBottom: 4 }}>{e.desc}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
                <span style={{ padding: "2px 8px", background: "#374151", borderRadius: 12 }}>{e.category}</span>
                <span>{e.date}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontWeight: 700, color: "#f87171", fontFamily: "'DM Mono', monospace", fontSize: 18 }}>₹{e.amount}</span>
              <button onClick={() => onDelete(e.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PURCHASES & SUPPLIERS TAB ───────────────────────────────────────────────
function PurchasesTab({ purchases, suppliers, inventory, onUpdateSupplier, onAddPurchase }) {
  const [view, setView] = useState("form"); // "form" or "directory"
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  const [isNewTile, setIsNewTile] = useState(false);
  const [newTileName, setNewTileName] = useState("");
  const [newTileSize, setNewTileSize] = useState("");
  const [newTileShade, setNewTileShade] = useState("");
  const [newSellingRate, setNewSellingRate] = useState("");

  const [selectedTileId, setSelectedTileId] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  const handleSave = () => {
    if (!supplierName) { alert("Supplier name required."); return; }

    let tile;
    let newTileObj = null;

    if (isNewTile) {
      if (!newTileName || !newTileSize || !newTileShade || !newSellingRate || !qty || !rate) {
        alert("All new tile details are required."); return;
      }
      newTileObj = {
        id: "t" + Date.now(),
        shopId: "shop_001",
        name: newTileName,
        size: newTileSize,
        shade: newTileShade,
        stock: 0,
        purchaseRate: Number(rate),
        sellingRate: Number(newSellingRate)
      };
      tile = newTileObj;
    } else {
      tile = inventory.find(t => t.id === selectedTileId);
      if (!tile || !qty || !rate) { alert("Tile details required."); return; }
    }

    const net = Number(qty) * Number(rate);
    const paid = Number(amountPaid) || 0;

    const purchase = {
      type: "Purchase",
      supplierName,
      supplierPhone,
      supplierId: selectedSupplierId,
      items: [{ tileId: tile.id, name: `${tile.name} ${tile.size} - ${tile.shade}`, qty: Number(qty), rate: Number(rate), total: net }],
      net,
      paid,
      pending: net - paid
    };

    onAddPurchase(purchase, newTileObj);

    setSupplierName(""); setSupplierPhone(""); setSelectedSupplierId(null);
    setSelectedTileId(""); setQty(""); setRate(""); setAmountPaid("");
    setIsNewTile(false); setNewTileName(""); setNewTileSize(""); setNewTileShade(""); setNewSellingRate("");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setView("form")} style={{ ...btnStyle, background: view === "form" ? "#10b981" : "#1a1d2e", color: view === "form" ? "#000" : "#9ca3af", fontWeight: view === "form" ? 700 : 500 }}>
          ➕ Add Purchase / Stock
        </button>
        <button onClick={() => setView("directory")} style={{ ...btnStyle, background: view === "directory" ? "#3b82f6" : "#1a1d2e", color: view === "directory" ? "#fff" : "#9ca3af", fontWeight: view === "directory" ? 700 : 500 }}>
          🏢 Supplier Directory
        </button>
      </div>

      {view === "form" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Supplier Info & Tile Input */}
          <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Supplier Details</div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Supplier Name *</label>
              <div style={{ position: "relative" }}>
                <input value={supplierName} onChange={e => {
                  setSupplierName(e.target.value);
                  const existing = suppliers.find(s => s.name.toLowerCase() === e.target.value.toLowerCase());
                  if (existing) { setSelectedSupplierId(existing.id); setSupplierPhone(existing.phone); } else { setSelectedSupplierId(null); }
                }} placeholder="e.g. Kajaria Distributors" style={inputStyle} list="supplier-list" />
                <datalist id="supplier-list">
                  {suppliers.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Phone Number</label>
              <input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="e.g. 9876543210" style={inputStyle} />
            </div>

            <div style={{ borderTop: "1px solid #2a2d3e", margin: "20px 0" }}></div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Stock Arrived</div>
              <label style={{ fontSize: 13, color: "#9ca3af", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={isNewTile} onChange={e => setIsNewTile(e.target.checked)} style={{ accentColor: "#10b981" }} />
                Add New Tile
              </label>
            </div>

            {isNewTile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Tile Name (e.g. Kajaria Matt) *</label>
                  <input value={newTileName} onChange={e => setNewTileName(e.target.value)} placeholder="Tile Name" style={inputStyle} />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Size *</label>
                    <input value={newTileSize} onChange={e => setNewTileSize(e.target.value)} placeholder="2x2" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Shade *</label>
                    <input value={newTileShade} onChange={e => setNewTileShade(e.target.value)} placeholder="Grey" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Expected Selling Rate (₹/box) *</label>
                  <input type="number" value={newSellingRate} onChange={e => setNewSellingRate(e.target.value)} placeholder="0" min="0" style={inputStyle} />
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Select Tile *</label>
                <select value={selectedTileId} onChange={e => setSelectedTileId(e.target.value)} style={inputStyle}>
                  <option value="">-- Choose from Inventory --</option>
                  {inventory.map(t => <option key={t.id} value={t.id}>{t.name} ({t.size}) - {t.shade}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Boxes Bought *</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1} placeholder="0" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Purchase Rate (₹) *</label>
                <input type="number" value={rate} onChange={e => setRate(e.target.value)} min={0} placeholder="0" style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Purchase Summary */}
            <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Payment Summary</div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: "#9ca3af" }}>Total Bill Amount</span>
                <span style={{ fontWeight: 700, fontSize: 20, color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>
                  ₹{(Number(qty) * Number(rate) || 0).toLocaleString("en-IN")}
                </span>
              </div>

              <div style={{ background: "#1a1d2e", padding: 16, borderRadius: 8, border: "1px solid #2a2d3e", marginBottom: 16 }}>
                <label style={{ ...labelStyle, color: "#fbbf24", marginBottom: 8 }}>Amount Paid to Supplier (₹)</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} max={Number(qty) * Number(rate)} style={{ ...inputStyle, fontSize: 18, fontWeight: 700, color: "#10b981", textAlign: "right", padding: "12px 14px", border: "1px solid #064e3b", background: "#022c22" }} />
              </div>

              <button onClick={handleSave} style={{ ...btnStyle, width: "100%", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px" }}>
                💾 Log Purchase & Update Stock
              </button>
            </div>

            {/* Recent Purchases List */}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Recent Purchases</div>
              {purchases.length === 0 ? <div style={{ color: "#6b7280" }}>No purchases yet.</div> : purchases.slice(0, 3).map(p => (
                <div key={p.id} style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#e8e8e8", fontSize: 13 }}>{p.supplierName}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: "#10b981", fontSize: 13, fontWeight: 600 }}>₹{p.net}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {p.items.map((i, idx) => <span key={idx}>{i.name} ({i.qty} boxes)</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "directory" && (
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Supplier Ledgers ({suppliers.length})</div>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {suppliers.map(s => (
              <div key={s.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: 18, marginBottom: 4 }}>{s.name}</div>
                <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>{s.phone}</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 1, background: "#1a1d2e", padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Total Purchased</div>
                    <div style={{ fontWeight: 700, color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{s.totalBought.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ flex: 1, background: s.totalPending > 0 ? "#451a03" : "#1a1d2e", border: s.totalPending > 0 ? "1px solid #92400e" : "none", padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: s.totalPending > 0 ? "#fbbf24" : "#6b7280", marginBottom: 4 }}>You Owe (Pending)</div>
                    <div style={{ fontWeight: 700, color: s.totalPending > 0 ? "#f87171" : "#10b981", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{s.totalPending.toLocaleString("en-IN")}</div>
                  </div>
                </div>
                {s.totalPending > 0 && (
                  <button onClick={() => {
                    const amt = prompt(`Amount paying to ${s.name} to clear dues of ₹${s.totalPending}:`);
                    if (amt && !isNaN(amt) && Number(amt) > 0 && Number(amt) <= s.totalPending) {
                      onUpdateSupplier({ ...s, totalPending: s.totalPending - Number(amt) });
                    } else if (amt) {
                      alert("Invalid amount.");
                    }
                  }} style={{ ...btnStyle, width: "100%", background: "#2a2d3e", border: "1px solid #374151", color: "#fbbf24", marginTop: 12, fontSize: 13 }}>
                    💸 Settle Payment
                  </button>
                )}
              </div>
            ))}
            {suppliers.length === 0 && <div style={{ color: "#6b7280", padding: 20 }}>No suppliers found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RETURNS & REFUNDS TAB ───────────────────────────────────────────────────
function ReturnsTab({ sales, onProcessReturn }) {
  const [selectedBillId, setSelectedBillId] = useState("");
  const [returnQtys, setReturnQtys] = useState({});
  const [refundMethod, setRefundMethod] = useState("Adjusted against due");

  const bills = sales.filter(s => s.type === "Invoice" || s.type === "Return");

  const bill = bills.find(b => b.id === selectedBillId);

  const handleQtyChange = (idx, val) => {
    setReturnQtys({ ...returnQtys, [idx]: Number(val) });
  };

  const handleReturn = () => {
    if (!bill) return;

    const itemsReturned = [];
    let totalRefund = 0;

    bill.items.forEach((item, idx) => {
      const q = returnQtys[idx];
      if (q && q > 0) {
        const amt = q * item.rate;
        itemsReturned.push({ ...item, qtyReturned: q, refundAmount: amt });
        totalRefund += amt;
      }
    });

    if (itemsReturned.length === 0) {
      alert("Please enter return quantity for at least one item.");
      return;
    }

    if (window.confirm(`Process return of ₹${totalRefund} for ${itemsReturned.length} items?`)) {
      onProcessReturn({
        originalBillId: bill.id,
        customerId: bill.customerId,
        customerName: bill.customerName,
        items: itemsReturned,
        totalRefund,
        refundMethod
      });
      setSelectedBillId("");
      setReturnQtys({});
    }
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Process Return / Refund</div>

      <div className="split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Select Invoice</div>

          <label style={labelStyle}>Search Bill No.</label>
          <select value={selectedBillId} onChange={e => { setSelectedBillId(e.target.value); setReturnQtys({}); }} style={{ ...inputStyle, marginBottom: 16 }}>
            <option value="">-- Select an Invoice --</option>
            {bills.filter(b => b.type === "Invoice").map(b => (
              <option key={b.id} value={b.id}>{b.billNo} - {b.customerName} (₹{b.net})</option>
            ))}
          </select>

          {bill && (
            <div style={{ background: "#12151f", padding: 16, borderRadius: 8, border: "1px solid #1e2130" }}>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>Bill details</div>
              <div style={{ fontWeight: 600, color: "#fff", marginBottom: 2 }}>{bill.customerName}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Date: {bill.date} • Paid: ₹{bill.paid} • Pending: ₹{bill.pending}</div>
            </div>
          )}
        </div>

        {bill && (
          <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Return Items</div>

            {bill.items.map((item, idx) => (
              <div key={idx} style={{ padding: "12px 0", borderBottom: "1px solid #1e2130", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "#e8e8e8" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Orig. Qty: {item.qty} | Rate: ₹{item.rate}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "#9ca3af" }}>Return Qty:</label>
                  <input type="number" min={0} max={item.qty} value={returnQtys[idx] || ""} onChange={e => handleQtyChange(idx, e.target.value)} style={{ width: 60, background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, padding: "6px 8px", color: "#f87171", fontFamily: "'DM Mono', monospace", textAlign: "right" }} />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <label style={labelStyle}>Refund Method</label>
              <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} style={inputStyle}>
                <option value="Adjusted against due">Adjust against pending dues</option>
                <option value="Cash Refund">Cash Refund</option>
                <option value="UPI Refund">UPI Refund</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <button onClick={handleReturn} style={{ ...btnStyle, width: "100%", background: "linear-gradient(135deg, #f87171, #ef4444)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px" }}>
              ↩️ Process Return & Refund
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── REPORTS TAB ─────────────────────────────────────────────────────────────
function ReportsTab({ sales, inventory, expenses, onDelete }) {
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const getFilteredData = (dataArray) => {
    if (!dataArray) return [];

    const todayStr = getLocalDateString();

    if (dateFilter === "all") return dataArray;

    if (dateFilter === "today") return dataArray.filter(d => d.date === todayStr);

    if (dateFilter === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const lastWeekStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
      return dataArray.filter(x => x.date && x.date >= lastWeekStr);
    }

    if (dateFilter === "month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const lastMonthStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
      return dataArray.filter(x => x.date && x.date >= lastMonthStr);
    }

    if (dateFilter === "custom" && startDate && endDate) {
      return dataArray.filter(x => x.date && x.date >= startDate && x.date <= endDate);
    }

    return dataArray;
  };

  const filteredSales = getFilteredData(sales);
  const filteredExpenses = getFilteredData(expenses);

  const todayStr = getLocalDateString();
  const todaySales = sales.filter(s => s.date === todayStr);

  // Expenses sum
  const totalExpenses = Array.isArray(filteredExpenses)
    ? filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    : 0;

  // Profit should be calculated on GROSS - DISCOUNT. GST is not profit. Only for valid Invoices.
  const validInvoices = filteredSales.filter(b => b.type === "Invoice");
  const returnInvoices = filteredSales.filter(b => b.type === "Return");

  const totalRevenue = validInvoices.reduce((s, b) => s + (b.gross - (b.discount || 0)), 0);
  const totalReturnsNet = returnInvoices.reduce((s, b) => s + Math.abs(b.gross), 0); // Refunds taken out

  const totalCost = validInvoices.reduce((s, b) => {
    return s + b.items.reduce((ss, item) => {
      let matchedTile = inventory.find(t => `${t.name} ${t.size} - ${t.shade}` === item.name || `${t.name} ${t.size} ${t.shade}` === item.name);
      return ss + (matchedTile ? matchedTile.purchaseRate * item.qty : 0);
    }, 0);
  }, 0);

  const profit = totalRevenue - totalReturnsNet - totalCost - totalExpenses;

  const stats = [
    { label: "Valid Bills Generated", value: validInvoices.length, color: "#60a5fa" },
    { label: "Total Revenue (excl. GST)", value: `₹${totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#10b981" },
    { label: "Net Profit", value: `₹${profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: profit < 0 ? "#f87171" : "#f59e0b" },
    { label: "Total Expenses", value: `₹${totalExpenses.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#f87171" },
  ];

  const exportCSV = () => {
    if (filteredSales.length === 0) {
      alert("No data to export");
      return;
    }

    // We create flat records from the sales data. Since bills have multiple items,
    // we export one row per bill to keep things simple for high-level CSV analysis.
    const csvRows = [
      ["Bill No", "Date", "Document", "Customer", "Items Count", "Items Details", "Gross", "Discount", "GST", "Net Payable", "Amount Paid", "Pending Balance", "Payment Method"]
    ];

    filteredSales.forEach(s => {
      csvRows.push([
        s.billNo,
        s.date,
        s.type,
        s.customerName,
        s.items.length,
        s.items.map(i => `${i.name} (${i.qty})`).join(" | "),
        s.gross,
        s.discount,
        s.gst,
        s.net,
        s.paid,
        s.pending,
        s.paymentMethod || "N/A"
      ]);
    });

    const csvContent = csvRows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_report_${dateFilter}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Reports & Analytics</div>
        <button onClick={exportCSV} style={{ ...btnStyle, background: "#10b981", color: "#000", fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
          <span>📥</span> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>Filter Timeline:</div>

        <div style={{ display: "flex", background: "#12151f", borderRadius: 8, padding: 4 }}>
          {[
            { id: "all", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "week", label: "Last 7 Days" },
            { id: "month", label: "Last 30 Days" },
            { id: "custom", label: "Custom Dates" }
          ].map(f => (
            <button key={f.id} onClick={() => setDateFilter(f.id)} style={{
              ...btnStyle, padding: "6px 16px", borderRadius: 6, fontSize: 13,
              background: dateFilter === f.id ? "#3b82f6" : "transparent",
              color: dateFilter === f.id ? "#fff" : "#9ca3af",
              fontWeight: dateFilter === f.id ? 600 : 500
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {dateFilter === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 12px" }} />
            <span style={{ color: "#6b7280" }}>to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 12px" }} />
          </div>
        )}
      </div>

      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div style={{ background: "#0d1a2d", border: "1px solid #1d3557", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa", marginBottom: 12 }}>🤖 AI Insights</div>
        {inventory.filter(t => t.stock === 0).length > 0 && (
          <div style={{ fontSize: 13, color: "#f87171", marginBottom: 8 }}>🚫 {inventory.filter(t => t.stock === 0).length} designs out of stock — reorder immediately</div>
        )}
        {inventory.filter(t => t.stock > 0 && t.stock <= 10).length > 0 && (
          <div style={{ fontSize: 13, color: "#fbbf24", marginBottom: 8 }}>⚠️ {inventory.filter(t => t.stock > 0 && t.stock <= 10).length} designs running low — restock soon</div>
        )}
        <div style={{ fontSize: 13, color: "#6ee7b7" }}>
          ✅ Profit margin: {totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : 0}% — {profit / totalRevenue > 0.2 ? "Healthy!" : "Consider reviewing pricing"}
        </div>
      </div>

      {/* Recent Bills */}
      <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 12 }}>{dateFilter !== "all" ? "Filtered Bills" : "Recent Bills"}</div>
      {filteredSales.slice(0, 15).map(bill => (
        <div key={bill.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>
                <span style={{ color: "#f59e0b", fontFamily: "'DM Mono', monospace", marginRight: 8 }}>{bill.billNo}</span>
                {bill.customerName}
              </div>
              <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                {bill.items.map(i => `${i.name} (${i.qty})`).join(', ')}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: "#10b981", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{bill.net.toFixed(0)}</div>
              {bill.pending > 0 && <div style={{ fontSize: 11, color: "#f87171", fontFamily: "'DM Mono', monospace" }}>Pending: ₹{bill.pending.toFixed(0)}</div>}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e2130", paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 12 }}>
              <span>📅 {bill.date}</span>
              <span>📦 {bill.type}</span>
            </div>
            <button onClick={() => onDelete(bill.id)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}
      {filteredSales.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          No records found for the selected time period.
        </div>
      )}
    </div>
  );
}

// ─── SHARED STYLES ───────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", background: "#12151f", border: "1px solid #2a2d3e", borderRadius: 8,
  padding: "10px 14px", color: "#e8e8e8", fontSize: 14, outline: "none",
  fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box"
};

const labelStyle = {
  display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500, letterSpacing: "0.3px"
};

const btnStyle = {
  padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", transition: "opacity 0.2s"
};

const qtyBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: "1px solid #2a2d3e",
  background: "#1a1d2e", color: "#fff", fontSize: 18, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif"
};

// ─── SETTINGS TAB ───────────────────────────────────────────────────────────
function SettingsTab({ shopData, isPro, pushToCloud, onUpgrade, onLogout }) {
  const [name, setName] = useState(shopData?.name || "");
  const [gst, setGst] = useState(shopData?.gst || "");

  const handleSave = () => {
     pushToCloud({ shopName: name, gst: gst });
     alert("Firm details updated successfully!");
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
       <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 24, fontWeight: 700 }}>Showroom Settings</h2>
       
       <div style={{ background: "#1a1d2e", padding: "24px", borderRadius: 16, border: "1px solid #2a2d3e", marginBottom: 24 }}>
         <h3 style={{ color: "#e8e8e8", marginTop: 0, marginBottom: 16, fontSize: 18 }}>Business Identity</h3>
         <div style={{ marginBottom: 16 }}>
           <label style={labelStyle}>Showroom / Firm Name</label>
           <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="e.g. M/S Sharma Tiles" />
         </div>
         <div style={{ marginBottom: 16 }}>
           <label style={labelStyle}>GST Number (Optional)</label>
           <input type="text" value={gst} onChange={e => setGst(e.target.value)} style={inputStyle} placeholder="15 alphanumeric characters" />
         </div>
         <button onClick={handleSave} style={{ ...btnStyle, background: "#f59e0b", color: "#000", fontWeight: 700, width: "100%", marginTop: 8 }}>Save Firm Details</button>
         <p style={{ color: "#6b7280", fontSize: 12, marginTop: 12, textAlign: "center" }}>These details appear on your printed bills and WhatsApp statements.</p>
       </div>

       <div style={{ background: "#1a1d2e", padding: "24px", borderRadius: 16, border: "1px solid #2a2d3e", marginBottom: 24 }}>
          <h3 style={{ color: "#e8e8e8", marginTop: 0, marginBottom: 16, fontSize: 18 }}>Subscription Plan</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#12151f", padding: 16, borderRadius: 12, border: "1px solid #2a2d3e" }}>
            <span style={{ color: isPro ? "#10b981" : "#f59e0b", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
               {isPro ? "⭐ TileSync Pro" : "Free Trial"}
            </span>
            {!isPro && (
               <button onClick={onUpgrade} style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff", fontWeight: 700, padding: "8px 16px" }}>Upgrade Now</button>
            )}
          </div>
          {isPro && <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 12 }}>You have an active Pro subscription with unlimited invoices and SMS reminders enabled.</p>}
       </div>

       <button onClick={onLogout} style={{ ...btnStyle, background: "transparent", border: "1px solid #ef4444", color: "#f87171", width: "100%", fontWeight: 700, padding: 16 }}>Securely Sign Out</button>
    </div>
  )
}
