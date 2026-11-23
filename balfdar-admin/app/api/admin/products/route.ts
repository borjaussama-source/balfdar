import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { validateProductFields } from "@/lib/product-input";
import { createProduct, listCollections, listProducts, storeImages } from "@/lib/products";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  return NextResponse.json(await listProducts());
}
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  let images: string[] = [];
  try {
    const form = await request.formData(); const fields = validateProductFields(form);
    let collectionIds:unknown=[];try{collectionIds=JSON.parse(String(form.get("collectionIds")??"[]"))}catch{throw new Error("La sélection des collections est invalide.")}
    if(!Array.isArray(collectionIds)||collectionIds.length>100||collectionIds.some(id=>typeof id!=="string"))throw new Error("La sélection des collections est invalide.");
    const allowedCollections=new Set(listCollections(true).map(collection=>collection.id));if((collectionIds as string[]).some(id=>!allowedCollections.has(id)))throw new Error("Une collection sélectionnée est introuvable.");
    const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    images = await storeImages(files);
    if (!images.length) return NextResponse.json({ error: "Ajoutez au moins une image." }, { status: 400 });
    const rawMainIndex = form.get("mainImageIndex"); const mainIndex = rawMainIndex === null ? -1 : Number(rawMainIndex);
    if (Number.isInteger(mainIndex) && mainIndex >= 0 && mainIndex < images.length) images.unshift(...images.splice(mainIndex, 1));
    const product = await createProduct(fields, images,collectionIds as string[]);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    const { removeImages } = await import("@/lib/products"); await removeImages(images);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Enregistrement impossible." }, { status: 400 });
  }
}
