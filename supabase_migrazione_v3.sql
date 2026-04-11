-- ============================================
-- MIGRAZIONE V3 - Zone come dati master
-- Esegui questo SQL in Supabase > SQL Editor
-- ============================================

-- 1. Sgancia zone dai giri (rimuovi la foreign key giro_id)
ALTER TABLE zone DROP CONSTRAINT IF EXISTS zone_giro_id_fkey;
ALTER TABLE zone DROP COLUMN IF EXISTS giro_id;

-- 2. Sgancia localita dai giri (il legame passa tramite zona)
ALTER TABLE localita DROP CONSTRAINT IF EXISTS localita_giro_id_fkey;
-- Teniamo giro_id per retrocompatibilita' ma non lo usiamo piu'

-- 3. Crea tabella ponte giri <-> zone
CREATE TABLE giri_zone (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giro_id UUID REFERENCES giri(id) ON DELETE CASCADE,
  zona_id UUID REFERENCES zone(id) ON DELETE CASCADE,
  ordine INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(giro_id, zona_id)
);

-- 4. RLS per giri_zone
ALTER TABLE giri_zone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accesso completo giri_zone" ON giri_zone FOR ALL USING (true);

-- ============================================
-- FATTO! Nuova struttura:
-- Zone (master) -> Localita (punti consegna)
-- Giri (selezione) -> giri_zone -> Zone
-- ============================================
