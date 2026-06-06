
-- 1. contas_bancarias
CREATE TABLE public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  banco text NOT NULL,
  agencia text,
  conta text,
  digito text,
  tipo text NOT NULL DEFAULT 'corrente',
  chave_pix text,
  titular text,
  documento text,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_bancarias TO authenticated;
GRANT ALL ON public.contas_bancarias TO service_role;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY contas_bancarias_owner_all ON public.contas_bancarias
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER contas_bancarias_updated_at BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. movimentacoes_financeiras
CREATE TABLE public.movimentacoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor numeric NOT NULL CHECK (valor >= 0),
  data_movimentacao date NOT NULL DEFAULT CURRENT_DATE,
  descricao text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','pagamento_recebivel','pagamento_despesa','transferencia','ajuste')),
  registro_pagamento_id uuid REFERENCES public.registros_pagamento(id) ON DELETE CASCADE,
  recebivel_id uuid REFERENCES public.recebiveis(id) ON DELETE SET NULL,
  despesa_id uuid REFERENCES public.despesas(id) ON DELETE SET NULL,
  forma_pagamento text,
  comprovante_path text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_fin_conta ON public.movimentacoes_financeiras(conta_bancaria_id, data_movimentacao DESC);
CREATE INDEX idx_mov_fin_owner ON public.movimentacoes_financeiras(owner_id, data_movimentacao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_financeiras TO authenticated;
GRANT ALL ON public.movimentacoes_financeiras TO service_role;
ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY movs_owner_all ON public.movimentacoes_financeiras
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 3. registros_pagamento: nova coluna conta_bancaria_id + comprovante
ALTER TABLE public.registros_pagamento
  ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ADD COLUMN comprovante_path text;

-- 4. Trigger: criar movimentação automática ao registrar pagamento
CREATE OR REPLACE FUNCTION public.sync_movimentacao_from_pagamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tipo text;
  v_descricao text;
  v_owner uuid;
BEGIN
  IF NEW.conta_bancaria_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_owner := COALESCE(NEW.owner_id, auth.uid());

  IF NEW.recebivel_id IS NOT NULL THEN
    v_tipo := 'entrada';
    SELECT 'Recebimento: ' || COALESCE(pagador, '—') INTO v_descricao
      FROM public.recebiveis WHERE id = NEW.recebivel_id;
    INSERT INTO public.movimentacoes_financeiras
      (owner_id, conta_bancaria_id, tipo, valor, data_movimentacao, descricao,
       origem, registro_pagamento_id, recebivel_id, forma_pagamento, comprovante_path, observacao)
    VALUES (v_owner, NEW.conta_bancaria_id, v_tipo, NEW.valor, NEW.data_pagamento, v_descricao,
       'pagamento_recebivel', NEW.id, NEW.recebivel_id, NEW.forma_pagamento::text, NEW.comprovante_path, NEW.observacao);
  ELSIF NEW.despesa_id IS NOT NULL THEN
    v_tipo := 'saida';
    SELECT 'Pagamento: ' || COALESCE(descricao, '—') INTO v_descricao
      FROM public.despesas WHERE id = NEW.despesa_id;
    INSERT INTO public.movimentacoes_financeiras
      (owner_id, conta_bancaria_id, tipo, valor, data_movimentacao, descricao,
       origem, registro_pagamento_id, despesa_id, forma_pagamento, comprovante_path, observacao)
    VALUES (v_owner, NEW.conta_bancaria_id, v_tipo, NEW.valor, NEW.data_pagamento, v_descricao,
       'pagamento_despesa', NEW.id, NEW.despesa_id, NEW.forma_pagamento::text, NEW.comprovante_path, NEW.observacao);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_mov_pagamento_insert
  AFTER INSERT ON public.registros_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.sync_movimentacao_from_pagamento();

-- 5. Função saldo atual
CREATE OR REPLACE FUNCTION public.saldo_conta_bancaria(_conta_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT saldo_inicial FROM public.contas_bancarias WHERE id = _conta_id), 0)
       + COALESCE((SELECT SUM(CASE WHEN tipo='entrada' THEN valor ELSE -valor END)
                     FROM public.movimentacoes_financeiras WHERE conta_bancaria_id = _conta_id), 0);
$$;

GRANT EXECUTE ON FUNCTION public.saldo_conta_bancaria(uuid) TO authenticated;
