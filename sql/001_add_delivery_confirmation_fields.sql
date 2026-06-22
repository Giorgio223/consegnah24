-- Add these columns in Supabase SQL Editor before uploading the updated project.
-- They store the admin delivery confirmation details shown to the client.

alter table public.orders
  add column if not exists delivered_to text,
  add column if not exists delivered_at timestamptz;

-- Optional index if you often sort/filter delivered orders later.
create index if not exists orders_delivered_at_idx on public.orders (delivered_at desc);
