# BALFDAR — Project V2

French-first Next.js 15 storefront for BALFDAR. The supplied reference guides its black and warm-paper palette, silver accents, restrained typography, and editorial photography.

## Local development

Requires Node.js 24+ and npm. From this directory run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Product administration is at `http://localhost:3000/admin`.

## Admin access

This project has a local `.env` file with an initial administrator login. The password is randomly generated and is not committed to source control. To change it, update `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, and replace `ADMIN_SESSION_SECRET` with a new random secret of at least 32 characters. Restart the server after changes. Login is rate-limited; the session cookie is HttpOnly, SameSite Strict, and signed server-side.

All product management APIs verify the signed administrator session on the server. Products and metadata are saved in the SQLite database at `.data/akker.sqlite`; uploaded images are stored under `public/uploads`. These persist across local server restarts and are excluded from Git. The first product image is the shop-card image. Add, edit, publish/unpublish, replace/reorder/remove images, and delete operations are available in `/admin`.

The catalog has no default products. Add products in the admin panel and publish them to show them on the existing storefront. A published product with stock set to zero appears as sold out and cannot be added to the cart.

## Collections

Collections are managed from `/admin` → **Collections**. The existing SQLite database initializes the additive `collections` and `collection_products` tables at application startup; no Prisma migration or database reset is needed. The join table stores product membership and display order, so assigning a product to several collections never duplicates its product record. Removing a collection cascades only its membership rows; the products remain in the catalog. Existing product rows are left intact by the schema addition.

Collection cover uploads use the existing `public/uploads` storage and the same image validation/8 MiB limit as product images. Admin collection APIs require the existing signed administrator session. The public `/api/collections` endpoint and `/collections/[slug]` pages return published collections only. Featured published collections appear on the homepage, and admins control this through each collection’s featured setting. All published collections are listed at `/collections`.

## Storage and deployment

The local product database uses Node 24's built-in `node:sqlite`; Node currently marks that API experimental. Product images use the server's local filesystem. This setup needs no database URL, external image service, payment credentials, or courier integration, but it must run on a single server with persistent disk. Back up both `.data/akker.sqlite` (including its WAL files when the server is stopped) and `public/uploads` together. Do not deploy this local-disk setup to an ephemeral/serverless host or multiple app instances. For those deployments, migrate product data to a managed PostgreSQL database and image files to durable object storage.

## Orders and WhatsApp confirmation

Customer orders and line items are persisted in the existing `.data/akker.sqlite` database. On database initialization the app applies additive SQLite changes for delivery dates, customer confirmation state, one-time confirmation-token hashes, WhatsApp message state, and editable message templates; existing orders are retained. Set `ORDER_CONFIRMATION_DAYS` to change the token lifetime (1–180 days, default 30). In production, set `NEXT_PUBLIC_SITE_URL` to the public HTTPS storefront origin so confirmation links work from customer phones.

The admin Orders section prepares the new-order and delivery-confirmation messages from saved order data and opens a WhatsApp chat with the message filled in. The administrator must review and send each message inside WhatsApp. This project has no WhatsApp Business API/provider credentials, so it cannot send messages automatically or detect whether a manually opened message was sent. Customer delivery confirmation does not require a WhatsApp reply: the secure one-use link changes a delivered order to Completed, while an administrator can also mark it Completed manually.

Replace the demo catalog content with verified product data before opening the shop.
