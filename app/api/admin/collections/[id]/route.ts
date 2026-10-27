import { NextRequest,NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { validateCollectionInput } from "@/lib/collection-input";
import { deleteCollection,getCollectionBySlug,listCollections,listProducts,removeImages,storeImages,updateCollection } from "@/lib/products";

export const runtime="nodejs";
type Context={params:Promise<{id:string}>};

export async function PATCH(request:NextRequest,{params}:Context){
  if(!(await isAdmin()))return NextResponse.json({error:"Accès refusé."},{status:401});
  let uploaded:string[]=[];
  try{
    const {id}=await params;
    const current=listCollections(true).find(collection=>collection.id===id);
    if(!current)return NextResponse.json({error:"Collection introuvable."},{status:404});
    const form=await request.formData();
    const files=form.getAll("imageFile").filter((value):value is File=>value instanceof File&&value.size>0);
    if(files.length>1)throw new Error("Ajoutez une seule image de couverture.");
    uploaded=await storeImages(files);
    const image=uploaded[0]??String(form.get("image")??current.image);
    if(image&&!uploaded.length&&!/^\/(uploads\/[0-9a-f-]+\.(jpg|png|webp|avif)|[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp|avif))$/i.test(image))throw new Error("Image de couverture invalide.");
    const input=validateCollectionInput(form,image);
    if(input.productIds.some(productId=>!listProducts().some(product=>product.id===productId)))throw new Error("La sélection contient un produit introuvable.");
    const updated=updateCollection(id,input);
    if(current.image&&current.image!==image)await removeImages([current.image]);
    return NextResponse.json(updated);
  }catch(error){await removeImages(uploaded);const message=error instanceof Error?error.message:"Modification impossible.";const conflict=/UNIQUE constraint failed: collections.slug/.test(message);return NextResponse.json({error:conflict?"Ce slug est déjà utilisé.":message},{status:400});}
}

export async function DELETE(_request:NextRequest,{params}:Context){
  if(!(await isAdmin()))return NextResponse.json({error:"Accès refusé."},{status:401});
  const {id}=await params;const image=deleteCollection(id);
  if(image===null)return NextResponse.json({error:"Collection introuvable."},{status:404});
  await removeImages([image]);
  return new NextResponse(null,{status:204});
}
