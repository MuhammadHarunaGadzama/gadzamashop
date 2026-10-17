-- Review and back up the database before applying this migration.
-- Seller fee: ₦100 one time per account, lifetime. Only server-side verified Paystack writes fee rows.
create table if not exists public.seller_account_fees (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paystack_reference text not null unique,
  amount_kobo bigint not null check (amount_kobo = 10000),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.seller_account_fees enable row level security;
drop policy if exists "Sellers can view own lifetime fee" on public.seller_account_fees;
create policy "Sellers can view own lifetime fee" on public.seller_account_fees for select to authenticated using (auth.uid() = user_id);
-- Enforce fee at the database policy layer too, not just in browser UI.
drop policy if exists "Sellers can submit their own products" on public.seller_product_submissions;
create policy "Sellers can submit their own products after lifetime fee" on public.seller_product_submissions for insert to authenticated
with check (auth.uid() = user_id and submission_status = 'pending' and approved_product_id is null and reviewed_by is null and exists (select 1 from public.seller_account_fees f where f.user_id = auth.uid()));
-- Paid website-request drafts are only turned into service_requests by the server after Paystack verification.
create table if not exists public.service_request_drafts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 customer_name text not null, customer_email text not null, whatsapp text not null, requested_features text not null,
 initial_fee_kobo bigint not null default 100000 check (initial_fee_kobo = 100000), final_fee_kobo bigint not null default 200000 check (final_fee_kobo = 200000),
 status text not null default 'awaiting_payment', initial_paystack_reference text unique, service_request_id uuid, created_at timestamptz not null default now()
);
alter table public.service_request_drafts enable row level security;
drop policy if exists "Users view own service request drafts" on public.service_request_drafts;
create policy "Users view own service request drafts" on public.service_request_drafts for select to authenticated using (auth.uid() = user_id);
alter table public.service_requests add column if not exists initial_payment_status text not null default 'pending';
alter table public.service_requests add column if not exists final_payment_status text not null default 'pending';
alter table public.service_requests add column if not exists initial_paystack_reference text unique;
alter table public.service_requests add column if not exists final_paystack_reference text unique;
alter table public.service_requests drop constraint if exists service_requests_payment_status_check;
alter table public.service_requests add constraint service_requests_payment_status_check check (payment_status in ('pending','unpaid','paid','failed','refunded','not_required'));
notify pgrst, 'reload schema';
