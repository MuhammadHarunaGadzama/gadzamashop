# GADZAMA STORE — Supabase + Netlify

This is an updated storefront/admin dashboard package for the existing `gadzamashop` Netlify site and Supabase project. It is a build package, not a claim that the live site has already been deployed.

## Included in this build
- Welcome/advertising page; sign-in or create-account opens the store after successful authentication.
- Strong signup password rule: minimum 8 characters, uppercase, lowercase, and special character; readable error messages and button loading state.
- Product search, cart, external seller links, and customer navigation for website service, book requests, course materials, and order tracking.
- Admin dashboard tabs for products/stock, orders, website requests, book requests, course materials, material orders, and seller product applications.
- Customer “Sell a product” application: seller contact details, description, requested price, stock and up to five photos. Applications are stored in Supabase and remain unpublished until an admin verifies the product and approves a price.
- Admin can review/reject applications or approve and publish the product at the verified price; the seller sees their application status. Photo uploads are restricted to the signed-in seller’s own storage folder.
- Admin product form supports physical, chicken, digital and external products; photo upload to Supabase Storage; stock and price edits.
- Chicken pricing validation for 2-week, 4-week and 6-week birds; pickup minimum 1 and delivery minimum 5.
- Two supplied Casio calculator images in `assets/`, plus SQL seed entries for the three used-calculator price options (₦5,000, ₦6,000, ₦7,000). Seeded stock is zero until you confirm availability.
- Paystack checkout runs through a Netlify Function and verifies payment server-side before an order is marked paid. The live Paystack secret is read only from a server-side Netlify environment variable.

## CRITICAL: fix the seller-payment database error first
The live screenshot error `Could not find the table public.seller_account_fees in the schema cache` means the seller-fee migration has not been applied to the connected Supabase database (or PostgREST has not refreshed its schema). Before accepting seller payments, back up the database and run `seller-account-fee-and-service-fix.sql` in the correct Supabase project SQL Editor. Confirm the table exists, then reload the schema cache and test with a Paystack test transaction. Until this is done, the storefront now shows a clear setup message instead of exposing a raw database error or encouraging a user to pay into a broken flow.

## Before deploying
1. The existing store setup is already applied to the connected Supabase project. The seller-product review migration has also been applied directly. `seller-product-review-setup.sql` is included for reference; do not rerun it unless you intentionally need to recreate the policies.
2. In Supabase Authentication, decide whether email confirmation is required. If enabled, a new user must confirm their email before they can enter the store. The page now explains this rather than hanging silently.
3. Confirm `muhammadhg2048@gmail.com` still has `profiles.role = 'admin'`. Do not make admin role user-editable.
4. The store WhatsApp number is configured as `2347038669725` in `index.html`; the contact link opens `https://wa.me/2347038669725`.
5. Ensure production Netlify Functions variables are set: `SUPABASE_URL=https://mggfsllnnjhhtygfcxos.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, and `SITE_URL=https://gadzamashop.netlify.app`. Keep `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` server-side only. The Supabase URL and site URL are non-secret values.
6. Deploy with Netlify CLI or a deploy method that includes `netlify/functions`. A static-only upload may omit serverless functions. Changes to Netlify environment variables take effect after a new deploy.

## Deploy without GitHub
Extract the ZIP, install Node.js and Netlify CLI, then run from the extracted folder:

```bash
npm install
npx netlify login
npx netlify link --name gadzamashop
npx netlify deploy --prod
```

Review the target site before confirming the production deployment.

## Important limitations
- This package must be deployed to publish the latest header, WhatsApp and checkout-function changes to the live site. The code and environment variables were updated in this workspace; the static site has not been automatically published from this conversation.
- Bank-transfer receipt upload/review is not yet implemented for ordinary product orders; the interface instructs customers to confirm transfer details through WhatsApp.
- PDF files are stored privately. This dashboard publishes authorized material metadata; delivery after payment still needs the final protected download/WhatsApp fulfillment step.
- Seller product applications are stored in Supabase and visible in the admin dashboard. The application provides a `mailto:` draft to notify `muhammadhg2048@gmail.com`; the customer must tap it and send the email. Fully automatic email notifications require configuring an email provider, which is not set up yet. Customer book and website requests are also stored in Supabase; outbound automatic email notifications are not configured.
- Chicken stock begins at zero in seeded data; update availability in the dashboard before taking orders.


## Final seller-fee and welcome-banner update
- Added the supplied stylized 3D/CGI hero artwork in `assets/gadzama-eshop-3d-hero.png`. It is shown only on the welcome screen; existing sign-in flow hides that screen after entering the store. The hero includes real Explore and Sign in buttons over the artwork.
- Added one-time ₦100 seller account activation through Paystack (`create-seller-fee-payment` and `verify-seller-fee-payment`). Verified activation is stored once per account; products still require admin approval. A client-side in-flight guard reduces accidental duplicate submissions.
- Updated website request insert to use `payment_status='pending'` and included `seller-account-fee-and-service-fix.sql` to normalize the service request payment-status constraint.

## Required before production deployment
1. Run `seller-account-fee-and-service-fix.sql` in the Supabase SQL Editor. Back up the database first. This migration is included but has **not** been applied automatically to your live database.
2. Ensure Netlify production environment variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, and `SITE_URL` are configured. Never put secret keys in browser code.
3. Deploy the entire folder with Netlify Functions included, then test a real ₦100 payment with a controlled test/live-mode setup before opening seller access.
4. Existing duplicate records already saved in `seller_product_submissions` are not automatically deleted. The new client guard prevents simultaneous duplicate clicks, but review existing duplicates carefully before deleting anything.
5. This ZIP has not been deployed to the live website, and the SQL migration has not been run automatically.

## Payment-first seller and website-request workflow (updated 17 October 2026)
- Sellers must complete a one-time ₦100 lifetime account fee before the product application form is unlocked. The browser checks `seller_account_fees`, and the included SQL migration also adds an insert-policy condition requiring a verified fee row. The Netlify `create-seller-fee-payment` and `verify-seller-fee-payment` functions use Paystack server-side verification.
- Website requests now collect the customer's name, email, WhatsApp number and requirements, then initialize a ₦1,000 Paystack checkout. A draft is created first; only after the server verifies the full NGN 100000-kobo transaction does the function create the service request in `service_requests` and attempt to email the customer and `muhammadhg2048@gmail.com`.
- Admin can generate a ₦2,000 final-payment link for a website request after the preview is ready. The customer pays through Paystack, and the final callback is verified server-side. The dashboard never sets an order payment to paid just because an admin clicks a button; `Verify Paystack payment` checks the Paystack transaction and exact amount before updating the order.
- Seller approval/rejection status is saved in Supabase, and the package attempts to email the seller about the decision.
- Support contact: `muhammadhg2048@gmail.com` and WhatsApp `https://wa.me/2347038669725`.

## Required configuration before email notifications work
Configure these **Netlify site environment variables** for Functions scope:
- `RESEND_API_KEY` — API key for the Resend email provider.
- `EMAIL_FROM` — sender address verified in your Resend account (for example, a verified address on a domain you control).

Without these variables, payments and request records can still be verified/saved, but automatic email messages cannot be delivered. The functions return/log this limitation rather than claiming an email was sent. Never put these credentials in `index.html`.

## Apply and deploy carefully
1. Back up Supabase first, then review and run `seller-account-fee-and-service-fix.sql` in the Supabase SQL Editor. This is required for the new seller insert policy, draft table, payment references and payment-status fields.
2. Check that Netlify Functions environment variables include `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, and `SITE_URL`, with secrets available to Functions.
3. Configure `RESEND_API_KEY` and `EMAIL_FROM` as described above, then deploy the entire project folder including `netlify/functions/`.
4. Test with Paystack test mode before switching to live payments. Confirm a failed or mismatched payment never unlocks seller access or marks a request/order paid.
5. Existing duplicate material orders are not automatically deleted by this package. The client prevents rapid duplicate clicks, but inspect order history and database records before removing anything.

## Verification notes
JavaScript syntax checks are included in the preparation process. This archive has not been deployed to Netlify, the SQL migration has not been applied to your live Supabase database, and payment/email flows have not been exercised against live provider credentials in this workspace.
