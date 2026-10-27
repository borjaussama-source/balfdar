import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMessage } from "@/lib/products";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const attempts=new Map<string,{count:number;start:number}>();
const schema=z.object({name:z.string().trim().min(1).max(100),email:z.string().trim().email().max(254).or(z.literal("")).default(""),phone:z.string().trim().max(40).default(""),message:z.string().trim().min(5).max(3000),website:z.string().max(200).optional()}).refine(v=>v.email.length>0||v.phone.length>0,{message:"Indiquez une adresse e-mail ou un téléphone."});
export async function POST(request:NextRequest){
  const contentType=request.headers.get("content-type")??"";if(!contentType.includes("application/json"))return NextResponse.json({error:"Format de requête invalide."},{status:415});
  const origin=request.headers.get("origin");if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Origine non autorisée."},{status:403})}catch{return NextResponse.json({error:"Origine non autorisée."},{status:403})}}
  let raw:unknown;try{raw=await request.json()}catch{return NextResponse.json({error:"Requête invalide."},{status:400})}
  const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Vérifiez les champs du formulaire."},{status:400});
  if(parsed.data.website)return NextResponse.json({ok:true});
  const client=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"local";const now=Date.now();const previous=attempts.get(client);if(previous&&now-previous.start<10*60_000&&previous.count>=5)return NextResponse.json({error:"Trop de messages envoyés. Réessayez plus tard."},{status:429});if(previous&&now-previous.start<10*60_000)previous.count++;else attempts.set(client,{count:1,start:now});
  const message=createMessage({name:parsed.data.name,email:parsed.data.email,phone:parsed.data.phone,body:parsed.data.message});
  return NextResponse.json({ok:true,id:message.id},{status:201});
}
