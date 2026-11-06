/**
 * The single source of truth for services and pricing.
 * Amounts are stored as cents so payments never rely on browser calculations.
 * To change a price, edit unitAmountCents here and publish a new deploy.
 */
export const CURRENCY = "usd";

export const SERVICES = Object.freeze([
  {
    id: "multitrack-stem-mixing",
    name: "Multi track/Stem mixing",
    unitAmountCents: 30000,
    unitLabel: "per track"
  },
  {
    id: "2track-mixing",
    name: "2track mixing",
    unitAmountCents: 30000,
    unitLabel: "per track"
  },
  {
    id: "mastering",
    name: "Mastering",
    unitAmountCents: 5000,
    unitLabel: "per track"
  },
  {
    id: "dolby-atmos",
    name: "Dolby-Atmos",
    unitAmountCents: 30000,
    unitLabel: "per track"
  }
]);

const serviceById = new Map(SERVICES.map((service) => [service.id, service]));

export function publicCatalog() {
  return {
    currency: CURRENCY,
    services: SERVICES.map(({ id, name, unitAmountCents, unitLabel }) => ({
      id,
      name,
      unitAmountCents,
      unitLabel
    })),
    discounts: []
  };
}

/**
 * Rebuilds every line item from the authoritative catalog. Client-supplied
 * amounts, totals, and labels are intentionally ignored.
 */
export function quoteFor(requestedItems) {
  const quantities = new Map();

  for (const item of requestedItems) {
    if (!serviceById.has(item.id)) {
      throw new Error("An unavailable service was selected.");
    }

    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 || item.quantity > 99) {
      throw new Error("Each service quantity must be a whole number from 0 to 99.");
    }

    if (quantities.has(item.id)) {
      throw new Error("Each service can only be sent once.");
    }

    quantities.set(item.id, item.quantity);
  }

  const lineItems = SERVICES.flatMap((service) => {
    const quantity = quantities.get(service.id) ?? 0;
    if (quantity === 0) return [];

    return [{
      ...service,
      quantity,
      amountCents: service.unitAmountCents * quantity
    }];
  });

  if (lineItems.length === 0) {
    throw new Error("Choose at least one service before checkout.");
  }

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);

  return {
    currency: CURRENCY,
    lineItems,
    subtotalCents,
    discountCents: 0,
    totalCents: subtotalCents
  };
}
