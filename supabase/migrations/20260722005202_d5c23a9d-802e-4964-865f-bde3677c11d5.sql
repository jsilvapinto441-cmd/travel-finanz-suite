CREATE POLICY "logs_no_update" ON public.activity_logs AS RESTRICTIVE FOR UPDATE TO public USING (false) WITH CHECK (false);
CREATE POLICY "logs_no_delete" ON public.activity_logs AS RESTRICTIVE FOR DELETE TO public USING (false);
REVOKE UPDATE, DELETE ON public.activity_logs FROM authenticated, anon;