-- Add Imagen-generated thumbnail URL alongside each Veo-generated video
-- Run via Supabase SQL Editor or psql

alter table content_videos
  add column if not exists r2_thumbnail_url text;
