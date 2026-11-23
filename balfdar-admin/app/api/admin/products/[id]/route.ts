import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { validateProductFields } from "@/lib/product-input";
import { deleteProduct, listCollections, listProducts, removeImages, updateProduct, storeImages } from "@/lib/products";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  let newImages: string[] = [];
  try {
    const { id } = await params; const current = (await listProducts()).find((product) => product.id === id);
    if (!current) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    const form = await request.formData(); const fields = validateProductFields(form);
    let collectionIds:string[]|undefined;
    if(form.has("collectionIds")){let parsed:unknown;try{parsed=JSON.parse(String(form.get("collectionIds")))}catch{throw new Error("La sélection des collections est invalide.")}if(!Array.isArray(parsed)||parsed.length>100||parsed.some(id=>typeof id!=="string"))throw new Error("La sélection des collections est invalide.");collectionIds=parsed as string[];const allowedCollections=new Set(listCollections(true).map(collection=>collection.id));if(collectionIds.some(collectionId=>!allowedCollections.has(collectionId)))throw new Error("Une collection sélectionnée est introuvable.")}
    const removed = new Set(form.getAll("removeImages").filter((x): x is string => typeof x === "string"));
    const added = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    newImages = await storeImages(added);
    const retained = current.images.filter((url) => !removed.has(url));
    const images = [...retained, ...newImages];
    if (!images.length) throw new Error("Le produit doit conserver au moins une image.");
    const main = String(form.get("mainImage") ?? "");
    if (main && images.includes(main)) images.splice(images.indexOf(main), 1), images.unshift(main);
    const rawMainNewIndex = form.get("mainImageIndex"); const mainNewIndex = rawMainNewIndex === null ? -1 : Number(rawMainNewIndex);
    if (Number.isInteger(mainNewIndex) && mainNewIndex >= 0 && mainNewIndex < newImages.length) {
      const selected = newImages[mainNewIndex]; images.splice(images.indexOf(selected), 1); images.unshift(selected);
    }
    const updated = await updateProduct(id, fields, images,collectionIds);
    await removeImages(current.images.filter((url) => !images.includes(url)));
    return NextResponse.json(updated);
  } catch (error) {
    await removeImages(newImages);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: 400 });
  }
}
export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  const { id } = await params; const images = await deleteProduct(id);
  if (!images) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  await removeImages(images);
  return new NextResponse(null, { status: 204 });
}
