-- Sign-in attempts per normalized email, used for throttling (US-01, OWASP A07).
CREATE TABLE login_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_email_time ON login_attempts (email, attempted_at DESC);
