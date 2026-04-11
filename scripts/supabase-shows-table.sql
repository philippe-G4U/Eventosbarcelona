-- Tabla para el catálogo completo de shows/artistas
-- Ejecutar en Supabase SQL Editor

create table if not exists shows (
  id text primary key,
  name text not null,
  category text not null check (category in ('danza', 'musica', 'circo', 'wow')),
  subcategory text,
  description text,
  base_price integer not null default 0,
  price_note text,
  video_url text,
  image_url text,
  source text default 'ppt' check (source in ('web', 'ppt', 'manual')),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_shows_category on shows(category);
create index if not exists idx_shows_active on shows(active);

-- RLS
alter table shows enable row level security;

create policy "Public read shows" on shows
  for select using (true);

create policy "Service write shows" on shows
  for all using (true);
