-- Run once in Neon: SQL Editor → paste → Run.
-- Upgrades `users` from legacy `name` to `first_name` + `last_name` (required by current app).
-- Safe to re-run: skips work if already migrated.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

DO $$
DECLARE
  has_legacy_name boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'name'
  )
  INTO has_legacy_name;

  IF has_legacy_name THEN
    UPDATE users
    SET
      first_name = COALESCE(
        NULLIF(trim(split_part(COALESCE(name, ''), ' ', 1)), ''),
        'Legacy'
      ),
      last_name = COALESCE(
        NULLIF(
          trim(
            regexp_replace(
              trim(COALESCE(name, '')),
              '^\S+\s*',
              ''
            )
          ),
          ''
        ),
        'User'
      )
    WHERE first_name IS NULL OR trim(first_name) = '';
  END IF;
END $$;

-- Ensure no NULLs (e.g. empty table edge cases or partial runs)
UPDATE users
SET
  first_name = COALESCE(NULLIF(trim(first_name), ''), 'Legacy'),
  last_name = COALESCE(NULLIF(trim(last_name), ''), 'User')
WHERE first_name IS NULL
   OR trim(first_name) = ''
   OR last_name IS NULL
   OR trim(last_name) = '';

ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS name;
