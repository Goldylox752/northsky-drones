<script>
function goToCheckout(){
  const session_id = localStorage.getItem("session_id") || "unknown";
  const source = document.referrer || "direct";

  const url = new URL("https://buy.stripe.com/9B6eV64qDcT20xpeDC2ZO0i");

  url.searchParams.append("client_reference_id", session_id);

  window.location.href = url.toString();
}
</script>


import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Webhook signature failed");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ PAYMENT SUCCESS
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const email = session.customer_details?.email;
    const amount = session.amount_total / 100;

    // metadata you’ll pass from frontend
    const session_id = session.metadata?.session_id || null;
    const source = session.metadata?.source || "unknown";

    // 🔥 SEND TO SUPABASE
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/purchases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email,
        amount,
        session_id,
        source,
        created_at: new Date().toISOString()
      })
    });

    console.log("💰 Purchase tracked:", email, amount);
  }

  res.status(200).json({ received: true });
}



<script>
/* ================= CONFIG ================= */
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_KEY = "YOUR_PUBLIC_ANON_KEY";

/* ================= INIT ================= */
let supabase = null;

function initSupabase(){
  try {
    if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("✅ Supabase connected");
    }
  } catch (e) {
    console.log("❌ Supabase init failed");
  }
}

initSupabase();

/* ================= SESSION ================= */
function getSessionId(){
  let id = localStorage.getItem("session_id");
  if (!id){
    id = crypto.randomUUID();
    localStorage.setItem("session_id", id);
  }
  return id;
}

const SESSION_ID = getSessionId();

/* ================= TRACKING ================= */
async function track(event, meta = {}) {
  const payload = {
    event,
    meta: {
      ...meta,
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer || null,
      session_id: SESSION_ID,
      user_agent: navigator.userAgent
    },
    time: new Date().toISOString()
  };

  console.log("📊 TRACK:", payload);

  if (!supabase) return;

  try {
    await supabase.from("events").insert([payload]);
  } catch (e) {
    console.log("❌ Track error");
  }
}

/* ================= HELPERS ================= */
function $(id){
  return document.getElementById(id);
}

/* ================= SOURCE DETECTION ================= */
function getTrafficSource(){
  const ref = document.referrer;

  if (!ref) return "direct";

  if (ref.includes("goldylox752.github.io")) return "roofflow"; // YOUR SITE
  if (ref.includes("google")) return "google";
  if (ref.includes("facebook")) return "facebook";
  if (ref.includes("tiktok")) return "tiktok";

  return "other";
}

/* ================= CTA TRACKING ================= */
function trackCTAClicks(){
  document.querySelectorAll("a").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const href = btn.getAttribute("href") || "";

      if (href.includes("stripe.com")){
        track("cta_click", {
          type: "purchase",
          text: btn.innerText,
          source: getTrafficSource()
        });
      }

      if (href.includes("northsky-drones")){
        track("view_drone", {
          source: getTrafficSource()
        });
      }

      if (href.includes("RoofFlow-AI")){
        track("view_roofflow", {
          source: getTrafficSource()
        });
      }
    });
  });
}

/* ================= SCROLL TRACKING ================= */
function trackScrollDepth(){
  let triggered = false;

  window.addEventListener("scroll", ()=>{
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;

    if (scrollPercent > 60 && !triggered){
      triggered = true;
      track("scroll_60");
    }
  });
}

/* ================= EMAIL POPUP ================= */
function showPopup(){
  if (localStorage.getItem("emailCaptured")) return;

  setTimeout(()=>{
    const popup = $("popup");
    if (popup){
      popup.style.display = "block";
      track("popup_shown");
    }
  }, 3000);
}

function closePopup(){
  const popup = $("popup");
  if (popup) popup.style.display = "none";
}

/* ================= EMAIL SUBMIT ================= */
async function submitEmail(){
  const input = $("emailInput");
  const email = input ? input.value.trim() : "";

  if (!email.includes("@")){
    alert("Enter a valid email");
    return;
  }

  localStorage.setItem("emailCaptured", "true");

  await track("email_capture", { email });

  try {
    if (supabase) {
      await supabase.from("leads").insert([
        {
          email,
          session_id: SESSION_ID,
          source: getTrafficSource(),
          created_at: new Date().toISOString()
        }
      ]);
    }
  } catch (e) {
    console.log("❌ Lead save error");
  }

  alert("✅ $50 discount unlocked!");
  closePopup();
}

/* ================= PAGE INIT ================= */
window.addEventListener("load", () => {
  track("page_view", {
    source: getTrafficSource()
  });

  trackCTAClicks();
  trackScrollDepth();
  showPopup();
});
</script>