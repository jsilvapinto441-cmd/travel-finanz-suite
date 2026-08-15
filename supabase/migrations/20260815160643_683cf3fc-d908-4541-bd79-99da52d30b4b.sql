CREATE TABLE public.backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  backup_id uuid REFERENCES public.backups(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('backup','restauracao','validacao')),
  status text NOT NULL DEFAULT 'processando' CHECK (status IN ('processando','concluido','erro','cancelado')),
  progresso integer NOT NULL DEFAULT 0,
  etapa text,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  erro text,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_jobs TO authenticated;
GRANT ALL ON public.backup_jobs TO service_role;

ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own backup jobs"
  ON public.backup_jobs FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_backup_jobs_owner BEFORE INSERT ON public.backup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_backup_jobs_updated BEFORE UPDATE ON public.backup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_backup_jobs_owner_created ON public.backup_jobs(owner_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.backup_jobs;