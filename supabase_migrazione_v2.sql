-- ============================================
-- MIGRAZIONE V2 - Zone e Giri generali
-- Esegui questo SQL in Supabase > SQL Editor
-- ============================================

-- 1. Rendi i giri generali (corriere opzionale, rimuovi vincolo numero_giro)
ALTER TABLE giri DROP CONSTRAINT IF EXISTS giri_numero_giro_check;
ALTER TABLE giri ALTER COLUMN numero_giro DROP NOT NULL;

-- 2. Crea la tabella ZONE (es. Castelli di San Marino)
CREATE TABLE zone (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giro_id UUID REFERENCES giri(id) ON DELETE CASCADE,
  nome_zona TEXT NOT NULL,
  ordine INT DEFAULT 0,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Aggiungi zona_id alla tabella localita
ALTER TABLE localita ADD COLUMN zona_id UUID REFERENCES zone(id) ON DELETE CASCADE;

-- 4. RLS per zone
ALTER TABLE zone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accesso completo zone" ON zone FOR ALL USING (true);

-- ============================================
-- FATTO! Ora la struttura e':
-- Giro (generale) → Zone (es. castelli) → Localita (punti consegna)
-- Il corriere si assegna al giro quando serve
-- ============================================
