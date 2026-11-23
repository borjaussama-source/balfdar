import { createHash } from "node:crypto";
import type { CustomerOrder } from "@/lib/products";

export type OrderMessageEvent = "new_order" | "delivered" | "completed";
export type OrderMessageTemplates = Record<OrderMessageEvent, string>;

export const defaultOrderMessageTemplates: OrderMessageTemplates = {
  new_order: `Bonjour {CUSTOMER_NAME},\n\nMerci pour votre commande chez BALFDAR.\n\nCommande : #{ORDER_ID}\n\nProduit(s) :\n{PRODUCT_LIST}\n\nMontant total : {TOTAL_AMOUNT} MAD\n\nMerci d’avoir choisi BALFDAR.`,
  delivered: `Bonjour {CUSTOMER_NAME},\n\nVotre commande #{ORDER_ID} a été livrée.\n\nProduit(s) :\n{PRODUCT_LIST}\n\nMontant total : {TOTAL_AMOUNT} MAD\n\nMerci de confirmer la réception de votre commande.\n\nConfirmer la réception :\n{SECURE_CONFIRMATION_LINK}\n\nMerci d’avoir choisi BALFDAR.`,
  completed: `Bonjour {CUSTOMER_NAME},\n\nMerci d’avoir confirmé la réception de votre commande #{ORDER_ID}.\n\nMerci d’avoir choisi BALFDAR.`,
};

export function applyCurrentBranding(template: string) {
  return template.replace(/\bAKKER\b/gi, "BALFDAR");
}

const money = (value: number) => new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value);
export function renderOrderMessage(template: string, order: CustomerOrder, confirmationLink = "") {
  const productList = (order.items?.length ? order.items : [{ productName: order.productName, size: order.size, quantity: order.quantity, unitPriceMad: order.unitPriceMad }])
    .map(item => `• ${item.productName}${item.size ? ` (${item.size})` : ""} — ${item.quantity} × ${money(item.unitPriceMad)} MAD`)
    .join("\n");
  const values: Record<string, string> = {
    CUSTOMER_NAME: order.customerName,
    ORDER_ID: order.id,
    PRODUCT_NAME: order.productName,
    PRODUCT_LIST: productList,
    QUANTITY: String(order.quantity),
    PRODUCT_PRICE: money(order.unitPriceMad),
    TOTAL_AMOUNT: money(order.totalPriceMad),
    SECURE_CONFIRMATION_LINK: confirmationLink,
  };
  return applyCurrentBranding(template).replace(/\{([A-Z_]+)\}/g, (match, key: string) => values[key] ?? match);
}

export function whatsappLink(phone: string, message: string) {
  let normalized = phone.replace(/\D/g, "");
  if (normalized.startsWith("00")) normalized = normalized.slice(2);
  if (normalized.startsWith("0")) normalized = `212${normalized.slice(1)}`;
  else if (/^[567]\d{8}$/.test(normalized)) normalized = `212${normalized}`;
  if (normalized.length < 8 || normalized.length > 15) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function hashConfirmationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
