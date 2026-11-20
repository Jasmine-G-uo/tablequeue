-- Accounts for guests (self-registered) and staff (seed script). PRD §2.
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Emails are unique case-insensitively (US-01). The app also stores them normalized.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
