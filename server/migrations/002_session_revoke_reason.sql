-- Why a session was revoked. The multi-tab "grace window" in /auth/refresh
-- must apply ONLY to tokens retired by normal rotation — never to sessions
-- killed by logout, password change or theft detection.
ALTER TABLE sessions ADD COLUMN revoke_reason text
  CHECK (revoke_reason IN ('rotated', 'reuse_detected', 'logout', 'logout_all', 'password_change', 'password_reset'));
