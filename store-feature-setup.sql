-- GADZAMA STORE feature setup (safe to run in Supabase SQL Editor)
-- Existing tables and the product-type columns were created in the earlier migration.
-- This file adds the public product image bucket, admin-only upload permissions, and calculator listings.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images', 'store-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Store images are publicly viewable" on storage.objects;
create policy "Store images are publicly viewable" on storage.objects for select using (bucket_id = 'store-images');
drop policy if exists "Admins upload store images" on storage.objects;
create policy "Admins upload store images" on storage.objects for insert to authenticated with check (
  bucket_id = 'store-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists "Admins update store images" on storage.objects;
create policy "Admins update store images" on storage.objects for update to authenticated using (
  bucket_id = 'store-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  bucket_id = 'store-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists "Admins delete store images" on storage.objects;
create policy "Admins delete store images" on storage.objects for delete to authenticated using (
  bucket_id = 'store-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Seed the three requested USED Casio calculator price options. Images are shipped with the site.
-- Stock remains 0 until the admin confirms availability and updates stock in the dashboard.
insert into public.products (name, description, price_kobo, image_url, category, stock, is_active, product_type, external_url, age_weeks, pickup_minimum, delivery_minimum)
select 'Used Casio FX-991ES PLUS Calculator — ₦5,000', 'Second-hand / used scientific calculator. Condition and availability confirmed with the store before payment.', 500000, 'https://gadzamashop.netlify.app/assets/casio-fx991es-used-front.jpg', 'Calculators', 0, true, 'physical', null, null, null, null
where not exists (select 1 from public.products where name = 'Used Casio FX-991ES PLUS Calculator — ₦5,000');
insert into public.products (name, description, price_kobo, image_url, category, stock, is_active, product_type, external_url, age_weeks, pickup_minimum, delivery_minimum)
select 'Used Casio FX-991ES PLUS Calculator — ₦6,000', 'Second-hand / used scientific calculator. Condition and availability confirmed with the store before payment.', 600000, 'https://gadzamashop.netlify.app/assets/casio-fx991es-used-box.jpg', 'Calculators', 0, true, 'physical', null, null, null, null
where not exists (select 1 from public.products where name = 'Used Casio FX-991ES PLUS Calculator — ₦6,000');
insert into public.products (name, description, price_kobo, image_url, category, stock, is_active, product_type, external_url, age_weeks, pickup_minimum, delivery_minimum)
select 'Used Casio FX-991ES PLUS Calculator — ₦7,000', 'Second-hand / used scientific calculator. Condition and availability confirmed with the store before payment.', 700000, 'https://gadzamashop.netlify.app/assets/casio-fx991es-used-front.jpg', 'Calculators', 0, true, 'physical', null, null, null, null
where not exists (select 1 from public.products where name = 'Used Casio FX-991ES PLUS Calculator — ₦7,000');

-- Private bucket for authorized course PDFs. Customers must not read files directly;
-- deliver the file only after manual payment verification.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-materials', 'course-materials', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];
drop policy if exists "Admins upload course PDFs" on storage.objects;
create policy "Admins upload course PDFs" on storage.objects for insert to authenticated with check (
  bucket_id = 'course-materials' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists "Admins read course PDFs" on storage.objects;
create policy "Admins read course PDFs" on storage.objects for select to authenticated using (
  bucket_id = 'course-materials' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists "Admins delete course PDFs" on storage.objects;
create policy "Admins delete course PDFs" on storage.objects for delete to authenticated using (
  bucket_id = 'course-materials' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
