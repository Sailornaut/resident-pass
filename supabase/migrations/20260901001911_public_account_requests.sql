-- Allow prospective residents to request an account before an Auth identity
-- exists. Inserts still happen only through the trusted server action; anon
-- receives no table privileges and no RLS policy.

ALTER TABLE public.user_access_requests
  ALTER COLUMN requester_user_id DROP NOT NULL;

DROP INDEX public.idx_access_requests_one_pending_per_community;

CREATE UNIQUE INDEX idx_access_requests_one_pending_email_per_community
  ON public.user_access_requests(community_id, lower(email))
  WHERE status = 'pending';

DROP POLICY access_requests_read ON public.user_access_requests;
CREATE POLICY access_requests_read ON public.user_access_requests
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL
      AND (
        requester_user_id = (SELECT auth.uid())
        OR lower(email) = lower((SELECT auth.jwt()) ->> 'email')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.community_id = user_access_requests.community_id
        AND membership.role IN ('admin', 'platform_admin')
        AND membership.status = 'active'
    )
  );
