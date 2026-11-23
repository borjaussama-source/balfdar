import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  authenticateStaffAccount,
  getAdminProfile,
  getStaffAccountById,
  STAFF_PERMISSIONS,
  verifyAdminCredentials as verifyStoredCredentials,
  type StaffPermission,
} from "@/lib/products";

export const COOKIE_NAME = "akker_admin";
const SESSION_SECONDS = 60 * 60 * 8;
export type AdminRole = "super_admin" | "admin" | "employee";
export type AuthenticatedAdmin = { id:string; email:string; username:string; role:AdminRole; permissions:StaffPermission[]; managerId:string|null };
export const DEFAULT_ADMIN_PERMISSIONS:StaffPermission[]=["products.view","products.create","employees.manage","messages.use"];
function secret() { const value = process.env.ADMIN_SESSION_SECRET; if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters."); return value; }
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }

export function validAdminCredentials(email: string, password: string) {
  try { return verifyStoredCredentials(email, password); } catch { return false; }
}

export function authenticateAdminAccount(email:string,password:string):AuthenticatedAdmin|null {
  if(validAdminCredentials(email,password)){
    const profile=getAdminProfile();
    if(!profile)return null;
    return {id:"super-admin",email:profile.email,username:profile.username,role:"super_admin",permissions:[...STAFF_PERMISSIONS],managerId:null};
  }
  try{
    const account=authenticateStaffAccount(email,password);
    return account?{id:account.id,email:account.email,username:account.username,role:account.role,permissions:account.permissions,managerId:account.managerId}:null;
  }catch{return null;}
}

export function createAdminSession(account:Pick<AuthenticatedAdmin,"id"|"email"|"role">) {
  const payload = Buffer.from(JSON.stringify({id:account.id,email:account.email.toLowerCase(),role:account.role,exp:Date.now()+SESSION_SECONDS*1000})).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export async function getCurrentAdmin():Promise<AuthenticatedAdmin|null> {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return null;
    const [payload, sig, extra] = token.split(".");
    if (!payload || !sig || extra) return null;
    const expected = Buffer.from(signature(payload)); const provided = Buffer.from(sig);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
    const decoded=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {id?:unknown;email?:unknown;role?:unknown;exp?:unknown};
    if(typeof decoded.id!=="string"||typeof decoded.email!=="string"||typeof decoded.exp!=="number"||decoded.exp<=Date.now())return null;
    if(decoded.id==="super-admin"&&decoded.role==="super_admin"){
      const profile=getAdminProfile();
      return profile&&profile.email===decoded.email?{id:"super-admin",email:profile.email,username:profile.username,role:"super_admin",permissions:[...STAFF_PERMISSIONS],managerId:null}:null;
    }
    const staff=getStaffAccountById(decoded.id);
    if(!staff||!staff.active||staff.email!==decoded.email||staff.role!==decoded.role)return null;
    return {id:staff.id,email:staff.email,username:staff.username,role:staff.role,permissions:staff.permissions,managerId:staff.managerId};
  } catch { return null; }
}

// Keep the legacy guard explicitly Super Admin-only. Existing management APIs
// therefore remain closed to newly created accounts unless they are opened below.
export async function isAdmin() { return (await getCurrentAdmin())?.role === "super_admin"; }
export async function hasPermission(permission:StaffPermission):Promise<boolean>{
  const actor=await getCurrentAdmin();
  return Boolean(actor&&(actor.role==="super_admin"||actor.permissions.includes(permission)));
}
