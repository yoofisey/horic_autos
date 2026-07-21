-- Run this in Neon SQL Editor to add trim column to existing vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trim text default '';
