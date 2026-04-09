-- ============================================
-- SCHEMA DATABASE - GestDistribuzione
-- Esegui questo SQL in Supabase > SQL Editor
-- ============================================

-- TABELLA: corrieri
CREATE TABLE corrieri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  veicolo TEXT,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: giri
CREATE TABLE giri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  corriere_id UUID REFERENCES corrieri(id) ON DELETE CASCADE,
  numero_giro INT NOT NULL CHECK (numero_giro BETWEEN 1 AND 4),
  nome_giro TEXT,
  ordine_posizione INT DEFAULT 0,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: localita
CREATE TABLE localita (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giro_id UUID REFERENCES giri(id) ON DELETE CASCADE,
  nome_locale TEXT NOT NULL,
  indirizzo TEXT,
  note TEXT,
  copie_standard INT DEFAULT 0,
  ordine INT DEFAULT 0,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: sessioni_consegna
CREATE TABLE sessioni_consegna (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  corriere_id UUID REFERENCES corrieri(id),
  giro_id UUID REFERENCES giri(id),
  data_consegna DATE DEFAULT CURRENT_DATE,
  inizio_consegna TIMESTAMPTZ,
  fine_consegna TIMESTAMPTZ,
  durata_minuti INT,
  km_percorsi DECIMAL(8,2),
  veicolo_usato TEXT,
  note_sessione TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: consegne_giornaliere
CREATE TABLE consegne_giornaliere (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sessione_id UUID REFERENCES sessioni_consegna(id) ON DELETE CASCADE,
  localita_id UUID REFERENCES localita(id),
  data_consegna DATE DEFAULT CURRENT_DATE,
  copie_consegnate INT DEFAULT 0,
  rimanenze_ieri INT DEFAULT 0,
  rimanenze_oggi INT,
  consegnato BOOLEAN DEFAULT false,
  ora_consegna TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: storico_rimanenze
CREATE TABLE storico_rimanenze (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  localita_id UUID REFERENCES localita(id),
  data DATE NOT NULL,
  copie_consegnate INT,
  rimanenze INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(localita_id, data)
);

-- TABELLA: codici_accesso (per login con codice)
CREATE TABLE codici_accesso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codice TEXT NOT NULL UNIQUE,
  ruolo TEXT NOT NULL CHECK (ruolo IN ('admin', 'corriere')),
  corriere_id UUID REFERENCES corrieri(id) ON DELETE SET NULL,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE corrieri ENABLE ROW LEVEL SECURITY;
ALTER TABLE giri ENABLE ROW LEVEL SECURITY;
ALTER TABLE localita ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessioni_consegna ENABLE ROW LEVEL SECURITY;
ALTER TABLE consegne_giornaliere ENABLE ROW LEVEL SECURITY;
ALTER TABLE storico_rimanenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE codici_accesso ENABLE ROW LEVEL SECURITY;

-- Policy: accesso pubblico in lettura per codici_accesso (serve per il login)
CREATE POLICY "Lettura codici per login" ON codici_accesso
  FOR SELECT USING (true);

-- Policy: accesso completo per utenti autenticati (anon key)
CREATE POLICY "Accesso completo corrieri" ON corrieri FOR ALL USING (true);
CREATE POLICY "Accesso completo giri" ON giri FOR ALL USING (true);
CREATE POLICY "Accesso completo localita" ON localita FOR ALL USING (true);
CREATE POLICY "Accesso completo sessioni" ON sessioni_consegna FOR ALL USING (true);
CREATE POLICY "Accesso completo consegne" ON consegne_giornaliere FOR ALL USING (true);
CREATE POLICY "Accesso completo storico" ON storico_rimanenze FOR ALL USING (true);

-- ============================================
-- DATI INIZIALI
-- Crea il codice admin (cambia "ADMIN2024" con il codice che preferisci)
-- ============================================
INSERT INTO codici_accesso (codice, ruolo) VALUES ('ADMIN2024', 'admin');

-- ============================================
-- DOPO aver creato i corrieri dall'app, aggiungi i codici corriere:
-- Esempio (sostituisci l'UUID con l'id reale del corriere):
--
-- INSERT INTO codici_accesso (codice, ruolo, corriere_id)
-- VALUES ('MARIO01', 'corriere', 'uuid-del-corriere-qui');
-- ============================================
