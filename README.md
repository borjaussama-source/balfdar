# BALFDAR separated projects

`balfdar-admin` owns the existing SQLite database, admin authentication, upload storage, and shared API. `balfdar-store` is the customer-facing Next.js app; it proxies `/api/*` and `/uploads/*` to that Admin service, so both apps use the same database and uploaded product images.

## Run locally

1. In `balfdar-admin`, keep the existing `.env` credentials, then run `npm install` once and `npm run dev` (port 3003).
2. In `balfdar-store`, run `npm install` once and `npm run dev` (port 3002). Its default `BALFDAR_API_URL` is `http://localhost:3003`; override this in `.env.local` when the Admin API has another origin.
3. Open the Store at http://localhost:3002 and Admin at http://localhost:3003/admin.

The SQLite database and product uploads live only in `balfdar-admin/.data/akker.sqlite` and `balfdar-admin/public/uploads`. The database is a consistent SQLite backup of the original project. The original project folder was left in place.

## Separate deployments

Deploy `balfdar-admin` as the API/admin service and set `BALFDAR_STORE_ORIGIN` and `NEXT_PUBLIC_SITE_URL` to the public Store origin. Deploy `balfdar-store` with `BALFDAR_API_URL` set to the Admin service origin. Keep Admin environment secrets only in the Admin deployment. Use persistent storage for the Admin `.data` directory and `public/uploads`; both contain runtime data that must survive restarts.
