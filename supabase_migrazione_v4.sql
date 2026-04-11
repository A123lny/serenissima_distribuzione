-- ============================================
-- MIGRAZIONE V4 - Login utente + password + resi
-- Esegui questo SQL in Supabase > SQL Editor
-- ============================================

-- 1. Aggiungi username e password alla tabella codici_accesso
ALTER TABLE codici_accesso ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE codici_accesso ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Aggiorna il record admin esistente con username e password
UPDATE codici_accesso SET username = 'admin', password = 'admin2024' WHERE codice = 'ADMIN2024';

-- 3. Aggiungi colonna resi_ritirati alle consegne
ALTER TABLE consegne_giornaliere ADD COLUMN IF NOT EXISTS resi_ritirati INT DEFAULT 0;

-- ============================================
-- FATTO! Ora puoi fare login con utente + password
-- Per creare nuovi utenti, usa la pagina Utenti nell'app
-- ============================================
