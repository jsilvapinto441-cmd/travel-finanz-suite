DROP POLICY IF EXISTS "anexos_storage_select" ON storage.objects;
CREATE POLICY "anexos_storage_select_staff" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'anexos' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role)));