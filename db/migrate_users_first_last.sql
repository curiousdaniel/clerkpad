-- One-time migration: `name` → `first_name` + `last_name`
-- Run in Neon SQL Editor if your `users` table still has `name` and no first_name column.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

UPDATE users
SET
  first_name = COALESCE(
    NULLIF(trim(split_part(COALESCE(name, ''), ' ', 1)), ''),
    'Legacy'
  ),
  last_name = COALESCE(
    NULLIF(
      trim(regexp_replace(trim(COALESCE(name, '')), '^\\S+\\s*', '')),
      ''
    ),
    'User'
  )
WHERE first_name IS NULL OR first_name = '';

ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS name;
