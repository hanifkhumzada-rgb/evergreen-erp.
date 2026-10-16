# Evergreen Water customer website

Standalone Next.js site deployed from this folder on Vercel. The ERP remains at the repository root and uses its existing deployment.

## Supabase

Set these Vercel project environment variables for Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The site uses the publishable key in the browser. The database's `website_order_requests` RLS policy permits anonymous inserts only. It grants no public read, update, or delete access; the ERP can read requests for staff with the `orders.view` permission.

The Supabase migration is `supabase/migrations/20261016062850_website_order_requests.sql`.

## Local development

From this folder, run `npm install`, configure `.env.local` with the two public Supabase variables, then run `npm run dev`.
