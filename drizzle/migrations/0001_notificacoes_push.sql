CREATE TABLE public.notification_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_ativo boolean NOT NULL DEFAULT false,
  recebiveis_ativo boolean NOT NULL DEFAULT false,
  despesas_ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Próprias configurações - ler" ON public.notification_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Próprias configurações - criar" ON public.notification_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Próprias configurações - editar" ON public.notification_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notification_settings_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  dispositivo text NOT NULL DEFAULT 'web' CHECK (dispositivo IN ('web','android','ios')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_push_tokens_user_idx ON public.user_push_tokens(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_tokens TO authenticated;
GRANT ALL ON public.user_push_tokens TO service_role;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Próprios tokens" ON public.user_push_tokens FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('recebivel','despesa')),
  etapa text NOT NULL CHECK (etapa IN ('antecipado','vespera','hoje','atrasado','atraso_continuo')),
  item_id uuid NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_log_lookup_idx ON public.notification_log(user_id, tipo, item_id, enviado_em);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Próprio histórico - ler" ON public.notification_log FOR SELECT TO authenticated USING (auth.uid() = user_id);