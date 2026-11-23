import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_ADMIN_PERMISSIONS, getCurrentAdmin, hasPermission } from "@/lib/admin-auth";
import { createStaffAccount, listStaffAccounts, STAFF_PERMISSIONS, type StaffPermission, type StaffRole } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const isPermissionList=(value:unknown):value is StaffPermission[]=>Array.isArray(value)&&value.length<=STAFF_PERMISSIONS.length&&value.every(item=>typeof item==="string"&&STAFF_PERMISSIONS.includes(item as StaffPermission));
const originMatches=(request:NextRequest)=>{const origin=request.headers.get("origin");if(!origin)return true;try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}};

export async function GET(){
  const actor=await getCurrentAdmin();
  if(!actor||!(await hasPermission("employees.manage")))return NextResponse.json({error:"Accès refusé."},{status:401,headers:{"Cache-Control":"no-store"}});
  const accounts=actor.role==="super_admin"?listStaffAccounts():listStaffAccounts(actor.id).filter(account=>account.role==="employee");
  return NextResponse.json({accounts},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
  const actor=await getCurrentAdmin();
  if(!actor||actor.role==="employee"||!(await hasPermission("employees.manage")))return NextResponse.json({error:"Accès refusé."},{status:401});
  if(!originMatches(request))return NextResponse.json({error:"Origine non autorisée."},{status:403});
  let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Requête invalide."},{status:400})}
  if(!body||typeof body!=="object")return NextResponse.json({error:"Compte invalide."},{status:400});
  const data=body as Record<string,unknown>;
  const requestedRole=data.role??"employee";
  if(requestedRole!=="admin"&&requestedRole!=="employee")return NextResponse.json({error:"Rôle invalide."},{status:400});
  if(actor.role!=="super_admin"&&requestedRole!=="employee")return NextResponse.json({error:"Seul le Super Admin peut créer un compte Admin."},{status:403});
  const permissions=data.permissions===undefined?(requestedRole==="admin"?DEFAULT_ADMIN_PERMISSIONS:[]):data.permissions;
  if(!isPermissionList(permissions))return NextResponse.json({error:"Permissions invalides."},{status:400});
  if(actor.role==="admin"&&permissions.some(permission=>permission==="employees.manage"||!actor.permissions.includes(permission)))return NextResponse.json({error:"Vous ne pouvez attribuer que les permissions que vous possédez, sans gestion de comptes."},{status:403});
  if(requestedRole==="employee"&&permissions.includes("employees.manage"))return NextResponse.json({error:"Les employés ne peuvent pas gérer d’autres comptes."},{status:400});
  const managerId=actor.role==="super_admin"?String(data.managerId??"super-admin"):actor.id;
  if(typeof data.username!=="string"||typeof data.email!=="string"||typeof data.password!=="string")return NextResponse.json({error:"Nom, e-mail et mot de passe requis."},{status:400});
  try{
    const account=createStaffAccount({username:data.username,email:data.email,password:data.password,role:requestedRole as StaffRole,managerId,permissions});
    return NextResponse.json({account},{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Création du compte impossible."},{status:400})}
}
