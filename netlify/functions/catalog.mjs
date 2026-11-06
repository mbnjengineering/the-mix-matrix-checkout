import { publicCatalog } from "./lib/catalog.mjs";

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { Allow: "GET" }, body: "Method Not Allowed" };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    },
    body: JSON.stringify(publicCatalog())
  };
}
