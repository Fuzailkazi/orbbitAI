-- 001_create_models.sql
-- AI model catalog

CREATE TYPE model_category AS ENUM (
  'chat', 'reasoning', 'code', 'vision', 'embedding', 'moe', 'transformer'
);

CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  category model_category NOT NULL DEFAULT 'chat',
  context_window INTEGER NOT NULL DEFAULT 0,
  pricing_input NUMERIC(10, 4) NOT NULL DEFAULT 0,
  pricing_output NUMERIC(10, 4) NOT NULL DEFAULT 0,
  api_identifier TEXT NOT NULL UNIQUE,
  release_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_models_vendor ON models(vendor);
CREATE INDEX idx_models_category ON models(category);
CREATE INDEX idx_models_is_active ON models(is_active);
