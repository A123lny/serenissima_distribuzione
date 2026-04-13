-- ============================================
-- MIGRAZIONE V6 - Ordine localita per giro separato
-- Esegui questo SQL in Supabase > SQL Editor
-- ============================================

-- Aggiunge colonna per salvare l'ordine delle localita per ogni zona in ogni giro
-- Formato: array JSON di localita_id in ordine es. ["uuid1","uuid2","uuid3"]
ALTER TABLE giri_zone ADD COLUMN IF NOT EXISTS ordine_localita JSONB DEFAULT '[]';
