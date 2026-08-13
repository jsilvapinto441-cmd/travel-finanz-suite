CREATE TABLE public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  criado_por uuid,
  tipo text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'processando',
  path text,
  tamanho_bytes bigint NOT NULL DEFAULT 0,
  total_registros integer NOT NULL DEFAULT 0,
  total_arquivos integer NOT NULL DEFAULT 0,
  tabelas jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro text,
  observacoes text,
  restaurado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backups_own" ON public.backups
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_backups_owner BEFORE INSERT ON public.backups
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_backups_updated BEFORE UPDATE ON public.backups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_backups_owner_created ON public.backups (owner_id, created_at DESC);

CREATE TABLE public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  frequencia text NOT NULL DEFAULT 'semanal',
  hora_utc integer NOT NULL DEFAULT 6,
  reter_ultimos integer NOT NULL DEFAULT 10,
  ultima_execucao timestamptz,
  proxima_execucao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_schedules_own" ON public.backup_schedules
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_backup_schedules_owner BEFORE INSERT ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_backup_schedules_updated BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();