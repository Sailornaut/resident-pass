-- Explicit Data API access for projects created after Supabase stopped
-- auto-exposing new public tables. Keep mutations server-side except for
-- resident pass issuance, which is protected by RLS.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON TABLE
  public.communities,
  public.community_brandings,
  public.units,
  public.users,
  public.memberships,
  public.parking_rule_sets,
  public.parking_passes,
  public.pass_events,
  public.pass_allowance_grants
TO authenticated;

GRANT INSERT ON TABLE public.parking_passes TO authenticated;

REVOKE ALL ON TABLE
  public.communities,
  public.community_brandings,
  public.units,
  public.users,
  public.memberships,
  public.parking_rule_sets,
  public.parking_passes,
  public.pass_events,
  public.pass_allowance_grants
FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.communities,
  public.community_brandings,
  public.units,
  public.users,
  public.memberships,
  public.parking_rule_sets,
  public.pass_events,
  public.pass_allowance_grants
FROM authenticated;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.parking_passes FROM authenticated;

-- Scope every policy explicitly to signed-in users and cache auth.uid() once
-- per statement. The service role continues to perform trusted mutations only
-- after the application has completed its authorization checks.
DROP POLICY IF EXISTS users_self_read ON public.users;
CREATE POLICY users_self_read ON public.users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS communities_member_read ON public.communities;
CREATE POLICY communities_member_read ON public.communities
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

DROP POLICY IF EXISTS units_member_read ON public.units;
CREATE POLICY units_member_read ON public.units
  FOR SELECT TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

DROP POLICY IF EXISTS memberships_self_read ON public.memberships;
CREATE POLICY memberships_self_read ON public.memberships
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rules_member_read ON public.parking_rule_sets;
CREATE POLICY rules_member_read ON public.parking_rule_sets
  FOR SELECT TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

DROP POLICY IF EXISTS passes_resident_read ON public.parking_passes;
CREATE POLICY passes_resident_read ON public.parking_passes
  FOR SELECT TO authenticated
  USING (
    requester_user_id = (SELECT auth.uid())
    OR community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('admin', 'platform_admin')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS passes_resident_insert ON public.parking_passes;
CREATE POLICY passes_resident_insert ON public.parking_passes
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = (SELECT auth.uid())
    AND unit_id IN (
      SELECT unit_id FROM public.memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
        AND unit_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS events_read ON public.pass_events;
CREATE POLICY events_read ON public.pass_events
  FOR SELECT TO authenticated
  USING (
    pass_id IN (
      SELECT id FROM public.parking_passes
      WHERE requester_user_id = (SELECT auth.uid())
    )
    OR pass_id IN (
      SELECT pp.id
      FROM public.parking_passes AS pp
      JOIN public.memberships AS m ON m.community_id = pp.community_id
      WHERE m.user_id = (SELECT auth.uid())
        AND m.role IN ('admin', 'platform_admin')
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS branding_member_read ON public.community_brandings;
CREATE POLICY branding_member_read ON public.community_brandings
  FOR SELECT TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

DROP POLICY IF EXISTS allowance_grants_read ON public.pass_allowance_grants;
CREATE POLICY allowance_grants_read ON public.pass_allowance_grants
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('admin', 'platform_admin')
        AND status = 'active'
    )
  );
