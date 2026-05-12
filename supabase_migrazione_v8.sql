-- =============================================
-- MIGRAZIONE V8: Persistenza stato sessione consegna in corso
-- =============================================
-- Obiettivo: rendere robusta la ripresa di un giro dopo refresh,
-- navigazione tra pagine, chiusura app, perdita di rete.
--
-- Cosa aggiunge:
--   - sessioni_consegna.fermata_idx_corrente   (indice fermata corrente)
--   - sessioni_consegna.aggiornata_at          (timestamp ultimo update)
--   - consegne_giornaliere.ordine              (ordine esplicito fermate)
--   - constraint UNIQUE: una sola sessione aperta per corriere
--   - cleanup automatico delle sessioni "fantasma" aperte da > 36h
--   - backfill di tutti i dati esistenti
--
-- Idempotente: ri-eseguibile senza effetti collaterali.
-- =============================================

-- 1. Cleanup: chiudi sessioni "fantasma" aperte da oltre 36h
--    Necessario PRIMA di creare il constraint UNIQUE per evitare conflitti.
UPDATE sessioni_consegna
SET fine_consegna = COALESCE(inizio_consegna, NOW()) + INTERVAL '4 hours',
    note_sessione = COALESCE(note_sessione, '') || ' [auto-chiusa da migrazione v8: orfana]'
WHERE fine_consegna IS NULL
  AND inizio_consegna IS NOT NULL
  AND inizio_consegna < NOW() - INTERVAL '36 hours';

-- 2. Nuovo campo: indice della fermata corrente (default 0)
ALTER TABLE sessioni_consegna
  ADD COLUMN IF NOT EXISTS fermata_idx_corrente INT DEFAULT 0;

-- 3. Nuovo campo: timestamp ultimo update (per riconciliazione cache locale)
ALTER TABLE sessioni_consegna
  ADD COLUMN IF NOT EXISTS aggiornata_at TIMESTAMPTZ;

-- 4. Nuovo campo: ordine esplicito delle fermate in una sessione
ALTER TABLE consegne_giornaliere
  ADD COLUMN IF NOT EXISTS ordine INT;

-- 5. Backfill ordine fermate (preserva l'ordine cronologico di insert)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY sessione_id ORDER BY created_at, id) - 1 AS rn
  FROM consegne_giornaliere
  WHERE ordine IS NULL
)
UPDATE consegne_giornaliere c
SET ordine = o.rn
FROM ordered o
WHERE c.id = o.id;

-- 6. Backfill fermata_idx_corrente per sessioni aperte residue
--    (conteggio delle consegne gia' completate)
UPDATE sessioni_consegna s
SET fermata_idx_corrente = COALESCE((
  SELECT COUNT(*) FROM consegne_giornaliere c
  WHERE c.sessione_id = s.id AND c.consegnato = true
), 0)
WHERE s.fine_consegna IS NULL;

-- 7. Constraint UNIQUE parziale: una sola sessione APERTA per corriere
--    Previene duplicati a livello DB (doppio click, race condition, ecc.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessione_aperta_unica_corriere
  ON sessioni_consegna (corriere_id)
  WHERE fine_consegna IS NULL AND corriere_id IS NOT NULL;

-- 8. Variante UNIQUE per sessioni admin (corriere_id NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessione_aperta_unica_admin
  ON sessioni_consegna ((1))
  WHERE fine_consegna IS NULL AND corriere_id IS NULL;

-- 9. Index per accelerare la ricerca della sessione attiva
CREATE INDEX IF NOT EXISTS idx_sessione_aperta_lookup
  ON sessioni_consegna (corriere_id, fine_consegna)
  WHERE fine_consegna IS NULL;

-- 10. Index per accelerare il recupero ordinato delle consegne di una sessione
CREATE INDEX IF NOT EXISTS idx_consegne_sessione_ordine
  ON consegne_giornaliere (sessione_id, ordine);

-- =============================================
-- VERIFICHE POST-MIGRAZIONE (eseguire manualmente)
-- =============================================
-- 1. Sessioni aperte con indice coerente:
--    SELECT id, fermata_idx_corrente, fine_consegna, inizio_consegna
--    FROM sessioni_consegna WHERE fine_consegna IS NULL;
--
-- 2. Tutte le consegne hanno ordine (deve restituire 0):
--    SELECT COUNT(*) FROM consegne_giornaliere WHERE ordine IS NULL;
--
-- 3. Nessun corriere ha piu' di una sessione aperta (deve essere vuoto):
--    SELECT corriere_id, COUNT(*) FROM sessioni_consegna
--    WHERE fine_consegna IS NULL GROUP BY corriere_id HAVING COUNT(*) > 1;
