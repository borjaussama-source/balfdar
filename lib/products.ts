import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { mkdirSync as makeDirectorySync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Product = {
  id: string; name: string; description: string; category: string; priceMad: number;
  discountPriceMad: number | null; images: string[]; sku: string; sizes: string[];
  colors: string[]; stock: number; published: boolean; createdAt: string; updatedAt: string; collectionIds: string[];
};
export type Collection = { id:string;name:string;slug:string;description:string;image:string;published:boolean;featured:boolean;displayOrder:number;createdAt:string;updatedAt:string;productIds:string[];productCount:number };
export type ContactMessage = { id:string;name:string;email:string;phone:string;body:string;createdAt:string;readAt:string|null };
export type OrderStatus = "Pending"|"Confirmed"|"Processing"|"Shipped"|"Delivered"|"Completed"|"Cancelled";
export type OrderLineItem = { id:string;productId:string;productName:string;productImage:string;sku:string;size:string;quantity:number;unitPriceMad:number;totalPriceMad:number };
export type CustomerOrder = { id:string;customerName:string;phone:string;city:string;address:string;email:string;notes:string;productId:string;productName:string;productImage:string;size:string;quantity:number;unitPriceMad:number;totalPriceMad:number;status:OrderStatus;createdAt:string;reviewedAt:string|null;archived:boolean;invoiceId:string;invoiceNumber:string;itemCount:number;items:OrderLineItem[];deliveryDate:string|null;customerConfirmationStatus:"pending"|"confirmed";customerConfirmationDate:string|null;customerConfirmationMethod:"whatsapp_link"|"admin_manual"|null;whatsappOrderStatus:string;whatsappDeliveryStatus:string;whatsappError:string };
export type InvoiceStatus = "Draft"|"Generated"|"Sent"|"Paid"|"Cancelled";
export type InvoiceItem = {id:string;orderItemId:string;productId:string;productName:string;productImage:string;sku:string;size:string;quantity:number;unitPriceMad:number;discountMad:number;totalPriceMad:number};
export type InvoiceRecord = {id:string;invoiceNumber:string;orderId:string;issuedAt:string;status:InvoiceStatus;orderStatus:OrderStatus|null;customerName:string;phone:string;city:string;address:string;email:string;subtotalMad:number;shippingCostMad:number;discountMad:number;taxMad:number;totalMad:number;paymentMethod:string;items:InvoiceItem[];shareToken:string};
export type InvoiceSummary = Pick<InvoiceRecord,"id"|"invoiceNumber"|"orderId"|"issuedAt"|"status"|"orderStatus"|"customerName"|"phone"|"totalMad"> & {itemCount:number};
export type AdminProfile = { username:string; email:string; profileImage:string; updatedAt:string };
type Row = { id:string;name:string;description:string;category:string;price_mad:number;discount_price_mad:number|null;images:string;sku:string;sizes:string;colors:string;stock:number;published:number;created_at:string;updated_at:string };
const dataDir = process.env.AKKER_DATA_DIR ? path.resolve(process.env.AKKER_DATA_DIR) : path.join(process.cwd(), ".data");
const dbPath = path.join(dataDir, "akker.sqlite");
const uploadsDir = path.join(process.cwd(), "public", "uploads");
function confirmationTtlMs(){const configured=Number(process.env.ORDER_CONFIRMATION_DAYS??30);const days=Number.isFinite(configured)?Math.min(180,Math.max(1,Math.floor(configured))):30;return days*24*60*60*1000}
let db: DatabaseSync | undefined;

function database() {
  if (!db) {
    makeDirectorySync(dataDir, { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '', price_mad INTEGER NOT NULL CHECK(price_mad > 0),
        discount_price_mad INTEGER CHECK(discount_price_mad IS NULL OR (discount_price_mad > 0 AND discount_price_mad < price_mad)),
        images TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '', sizes TEXT NOT NULL DEFAULT '[]',
        colors TEXT NOT NULL DEFAULT '[]', stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
        published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON products(sku) WHERE sku <> '';
      CREATE INDEX IF NOT EXISTS products_publication ON products(published, created_at);`);
    db.exec(`CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)), featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
      display_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS collections_store_order ON collections(published, display_order, created_at);
    CREATE TABLE IF NOT EXISTS collection_products (
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      display_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      PRIMARY KEY(collection_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS collection_products_product ON collection_products(product_id, collection_id);`);
    db.exec(`CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT
    ); CREATE INDEX IF NOT EXISTS messages_created ON contact_messages(created_at DESC);`);
    db.exec(`CREATE TABLE IF NOT EXISTS admin_profile (
      id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, profile_image TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
    );`);
    db.exec(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
      city TEXT NOT NULL, address TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
      product_id TEXT NOT NULL, product_name TEXT NOT NULL, product_image TEXT NOT NULL, size TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price_mad INTEGER NOT NULL CHECK(unit_price_mad > 0),
      total_price_mad INTEGER NOT NULL CHECK(total_price_mad > 0), status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL, reviewed_at TEXT, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
    ); CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS orders_status ON orders(status, archived);`);
    db.exec(`CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT NOT NULL, product_name TEXT NOT NULL,
      product_image TEXT NOT NULL DEFAULT '', sku TEXT NOT NULL DEFAULT '', size TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price_mad INTEGER NOT NULL CHECK(unit_price_mad >= 0), total_price_mad INTEGER NOT NULL CHECK(total_price_mad >= 0)
    );`);
    db.exec(`CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);`);
    const orderColumns = new Set((db.prepare("PRAGMA table_info(orders)").all() as Array<{name:string}>).map(column=>column.name));
    const migrations: Array<[string,string]> = [["delivery_date","TEXT"],["customer_confirmation_status","TEXT NOT NULL DEFAULT 'pending'"],["customer_confirmation_date","TEXT"],["customer_confirmation_method","TEXT"],["confirmation_token_hash","TEXT"],["confirmation_token_expiry","TEXT"],["whatsapp_order_status","TEXT NOT NULL DEFAULT 'not_prepared'"],["whatsapp_delivery_status","TEXT NOT NULL DEFAULT 'not_prepared'"],["whatsapp_error","TEXT NOT NULL DEFAULT ''"]];
    for (const [column,declaration] of migrations) if (!orderColumns.has(column)) db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${declaration}`);
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS orders_confirmation_token ON orders(confirmation_token_hash) WHERE confirmation_token_hash IS NOT NULL;");
    const ordersWithoutItems = db.prepare("SELECT o.* FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE i.id IS NULL").all() as unknown as OrderRow[];
    if (ordersWithoutItems.length) {
      db.exec("BEGIN IMMEDIATE");
      try { for (const order of ordersWithoutItems) db.prepare("INSERT INTO order_items(id,order_id,product_id,product_name,product_image,sku,size,quantity,unit_price_mad,total_price_mad) VALUES(?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),order.id,order.product_id,order.product_name,order.product_image,"",order.size,order.quantity,order.unit_price_mad,order.total_price_mad); db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    }
    db.exec(`CREATE TABLE IF NOT EXISTS invoices (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, invoice_number TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL UNIQUE, issued_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Draft','Generated','Sent','Paid','Cancelled')),
      customer_name TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
      subtotal_mad INTEGER NOT NULL CHECK(subtotal_mad >= 0), shipping_cost_mad INTEGER NOT NULL DEFAULT 0 CHECK(shipping_cost_mad >= 0),
      discount_mad INTEGER NOT NULL DEFAULT 0 CHECK(discount_mad >= 0), tax_mad INTEGER NOT NULL DEFAULT 0 CHECK(tax_mad >= 0),
      total_mad INTEGER NOT NULL CHECK(total_mad >= 0), payment_method TEXT NOT NULL DEFAULT 'Paiement à la livraison', share_token TEXT NOT NULL UNIQUE
    );`);
    db.exec(`CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, order_item_id TEXT NOT NULL,
      product_id TEXT NOT NULL, product_name TEXT NOT NULL, product_image TEXT NOT NULL DEFAULT '', sku TEXT NOT NULL DEFAULT '', size TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price_mad INTEGER NOT NULL CHECK(unit_price_mad >= 0),
      discount_mad INTEGER NOT NULL DEFAULT 0 CHECK(discount_mad >= 0), total_price_mad INTEGER NOT NULL CHECK(total_price_mad >= 0)
    );`);
    db.exec(`CREATE INDEX IF NOT EXISTS invoices_issued ON invoices(issued_at DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS invoices_status ON invoices(status, issued_at DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS invoice_items_invoice ON invoice_items(invoice_id);`);
    db.exec(`CREATE TABLE IF NOT EXISTS order_message_templates(event TEXT PRIMARY KEY CHECK(event IN ('new_order','delivered','completed')),template TEXT NOT NULL,updated_at TEXT NOT NULL);`);
    const templates: Array<[string,string]> = [["new_order","Bonjour {CUSTOMER_NAME},\n\nMerci pour votre commande chez BALFDAR.\n\nCommande : #{ORDER_ID}\n\nProduit(s) :\n{PRODUCT_LIST}\n\nMontant total : {TOTAL_AMOUNT} MAD\n\nMerci d’avoir choisi BALFDAR."],["delivered","Bonjour {CUSTOMER_NAME},\n\nVotre commande #{ORDER_ID} a été livrée.\n\nProduit(s) :\n{PRODUCT_LIST}\n\nMontant total : {TOTAL_AMOUNT} MAD\n\nMerci de confirmer la réception de votre commande.\n\nConfirmer la réception :\n{SECURE_CONFIRMATION_LINK}\n\nMerci d’avoir choisi BALFDAR."],["completed","Bonjour {CUSTOMER_NAME},\n\nMerci d’avoir confirmé la réception de votre commande #{ORDER_ID}.\n\nMerci d’avoir choisi BALFDAR."]];
    const seedTemplate=db.prepare("INSERT OR IGNORE INTO order_message_templates(event,template,updated_at) VALUES(?,?,?)");for(const [event,template] of templates)seedTemplate.run(event,template,new Date().toISOString());
    const pendingInvoices = db.prepare("SELECT o.* FROM orders o LEFT JOIN invoices i ON i.order_id=o.id WHERE i.id IS NULL ORDER BY o.created_at,o.id").all() as unknown as OrderRow[];
    if (pendingInvoices.length) {
      db.exec("BEGIN IMMEDIATE");
      try { pendingInvoices.forEach(order => createInvoiceForOrder(db!, order)); db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    }
  }
  return db;
}
function present(row: Row): Product {
  return { id:row.id,name:row.name,description:row.description,category:row.category,priceMad:row.price_mad,discountPriceMad:row.discount_price_mad,images:JSON.parse(row.images),sku:row.sku,sizes:JSON.parse(row.sizes),colors:JSON.parse(row.colors),stock:row.stock,published:row.published===1,createdAt:row.created_at,updatedAt:row.updated_at,collectionIds:JSON.parse((row as Row&{collection_ids?:string}).collection_ids??"[]") };
}
const productSelect=`SELECT p.*, COALESCE((SELECT json_group_array(collection_id) FROM collection_products cp WHERE cp.product_id=p.id), '[]') AS collection_ids FROM products p`;
export function listProducts() { return (database().prepare(`${productSelect} ORDER BY p.created_at DESC`).all() as unknown as Row[]).map(present); }
type Fields = { name:string;description:string;category:string;priceMad:number;discountPriceMad:number|null;sku:string;sizes:string[];colors:string[];stock:number;published:boolean };
function saveProductCollections(id:string,collectionIds:string[],now:string){const conn=database();const validIds=Array.from(new Set(collectionIds)).filter(collectionId=>Boolean(conn.prepare("SELECT 1 FROM collections WHERE id=?").get(collectionId)));conn.prepare("DELETE FROM collection_products WHERE product_id=?").run(id);const insert=conn.prepare("INSERT INTO collection_products(collection_id,product_id,display_order,created_at) VALUES(?,?,(SELECT COALESCE(MAX(display_order)+1,0) FROM collection_products WHERE collection_id=?),?)");for(const collectionId of validIds)insert.run(collectionId,id,collectionId,now)}
export function createProduct(fields:Fields, images:string[], collectionIds:string[] = []) {
  const now=new Date().toISOString();const id=randomUUID();
  const conn=database();conn.exec("BEGIN IMMEDIATE");try{conn.prepare(`INSERT INTO products(id,name,description,category,price_mad,discount_price_mad,images,sku,sizes,colors,stock,published,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,fields.name,fields.description,fields.category,fields.priceMad,fields.discountPriceMad,JSON.stringify(images),fields.sku,JSON.stringify(fields.sizes),JSON.stringify(fields.colors),fields.stock,fields.published?1:0,now,now);
  saveProductCollections(id,collectionIds,now);conn.exec("COMMIT");}catch(error){conn.exec("ROLLBACK");throw error}return listProducts().find(product=>product.id===id)!;
}
export function updateProduct(id:string,fields:Fields,images:string[],collectionIds?:string[]) {
  const conn=database();conn.exec("BEGIN IMMEDIATE");try{const result=conn.prepare(`UPDATE products SET name=?,description=?,category=?,price_mad=?,discount_price_mad=?,images=?,sku=?,sizes=?,colors=?,stock=?,published=?,updated_at=? WHERE id=?`)
    .run(fields.name,fields.description,fields.category,fields.priceMad,fields.discountPriceMad,JSON.stringify(images),fields.sku,JSON.stringify(fields.sizes),JSON.stringify(fields.colors),fields.stock,fields.published?1:0,new Date().toISOString(),id);
  if (result.changes===0) throw new Error("Produit introuvable.");if(collectionIds!==undefined)saveProductCollections(id,collectionIds,new Date().toISOString());conn.exec("COMMIT");}catch(error){conn.exec("ROLLBACK");throw error}
  return listProducts().find(product=>product.id===id)!;
}
export function deleteProduct(id:string) {
  const row=database().prepare("SELECT images FROM products WHERE id=?").get(id) as {images:string}|undefined;
  if(!row)return null;
  database().prepare("DELETE FROM products WHERE id=?").run(id);
  return JSON.parse(row.images) as string[];
}

type CollectionRow={id:string;name:string;slug:string;description:string;image:string;published:number;featured:number;display_order:number;created_at:string;updated_at:string;product_ids?:string;product_count?:number};
function presentCollection(row:CollectionRow):Collection{return {id:row.id,name:row.name,slug:row.slug,description:row.description,image:row.image,published:row.published===1,featured:row.featured===1,displayOrder:row.display_order,createdAt:row.created_at,updatedAt:row.updated_at,productIds:JSON.parse(row.product_ids??"[]"),productCount:Number(row.product_count??0)}}
const collectionSelect=`SELECT c.*,
  COALESCE((SELECT json_group_array(product_id) FROM (SELECT product_id FROM collection_products cp WHERE cp.collection_id=c.id ORDER BY cp.display_order,cp.created_at)), '[]') AS product_ids,
  (SELECT COUNT(*) FROM collection_products cp JOIN products p ON p.id=cp.product_id WHERE cp.collection_id=c.id AND (?=0 OR p.published=1)) AS product_count
  FROM collections c`;
export function listCollections(includeUnpublished=true){const visible=includeUnpublished?"1=1":"c.published=1";return (database().prepare(`${collectionSelect.replace("SELECT c.*",`SELECT c.*`)} WHERE ${visible} ORDER BY c.display_order,c.created_at`).all(includeUnpublished?0:1) as unknown as CollectionRow[]).map(presentCollection)}
export function getCollectionBySlug(slug:string,includeUnpublished=false){const visible=includeUnpublished?"1=1":"c.published=1";const row=database().prepare(`${collectionSelect} WHERE c.slug=? AND ${visible}`).get(includeUnpublished?0:1,slug) as unknown as CollectionRow|undefined;return row?presentCollection(row):null}
export function getCollectionWithProducts(slug:string){const collection=getCollectionBySlug(slug,false);if(!collection)return null;const rows=database().prepare(`${productSelect} JOIN collection_products cp ON cp.product_id=p.id WHERE cp.collection_id=? AND p.published=1 ORDER BY cp.display_order,cp.created_at`).all(collection.id) as unknown as Row[];return {...collection,products:rows.map(present)}}
export function createCollection(input:{name:string;slug:string;description:string;image:string;published:boolean;featured:boolean;displayOrder:number;productIds:string[]}){
  const conn=database(),id=randomUUID(),now=new Date().toISOString();conn.exec("BEGIN IMMEDIATE");try{conn.prepare("INSERT INTO collections(id,name,slug,description,image,published,featured,display_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,input.name,input.slug,input.description,input.image,input.published?1:0,input.featured?1:0,input.displayOrder,now,now);setCollectionProducts(id,input.productIds,now);conn.exec("COMMIT")}catch(error){conn.exec("ROLLBACK");throw error}return getCollectionBySlug(input.slug,true)!;
}
export function updateCollection(id:string,input:{name:string;slug:string;description:string;image:string;published:boolean;featured:boolean;displayOrder:number;productIds:string[]}){
  const conn=database(),now=new Date().toISOString();conn.exec("BEGIN IMMEDIATE");try{const result=conn.prepare("UPDATE collections SET name=?,slug=?,description=?,image=?,published=?,featured=?,display_order=?,updated_at=? WHERE id=?").run(input.name,input.slug,input.description,input.image,input.published?1:0,input.featured?1:0,input.displayOrder,now,id);if(!result.changes)throw new Error("Collection introuvable.");setCollectionProducts(id,input.productIds,now);conn.exec("COMMIT")}catch(error){conn.exec("ROLLBACK");throw error}return getCollectionBySlug(input.slug,true)!;
}
function setCollectionProducts(collectionId:string,productIds:string[],now:string){const conn=database();conn.prepare("DELETE FROM collection_products WHERE collection_id=?").run(collectionId);const insert=conn.prepare("INSERT INTO collection_products(collection_id,product_id,display_order,created_at) VALUES(?,?,?,?)");Array.from(new Set(productIds)).forEach((productId,index)=>{if(conn.prepare("SELECT 1 FROM products WHERE id=?").get(productId))insert.run(collectionId,productId,index,now)})}
export function deleteCollection(id:string){const conn=database(),row=conn.prepare("SELECT image FROM collections WHERE id=?").get(id) as {image:string}|undefined;if(!row)return null;conn.prepare("DELETE FROM collections WHERE id=?").run(id);return row.image}

type MessageRow={id:string;name:string;email:string;phone:string;body:string;created_at:string;read_at:string|null};
function presentMessage(row:MessageRow):ContactMessage{return {id:row.id,name:row.name,email:row.email,phone:row.phone,body:row.body,createdAt:row.created_at,readAt:row.read_at}}
export function listMessages(){return (database().prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all() as unknown as MessageRow[]).map(presentMessage)}
export function createMessage(input:{name:string;email:string;phone:string;body:string}){const item={id:randomUUID(),...input,createdAt:new Date().toISOString(),readAt:null};database().prepare("INSERT INTO contact_messages(id,name,email,phone,body,created_at,read_at) VALUES(?,?,?,?,?,?,NULL)").run(item.id,item.name,item.email,item.phone,item.body,item.createdAt);return item}
export function updateMessageRead(id:string,read:boolean){const result=database().prepare("UPDATE contact_messages SET read_at=? WHERE id=?").run(read?new Date().toISOString():null,id);return result.changes>0}
export function deleteMessage(id:string){const result=database().prepare("DELETE FROM contact_messages WHERE id=?").run(id);return result.changes>0}

type OrderRow={id:string;idempotency_key?:string;customer_name:string;phone:string;city:string;address:string;email:string;notes:string;product_id:string;product_name:string;product_image:string;size:string;quantity:number;unit_price_mad:number;total_price_mad:number;status:OrderStatus;created_at:string;reviewed_at:string|null;archived:number;invoice_id?:string|null;invoice_number?:string|null;item_count?:number;delivery_date?:string|null;customer_confirmation_status?:"pending"|"confirmed";customer_confirmation_date?:string|null;customer_confirmation_method?:"whatsapp_link"|"admin_manual"|null;whatsapp_order_status?:string;whatsapp_delivery_status?:string;whatsapp_error?:string};
function getOrderItems(id:string):OrderLineItem[]{return (database().prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY rowid").all(id) as Array<{id:string;product_id:string;product_name:string;product_image:string;sku:string;size:string;quantity:number;unit_price_mad:number;total_price_mad:number}>).map(item=>({id:item.id,productId:item.product_id,productName:item.product_name,productImage:item.product_image,sku:item.sku,size:item.size,quantity:item.quantity,unitPriceMad:item.unit_price_mad,totalPriceMad:item.total_price_mad}))}
function presentOrder(row:OrderRow):CustomerOrder{return {id:row.id,customerName:row.customer_name,phone:row.phone,city:row.city,address:row.address,email:row.email,notes:row.notes,productId:row.product_id,productName:row.product_name,productImage:row.product_image,size:row.size,quantity:row.quantity,unitPriceMad:row.unit_price_mad,totalPriceMad:row.total_price_mad,status:row.status,createdAt:row.created_at,reviewedAt:row.reviewed_at,archived:row.archived===1,invoiceId:row.invoice_id??"",invoiceNumber:row.invoice_number??"",itemCount:row.item_count??1,items:getOrderItems(row.id),deliveryDate:row.delivery_date??null,customerConfirmationStatus:row.customer_confirmation_status??"pending",customerConfirmationDate:row.customer_confirmation_date??null,customerConfirmationMethod:row.customer_confirmation_method??null,whatsappOrderStatus:row.whatsapp_order_status??"not_prepared",whatsappDeliveryStatus:row.whatsapp_delivery_status??"not_prepared",whatsappError:row.whatsapp_error??""}}
type InvoiceDbRow={sequence:number;id:string;invoice_number:string;order_id:string;issued_at:string;status:InvoiceStatus;customer_name:string;phone:string;city:string;address:string;email:string;subtotal_mad:number;shipping_cost_mad:number;discount_mad:number;tax_mad:number;total_mad:number;payment_method:string;share_token:string;order_status:OrderStatus|null};
type InvoiceItemDbRow={id:string;order_item_id:string;product_id:string;product_name:string;product_image:string;sku:string;size:string;quantity:number;unit_price_mad:number;discount_mad:number;total_price_mad:number};
function presentInvoiceItem(row:InvoiceItemDbRow):InvoiceItem{return {id:row.id,orderItemId:row.order_item_id,productId:row.product_id,productName:row.product_name,productImage:row.product_image,sku:row.sku,size:row.size,quantity:row.quantity,unitPriceMad:row.unit_price_mad,discountMad:row.discount_mad,totalPriceMad:row.total_price_mad}}
function presentInvoice(row:InvoiceDbRow,items:InvoiceItemDbRow[]):InvoiceRecord{return {id:row.id,invoiceNumber:row.invoice_number,orderId:row.order_id,issuedAt:row.issued_at,status:row.status,orderStatus:row.order_status,customerName:row.customer_name,phone:row.phone,city:row.city,address:row.address,email:row.email,subtotalMad:row.subtotal_mad,shippingCostMad:row.shipping_cost_mad,discountMad:row.discount_mad,taxMad:row.tax_mad,totalMad:row.total_mad,paymentMethod:row.payment_method,items:items.map(presentInvoiceItem),shareToken:row.share_token}}
function createInvoiceForOrder(conn:DatabaseSync,order:OrderRow){
  const existing=conn.prepare("SELECT id FROM invoices WHERE order_id=?").get(order.id) as {id:string}|undefined;if(existing)return existing.id;
  const id=randomUUID(),token=randomBytes(32).toString("base64url"),placeholder="PENDING-"+id;
  const inserted=conn.prepare("INSERT INTO invoices(id,invoice_number,order_id,issued_at,status,customer_name,phone,city,address,email,subtotal_mad,shipping_cost_mad,discount_mad,tax_mad,total_mad,payment_method,share_token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id,placeholder,order.id,order.created_at,order.status==="Cancelled"?"Cancelled":"Generated",order.customer_name,order.phone,order.city,order.address,order.email,order.total_price_mad,0,0,0,order.total_price_mad,"Paiement à la livraison",token);
  const number="INV-"+String(inserted.lastInsertRowid).padStart(6,"0");
  conn.prepare("UPDATE invoices SET invoice_number=? WHERE id=?").run(number,id);
  const orderItems=conn.prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY rowid").all(order.id) as Array<{id:string;product_id:string;product_name:string;product_image:string;sku:string;size:string;quantity:number;unit_price_mad:number;total_price_mad:number}>;
  const add=conn.prepare("INSERT INTO invoice_items(id,invoice_id,order_item_id,product_id,product_name,product_image,sku,size,quantity,unit_price_mad,discount_mad,total_price_mad) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
  for(const item of orderItems)add.run(randomUUID(),id,item.id,item.product_id,item.product_name,item.product_image,item.sku,item.size,item.quantity,item.unit_price_mad,0,item.total_price_mad);
  return id;
}
function invoiceWithItems(row:InvoiceDbRow):InvoiceRecord{
  const items=database().prepare("SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY rowid").all(row.id) as unknown as InvoiceItemDbRow[];
  return presentInvoice(row,items);
}
const invoiceStatuses:InvoiceStatus[]=["Draft","Generated","Sent","Paid","Cancelled"];
export function getInvoiceById(id:string){const row=database().prepare("SELECT i.*,o.status AS order_status FROM invoices i LEFT JOIN orders o ON o.id=i.order_id WHERE i.id=?").get(id) as unknown as InvoiceDbRow|undefined;return row?invoiceWithItems(row):null}
export function getInvoiceByOrder(orderId:string){const row=database().prepare("SELECT i.*,o.status AS order_status FROM invoices i LEFT JOIN orders o ON o.id=i.order_id WHERE i.order_id=?").get(orderId) as unknown as InvoiceDbRow|undefined;return row?invoiceWithItems(row):null}
export function getInvoiceByShareToken(token:string){const row=database().prepare("SELECT i.*,o.status AS order_status FROM invoices i LEFT JOIN orders o ON o.id=i.order_id WHERE i.share_token=?").get(token) as unknown as InvoiceDbRow|undefined;return row?invoiceWithItems(row):null}
export function listInvoices(filters:{page:number;pageSize:number;query:string;status:string;orderStatus:string;from:string;to:string}){
  const clauses:string[]=[],values:(string|number)[]=[];
  if(filters.query){const like="%"+filters.query.slice(0,120)+"%";clauses.push("(i.invoice_number LIKE ? OR i.order_id LIKE ? OR i.customer_name LIKE ? OR i.phone LIKE ?)");values.push(like,like,like,like)}
  if(invoiceStatuses.includes(filters.status as InvoiceStatus)){clauses.push("i.status=?");values.push(filters.status)}
  if(["Pending","Confirmed","Processing","Shipped","Delivered","Completed","Cancelled"].includes(filters.orderStatus)){clauses.push("o.status=?");values.push(filters.orderStatus)}
  if(/^\d{4}-\d{2}-\d{2}$/.test(filters.from)){clauses.push("i.issued_at>=?");values.push(filters.from+"T00:00:00.000Z")}
  if(/^\d{4}-\d{2}-\d{2}$/.test(filters.to)){clauses.push("i.issued_at<=?");values.push(filters.to+"T23:59:59.999Z")}
  const where=clauses.length?"WHERE "+clauses.join(" AND "):"",conn=database();
  const count=Number((conn.prepare("SELECT COUNT(*) AS count FROM invoices i LEFT JOIN orders o ON o.id=i.order_id "+where).get(...values) as {count:number}).count);
  const totals=conn.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(total_mad),0) AS value FROM invoices").get() as {count:number;value:number};
  const page=Math.max(1,Math.floor(filters.page)),pageSize=Math.min(100,Math.max(1,Math.floor(filters.pageSize))),pageCount=Math.max(1,Math.ceil(count/pageSize));
  const rows=conn.prepare("SELECT i.*,o.status AS order_status,(SELECT COUNT(*) FROM invoice_items x WHERE x.invoice_id=i.id) AS item_count FROM invoices i LEFT JOIN orders o ON o.id=i.order_id "+where+" ORDER BY i.sequence DESC LIMIT ? OFFSET ?").all(...values,pageSize,(page-1)*pageSize) as unknown as Array<InvoiceDbRow&{item_count:number}>;
  return {invoices:rows.map(row=>({id:row.id,invoiceNumber:row.invoice_number,orderId:row.order_id,issuedAt:row.issued_at,status:row.status,orderStatus:row.order_status,customerName:row.customer_name,phone:row.phone,totalMad:row.total_mad,itemCount:row.item_count})),total:count,page,pageSize,pageCount,invoiceCount:Number(totals.count),invoiceValueMad:Number(totals.value)};
}
export function updateInvoiceStatus(id:string,status:InvoiceStatus){
  if(!invoiceStatuses.includes(status))throw new Error("Statut de facture invalide.");
  const conn=database(),row=conn.prepare("SELECT order_id FROM invoices WHERE id=?").get(id) as {order_id:string}|undefined;if(!row)return null;
  const order=conn.prepare("SELECT status FROM orders WHERE id=?").get(row.order_id) as {status:OrderStatus}|undefined;
  if(status==="Cancelled"&&order&&order.status!=="Cancelled")updateOrder(row.order_id,{status:"Cancelled"});
  else {if(order?.status==="Cancelled"&&status!=="Cancelled")throw new Error("Réactivez d’abord la commande avant de modifier cette facture.");conn.prepare("UPDATE invoices SET status=? WHERE id=?").run(status,id)}
  return getInvoiceById(id);
}
export function listOrders(){return (database().prepare("SELECT o.*,i.id AS invoice_id,i.invoice_number,(SELECT COUNT(*) FROM order_items x WHERE x.order_id=o.id) AS item_count FROM orders o LEFT JOIN invoices i ON i.order_id=o.id ORDER BY o.created_at DESC").all() as unknown as OrderRow[]).map(presentOrder)}
export type OrderMessageEvent = "new_order"|"delivered"|"completed";
export type OrderMessageTemplates = Record<OrderMessageEvent,string>;
export function getOrderMessageTemplates():OrderMessageTemplates{const rows=database().prepare("SELECT event,template FROM order_message_templates").all() as Array<{event:OrderMessageEvent;template:string}>;return Object.fromEntries(rows.map(row=>[row.event,row.template])) as OrderMessageTemplates}
export function saveOrderMessageTemplates(templates:OrderMessageTemplates){const allowed=new Set(["CUSTOMER_NAME","ORDER_ID","PRODUCT_NAME","PRODUCT_LIST","QUANTITY","PRODUCT_PRICE","TOTAL_AMOUNT","SECURE_CONFIRMATION_LINK"]);for(const template of Object.values(templates)){if(typeof template!=="string"||template.length>8000)throw new Error("Chaque modèle doit contenir au maximum 8 000 caractères.");for(const match of template.matchAll(/\{([A-Z_]+)\}/g))if(!allowed.has(match[1]))throw new Error(`Variable inconnue : {${match[1]}}`)}const conn=database(),save=conn.prepare("INSERT INTO order_message_templates(event,template,updated_at) VALUES(?,?,?) ON CONFLICT(event) DO UPDATE SET template=excluded.template,updated_at=excluded.updated_at"),now=new Date().toISOString();for(const event of ["new_order","delivered","completed"] as const)save.run(event,templates[event],now);return getOrderMessageTemplates()}
export function getOrderById(id:string):CustomerOrder|null{const row=database().prepare("SELECT o.*,i.id AS invoice_id,i.invoice_number,(SELECT COUNT(*) FROM order_items x WHERE x.order_id=o.id) AS item_count FROM orders o LEFT JOIN invoices i ON i.order_id=o.id WHERE o.id=?").get(id) as unknown as OrderRow|undefined;return row?presentOrder(row):null}
export function prepareOrderConfirmation(id:string){const conn=database(),row=conn.prepare("SELECT status,customer_confirmation_status FROM orders WHERE id=?").get(id) as {status:OrderStatus;customer_confirmation_status:"pending"|"confirmed"}|undefined;if(!row||row.status!=="Delivered"||row.customer_confirmation_status!=="pending")throw new Error("Le lien de confirmation est disponible uniquement pour une commande livrée en attente de confirmation.");const token=randomBytes(32).toString("base64url"),expiry=new Date(Date.now()+confirmationTtlMs()).toISOString();conn.prepare("UPDATE orders SET confirmation_token_hash=?,confirmation_token_expiry=? WHERE id=?").run(createHash("sha256").update(token).digest("hex"),expiry,id);return {order:getOrderById(id)!,token,expiresAt:expiry}}
export function getOrderForConfirmation(token:string){if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))return null;const hash=createHash("sha256").update(token).digest("hex"),row=database().prepare("SELECT id,status,confirmation_token_expiry,customer_confirmation_status FROM orders WHERE confirmation_token_hash=?").get(hash) as {id:string;status:OrderStatus;confirmation_token_expiry:string|null;customer_confirmation_status:"pending"|"confirmed"}|undefined;if(!row||row.status!=="Delivered"||row.customer_confirmation_status!=="pending"||!row.confirmation_token_expiry||Date.parse(row.confirmation_token_expiry)<=Date.now())return null;return {orderId:row.id}}
export function confirmOrderDelivery(token:string){if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))return {ok:false as const,reason:"invalid" as const};const hash=createHash("sha256").update(token).digest("hex"),conn=database(),row=conn.prepare("SELECT id,status,confirmation_token_expiry,customer_confirmation_status FROM orders WHERE confirmation_token_hash=?").get(hash) as {id:string;status:OrderStatus;confirmation_token_expiry:string|null;customer_confirmation_status:"pending"|"confirmed"}|undefined;if(!row)return {ok:false as const,reason:"invalid" as const};if(row.customer_confirmation_status==="confirmed")return {ok:false as const,reason:"used" as const};if(row.status!=="Delivered"||!row.confirmation_token_expiry||Date.parse(row.confirmation_token_expiry)<=Date.now())return {ok:false as const,reason:"expired" as const};const now=new Date().toISOString();const result=conn.prepare("UPDATE orders SET status='Completed',customer_confirmation_status='confirmed',customer_confirmation_date=?,customer_confirmation_method='whatsapp_link',confirmation_token_hash=NULL,confirmation_token_expiry=NULL WHERE id=? AND confirmation_token_hash=? AND status='Delivered' AND customer_confirmation_status='pending'").run(now,row.id,hash);if(!result.changes)return {ok:false as const,reason:"used" as const};return {ok:true as const,order:getOrderById(row.id)} }
export function setOrderWhatsAppState(id:string,event:OrderMessageEvent,status:"prepared"|"sent"|"error",error=""){const column=event==="new_order"?"whatsapp_order_status":"whatsapp_delivery_status";database().prepare(`UPDATE orders SET ${column}=?,whatsapp_error=? WHERE id=?`).run(status,error.slice(0,1000),id);return getOrderById(id)}
export function countNewOrders(){return Number((database().prepare("SELECT COUNT(*) AS count FROM orders WHERE reviewed_at IS NULL AND archived=0").get() as {count:number}).count)}
export function markOrderReviewed(id:string){return database().prepare("UPDATE orders SET reviewed_at=? WHERE id=? AND reviewed_at IS NULL").run(new Date().toISOString(),id).changes>0}
export function createOrder(input:{idempotencyKey:string;customerName:string;phone:string;city:string;address:string;email:string;notes:string;productId?:string;size?:string;quantity?:number;items?:Array<{productId:string;size:string;quantity:number}>}){
  const conn=database();const duplicate=conn.prepare("SELECT * FROM orders WHERE idempotency_key=?").get(input.idempotencyKey) as OrderRow|undefined;if(duplicate)return {order:presentOrder(duplicate),duplicate:true};
  conn.exec("BEGIN IMMEDIATE");try{
    const requested=input.items??(input.productId?[{productId:input.productId,size:input.size??"",quantity:input.quantity??1}]:[]);
    if(!requested.length||requested.length>50)throw new Error("La commande ne contient aucun article valide.");
    const byProduct=new Map<string,{size:string;quantity:number}>();
    for(const item of requested){if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20)throw new Error("Quantité invalide.");const current=byProduct.get(item.productId);if(current&&current.size!==item.size)throw new Error("Un même produit ne peut pas être commandé en plusieurs tailles dans une seule ligne.");byProduct.set(item.productId,{size:item.size,quantity:(current?.quantity??0)+item.quantity});}
    const lines=Array.from(byProduct,([productId,line])=>{const product=conn.prepare("SELECT * FROM products WHERE id=? AND published=1").get(productId) as Row|undefined;if(!product)throw new Error("Un article n’est plus disponible.");if(line.quantity>product.stock)throw new Error("La quantité demandée dépasse le stock disponible.");const sizes=JSON.parse(product.sizes) as string[];if(line.size&&!sizes.includes(line.size))throw new Error("Une taille sélectionnée n’est plus disponible.");const price=product.discount_price_mad??product.price_mad;return {product,line,price,total:price*line.quantity};});
    const id=randomUUID(),now=new Date().toISOString(),first=lines[0],total=lines.reduce((sum,line)=>sum+line.total,0),quantity=lines.reduce((sum,line)=>sum+line.line.quantity,0);
    conn.prepare(`INSERT INTO orders(id,idempotency_key,customer_name,phone,city,address,email,notes,product_id,product_name,product_image,size,quantity,unit_price_mad,total_price_mad,status,created_at,reviewed_at,archived) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending',?,NULL,0)`).run(id,input.idempotencyKey,input.customerName,input.phone,input.city,input.address,input.email,input.notes,first.product.id,first.product.name,JSON.parse(first.product.images)[0]??"",first.line.size,quantity,first.price,total,now);
    const addItem=conn.prepare("INSERT INTO order_items(id,order_id,product_id,product_name,product_image,sku,size,quantity,unit_price_mad,total_price_mad) VALUES(?,?,?,?,?,?,?,?,?,?)");
    for(const {product,line,price,total:lineTotal} of lines){addItem.run(randomUUID(),id,product.id,product.name,JSON.parse(product.images)[0]??"",product.sku,line.size,line.quantity,price,lineTotal);conn.prepare("UPDATE products SET stock=stock-?,updated_at=? WHERE id=?").run(line.quantity,now,product.id);}
    conn.prepare("UPDATE orders SET whatsapp_order_status='prepared' WHERE id=?").run(id);const row=conn.prepare("SELECT * FROM orders WHERE id=?").get(id) as OrderRow;createInvoiceForOrder(conn,row);conn.exec("COMMIT");return {order:presentOrder(row),duplicate:false};
  }catch(error){conn.exec("ROLLBACK");const existing=conn.prepare("SELECT * FROM orders WHERE idempotency_key=?").get(input.idempotencyKey) as OrderRow|undefined;if(existing)return {order:presentOrder(existing),duplicate:true};throw error}
}
const orderStatuses:OrderStatus[]=["Pending","Confirmed","Processing","Shipped","Delivered","Completed","Cancelled"];
export function updateOrder(id:string,change:{status?:OrderStatus;archived?:boolean}): (CustomerOrder&{confirmationToken?:string})|null{
  const conn=database();conn.exec("BEGIN IMMEDIATE");try{
    const row=conn.prepare("SELECT * FROM orders WHERE id=?").get(id) as OrderRow|undefined;if(!row){conn.exec("ROLLBACK");return null}
    if(change.status&&!orderStatuses.includes(change.status))throw new Error("Statut de commande invalide.");
    if(change.status&&change.status!==row.status){
      const orderItems=conn.prepare("SELECT product_id,quantity FROM order_items WHERE order_id=?").all(id) as Array<{product_id:string;quantity:number}>;
      if(change.status==="Cancelled"&&row.status!=="Cancelled")for(const item of orderItems)conn.prepare("UPDATE products SET stock=stock+?,updated_at=? WHERE id=?").run(item.quantity,new Date().toISOString(),item.product_id);
      if(row.status==="Cancelled"&&change.status!=="Cancelled"){
        for(const item of orderItems){const stock=conn.prepare("SELECT stock FROM products WHERE id=?").get(item.product_id) as {stock:number}|undefined;if(!stock||stock.stock<item.quantity)throw new Error("Stock insuffisant pour réactiver cette commande.");conn.prepare("UPDATE products SET stock=stock-?,updated_at=? WHERE id=?").run(item.quantity,new Date().toISOString(),item.product_id);}
      }
      conn.prepare("UPDATE orders SET status=? WHERE id=?").run(change.status,id);if(change.status==="Cancelled")conn.prepare("UPDATE invoices SET status=CASE WHEN status='Paid' THEN status ELSE 'Cancelled' END WHERE order_id=?").run(id);else if(row.status==="Cancelled")conn.prepare("UPDATE invoices SET status='Generated' WHERE order_id=? AND status='Cancelled'").run(id);
      if(change.status==="Delivered"){const token=randomBytes(32).toString("base64url"),expiry=new Date(Date.now()+confirmationTtlMs()).toISOString();conn.prepare("UPDATE orders SET delivery_date=COALESCE(delivery_date,?),customer_confirmation_status='pending',customer_confirmation_date=NULL,customer_confirmation_method=NULL,confirmation_token_hash=?,confirmation_token_expiry=?,whatsapp_delivery_status='prepared',whatsapp_error='' WHERE id=?").run(new Date().toISOString(),createHash("sha256").update(token).digest("hex"),expiry,id);(row as OrderRow&{confirmationToken?:string}).confirmationToken=token;}
      else if(change.status==="Completed"){conn.prepare("UPDATE orders SET customer_confirmation_date=COALESCE(customer_confirmation_date,?),customer_confirmation_method=CASE WHEN customer_confirmation_status='confirmed' THEN customer_confirmation_method ELSE 'admin_manual' END,confirmation_token_hash=NULL,confirmation_token_expiry=NULL WHERE id=?").run(new Date().toISOString(),id);}
      else if(change.status==="Cancelled")conn.prepare("UPDATE orders SET confirmation_token_hash=NULL,confirmation_token_expiry=NULL WHERE id=?").run(id);
    }
    if(change.archived!==undefined)conn.prepare("UPDATE orders SET archived=? WHERE id=?").run(change.archived?1:0,id);
    const updated=conn.prepare("SELECT * FROM orders WHERE id=?").get(id) as OrderRow;conn.exec("COMMIT");const presented=presentOrder(updated);const confirmationToken=(row as OrderRow&{confirmationToken?:string}).confirmationToken;return confirmationToken?{...presented,confirmationToken}:presented;
  }catch(error){conn.exec("ROLLBACK");throw error}
}
export function deleteOrder(id:string){const conn=database();conn.exec("BEGIN IMMEDIATE");try{const row=conn.prepare("SELECT status FROM orders WHERE id=?").get(id) as {status:OrderStatus}|undefined;if(!row){conn.exec("ROLLBACK");return false}if(row.status!=="Cancelled"){const items=conn.prepare("SELECT product_id,quantity FROM order_items WHERE order_id=?").all(id) as Array<{product_id:string;quantity:number}>;for(const item of items)conn.prepare("UPDATE products SET stock=stock+?,updated_at=? WHERE id=?").run(item.quantity,new Date().toISOString(),item.product_id)}conn.prepare("DELETE FROM orders WHERE id=?").run(id);conn.exec("COMMIT");return true}catch(error){conn.exec("ROLLBACK");throw error}}

type AdminProfileRow={id:number;username:string;email:string;password_salt:string;password_hash:string;profile_image:string;updated_at:string};
const passwordBytes=64;
function ensureAdminProfileRow():AdminProfileRow|undefined{
  const conn=database();let row=conn.prepare("SELECT * FROM admin_profile WHERE id=1").get() as AdminProfileRow|undefined;
  if(row)return row;
  const email=(process.env.ADMIN_EMAIL??"").trim().toLowerCase(),password=process.env.ADMIN_PASSWORD??"";
  if(!email||!password)return undefined;
  const salt=randomBytes(16).toString("hex"),hash=scryptSync(password,salt,passwordBytes).toString("hex"),username=email.split("@")[0]||"Admin",now=new Date().toISOString();
  conn.prepare("INSERT OR IGNORE INTO admin_profile(id,username,email,password_salt,password_hash,profile_image,updated_at) VALUES(1,?,?,?,?,?,?)").run(username,email,salt,hash,"",now);
  row=conn.prepare("SELECT * FROM admin_profile WHERE id=1").get() as AdminProfileRow|undefined;
  return row;
}
function publicAdminProfile(row:AdminProfileRow):AdminProfile{return {username:row.username,email:row.email,profileImage:row.profile_image,updatedAt:row.updated_at}}
export function getAdminProfile():AdminProfile|null{const row=ensureAdminProfileRow();return row?publicAdminProfile(row):null}
export function verifyAdminPassword(password:string):boolean{
  const row=ensureAdminProfileRow();if(!row)return false;
  try{const expected=Buffer.from(row.password_hash,"hex"),actual=scryptSync(password,row.password_salt,passwordBytes);return expected.length===actual.length&&timingSafeEqual(expected,actual)}catch{return false}
}
export function verifyAdminCredentials(email:string,password:string):boolean{
  const row=ensureAdminProfileRow();if(!row)return false;
  const sameEmail=email.trim().toLowerCase()===row.email;
  const samePassword=verifyAdminPassword(password);
  return sameEmail&&samePassword;
}
export function updateAdminProfile(input:{username:string;email:string;newPassword?:string;profileImage?:string}):AdminProfile{
  const row=ensureAdminProfileRow();if(!row)throw new Error("Le profil administrateur n’est pas configuré.");
  const nextEmail=input.email.trim().toLowerCase(),nextUsername=input.username.trim();
  if(!nextUsername||!nextEmail)throw new Error("Nom et adresse e-mail obligatoires.");
  const salt=input.newPassword?randomBytes(16).toString("hex"):row.password_salt;
  const hash=input.newPassword?scryptSync(input.newPassword,salt,passwordBytes).toString("hex"):row.password_hash;
  database().prepare("UPDATE admin_profile SET username=?,email=?,password_salt=?,password_hash=?,profile_image=?,updated_at=? WHERE id=1")
    .run(nextUsername,nextEmail,salt,hash,input.profileImage??row.profile_image,new Date().toISOString());
  const updated=database().prepare("SELECT * FROM admin_profile WHERE id=1").get() as AdminProfileRow;
  return publicAdminProfile(updated);
}

const imageTypes: Record<string,string>={"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/avif":".avif"};
export const MAX_IMAGE_BYTES=8*1024*1024;
function validImageBytes(bytes:Buffer,type:string){
  if(type==="image/jpeg")return bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(type==="image/png")return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(type==="image/webp")return bytes.length>12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
  if(type==="image/avif")return bytes.length>12&&bytes.toString("ascii",4,8)==="ftyp"&&bytes.toString("ascii",8,12).includes("avif");
  return false;
}
export async function storeImages(files:File[]):Promise<string[]>{
  if(files.length>8)throw new Error("Ajoutez 8 images maximum par produit.");const saved:string[]=[];
  try{await mkdir(uploadsDir,{recursive:true});for(const file of files){const ext=imageTypes[file.type];if(!ext)throw new Error("Format image non pris en charge. Utilisez JPEG, PNG, WebP ou AVIF.");if(file.size<=0||file.size>MAX_IMAGE_BYTES)throw new Error("Chaque image doit peser moins de 8 Mo.");const bytes=Buffer.from(await file.arrayBuffer());if(!validImageBytes(bytes,file.type))throw new Error("Le fichier ne semble pas être une image valide.");const filename=`${randomUUID()}${ext}`;await writeFile(path.join(uploadsDir,filename),bytes,{flag:"wx"});saved.push(`/uploads/${filename}`)}return saved}catch(error){await removeImages(saved);throw error}
}
export async function removeImages(images:string[]){await Promise.all(images.map(async url=>{if(!/^\/uploads\/[0-9a-f-]+\.(jpg|png|webp|avif)$/i.test(url))return;try{await unlink(path.join(uploadsDir,path.basename(url)))}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error}}))}
