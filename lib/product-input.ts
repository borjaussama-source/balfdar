import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
  description: z.string().max(5000).default(""),
  category: z.string().trim().max(80).default(""),
  priceMad: z.coerce.number().int().min(1).max(100_000_000),
  discountPriceMad: z.union([z.coerce.number().int().min(1).max(100_000_000), z.null()]).default(null),
  sku: z.string().trim().max(80).default(""),
  sizes: z.array(z.string().trim().min(1).max(30)).max(30).default([]),
  colors: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  published: z.boolean().default(false),
});

export function validateProductFields(form: FormData) {
  const parseList = (key: string) => String(form.get(key) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const discount = String(form.get("discountPriceMad") ?? "").trim();
  const result = schema.safeParse({
    name: form.get("name"), description: form.get("description") ?? "", category: form.get("category") ?? "",
    priceMad: form.get("priceMad"), discountPriceMad: discount ? discount : null, sku: form.get("sku") ?? "",
    sizes: parseList("sizes"), colors: parseList("colors"), stock: form.get("stock") ?? "0",
    published: form.get("published") === "true",
  });
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Informations produit invalides.");
  const data = result.data;
  if (data.discountPriceMad !== null && data.discountPriceMad >= data.priceMad) throw new Error("Le prix réduit doit être inférieur au prix normal.");
  return data;
}
