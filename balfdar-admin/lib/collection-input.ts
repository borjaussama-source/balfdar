export function collectionSlug(value:string){
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,120).replace(/-$/g,"");
}

export function validateCollectionInput(form:FormData,image:string){
  const name=String(form.get("name")??"").trim();
  const requestedSlug=String(form.get("slug")??"").trim();
  const slug=collectionSlug(requestedSlug||name);
  const description=String(form.get("description")??"").trim();
  const orderRaw=String(form.get("displayOrder")??"0");
  const displayOrder=Number(orderRaw);
  let productIds:unknown;
  try{productIds=JSON.parse(String(form.get("productIds")??"[]"))}catch{throw new Error("La sélection de produits est invalide.")}
  if(name.length<2||name.length>100)throw new Error("Le nom doit contenir entre 2 et 100 caractères.");
  if(!slug||slug.length>120)throw new Error("Le slug doit contenir des lettres ou chiffres séparés par des tirets.");
  if(description.length>2000)throw new Error("La description ne peut pas dépasser 2 000 caractères.");
  if(!Number.isInteger(displayOrder)||displayOrder<0||displayOrder>10000)throw new Error("L’ordre d’affichage est invalide.");
  if(!Array.isArray(productIds)||productIds.length>500||productIds.some(id=>typeof id!=="string"||id.length>100))throw new Error("La sélection de produits est invalide.");
  return {name,slug,description,image,published:form.get("published")==="true",featured:form.get("featured")==="true",displayOrder,productIds:Array.from(new Set(productIds as string[]))};
}
