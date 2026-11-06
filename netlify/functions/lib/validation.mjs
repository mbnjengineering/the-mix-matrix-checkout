export class RequestValidationError extends Error {}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredText(value, label, { min, max }) {
  if (typeof value !== "string") {
    throw new RequestValidationError(`${label} is required.`);
  }

  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw new RequestValidationError(`${label} must be ${min}-${max} characters.`);
  }

  return clean;
}

export function validatePurchase(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new RequestValidationError("Please send a valid checkout request.");
  }

  const customerName = requiredText(payload.customerName, "Name", { min: 2, max: 120 });
  const customerEmail = requiredText(payload.customerEmail, "Email", { min: 3, max: 254 }).toLowerCase();
  const projectDetails = requiredText(payload.projectDetails, "Project details", { min: 3, max: 1500 });

  if (!emailPattern.test(customerEmail)) {
    throw new RequestValidationError("Enter a valid email address.");
  }

  if (!Array.isArray(payload.items) || payload.items.length > 4) {
    throw new RequestValidationError("Please choose your services again.");
  }

  const items = payload.items.map((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      throw new RequestValidationError("Please choose your services again.");
    }

    return { id: item.id };
  });

  if (!Number.isSafeInteger(payload.songCount)) {
    throw new RequestValidationError("Song count must be a whole number.");
  }

  return { customerName, customerEmail, projectDetails, songCount: payload.songCount, items };
}

/** Stripe allows a metadata value to contain up to 500 characters. */
export function projectDetailMetadata(projectDetails) {
  const chunkSize = 500;
  // Array.from keeps emoji and other Unicode code points intact at chunk edges.
  const characters = Array.from(projectDetails);
  const chunks = Array.from(
    { length: Math.ceil(characters.length / chunkSize) },
    (_, index) => characters.slice(index * chunkSize, (index + 1) * chunkSize).join("")
  );

  return Object.fromEntries(chunks.map((chunk, index) => [`project_details_${index + 1}`, chunk]));
}
