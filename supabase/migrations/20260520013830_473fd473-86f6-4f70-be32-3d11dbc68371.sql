
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos', 'anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  path text NOT NULL,
  nome text NOT NULL,
  mime text,
  tamanho bigint,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anexos_entidade ON public.anexos(entidade, entidade_id);

ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anexos_select_auth" ON public.anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "anexos_insert_staff" ON public.anexos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "anexos_delete_admin" ON public.anexos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());

-- Storage policies for bucket 'anexos'
CREATE POLICY "anexos_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anexos');
CREATE POLICY "anexos_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "anexos_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'anexos' AND has_role(auth.uid(), 'admin'::app_role));
