-- Migration: Asset Cache TTL and Model Versioning
-- Adds expiration tracking and model version to asset cache for automatic cleanup

-- Add expires_at column for TTL-based expiration
ALTER TABLE asset_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add model_version column to track which model generated the asset
ALTER TABLE asset_cache ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'claude-sonnet-4-5';

-- Add updated_at column for tracking modifications
ALTER TABLE asset_cache ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add cache_version column for invalidation when cache format changes
ALTER TABLE asset_cache ADD COLUMN IF NOT EXISTS cache_version TEXT DEFAULT '1.0';

-- Backfill expires_at for existing rows (7 days from creation)
UPDATE asset_cache
SET expires_at = created_at + INTERVAL '7 days'
WHERE expires_at IS NULL;

-- Create index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_asset_cache_expires ON asset_cache(expires_at);

-- Create index for model version queries
CREATE INDEX IF NOT EXISTS idx_asset_cache_model_version ON asset_cache(model_version);

-- Create composite index for cache lookups with model version
CREATE INDEX IF NOT EXISTS idx_asset_cache_hash_version ON asset_cache(prompt_hash, model_version);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_asset_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS asset_cache_updated_at ON asset_cache;
CREATE TRIGGER asset_cache_updated_at
  BEFORE UPDATE ON asset_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_cache_updated_at();

-- Function to purge expired cache entries
CREATE OR REPLACE FUNCTION purge_expired_asset_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM asset_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the purge operation
  RAISE NOTICE 'Purged % expired asset cache entries', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache by model version
CREATE OR REPLACE FUNCTION invalidate_cache_by_model(target_version TEXT)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM asset_cache
  WHERE model_version = target_version;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Invalidated % cache entries for model version %', deleted_count, target_version;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache by asset type
CREATE OR REPLACE FUNCTION invalidate_cache_by_type(target_type TEXT)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM asset_cache
  WHERE asset_type = target_type;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Invalidated % cache entries for asset type %', deleted_count, target_type;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily purge at 3am UTC using pg_cron (if available)
-- Note: pg_cron must be enabled in Supabase dashboard under Database > Extensions
DO $$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('purge_expired_assets');

    -- Schedule daily purge at 3am UTC
    PERFORM cron.schedule(
      'purge_expired_assets',
      '0 3 * * *',
      $$SELECT purge_expired_asset_cache()$$
    );

    RAISE NOTICE 'Scheduled daily asset cache purge at 3am UTC';
  ELSE
    RAISE NOTICE 'pg_cron not available - manual purge required';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %', SQLERRM;
END;
$$;

-- View for cache statistics
CREATE OR REPLACE VIEW asset_cache_stats AS
SELECT
  model_version,
  asset_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_entries,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry,
  AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 86400)::NUMERIC(5,2) as avg_ttl_days
FROM asset_cache
GROUP BY model_version, asset_type
ORDER BY model_version, asset_type;

-- Grant access to the view
GRANT SELECT ON asset_cache_stats TO authenticated;

-- Comment on table
COMMENT ON TABLE asset_cache IS 'Cached AI-generated assets with TTL-based expiration and model versioning';
COMMENT ON COLUMN asset_cache.expires_at IS 'When this cache entry expires and should be purged';
COMMENT ON COLUMN asset_cache.model_version IS 'The AI model version that generated this asset';
COMMENT ON COLUMN asset_cache.cache_version IS 'Cache format version for bulk invalidation';
