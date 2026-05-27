-- Backfill NULL emails so the NOT NULL constraint can be added
UPDATE users SET email = 'legacy_' || id || '@buildflow.local' WHERE email IS NULL;

-- Email becomes mandatory; default auto-generates a unique placeholder for Lark-only rows
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET DEFAULT ('lark_' || gen_random_uuid()::text || '@buildflow.local');

-- Case-insensitive unique index on email
CREATE UNIQUE INDEX users_email_unique_lower ON users (lower(email));

-- Lark identity columns become optional (password-only users have NULL for both)
ALTER TABLE users ALTER COLUMN lark_open_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN lark_tenant_key DROP NOT NULL;

-- New password hash column (NULL = Lark-only user)
ALTER TABLE users ADD COLUMN password_hash text;
