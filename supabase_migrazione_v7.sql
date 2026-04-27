-- =============================================
-- MIGRAZIONE V7: Pianificazione Giornaliera Giri
-- =============================================

-- 1. Aggiunta coordinate GPS alla tabella localita
ALTER TABLE localita ADD COLUMN IF NOT EXISTS latitudine DECIMAL(10,7);
ALTER TABLE localita ADD COLUMN IF NOT EXISTS longitudine DECIMAL(10,7);

-- 2. Aggiunta campi per distinguere giri fissi da giornalieri
ALTER TABLE giri ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'fisso';
ALTER TABLE giri ADD COLUMN IF NOT EXISTS data_pianificazione DATE;

-- 3. Tabella pianificazione giornaliera
CREATE TABLE IF NOT EXISTS pianificazione_giornaliera (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_giro DATE NOT NULL,
  stato TEXT DEFAULT 'attivo' CHECK (stato IN ('attivo', 'completato', 'annullato')),
  creato_da UUID REFERENCES codici_accesso(id),
  annullato_da UUID REFERENCES codici_accesso(id),
  annullato_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Assegnazioni: quali zone vanno a quale corriere per la pianificazione del giorno
CREATE TABLE IF NOT EXISTS pianificazione_assegnazioni (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pianificazione_id UUID REFERENCES pianificazione_giornaliera(id) ON DELETE CASCADE,
  corriere_id UUID REFERENCES corrieri(id),
  giro_generato_id UUID REFERENCES giri(id) ON DELETE SET NULL,
  zone_ids JSONB NOT NULL DEFAULT '[]',
  ordine_ottimizzato JSONB DEFAULT '[]',
  punto_partenza_lat DECIMAL(10,7),
  punto_partenza_lng DECIMAL(10,7),
  punto_partenza_desc TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Vincolo: una sola pianificazione attiva per giorno
CREATE UNIQUE INDEX IF NOT EXISTS idx_pianificazione_unica_giorno
  ON pianificazione_giornaliera (data_giro)
  WHERE stato = 'attivo';

-- 6. RLS
ALTER TABLE pianificazione_giornaliera ENABLE ROW LEVEL SECURITY;
ALTER TABLE pianificazione_assegnazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pianificazione_giornaliera_all" ON pianificazione_giornaliera FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pianificazione_assegnazioni_all" ON pianificazione_assegnazioni FOR ALL USING (true) WITH CHECK (true);
