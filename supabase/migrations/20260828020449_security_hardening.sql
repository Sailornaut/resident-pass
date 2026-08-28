-- Close the remaining advisor findings from the original MVP schema.

ALTER TABLE public.management_companies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.management_companies FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE INDEX idx_allowance_grants_granted_by
  ON public.pass_allowance_grants(granted_by_user_id);
