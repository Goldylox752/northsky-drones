import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Required for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

const getRawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const signature = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await getRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      // ✅ Payment successful (MAIN EVENT)
      case "checkout.session.completed": {
        const session = event.data.object;

        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        console.log("Payment completed:", { userId, plan });

        // 👉 Activate user here (DB logic)
        // Example:
        // await db.users.update({
        //   where: { id: userId },
        //   data: {
        //     plan,
        //     status: "active",
        //     stripe_customer_id: session.customer,
        //   },
        // });

        break;
      }

      // 🔄 Subscription updated
      case "customer.subscription.updated": {
        console.log("Subscription updated");
        break;
      }

      // ❌ Subscription canceled
      case "customer.subscription.deleted": {
        console.log("Subscription canceled");
        break;
      }

      default:
        console.log("Unhandled event:", event.type);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}