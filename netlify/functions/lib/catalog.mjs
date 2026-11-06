/**
 * The single source of truth for services and pricing.
 * Amounts are stored as cents so payments never rely on browser calculations.
 * To change a price, edit unitAmountCents here and publish a new deploy.
 */
export const CURRENCY = "usd";
export const CUSTOM_PROJECT_EMAIL = "mbnj.engineering@gmail.com";

export const DISCOUNT_TIERS = Object.freeze([
  { minSongs: 5, percent: 15 },
  { minSongs: 3, percent: 5 }
]);

export const SERVICES = Object.freeze([
  {
    id: "multitrack-stem-mixing",
    name: "Multi track/Stem mixing",
    unitAmountCents: 30000,
    unitLabel: "per song",
    selectionType: "primary"
  },
  {
    id: "2track-mixing",
    name: "2track mixing",
    unitAmountCents: 17500,
    unitLabel: "per song",
    selectionType: "primary"
  },
  {
    id: "mastering",
    name: "Add mastering",
    unitAmountCents: 5000,
    unitLabel: "per song",
    isAddOn: true,
    selectionType: "addon"
  },
  {
    id: "dolby-atmos",
    name: "Dolby-Atmos",
    unitAmountCents: 30000,
    unitLabel: "per song",
    isAddOn: true,
    selectionType: "addon"
  }
]);

const serviceById = new Map(SERVICES.map((service) => [service.id, service]));

export function publicCatalog() {
  return {
    currency: CURRENCY,
    services: SERVICES.map(({ id, name, unitAmountCents, unitLabel, isAddOn = false, selectionType }) => ({
      id,
      name,
      unitAmountCents,
      unitLabel,
      isAddOn,
      selectionType
    })),
    discounts: DISCOUNT_TIERS,
    customProjectEmail: CUSTOM_PROJECT_EMAIL
  };
}

/**
 * Rebuilds every line item from the authoritative catalog. Client-supplied
 * amounts, totals, and labels are intentionally ignored.
 */
export function quoteFor({ requestedItems, songCount }) {
  if (!Number.isSafeInteger(songCount) || songCount < 1 || songCount > 99) {
    throw new Error("Song count must be a whole number from 1 to 99.");
  }

  const selectedServiceIds = new Set();

  for (const item of requestedItems) {
    if (!serviceById.has(item.id)) {
      throw new Error("An unavailable service was selected.");
    }

    if (selectedServiceIds.has(item.id)) {
      throw new Error("Each service can only be sent once.");
    }

    selectedServiceIds.add(item.id);
  }

  const lineItems = SERVICES.flatMap((service) => {
    if (!selectedServiceIds.has(service.id)) return [];

    return [{
      ...service,
      quantity: songCount,
      amountCents: service.unitAmountCents * songCount
    }];
  });

  if (lineItems.length === 0) {
    throw new Error("Choose at least one service before checkout.");
  }

  if (lineItems.filter((item) => item.selectionType === "primary").length > 1) {
    throw new Error("Choose only one primary mix type per project.");
  }

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  const discount = DISCOUNT_TIERS.find((tier) => songCount >= tier.minSongs);
  const discountPercent = discount?.percent ?? 0;
  const discountCents = Math.round(subtotalCents * discountPercent / 100);

  return {
    currency: CURRENCY,
    songCount,
    lineItems,
    subtotalCents,
    discountPercent,
    discountCents,
    totalCents: subtotalCents - discountCents
  };
}
