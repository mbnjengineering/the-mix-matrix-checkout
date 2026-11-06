# The Mix Matrix checkout calculator

This is a branded, server-priced project calculator for The Mix Matrix. It is deliberately small: no database, no admin dashboard, and no secret key in the website files.

## What it does

- Uses the approved prices only: Multi track/Stem mixing $300/track, 2track mixing $300/track, mastering $50/track, and Dolby-Atmos $300/track.
- Shows an itemized price while a customer selects services and track counts.
- Requires their name, email, and project details before checkout.
- Recalculates the order on the server from `netlify/functions/lib/catalog.mjs`; the browser’s displayed total is never trusted.
- Creates a hosted Stripe Checkout Session and sends the customer there to pay.
- Keeps the submitted project details in Stripe metadata (safely split where needed), so they are visible with the payment in the Stripe Dashboard.
- Does **not** apply discounts or promo codes. Nothing changes the listed prices without an intentional edit.
- Lets Stripe dynamically show only payment methods that are enabled and eligible for the Stripe account. Klarna, Afterpay/Clearpay, etc. are not promised or force-enabled.

## Running cost

| Item | Cost | Notes |
| --- | --- | --- |
| Netlify Free | $0/month | Fine for an initial small launch; it has 300 usage credits/month and the site pauses if the limit is reached. |
| Netlify Personal (recommended once this takes regular bookings) | $9/month | Adds 1,000 credits/month and optional auto-recharge so a traffic spike is less likely to interrupt bookings. |
| Stripe Checkout | $0/month + payment processing | In the US, Stripe lists standard domestic card processing at 2.9% + 30¢ per successful transaction. Your country, card mix, and payment method can differ. |
| Carrd | $0 additional for a normal link | A Carrd button can link to this calculator on any plan. An inline embed requires the Carrd plan that includes Embed elements (commonly Pro Standard); only upgrade if you specifically want an iframe. |

Netlify’s current free tier is a legitimate starting point, but it can pause at its limit. The calculator has no database charge. See [Netlify pricing](https://www.netlify.com/pricing/), [Stripe pricing](https://stripe.com/pricing), and [Carrd plans](https://carrd.co/pro).

## Before you deploy

You need a Stripe account and a Netlify account. A free GitHub account is the simplest way to give Netlify this project.

Never put a Stripe secret key in this folder, a GitHub file, Carrd, or a chat. It belongs only in Netlify’s protected environment-variable screen.

## Publish it step by step

### 1. Put this folder in a private GitHub repository

1. Go to [GitHub](https://github.com) and sign in.
2. Click the **+** in the top-right, then **New repository**.
3. Name it `the-mix-matrix-checkout`, choose **Private**, and click **Create repository**.
4. On the empty-repository screen, click **uploading an existing file**.
5. Upload the contents of this folder — `public`, `netlify`, `test`, plus `package.json`, `netlify.toml`, `.gitignore`, and `README.md`. Do not upload an `.env` file.
6. Click **Commit changes**.

### 2. Give Netlify the project

1. Go to [Netlify](https://app.netlify.com) and click **Add new project** → **Import an existing project**.
2. Choose **GitHub** and authorize Netlify if prompted.
3. Select the `the-mix-matrix-checkout` repository.
4. Netlify should read `netlify.toml` automatically. Leave the build command blank; confirm the publish directory is `public` and the functions directory is `netlify/functions` if shown.
5. Before deploying, open **Project configuration** → **Environment variables** → **Add a variable**.
6. In Stripe, turn on **Test mode**, go to **Developers** → **API keys**, and reveal the **test secret key**. Paste it only into Netlify as `STRIPE_SECRET_KEY`. Click **Create variable**.
7. Return to Netlify and click **Deploy project**.
8. When it finishes, click the generated `*.netlify.app` URL. Copy it.
9. Back in **Environment variables**, add `SITE_URL` with that exact URL (for example, `https://the-mix-matrix-checkout.netlify.app`), then use **Deploys** → **Trigger deploy** → **Deploy site**.

### 3. Add it to Carrd

The lowest-friction choice is a clear button on the existing Carrd page that opens this page in the same tab.

1. Open the The Mix Matrix site in Carrd and click **Edit**.
2. Select the existing **Book a Mix** button, or add a new Button directly below it.
3. Set its text to `Get an instant price + book`.
4. Set **URL** to the Netlify URL you copied. Keep it set to open in the same window.
5. Click **Publish changes**.

If you have a Carrd plan with the **Embed** element and want the calculator visually inside the one-page site, add an Embed element where it belongs and use:

```html
<iframe src="https://YOUR-NETLIFY-URL.netlify.app" title="The Mix Matrix project calculator" style="width:100%; min-height:1200px; border:0; border-radius:24px;"></iframe>
```

Replace only `YOUR-NETLIFY-URL`; do not add any Stripe keys to Carrd. The normal linked page is recommended because it behaves better on small phone screens and needs no Carrd plan change.

## Test it before going live

Do not switch to a live Stripe key until every item below passes in test mode.

1. Confirm Netlify has an `sk_test_...` value for `STRIPE_SECRET_KEY`, not a live key.
2. Visit the Netlify calculator URL. Choose, for example, **2** mastering tracks. Confirm the shown itemized total is **$100.00**.
3. Fill out the customer details and select **Continue to secure payment**.
4. Confirm Stripe Checkout opens and repeats the correct services, quantities, and total. Use a successful Stripe test card from [Stripe’s testing guide](https://docs.stripe.com/testing) to finish the test—Stripe will not make a real charge in test mode.
5. Check that the Mix Matrix thank-you screen appears.
6. In the Stripe Dashboard (still in Test mode), go to **Payments**, open the test payment, and inspect its metadata. Confirm the name, email, selected services, total, and project details are all there.
7. Test the Cancel link in Stripe Checkout. You should land back on the calculator with the cancellation message.

Only after that test works: in Netlify, replace `STRIPE_SECRET_KEY` with the **live** secret key from Stripe, redeploy, and run a small real transaction only when you are comfortable doing so.

## Optional payment plans: only after Stripe confirms eligibility

The code intentionally does not hard-code Klarna or Afterpay/Clearpay. Checkout instead uses the Stripe payment methods that the account has enabled and that the current customer/order qualifies for. If the Stripe Dashboard offers a method and you choose to enable it:

1. In Stripe, open **Settings** → **Payment methods**.
2. Review the eligibility and fee information Stripe shows for your account and business category.
3. Enable it in **Test mode** first and repeat the test checklist above.
4. Enable it in live mode only after the test behaves as expected.

Stripe’s current docs say Checkout dynamically shows relevant payment methods enabled in its payment-method settings; availability remains dependent on eligibility and customer/order context. See [Stripe Checkout payment methods](https://docs.stripe.com/payments/payment-methods/payment-method-configurations) and [Klarna eligibility](https://stripe.com/payments/klarna).

## Change a price later

Open `netlify/functions/lib/catalog.mjs`, edit the cents value beside the service, then commit and publish the change. Examples: `$300` is `30000`; `$50` is `5000`. This one file controls both the customer-facing catalog and the server-side payment total.

## Add discounts later (not enabled now)

No discount rules were approved, so the live calculator uses none. A common way to evaluate a volume break in project-based audio work is a modest percentage threshold (for example, one threshold at 3 tracks and another at 5), but the right numbers depend on your turnaround, revisions, and margin. Decide the exact rule first; then it can be added and tested in the server quote function without trusting browser calculations.

## Quality checks included

From this folder, run:

```bash
npm test
```

The checks confirm approved price math, zero discounts, input validation, rejection of invented service IDs, and preservation of long project notes in Stripe-safe metadata. They do not perform a Stripe payment; the manual Stripe test-mode checklist is the required real integration test.
