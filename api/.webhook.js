require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const bodyParser = require("body-parser");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// IMPORTANT: raw body required for Stripe signature verification
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ Handle events
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        console.log("💰 Payment successful:", session.id);

        // TODO: grant access / activate drone features
        break;

      case "invoice.paid":
        console.log("📦 Subscription payment received");
        break;

      case "customer.subscription.deleted":
        console.log("❌ Subscription cancelled");
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }
);

// normal JSON routes AFTER webhook
app.use(express.json());

app.get("/", (req, res) => {
  res.send("NorthSky Stripe Webhook Running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
