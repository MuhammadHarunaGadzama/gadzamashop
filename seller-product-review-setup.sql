-- GADZAMA STORE seller product application + admin review workflow
-- This migration has already been applied to project mggfsllnnjhhtygfcxos.
create table if not exists public.seller_product_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seller_name text not null,
  seller_phone text not null,
  seller_email text not null,
  product_name text not null,
  description text not null default '',
  category text not null default 'General',
  requested_price_kobo bigint not null check (requested_price_kobo > 0),
  image_urls text[] not null default '{}',
  submission_status text not null default 'pending' check (submission_status in ('pending','in_review','approved','rejected')),
  admin_review_notes text,
  approved_product_id uuid references public.products(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  requested_stock integer not null default 1 check (requested_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products add column if not exists seller_submission_id uuid references public.seller_product_submissions(id) on delete set null;
alter table public.products add column if not exists seller_name text;
alter table public.products add column if not exists seller_phone text;
alter table public.products add column if not exists seller_email text;
create index if not exists seller_product_submissions_status_created_idx on public.seller_product_submissions(submission_status, created_at desc);
create index if not exists seller_product_submissions_user_created_idx on public.seller_product_submissions(user_id, created_at desc);
create unique index if not exists products_seller_submission_id_unique on public.products(seller_submission_id) where seller_submission_id is not null;
alter table public.seller_product_submissions enable row level security;
drop policy if exists "Sellers can submit their own products" on public.seller_product_submissions;
create policy "Sellers can submit their own products" on public.seller_product_submissions for insert to authenticated with check (auth.uid() = user_id and submission_status = 'pending' and approved_product_id is null and reviewed_by is null);
drop policy if exists "Sellers can view their own submissions" on public.seller_product_submissions;
create policy "Sellers can view their own submissions" on public.seller_product_submissions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Admins can manage seller product submissions" on public.seller_product_submissions;
create policy "Admins can manage seller product submissions" on public.seller_product_submissions for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('store-images','store-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Sellers upload their own product photos" on storage.objects;
create policy "Sellers upload their own product photos" on storage.objects for insert to authenticated with check (bucket_id='store-images' and (storage.foldername(name))[1]='seller-submissions' and (storage.foldername(name))[2]=auth.uid()::text and storage.extension(name) in ('jpg','jpeg','png','webp'));
drop policy if exists "Sellers view own submitted product photos" on storage.objects;
create policy "Sellers view own submitted product photos" on storage.objects for select to authenticated using (bucket_id='store-images' and (storage.foldername(name))[1]='seller-submissions' and (storage.foldername(name))[2]=auth.uid()::text);
notify pgrst, 'reload schema';
