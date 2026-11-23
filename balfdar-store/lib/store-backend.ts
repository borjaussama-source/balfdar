import type { StoreCollectionWithProducts, StoreCollection } from "@/lib/store-types";

const backendOrigin = (process.env.BALFDAR_API_URL || "http://localhost:3003").replace(/\/$/, "");

export async function getStoreCollections(): Promise<StoreCollection[]> {
  const response = await fetch(`${backendOrigin}/api/collections`, { cache: "no-store" });
  if (!response.ok) return [];
  return response.json() as Promise<StoreCollection[]>;
}

export async function getStoreCollection(slug: string): Promise<StoreCollectionWithProducts | null> {
  const response = await fetch(`${backendOrigin}/api/collections/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Impossible de charger cette collection.");
  return response.json() as Promise<StoreCollectionWithProducts>;
}

export async function getStoreInvoice(token: string) {
  const response = await fetch(`${backendOrigin}/api/invoice/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error("Impossible de charger cette facture.");
  return response.json();
}
