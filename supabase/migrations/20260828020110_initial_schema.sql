-- ResidentPass production schema
-- Multi-tenant parking pass platform

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- MANAGEMENT COMPANY (optional parent organization)
-- ============================================================
CREATE TABLE management_companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMMUNITY (tenant / HOA / condo association)
-- ============================================================
CREATE TABLE communities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  management_company_id UUID REFERENCES management_companies(id),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  timezone              TEXT NOT NULL DEFAULT 'America/New_York',
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_communities_management_company ON communities(management_company_id);

-- ============================================================
-- COMMUNITY BRANDING
-- ============================================================
CREATE TABLE community_brandings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID NOT NULL UNIQUE REFERENCES communities(id) ON DELETE CASCADE,
  display_name    TEXT,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#1a56db',
  footer_text     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- UNIT (residence within a community)
-- ============================================================
CREATE TABLE units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  unit_label      TEXT NOT NULL,
  address_label   TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id, unit_label)
);

CREATE INDEX idx_units_community ON units(community_id);

-- ============================================================
-- USER (authentication identity — synced with Supabase Auth)
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY,  -- matches Supabase auth.users.id
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MEMBERSHIP (user-to-community/unit role mapping)
-- ============================================================
CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  unit_id         UUID REFERENCES units(id) ON DELETE SET NULL,
  role            TEXT NOT NULL CHECK (role IN ('resident', 'admin', 'verifier', 'platform_admin')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, community_id, role)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_community ON memberships(community_id);
CREATE INDEX idx_memberships_unit ON memberships(unit_id);

-- ============================================================
-- PARKING RULE SET (configurable policy per community)
-- ============================================================
CREATE TABLE parking_rule_sets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          UUID NOT NULL UNIQUE REFERENCES communities(id) ON DELETE CASCADE,
  max_active_passes     INT NOT NULL DEFAULT 2,
  max_duration_hours    INT NOT NULL DEFAULT 72,
  monthly_limit         INT NOT NULL DEFAULT 10,
  advance_window_days   INT NOT NULL DEFAULT 14,
  allow_resident_cancel BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PARKING PASS (issued temporary credential)
-- ============================================================
CREATE TABLE parking_passes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code       TEXT NOT NULL UNIQUE,
  community_id      UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  unit_id           UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES users(id),
  plate             TEXT NOT NULL,
  plate_state       TEXT NOT NULL DEFAULT '',
  vehicle_make      TEXT,
  vehicle_color     TEXT,
  guest_name        TEXT,
  note              TEXT,
  valid_from        TIMESTAMPTZ NOT NULL,
  valid_until       TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'active', 'expired', 'revoked', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (valid_until > valid_from)
);

CREATE INDEX idx_passes_community ON parking_passes(community_id);
CREATE INDEX idx_passes_unit ON parking_passes(unit_id);
CREATE INDEX idx_passes_requester ON parking_passes(requester_user_id);
CREATE INDEX idx_passes_public_code ON parking_passes(public_code);
CREATE INDEX idx_passes_status ON parking_passes(status);
CREATE INDEX idx_passes_plate ON parking_passes(plate);
CREATE INDEX idx_passes_valid_range ON parking_passes(valid_from, valid_until);

-- ============================================================
-- PASS EVENT (immutable audit log)
-- ============================================================
CREATE TABLE pass_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id         UUID NOT NULL REFERENCES parking_passes(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES users(id),
  event_type      TEXT NOT NULL CHECK (event_type IN (
                    'created', 'activated', 'expired', 'revoked',
                    'cancelled', 'verified', 'verification_failed'
                  )),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pass_events_pass ON pass_events(pass_id);
CREATE INDEX idx_pass_events_type ON pass_events(event_type);
CREATE INDEX idx_pass_events_actor ON pass_events(actor_user_id);

-- ============================================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_brandings ENABLE ROW LEVEL SECURITY;

-- Users can read their own record
CREATE POLICY users_self_read ON users
  FOR SELECT USING (id = auth.uid());

-- Users can read communities they belong to
CREATE POLICY communities_member_read ON communities
  FOR SELECT USING (
    id IN (SELECT community_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
  );

-- Users can read units in their communities
CREATE POLICY units_member_read ON units
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
  );

-- Memberships: users can see their own
CREATE POLICY memberships_self_read ON memberships
  FOR SELECT USING (user_id = auth.uid());

-- Parking rules: members can read their community's rules
CREATE POLICY rules_member_read ON parking_rule_sets
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
  );

-- Passes: residents see their own, admins see all in their community
CREATE POLICY passes_resident_read ON parking_passes
  FOR SELECT USING (
    requester_user_id = auth.uid()
    OR community_id IN (
      SELECT community_id FROM memberships
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin') AND status = 'active'
    )
  );

-- Passes: residents can insert for their own units
CREATE POLICY passes_resident_insert ON parking_passes
  FOR INSERT WITH CHECK (
    requester_user_id = auth.uid()
    AND unit_id IN (
      SELECT unit_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND unit_id IS NOT NULL
    )
  );

-- Pass events: readable by pass owner or community admin
CREATE POLICY events_read ON pass_events
  FOR SELECT USING (
    pass_id IN (
      SELECT id FROM parking_passes WHERE requester_user_id = auth.uid()
    )
    OR pass_id IN (
      SELECT pp.id FROM parking_passes pp
      JOIN memberships m ON m.community_id = pp.community_id
      WHERE m.user_id = auth.uid() AND m.role IN ('admin', 'platform_admin') AND m.status = 'active'
    )
  );

-- Branding: readable by community members
CREATE POLICY branding_member_read ON community_brandings
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Automatically update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_communities_updated_at
  BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_parking_rule_sets_updated_at
  BEFORE UPDATE ON parking_rule_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_parking_passes_updated_at
  BEFORE UPDATE ON parking_passes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_community_brandings_updated_at
  BEFORE UPDATE ON community_brandings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
