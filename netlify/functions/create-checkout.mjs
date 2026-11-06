import Stripe from "stripe";
import { quoteFor } from "./lib/catalog.mjs";
import { projectDetailMetadata, RequestValidationError, validatePurchase } from "./lib/validation.mjs";

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  };
}

function publicSiteUrl(event) {
  const configuredUrl = process.env.SITE_URL?.replace(/\/$/, "");
  if (configuredUrl && /^https:\/\//.test(configuredUrl)) return configuredUrl;

  const host = event.headers["x-forwarded-host"] || event.headers.host;
  if (!host) throw new Error("SITE_URL is not configured.");
  return `https://${host}`;
}

function metadataFor(purchase, quote) {
  return {
    customer_name: purchase.customerName,
    customer_email: purchase.customerEmail,
    mix_song_count: String(quote.mixSongCount),
    services: quote.lineItems.map((item) => `${item.name} x${item.quantity}`).join(" | "),
    discount_summary: quote.discountSummary || "none",
    discount_usd: (quote.discountCents / 100).toFixed(2),
    total_usd: (quote.totalCents / 100).toFixed(2),
    ...projectDetailMetadata(purchase.projectDetails)
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed." });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return reply(500, { error: "Stripe is not configured yet. Please try again later." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const purchase = validatePurchase(payload);
    const quote = quoteFor({ requestedItems: purchase.items });
    const metadata = metadataFor(purchase, quote);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const siteUrl = publicSiteUrl(event);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      customer_email: purchase.customerEmail,
      billing_address_collection: "auto",
      allow_promotion_codes: false,
      line_items: quote.lineItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: quote.currency,
          // Every price and eligible discount is calculated on the server, so
          // the Checkout total cannot be changed by the browser.
          unit_amount: item.checkoutUnitAmountCents,
          product_data: {
            name: item.name,
            description: item.discountPercent > 0
              ? `${item.unitLabel}; ${item.discountPercent}% ${item.discountReason === "volume" ? "volume" : "Dolby add-on"} discount included`
              : item.unitLabel
          }
        }
      })),
      metadata,
      payment_intent_data: { metadata },
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled`
    });

    if (!session.url) throw new Error("Stripe did not provide a Checkout URL.");
    return reply(200, { url: session.url });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return reply(400, { error: error.message });
    }

    if (error instanceof SyntaxError) {
      return reply(400, { error: "Please send a valid checkout request." });
    }

    if (error instanceof Error && (
      error.message.includes("Choose at least one") ||
      error.message.includes("unavailable service") ||
      error.message.includes("service quantity") ||
      error.message.includes("only be sent once")
    )) {
      return reply(400, { error: error.message });
    }

    console.error("Checkout session creation failed", error);
    return reply(500, { error: "We could not start secure checkout. Please try again." });
  }
}
