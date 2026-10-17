GADZAMA eShop — focused final fix package

Only the two requested items were changed:
1) Seller activation: Sell a product shows an activation screen with a one-time ₦100 fee and a “Continue with Payment — ₦100” button. Existing Netlify Functions initialize Paystack and verify the exact ₦100 transaction server-side. After verification, lifetime access is stored; each product submission stays pending for admin review. Failed/unverified payments do not unlock access.
2) Welcome advertisement: removed the old large portrait photo from the welcome hero and replaced it with a responsive black-and-gold branded welcome banner. It is still shown only before sign-in; the store hides it after sign-in.

IMPORTANT — NOT YET DEPLOYED:
- Apply seller-activation-fix.sql in the correct Supabase project's SQL Editor first. It creates the missing seller_account_fees table and the database policy that blocks unpaid sellers from submitting products.
- Deploy the full project folder to Netlify, including netlify/functions. Required production environment variables must already be configured: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY, SITE_URL.
- Test a ₦100 Paystack transaction before making the feature available to sellers.

This ZIP is a prepared code package, not a claim that the live website or database has already been changed. No replacement portrait photo was supplied with this request, so the old portrait has been removed and replaced by a text-and-design banner rather than inventing a different person/photo.
