-- Supabase schema for Eventos Barcelona - Artist database
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Artists table
CREATE TABLE artistas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,

  -- Personal info
  nombre TEXT,
  nombre_artistico TEXT,
  compania TEXT,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT,
  ciudad TEXT,

  -- Show details
  disciplinas TEXT[],
  subcategorias TEXT[],
  formato_show TEXT,
  bio_show TEXT,
  show_unico TEXT[],

  -- Media
  video1 TEXT,
  video2 TEXT,
  web_rrss TEXT,
  rider_tecnico TEXT,
  fotos_urls TEXT[],

  -- Pricing & logistics
  rango_cache TEXT,
  num_artistas TEXT,
  duracion_show TEXT,
  shows_adicionales JSONB,

  -- Consent
  acepto_privacidad BOOLEAN DEFAULT FALSE,
  acepto_visibilidad BOOLEAN DEFAULT FALSE,

  -- CRM references
  ghl_contact_id TEXT,
  holded_id TEXT,

  -- Metadata
  origen TEXT DEFAULT 'web-formulario',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookups (used for pre-fill links)
CREATE INDEX idx_artistas_token ON artistas (token);

-- Index for email lookups (used for upsert)
CREATE INDEX idx_artistas_email ON artistas (email);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artistas_updated_at
  BEFORE UPDATE ON artistas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE artistas ENABLE ROW LEVEL SECURITY;

-- Policy: API can read/write via service role key
CREATE POLICY "Service role full access" ON artistas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Public can read only their own record via token (for form pre-fill)
CREATE POLICY "Public read by token" ON artistas
  FOR SELECT
  USING (true);
