const form = document.querySelector("#booking-form");
const servicesElement = document.querySelector("#services");
const loadMessage = document.querySelector("#load-message");
const discountProgress = document.querySelector("#discount-progress");
const lineItemsElement = document.querySelector("#line-items");
const totalElement = document.querySelector("#total");
const totalCopyElement = document.querySelector("#total-copy");
const discountElement = document.querySelector("#discount");
const discountLabelElement = document.querySelector("#discount-label");
const detailField = document.querySelector("#project-details");
const detailCount = document.querySelector("#detail-count");
const checkoutButton = document.querySelector("#checkout-button");
const formMessage = document.querySelector("#form-message");
const customProjectLink = document.querySelector("#custom-project-link");

let catalog;
const quantities = new Map();

function money(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function quantityFor(serviceId) {
  return quantities.get(serviceId) || 0;
}

function selectedEntries() {
  return catalog.services
    .map((service) => ({ service, quantity: quantityFor(service.id) }))
    .filter(({ quantity }) => quantity > 0);
}

function mixSongCount(entries) {
  return entries
    .filter(({ service }) => service.serviceType === "mix")
    .reduce((sum, { quantity }) => sum + quantity, 0);
}

function volumeDiscountFor(currentMixSongCount) {
  return catalog.discounts.find((tier) => currentMixSongCount >= tier.minMixSongs)?.percent || 0;
}

function quotedLineItem({ service, quantity, name = service.name, discountPercent = 0, discountReason = "" }) {
  const unitAmountCents = service.unitAmountCents;
  const checkoutUnitAmountCents = Math.round(unitAmountCents * (100 - discountPercent) / 100);
  return {
    id: service.id,
    name,
    quantity,
    unitAmountCents,
    amountCents: unitAmountCents * quantity,
    chargedAmountCents: checkoutUnitAmountCents * quantity,
    discountPercent,
    discountReason
  };
}

// This mirrors the display only. Netlify recalculates the same selection before
// it creates Stripe Checkout, so a browser cannot decide the payable amount.
function clientQuote() {
  const entries = selectedEntries();
  const currentMixSongCount = mixSongCount(entries);
  const volumeDiscountPercent = volumeDiscountFor(currentMixSongCount);
  const lineItems = [];

  for (const { service, quantity } of entries) {
    if (service.serviceType !== "dolby") {
      lineItems.push(quotedLineItem({
        service,
        quantity,
        discountPercent: volumeDiscountPercent,
        discountReason: volumeDiscountPercent > 0 ? "volume" : ""
      }));
      continue;
    }

    if (volumeDiscountPercent > 0) {
      lineItems.push(quotedLineItem({
        service,
        quantity,
        discountPercent: volumeDiscountPercent,
        discountReason: "volume"
      }));
      continue;
    }

    const addOnQuantity = Math.min(quantity, currentMixSongCount);
    if (addOnQuantity > 0) {
      lineItems.push(quotedLineItem({
        service,
        name: "Dolby-Atmos add-on",
        quantity: addOnQuantity,
        discountPercent: catalog.dolbyAddOnDiscountPercent,
        discountReason: "dolby_add_on"
      }));
    }

    const standaloneQuantity = quantity - addOnQuantity;
    if (standaloneQuantity > 0) {
      lineItems.push(quotedLineItem({
        service,
        name: currentMixSongCount > 0 ? "Dolby-Atmos only" : service.name,
        quantity: standaloneQuantity
      }));
    }
  }

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  const totalCents = lineItems.reduce((sum, item) => sum + item.chargedAmountCents, 0);
  const discountCents = subtotalCents - totalCents;
  const discountSummary = volumeDiscountPercent > 0
    ? `${volumeDiscountPercent}% ${currentMixSongCount}-song volume discount`
    : lineItems.some((item) => item.discountReason === "dolby_add_on")
      ? `${catalog.dolbyAddOnDiscountPercent}% Dolby Atmos add-on discount`
      : "";

  return { entries, currentMixSongCount, lineItems, subtotalCents, totalCents, discountCents, discountSummary };
}

function updateDiscountProgress(currentMixSongCount) {
  if (currentMixSongCount < 3) {
    const remaining = 3 - currentMixSongCount;
    discountProgress.textContent = `Add ${remaining} more mix ${remaining === 1 ? "song" : "songs"} to unlock 5% off your whole project.`;
  } else if (currentMixSongCount < 5) {
    const remaining = 5 - currentMixSongCount;
    discountProgress.textContent = `5% off your whole project is applied. Add ${remaining} more mix ${remaining === 1 ? "song" : "songs"} to unlock 15% off.`;
  } else {
    discountProgress.textContent = "15% off your whole project is applied.";
  }
}

function updateServiceRow(service) {
  const quantity = quantityFor(service.id);
  const row = document.querySelector(`[data-service-row="${service.id}"]`);
  const output = document.querySelector(`[data-quantity-value="${service.id}"]`);
  const decreaseButton = document.querySelector(`[data-decrease="${service.id}"]`);
  const increaseButton = document.querySelector(`[data-increase="${service.id}"]`);
  row.classList.toggle("is-selected", quantity > 0);
  output.value = String(quantity);
  output.textContent = String(quantity);
  decreaseButton.disabled = quantity === 0;
  increaseButton.disabled = quantity === 99;
}

function setQuantity(service, nextQuantity) {
  quantities.set(service.id, Math.min(99, Math.max(0, nextQuantity)));
  updateServiceRow(service);
  updateQuote();
}

function createServiceRow(service) {
  const row = document.createElement("div");
  row.className = "service-row";
  row.dataset.serviceRow = service.id;

  const name = document.createElement("div");
  name.className = "service-name";
  const titleLine = document.createElement("div");
  titleLine.className = "service-title";
  const title = document.createElement("h3");
  title.textContent = service.name;
  titleLine.append(title);
  if (service.masteringIncluded) {
    const badge = document.createElement("span");
    badge.className = "included-badge";
    badge.textContent = "Mastering included";
    titleLine.append(badge);
  }
  const description = document.createElement("p");
  description.textContent = `${money(service.unitAmountCents)} ${service.unitLabel} · ${service.description}`;
  name.append(titleLine, description);

  const quantityControl = document.createElement("div");
  quantityControl.className = "quantity-control";
  quantityControl.setAttribute("aria-label", `${service.name} quantity`);
  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.className = "quantity-button";
  decrease.dataset.decrease = service.id;
  decrease.setAttribute("aria-label", `Remove one ${service.name}`);
  decrease.textContent = "−";
  const output = document.createElement("output");
  output.className = "quantity-value";
  output.dataset.quantityValue = service.id;
  output.setAttribute("aria-label", `${service.name} quantity`);
  output.setAttribute("aria-live", "polite");
  const increase = document.createElement("button");
  increase.type = "button";
  increase.className = "quantity-button";
  increase.dataset.increase = service.id;
  increase.setAttribute("aria-label", `Add one ${service.name}`);
  increase.textContent = "+";

  decrease.addEventListener("click", () => setQuantity(service, quantityFor(service.id) - 1));
  increase.addEventListener("click", () => setQuantity(service, quantityFor(service.id) + 1));
  quantityControl.append(decrease, output, increase);
  row.append(name, quantityControl);
  return row;
}

function renderServices() {
  servicesElement.replaceChildren();
  for (const service of catalog.services) {
    quantities.set(service.id, 0);
    servicesElement.append(createServiceRow(service));
    updateServiceRow(service);
  }
}

function updateQuote() {
  const quote = clientQuote();
  const hasItems = quote.entries.length > 0;

  updateDiscountProgress(quote.currentMixSongCount);
  totalElement.textContent = money(quote.totalCents);
  totalCopyElement.textContent = money(quote.totalCents);
  discountElement.textContent = quote.discountCents > 0 ? `−${money(quote.discountCents)}` : "$0.00";
  discountLabelElement.textContent = quote.discountSummary || "Eligible savings";
  checkoutButton.disabled = !hasItems;
  lineItemsElement.replaceChildren();

  if (!hasItems) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Add a quantity to one or more services to see your itemized total.";
    lineItemsElement.append(empty);
    return;
  }

  for (const item of quote.lineItems) {
    const row = document.createElement("div");
    row.className = "line-item";
    const left = document.createElement("span");
    left.textContent = `${item.name} × ${item.quantity}`;
    const right = document.createElement("span");
    right.textContent = money(item.amountCents);
    row.append(left, right);
    lineItemsElement.append(row);
  }
}

function setError(message) {
  formMessage.textContent = message;
}

detailField.addEventListener("input", () => {
  detailCount.textContent = detailField.value.length;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");
  if (!form.reportValidity()) return;

  const quote = clientQuote();
  if (quote.entries.length === 0) {
    setError("Add at least one service quantity before continuing.");
    return;
  }

  const originalButtonText = checkoutButton.innerHTML;
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Opening secure checkout…";
  const payload = {
    customerName: document.querySelector("#customer-name").value,
    customerEmail: document.querySelector("#customer-email").value,
    projectDetails: detailField.value,
    items: quote.entries.map(({ service, quantity }) => ({ id: service.id, quantity }))
  };

  try {
    const response = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.url) throw new Error(result.error || "Could not start checkout.");
    window.location.assign(result.url);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Could not start checkout. Please try again.");
    checkoutButton.innerHTML = originalButtonText;
    updateQuote();
  }
});

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog");
    if (!response.ok) throw new Error("Catalog unavailable");
    catalog = await response.json();
    if (!Array.isArray(catalog.services) || catalog.services.length === 0) throw new Error("Catalog unavailable");
    renderServices();
    customProjectLink.href = `mailto:${catalog.customProjectEmail}?subject=Custom%20project%20quote`;
    updateQuote();
    loadMessage.remove();
    form.hidden = false;

    if (new URLSearchParams(window.location.search).get("checkout") === "cancelled") {
      setError("Checkout was cancelled. Your selection is still here whenever you’re ready.");
    }
  } catch {
    loadMessage.className = "notice error";
    loadMessage.textContent = "The calculator could not load. Please refresh the page or try again shortly.";
  }
}

loadCatalog();
