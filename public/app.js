const form = document.querySelector("#booking-form");
const primaryServicesElement = document.querySelector("#primary-services");
const addonServicesElement = document.querySelector("#addon-services");
const loadMessage = document.querySelector("#load-message");
const songCountField = document.querySelector("#song-count");
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

function money(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function songCount() {
  const value = Number(songCountField.value);
  return Number.isSafeInteger(value) && value >= 1 && value <= 99 ? value : 0;
}

function selectedItems() {
  return catalog.services.filter((service) => document.querySelector(`[data-service="${service.id}"]`).checked);
}

function discountFor(currentSongCount) {
  return catalog.discounts.find((tier) => currentSongCount >= tier.minSongs) || { percent: 0 };
}

function updateDiscountProgress(currentSongCount) {
  if (currentSongCount < 3) {
    const remaining = 3 - currentSongCount;
    discountProgress.textContent = `Add ${remaining} more ${remaining === 1 ? "song" : "songs"} to unlock 5% off.`;
  } else if (currentSongCount < 5) {
    const remaining = 5 - currentSongCount;
    discountProgress.textContent = `5% off unlocked. Add ${remaining} more ${remaining === 1 ? "song" : "songs"} to unlock 15% off.`;
  } else {
    discountProgress.textContent = "15% volume discount unlocked.";
  }
}

function createServiceCard(service) {
  const row = document.createElement("label");
  row.className = "service-row";

  const selector = document.createElement("input");
  selector.type = service.selectionType === "primary" ? "radio" : "checkbox";
  if (service.selectionType === "primary") selector.name = "primary-mix";
  selector.dataset.service = service.id;
  selector.setAttribute("aria-label", `${service.selectionType === "primary" ? "Choose" : "Add"} ${service.name}`);

  const indicator = document.createElement("span");
  indicator.className = `checkbox-indicator ${service.selectionType === "primary" ? "radio-indicator" : ""}`;
  indicator.setAttribute("aria-hidden", "true");

  const name = document.createElement("div");
  name.className = "service-name";
  const titleLine = document.createElement("div");
  titleLine.className = "service-title";
  const title = document.createElement("h3");
  title.textContent = service.name;
  titleLine.append(title);
  if (service.isAddOn) {
    const badge = document.createElement("span");
    badge.className = "addon-badge";
    badge.textContent = "Add-on";
    titleLine.append(badge);
  }
  const rate = document.createElement("p");
  rate.textContent = `${money(service.unitAmountCents)} ${service.unitLabel}`;
  name.append(titleLine, rate);

  const action = document.createElement("span");
  action.className = "service-action";
  action.textContent = service.selectionType === "primary" ? "Choose" : "Add";

  selector.addEventListener("change", () => {
    if (service.selectionType === "primary") {
      for (const primary of catalog.services.filter((item) => item.selectionType === "primary")) {
        const primaryAction = document.querySelector(`[data-service="${primary.id}"]`).closest("label").querySelector(".service-action");
        primaryAction.textContent = document.querySelector(`[data-service="${primary.id}"]`).checked ? "Chosen" : "Choose";
      }
    } else {
      action.textContent = selector.checked ? "Added" : "Add";
    }
    updateQuote();
  });

  row.append(selector, indicator, name, action);
  return row;
}

function renderServices() {
  primaryServicesElement.replaceChildren();
  addonServicesElement.replaceChildren();
  for (const service of catalog.services) {
    const card = createServiceCard(service);
    (service.selectionType === "primary" ? primaryServicesElement : addonServicesElement).append(card);
  }
}

function updateQuote() {
  const items = selectedItems();
  const currentSongCount = songCount();
  const subtotal = items.reduce((sum, item) => sum + (item.unitAmountCents * currentSongCount), 0);
  const discount = discountFor(currentSongCount);
  const discountCents = Math.round(subtotal * discount.percent / 100);
  const total = subtotal - discountCents;
  const hasItems = items.length > 0;

  updateDiscountProgress(currentSongCount);
  totalElement.textContent = money(total);
  totalCopyElement.textContent = money(total);
  discountElement.textContent = discountCents > 0 ? `−${money(discountCents)}` : "$0.00";
  discountLabelElement.textContent = discount.percent > 0
    ? `${currentSongCount}-song volume discount (${discount.percent}%)`
    : "Volume discount (3+ songs)";
  checkoutButton.disabled = !hasItems || currentSongCount === 0;
  lineItemsElement.replaceChildren();

  if (!hasItems) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Choose a mix, an add-on, or both to see your itemized total.";
    lineItemsElement.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "line-item";
    const left = document.createElement("span");
    left.textContent = `${item.name} × ${currentSongCount}`;
    const right = document.createElement("span");
    right.textContent = money(item.unitAmountCents * currentSongCount);
    row.append(left, right);
    lineItemsElement.append(row);
  }
}

function setError(message) {
  formMessage.textContent = message;
}

songCountField.addEventListener("input", updateQuote);
songCountField.addEventListener("change", updateQuote);
detailField.addEventListener("input", () => {
  detailCount.textContent = detailField.value.length;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  if (!form.reportValidity()) return;

  const originalButtonText = checkoutButton.innerHTML;
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Opening secure checkout…";

  const payload = {
    customerName: document.querySelector("#customer-name").value,
    customerEmail: document.querySelector("#customer-email").value,
    projectDetails: detailField.value,
    songCount: songCount(),
    items: selectedItems().map(({ id }) => ({ id }))
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
