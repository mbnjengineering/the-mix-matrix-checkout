export const CURRENCY = "usd";
export const CUSTOM_PROJECT_EMAIL = "mbnj.engineering@gmail.com";

export const DISCOUNT_TIERS = Object.freeze([
  { minMixSongs: 5, percent: 15 },
  { minMixSongs: 3, percent: 5 }
]);

export const DOLBY_ADD_ON_DISCOUNT_PERCENT = 5;

export const SERVICES = Object.freeze([
  {
    id: "multitrack-stem-mixing",
    name: "Multi track/Stem mixing",
    unitAmountCents: 30000,
    unitLabel: "per song",
    serviceType: "mix",
    masteringIncluded: true,
    description: "Mastering included."
  },
  {
    id: "2track-mixing",
    name: "2track mixing",
    unitAmountCents: 17500,
    unitLabel: "per song",
    serviceType: "mix",
    masteringIncluded: true,
    description: "Mastering included."
  },
  {
    id: "mastering",
    name: "Mastering only",
    unitAmountCents: 5000,
    unitLabel: "per song",
    serviceType: "standalone",
    description: "For songs that do not need mixing."
  },
  {
    id: "dolby-atmos",
    name: "Dolby-Atmos",
    unitAmountCents: 30000,
    unitLabel: "per song",
    serviceType: "dolby",
    description: "Book on its own or add it to a mix."
  }
]);

function serviceById(id) {
  return SERVICES.find((service) => service.id === id);
}

function wholeQuantity(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 99;
}

function moneyAmount(unitAmountCents, quantity) {
  return unitAmountCents * quantity;
}

function lineItem({ id, name, unitAmountCents, unitLabel, quantity, discountPercent = 0, discountReason = "" }) {
  const amountCents = moneyAmount(unitAmountCents, quantity);
  const checkoutUnitAmountCents = Math.round(unitAmountCents * (100 - discountPercent) / 100);
  return {
    id,
    name,
    unitAmountCents,
    checkoutUnitAmountCents,
    unitLabel,
    quantity,
    amountCents,
    chargedAmountCents: checkoutUnitAmountCents * quantity,
    discountPercent,
    discountReason
  };
}

function volumeDiscountFor(mixSongCount) {
  return DISCOUNT_TIERS.find((tier) => mixSongCount >= tier.minMixSongs)?.percent || 0;
}

export function publicCatalog() {
  return {
    currency: CURRENCY,
    services: SERVICES.map(({ id, name, unitAmountCents, unitLabel, serviceType, masteringIncluded, description }) => ({
      id,
      name,
      unitAmountCents,
      unitLabel,
      serviceType,
      masteringIncluded,
      description
    })),
    discounts: DISCOUNT_TIERS,
    dolbyAddOnDiscountPercent: DOLBY_ADD_ON_DISCOUNT_PERCENT,
    customProjectEmail: CUSTOM_PROJECT_EMAIL
  };
}

export function quoteFor({ requestedItems }) {
  if (!Array.isArray(requestedItems)) {
    throw new Error("Choose at least one service.");
  }

  const selected = [];
  const seen = new Set();
  for (const item of requestedItems) {
    if (!item || typeof item.id !== "string" || !wholeQuantity(item.quantity)) {
      throw new Error("Each service quantity must be a whole number from 0 to 99.");
    }
    if (seen.has(item.id)) throw new Error("Each service can only be sent once.");
    seen.add(item.id);

    const service = serviceById(item.id);
    if (!service) throw new Error("An unavailable service was selected.");
    if (item.quantity > 0) selected.push({ service, quantity: item.quantity });
  }

  if (selected.length === 0) throw new Error("Choose at least one service.");

  const mixSongCount = selected
    .filter(({ service }) => service.serviceType === "mix")
    .reduce((sum, { quantity }) => sum + quantity, 0);
  const volumeDiscountPercent = volumeDiscountFor(mixSongCount);
  const allUseVolumeDiscount = volumeDiscountPercent > 0;
  const lineItems = [];

  for (const { service, quantity } of selected) {
    if (service.serviceType !== "dolby-atmos" && service.serviceType !== "dolby") {
      lineItems.push(lineItem({
        ...service,
        quantity,
        discountPercent: allUseVolumeDiscount ? volumeDiscountPercent : 0,
        discountReason: allUseVolumeDiscount ? "volume" : ""
      }));
      continue;
    }

    if (allUseVolumeDiscount) {
      lineItems.push(lineItem({
        ...service,
        quantity,
        discountPercent: volumeDiscountPercent,
        discountReason: "volume"
      }));
      continue;
    }

    const addOnQuantity = Math.min(quantity, mixSongCount);
    if (addOnQuantity > 0) {
      lineItems.push(lineItem({
        ...service,
        name: "Dolby-Atmos add-on",
        quantity: addOnQuantity,
        discountPercent: DOLBY_ADD_ON_DISCOUNT_PERCENT,
        discountReason: "dolby_add_on"
      }));
    }
    const standaloneQuantity = quantity - addOnQuantity;
    if (standaloneQuantity > 0) {
      lineItems.push(lineItem({
        ...service,
        name: mixSongCount > 0 ? "Dolby-Atmos only" : service.name,
        quantity: standaloneQuantity
      }));
    }
  }

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  const totalCents = lineItems.reduce((sum, item) => sum + item.chargedAmountCents, 0);
  const discountCents = subtotalCents - totalCents;
  const discountSummary = volumeDiscountPercent > 0
    ? `${volumeDiscountPercent}% ${mixSongCount}-song volume discount`
    : lineItems.some((item) => item.discountReason === "dolby_add_on")
      ? `${DOLBY_ADD_ON_DISCOUNT_PERCENT}% Dolby Atmos add-on discount`
      : "";

  return {
    currency: CURRENCY,
    mixSongCount,
    lineItems,
    subtotalCents,
    volumeDiscountPercent,
    discountCents,
    discountSummary,
    totalCents
  };
}
