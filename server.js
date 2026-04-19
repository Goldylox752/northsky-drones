require("dotenv").config();

const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "20kb" }));

/* =========================
   SUPABASE INIT
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY // MUST be service_role
);

/* =========================
   SAFE NORMALIZER (CRITICAL FIX)
========================= */

function normalize(body) {
  return {
    user_id: body.user_id || body.user || "anon",
    session_id: body.session_id || "no-session",
    score: Number(body.score || 0),
    url: body.url || null,
    meta: body.meta || {},
    created_at: new Date().toISOString()
  };
}

/* =========================
   SAFE DB WRITER (NO SILENT FAILS)
========================= */

async function write(table, payload) {
  const { data, error } = await supabase
    .from(table)
    .insert([payload])
    .select();

  if (error) {
    console.log(`❌ DB ERROR [${table}]:`, error.message);
    return { ok: false, error };
  }

  console.log(`✅ DB INSERT [${table}]`, data);
  return { ok: true, data };
}

/* =========================
   LEADS
========================= */

app.post("/api/lead", async (req, res) => {
  const data = normalize(req.body);

  const result = await write("leads", data);

  if (!result.ok) {
    return res.status(500).json(result);
  }

  res.json({ ok: true });
});

/* =========================
   HOT LEADS (REVENUE ENGINE)
========================= */

app.post("/api/hot-lead", async (req, res) => {
  const data = normalize(req.body);

  const isHot = data.score >= 15;

  const result = await write("hot_leads", {
    ...data,
    is_hot: isHot
  });

  if (!result.ok) {
    return res.status(500).json(result);
  }

  console.log("🔥 HOT LEAD:", data.user_id, data.score);

  /* =========================
     AUTOPILOT HOOKS (READY)
  ========================= */

  if (isHot) {
    // FUTURE:
    // - Twilio SMS
    // - SendGrid email
    // - AI follow-up agent
    // - CRM push (HubSpot)

    console.log("🚀 AUTOPILOT TRIGGERED");
  }

  res.json({
    ok: true,
    routed: isHot
  });
});

/* =========================
   CHECKOUT TRACKING
========================= */

app.post("/api/checkout-click", async (req, res) => {
  const data = normalize(req.body);

  await write("events", {
    type: "checkout_click",
    ...data
  });

  res.json({ ok: true });
});

/* =========================
   ABANDONMENT
========================= */

app.post("/api/abandon", async (req, res) => {
  const data = normalize(req.body);

  await write("abandonments", data);

  res.json({ ok: true });
});

/* =========================
   STRIPE CHECKOUT
========================= */

app.post("/api/checkout", async (req, res) => {
  try {
    const items = req.body.items || [];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: items.map(i => ({
        price_data: {
          currency: "cad",
          product_data: { name: i.name },
          unit_amount: Math.round(i.price * 100)
        },
        quantity: 1
      })),
      success_url: `${process.env.BASE_URL}/success.html`,
      cancel_url: `${process.env.BASE_URL}/cancel.html`
    });

    res.json({ url: session.url });

  } catch (err) {
    console.log("❌ STRIPE ERROR:", err.message);
    res.status(500).json({ error: "checkout failed" });
  }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    system: "NorthSky Autopilot v3 (FIXED)"
  });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 4242;

app.listen(PORT, () => {
  console.log("🚀 Autopilot Server running on port", PORT);
});