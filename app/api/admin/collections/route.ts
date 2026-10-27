import { NextRequest,NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { validateCollectionInput } from "@/lib/collection-input";
import { createCollection,listCollections,listProducts,removeImages,storeImages } from "@/lib/products";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  if(!(await isAdmin()))return NextResponse.json({error:"Accès refusé."},{status:401});
  return NextResponse.json(listCollections(true));
}

export async function POST(request:NextRequest){
  if(!(await isAdmin()))return NextResponse.json({error:"Accès refusé."},{status:401});
  let uploaded:string[]=[];
  try{
    const form=await request.formData();
    const files=form.getAll("imageFile").filter((value):value is File=>value instanceof File&&value.size>0);
    if(files.length>1)throw new Error("Ajoutez une seule image de couverture.");
    uploaded=await storeImages(files);
    const image=uploaded[0]??String(form.get("image")??"");
    if(image&&!uploaded.length&&!/^\/(uploads\/[0-9a-f-]+\.(jpg|png|webp|avif)|[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp|avif))$/i.test(image))throw new Error("Image de couverture invalide.");
    const input=validateCollectionInput(form,image);
    const productIds=new Set(listProducts().map(product=>product.id));
    if(input.productIds.some(id=>!productIds.has(id)))throw new Error("La sélection contient un produit introuvable.");
    return NextResponse.json(createCollection(input),{status:201});
  }catch(error){await removeImages(uploaded);const message=error instanceof Error?error.message:"Enregistrement impossible.";const conflict=/UNIQUE constraint failed: collections.slug/.test(message);return NextResponse.json({error:conflict?"Ce slug est déjà utilisé.":message},{status:400});}
}
