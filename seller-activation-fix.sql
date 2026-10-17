-- Gadzama eShop: one-time ₦100 lifetime seller activation.
-- Apply to Supabase project mggfsllnnjhhtygfcxos before deploying the website.
-- This migration only creates the seller-fee table and the paid-seller insert policy.

create table if not exists public.seller_account_fees (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paystack_reference text not null unique,
  amount_kobo bigint not null check (amount_kobo = 10000),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.seller_account_fees enable row level security;
drop policy if exists "Sellers can view own lifetime fee" on public.seller_account_fees;
create policy "Sellers can view own lifetime fee"
  on public.seller_account_fees for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Sellers can submit their own products" on public.seller_product_submissions;
create policy "Sellers can submit their own products after lifetime fee"
  on public.seller_product_submissions for insert to authenticated
  with check (
    auth.uid() = user_id
    and submission_status = 'pending'
    and approved_product_id is null
    and reviewed_by is null
    and exists (
      select 1 from public.seller_account_fees f where f.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
