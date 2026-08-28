-- Case-by-case resident pass allowance approvals.

CREATE TABLE pass_allowance_grants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id            UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id      UUID NOT NULL REFERENCES users(id),
  additional_passes       INT NOT NULL CHECK (additional_passes BETWEEN 1 AND 20),
  reason                  TEXT,
  expires_at              TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT allowance_expiration_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX idx_allowance_grants_resident
  ON pass_allowance_grants(user_id, community_id, expires_at);
CREATE INDEX idx_allowance_grants_community
  ON pass_allowance_grants(community_id, expires_at);

ALTER TABLE pass_allowance_grants ENABLE ROW LEVEL SECURITY;

-- Residents can see their own approvals; community admins can audit all grants.
CREATE POLICY allowance_grants_read ON pass_allowance_grants
  FOR SELECT USING (
    user_id = auth.uid()
    OR community_id IN (
      SELECT community_id FROM memberships
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'platform_admin')
        AND status = 'active'
    )
  );
