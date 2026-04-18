<script>

/* ================= CONFIG ================= */
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_KEY = "YOUR_PUBLIC_ANON_KEY";

let supabase = null;

/* ================= INIT ================= */
function initSupabase(){
  if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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

/* ================= UTM SYSTEM ================= */
function getUTMs(){
  const p = new URLSearchParams(window.location.search);

  return {
    utm_source: p.get("utm_source") || "direct",
    utm_campaign: p.get("utm_campaign") || "none",
    utm_content: p.get("utm_content") || "none",
    cpc: parseFloat(p.get("cpc")) || 0
  };
}

/* ================= FUNNEL STAGES (NEW) ================= */
function funnelStage(name, meta = {}){
  track("funnel_stage", {
    stage: name,
    ...meta
  });
}

/* ================= ROOFFLOW BRIDGE ================= */
function captureFromRoofFlow(){

  const p = new URLSearchParams(window.location.search);

  const session_id = p.get("session_id");
  const utm_source = p.get("utm_source");
  const utm_campaign = p.get("utm_campaign");
  const from = p.get("from") || "direct";

  if (session_id){
    localStorage.setItem("session_id", session_id);
  }

  if (utm_source){
    localStorage.setItem("utm_source", utm_source);
  }

  if (utm_campaign){
    localStorage.setItem("utm_campaign", utm_campaign);
  }

  localStorage.setItem("funnel_source", from);

  funnelStage("entry", {
    from,
    session_id,
    utm_source,
    utm_campaign
  });

  console.log("🚀 Funnel entry captured");
}

/* ================= CORE TRACKING ================= */
async function track(event, meta = {}){

  if (!supabase) return;

  const payload = {
    event,
    meta: {
      ...meta,
      ...getUTMs(),
      session_id: SESSION_ID,
      url: location.href,
      referrer: document.referrer || "direct",
      user_agent: navigator.userAgent
    },
    time: new Date().toISOString()
  };

  try {
    await supabase.from("events").insert([payload]);
  } catch (e) {
    console.log("track error:", e.message);
  }
}

/* ================= LEAD SCORE (NEW) ================= */
function updateLeadScore(points){

  let score = parseInt(localStorage.getItem("lead_score") || "0");
  score += points;

  localStorage.setItem("lead_score", score);

  if (score >= 50){
    funnelStage("high_intent_lead", { score });
  }
}

/* ================= CHECKOUT ================= */
function goToCheckout(){

  const utm = getUTMs();

  const url = new URL("https://buy.stripe.com/9B6eV64qDcT20xpeDC2ZO0i");

  url.searchParams.set("client_reference_id", SESSION_ID);
  url.searchParams.set("utm_source", utm.utm_source);
  url.searchParams.set("utm_campaign", utm.utm_campaign);
  url.searchParams.set("utm_content", utm.utm_content);
  url.searchParams.set("cpc", utm.cpc);

  funnelStage("checkout_click");

  updateLeadScore(20);

  window.location.href = url.toString();
}

/* ================= CTA TRACKING (UPGRADED) ================= */
function bindCTAs(){

  document.querySelectorAll("a").forEach(a => {

    a.addEventListener("click", () => {

      const href = a.href || "";

      if (href.includes("stripe")){
        funnelStage("purchase_intent");
        updateLeadScore(30);
      }

      if (href.includes("RoofFlow")){
        funnelStage("roofflow_click");
        updateLeadScore(10);
      }

      if (href.includes("northsky")){
        funnelStage("product_view");
        updateLeadScore(15);
      }

    });

  });
}

/* ================= SCROLL DEPTH (UPGRADED) ================= */
function trackScroll(){

  let checkpoints = {
    30: false,
    60: false,
    90: false
  };

  window.addEventListener("scroll", () => {

    const percent =
      window.scrollY /
      (document.body.scrollHeight - window.innerHeight);

    const p = Math.floor(percent * 100);

    if (p > 30 && !checkpoints[30]){
      checkpoints[30] = true;
      funnelStage("scroll_30");
    }

    if (p > 60 && !checkpoints[60]){
      checkpoints[60] = true;
      funnelStage("scroll_60");
      updateLeadScore(5);
    }

    if (p > 90 && !checkpoints[90]){
      checkpoints[90] = true;
      funnelStage("scroll_90");
      updateLeadScore(10);
    }

  });

}

/* ================= POPUP ================= */
function showPopup(){

  if (localStorage.getItem("emailCaptured")) return;

  setTimeout(() => {
    const popup = document.getElementById("popup");

    if (popup){
      popup.style.display = "block";
      funnelStage("popup_shown");
    }
  }, 3000);

}

/* ================= EMAIL ================= */
async function submitEmail(){

  const email = document.getElementById("emailInput")?.value?.trim();

  if (!email || !email.includes("@")){
    alert("Enter valid email");
    return;
  }

  localStorage.setItem("emailCaptured", "true");

  funnelStage("email_capture");

  updateLeadScore(25);

  await track("email_capture", { email });

  if (supabase){
    await supabase.from("leads").insert([{
      email,
      session_id: SESSION_ID,
      source: getUTMs().utm_source,
      lead_score: parseInt(localStorage.getItem("lead_score") || "0"),
      created_at: new Date().toISOString()
    }]);
  }

  alert("Access unlocked!");
  document.getElementById("popup").style.display = "none";
}

/* ================= INIT ================= */
window.addEventListener("load", () => {

  captureFromRoofFlow();

  funnelStage("page_view");

  bindCTAs();
  trackScroll();
  showPopup();

});

</script>