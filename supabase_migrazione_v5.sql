-- ============================================
-- MIGRAZIONE V5 - Permessi granulari per utente
-- Esegui questo SQL in Supabase > SQL Editor
-- ============================================

ALTER TABLE codici_accesso ADD COLUMN IF NOT EXISTS permessi JSONB DEFAULT '[]';

-- Imposta permessi completi per l'admin esistente
UPDATE codici_accesso
SET permessi = '["dashboard","giri","consegne","storico","report","utenti"]'
WHERE ruolo = 'admin';
