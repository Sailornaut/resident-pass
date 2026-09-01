-- Access requests are an inbox only. Approval continues through the existing
-- admin resident-assignment flow so a request never grants membership itself.

CREATE TABLE public.user_access_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  requester_user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  full_name             TEXT,
  requested_unit_label  TEXT NOT NULL,
  note                  TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'denied', 'closed')),
  reviewed_by_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT access_request_review_state CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by_user_id IS NULL)
    OR
    (status <> 'pending' AND reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_access_requests_one_pending_per_community
  ON public.user_access_requests(requester_user_id, community_id)
  WHERE status = 'pending';

CREATE INDEX idx_access_requests_community_inbox
  ON public.user_access_requests(community_id, status, created_at DESC);

CREATE INDEX idx_access_requests_reviewer
  ON public.user_access_requests(reviewed_by_user_id)
  WHERE reviewed_by_user_id IS NOT NULL;

ALTER TABLE public.user_access_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.user_access_requests TO authenticated;
REVOKE ALL ON TABLE public.user_access_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.user_access_requests FROM authenticated;

-- Requesters can confirm their own pending state. Community administrators can
-- read only the inbox belonging to a community they actively administer.
CREATE POLICY access_requests_read ON public.user_access_requests
  FOR SELECT TO authenticated
  USING (
    requester_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.community_id = user_access_requests.community_id
        AND membership.role IN ('admin', 'platform_admin')
        AND membership.status = 'active'
    )
  );

CREATE TRIGGER trg_user_access_requests_updated_at
  BEFORE UPDATE ON public.user_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
