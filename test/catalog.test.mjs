import test from "node:test";
import assert from "node:assert/strict";
import { quoteFor } from "../netlify/functions/lib/catalog.mjs";
import { projectDetailMetadata, RequestValidationError, validatePurchase } from "../netlify/functions/lib/validation.mjs";

test("the server catalog returns the approved service total", () => {
  const quote = quoteFor([
    { id: "multitrack-stem-mixing", quantity: 2 },
    { id: "mastering", quantity: 2 }
  ]);

  assert.equal(quote.subtotalCents, 70000);
  assert.equal(quote.discountCents, 0);
  assert.equal(quote.totalCents, 70000);
  assert.deepEqual(
    quote.lineItems.map(({ id, quantity, amountCents }) => ({ id, quantity, amountCents })),
    [
      { id: "multitrack-stem-mixing", quantity: 2, amountCents: 60000 },
      { id: "mastering", quantity: 2, amountCents: 10000 }
    ]
  );
});

test("the server rejects client-invented services and empty carts", () => {
  assert.throws(() => quoteFor([{ id: "secret-discount", quantity: 1 }]), /unavailable service/);
  assert.throws(() => quoteFor([{ id: "mastering", quantity: 0 }]), /Choose at least one/);
});

test("customer data is validated before a Checkout Session can be made", () => {
  assert.throws(
    () => validatePurchase({ customerName: "N", customerEmail: "not-an-email", projectDetails: "Hi", items: [] }),
    RequestValidationError
  );

  const purchase = validatePurchase({
    customerName: "Nick Johnson",
    customerEmail: "NICK@example.com",
    projectDetails: "Two songs, release next month.",
    items: [{ id: "mastering", quantity: 2 }]
  });

  assert.equal(purchase.customerEmail, "nick@example.com");
});

test("long project details are retained in Stripe-safe metadata chunks", () => {
  const metadata = projectDetailMetadata("x".repeat(1100));
  assert.equal(Object.keys(metadata).length, 3);
  assert.equal(Object.values(metadata).join(""), "x".repeat(1100));
  assert.ok(Object.values(metadata).every((value) => value.length <= 500));
});
