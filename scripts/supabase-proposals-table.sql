-- Tabla para almacenar propuestas generadas
-- Ejecutar en Supabase SQL Editor

create table if not exists proposals (
  id text primary key default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text default 'revision' check (status in ('revision', 'approved', 'sent', 'accepted', 'rejected')),

  -- Client data
  client_name text,
  client_company text,
  client_email text,
  client_phone text,

  -- Event data
  event_name text,
  event_type text,
  event_date text,
  event_guests integer,
  event_location text,

  -- Proposal content
  category text,
  concept_title text,
  concept_text text,
  hero_sub text,
  shows jsonb not null default '[]',
  global_margin integer default 0,

  -- Metadata
  ghl_contact_id text,
  ghl_opportunity_id text,
  approved_at timestamptz,
  approved_by text
);

-- Index for quick lookups
create index if not exists idx_proposals_status on proposals(status);
create index if not exists idx_proposals_client_email on proposals(client_email);

-- RLS: allow read by anyone (client opens link), write only via service key
alter table proposals enable row level security;

create policy "Public read" on proposals
  for select using (true);

create policy "Service write" on proposals
  for all using (true);
