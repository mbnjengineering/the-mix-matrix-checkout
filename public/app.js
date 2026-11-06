const form = document.querySelector("#booking-form");
const servicesElement = document.querySelector("#services");
const loadMessage = document.querySelector("#load-message");
const lineItemsElement = document.querySelector("#line-items");
const totalElement = document.querySelector("#total");
const totalCopyElement = document.querySelector("#total-copy");
const detailField = document.querySelector("#project-details");
const detailCount = document.querySelector("#detail-count");
const checkoutButton = document.querySelector("#checkout-button");
const formMessage = document.querySelector("#form-message");

let catalog;

function money(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function selectedItems() {
  return catalog.services
    .map((service) => ({
      ...service,
      quantity: Number(document.querySelector(`[data-quantity="${service.id}"]`).value)
    }))
    .filter((service) => service.quantity > 0);
}

function renderServices() {
  servicesElement.replaceChildren();
  for (const service of catalog.services) {
    const row = document.createElement("div");
    row.className = "service-row";

    const name = document.createElement("div");
    name.className = "service-name";
    const title = document.createElement("h3");
    title.textContent = service.name;
    const rate = document.createElement("p");
    rate.textContent = `${money(service.unitAmountCents)} ${service.unitLabel}`;
    name.append(title, rate);

    const quantityLabel = document.createElement("label");
    quantityLabel.className = "quantity";
    quantityLabel.htmlFor = `quantity-${service.id}`;
    const quantityText = document.createElement("span");
    quantityText.textContent = "Tracks";
    const quantity = document.createElement("input");
    quantity.id = `quantity-${service.id}`;
    quantity.type = "number";
    quantity.inputMode = "numeric";
    quantity.min = "0";
    quantity.max = "99";
    quantity.step = "1";
    quantity.value = "0";
    quantity.dataset.quantity = service.id;
    quantity.setAttribute("aria-label", `${service.name} track quantity`);
    quantity.addEventListener("input", updateQuote);
    quantity.addEventListener("change", updateQuote);
    quantityLabel.append(quantityText, quantity);
    row.append(name, quantityLabel);
    servicesElement.append(row);
  }
}

function updateQuote() {
  const items = selectedItems();
  const total = items.reduce((sum, item) => sum + (item.unitAmountCents * item.quantity), 0);
  const hasItems = items.length > 0;

  totalElement.textContent = money(total);
  totalCopyElement.textContent = money(total);
  checkoutButton.disabled = !hasItems;
  lineItemsElement.replaceChildren();

  if (!hasItems) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Choose one or more services to see your itemized total.";
    lineItemsElement.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "line-item";
    const left = document.createElement("span");
    left.textContent = `${item.name} × ${item.quantity}`;
    const right = document.createElement("span");
    right.textContent = money(item.unitAmountCents * item.quantity);
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

  const originalButtonText = checkoutButton.innerHTML;
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Opening secure checkout…";

  const payload = {
    customerName: document.querySelector("#customer-name").value,
    customerEmail: document.querySelector("#customer-email").value,
    projectDetails: detailField.value,
    items: selectedItems().map(({ id, quantity }) => ({ id, quantity }))
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
