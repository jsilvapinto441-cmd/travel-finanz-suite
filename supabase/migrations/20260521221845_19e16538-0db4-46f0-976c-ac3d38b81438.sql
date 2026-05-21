
-- ============================================================
-- 1. ENUMS
-- ============================================================
ALTER TYPE public.status_contrato ADD VALUE IF NOT EXISTS 'em_analise';
ALTER TYPE public.status_contrato ADD VALUE IF NOT EXISTS 'aguardando_pagamento';

DO $$ BEGIN
  CREATE TYPE public.tipo_servico_contrato AS ENUM ('pacote_completo','so_aereo','so_hospedagem','personalizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.forma_pagamento AS ENUM ('pix','transferencia','boleto','cartao','dinheiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. CONTRATOS — novos campos
-- ============================================================
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS destino text,
  ADD COLUMN IF NOT EXISTS data_embarque date,
  ADD COLUMN IF NOT EXISTS data_retorno date,
  ADD COLUMN IF NOT EXISTS num_passageiros integer,
  ADD COLUMN IF NOT EXISTS tipo_servico public.tipo_servico_contrato,
  ADD COLUMN IF NOT EXISTS valor_entrada numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parcelas integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS frequencia text NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS dia_vencimento integer NOT NULL DEFAULT 10;

-- valor_saldo gerado
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS valor_saldo numeric
  GENERATED ALWAYS AS (GREATEST(COALESCE(valor,0) - COALESCE(valor_entrada,0), 0)) STORED;

-- ============================================================
-- 3. Auto numeração de contratos CTR-YYYY-NNN
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_contrato_numero()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE seq int; yr text;
BEGIN
  IF NEW.numero IS NULL OR length(trim(NEW.numero)) = 0 THEN
    yr := to_char(now(), 'YYYY');
    SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^CTR-' || yr || '-', ''), '')::int), 0) + 1
      INTO seq FROM public.contratos
      WHERE numero ~ ('^CTR-' || yr || '-[0-9]+$');
    NEW.numero := 'CTR-' || yr || '-' || lpad(seq::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_contrato_numero ON public.contratos;
CREATE TRIGGER trg_set_contrato_numero
BEFORE INSERT ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.set_contrato_numero();

-- ============================================================
-- 4. REGISTROS DE PAGAMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registros_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebivel_id uuid NOT NULL REFERENCES public.recebiveis(id) ON DELETE CASCADE,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric NOT NULL CHECK (valor > 0),
  forma_pagamento public.forma_pagamento NOT NULL DEFAULT 'pix',
  observacao text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registros_pagamento_recebivel ON public.registros_pagamento(recebivel_id);
CREATE INDEX IF NOT EXISTS idx_registros_pagamento_data ON public.registros_pagamento(data_pagamento);

ALTER TABLE public.registros_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reg_pag_select_auth ON public.registros_pagamento;
CREATE POLICY reg_pag_select_auth ON public.registros_pagamento
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS reg_pag_insert_staff ON public.registros_pagamento;
CREATE POLICY reg_pag_insert_staff ON public.registros_pagamento
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS reg_pag_update_staff ON public.registros_pagamento;
CREATE POLICY reg_pag_update_staff ON public.registros_pagamento
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS reg_pag_delete_admin ON public.registros_pagamento;
CREATE POLICY reg_pag_delete_admin ON public.registros_pagamento
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 5. recalc valor_pago em recebiveis a partir de registros_pagamento
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_valor_pago_recebivel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE rid uuid; total numeric;
BEGIN
  rid := COALESCE(NEW.recebivel_id, OLD.recebivel_id);
  SELECT COALESCE(SUM(valor),0) INTO total
    FROM public.registros_pagamento WHERE recebivel_id = rid;
  UPDATE public.recebiveis SET valor_pago = total WHERE id = rid;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_recalc_valor_pago_ins ON public.registros_pagamento;
CREATE TRIGGER trg_recalc_valor_pago_ins
AFTER INSERT OR UPDATE OR DELETE ON public.registros_pagamento
FOR EACH ROW EXECUTE FUNCTION public.recalc_valor_pago_recebivel();

-- ============================================================
-- 6. Status automatico do recebivel (trigger BEFORE)
--    Reutiliza a função existente public.compute_status_recebivel
-- ============================================================
DROP TRIGGER IF EXISTS trg_compute_status_recebivel ON public.recebiveis;
CREATE TRIGGER trg_compute_status_recebivel
BEFORE INSERT OR UPDATE ON public.recebiveis
FOR EACH ROW EXECUTE FUNCTION public.compute_status_recebivel();

-- ============================================================
-- 7. Sync status do contrato a partir dos recebiveis
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_status_contrato()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  cid uuid; total int; pagos int; vencidos int; cur_status public.status_contrato;
BEGIN
  cid := COALESCE(NEW.contrato_id, OLD.contrato_id);
  IF cid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT status INTO cur_status FROM public.contratos WHERE id = cid;
  IF cur_status = 'cancelado' THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pago'),
    COUNT(*) FILTER (WHERE status = 'atrasado')
    INTO total, pagos, vencidos
  FROM public.recebiveis WHERE contrato_id = cid;

  IF total = 0 THEN
    -- nada a fazer
    RETURN COALESCE(NEW, OLD);
  ELSIF pagos = total THEN
    UPDATE public.contratos SET status = 'concluido' WHERE id = cid;
  ELSIF vencidos > 0 THEN
    UPDATE public.contratos SET status = 'aguardando_pagamento' WHERE id = cid;
  ELSE
    UPDATE public.contratos SET status = 'ativo' WHERE id = cid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_sync_status_contrato ON public.recebiveis;
CREATE TRIGGER trg_sync_status_contrato
AFTER INSERT OR UPDATE OR DELETE ON public.recebiveis
FOR EACH ROW EXECUTE FUNCTION public.sync_status_contrato();

-- ============================================================
-- 8. Gerar recebiveis a partir do contrato
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_recebiveis_do_contrato()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  saldo numeric; base_cents bigint; per_cents bigint; remainder_cents bigint;
  i int; total int; vparc numeric; vlast numeric;
  base_date date; dia int;
BEGIN
  -- Se contrato cancelado, não gera
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;

  -- Só (re)gerar quando campos financeiros mudaram ou é insert
  IF TG_OP = 'UPDATE' THEN
    IF NEW.valor IS NOT DISTINCT FROM OLD.valor
       AND NEW.valor_entrada IS NOT DISTINCT FROM OLD.valor_entrada
       AND NEW.parcelas IS NOT DISTINCT FROM OLD.parcelas
       AND NEW.frequencia IS NOT DISTINCT FROM OLD.frequencia
       AND NEW.dia_vencimento IS NOT DISTINCT FROM OLD.dia_vencimento
       AND NEW.data_inicio IS NOT DISTINCT FROM OLD.data_inicio THEN
      RETURN NEW;
    END IF;
  END IF;

  base_date := COALESCE(NEW.data_inicio, CURRENT_DATE);
  dia := GREATEST(1, LEAST(31, COALESCE(NEW.dia_vencimento, 10)));
  total := GREATEST(1, COALESCE(NEW.parcelas, 1));
  saldo := GREATEST(COALESCE(NEW.valor,0) - COALESCE(NEW.valor_entrada,0), 0);

  -- Apagar recebíveis SEM pagamento associado a este contrato
  DELETE FROM public.recebiveis
   WHERE contrato_id = NEW.id
     AND COALESCE(valor_pago, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM public.registros_pagamento rp WHERE rp.recebivel_id = recebiveis.id);

  -- Marcar recebíveis com pagamento como "preservados" (status recalculado pelo trigger BEFORE)
  -- Não fazemos nada — o trigger compute_status_recebivel já mantém o status correto.

  -- Parcela de entrada (numero_parcela = 0)
  IF COALESCE(NEW.valor_entrada,0) > 0
     AND NOT EXISTS (SELECT 1 FROM public.recebiveis WHERE contrato_id = NEW.id AND numero_parcela = 0) THEN
    INSERT INTO public.recebiveis (
      empresa_id, missao_id, contrato_id, pagador, numero_fatura,
      valor_total, valor_parcela, parcelas, numero_parcela, frequencia,
      data_vencimento, status, categoria
    ) VALUES (
      NEW.empresa_id, NEW.missao_id, NEW.id, NEW.cliente, NEW.numero,
      NEW.valor_entrada, NEW.valor_entrada, total, 0, NEW.frequencia,
      base_date, 'em_aberto', 'entrada'
    );
  END IF;

  -- Parcelas do saldo
  IF saldo > 0 AND total >= 1 THEN
    base_cents := ROUND(saldo * 100)::bigint;
    per_cents := base_cents / total;
    remainder_cents := base_cents - (per_cents * total);
    vparc := per_cents::numeric / 100;
    vlast := (per_cents + remainder_cents)::numeric / 100;

    FOR i IN 1..total LOOP
      IF NOT EXISTS (SELECT 1 FROM public.recebiveis WHERE contrato_id = NEW.id AND numero_parcela = i) THEN
        INSERT INTO public.recebiveis (
          empresa_id, missao_id, contrato_id, pagador, numero_fatura,
          valor_total, valor_parcela, parcelas, numero_parcela, frequencia,
          data_vencimento, status, categoria
        ) VALUES (
          NEW.empresa_id, NEW.missao_id, NEW.id, NEW.cliente, NEW.numero,
          CASE WHEN i = total THEN vlast ELSE vparc END,
          CASE WHEN i = total THEN vlast ELSE vparc END,
          total, i, NEW.frequencia,
          public.add_freq(
            make_date(
              EXTRACT(YEAR FROM base_date)::int,
              EXTRACT(MONTH FROM base_date)::int,
              LEAST(dia, EXTRACT(DAY FROM (date_trunc('month', base_date) + interval '1 month - 1 day'))::int)
            ),
            NEW.frequencia,
            i - 1
          ),
          'em_aberto', 'parcela'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerar_recebiveis_contrato ON public.contratos;
CREATE TRIGGER trg_gerar_recebiveis_contrato
AFTER INSERT OR UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.gerar_recebiveis_do_contrato();

-- ============================================================
-- 9. Recebíveis: garantir que sempre tenha contrato OU pagador
-- ============================================================
ALTER TABLE public.recebiveis
  DROP CONSTRAINT IF EXISTS recebiveis_contrato_or_pagador;
ALTER TABLE public.recebiveis
  ADD CONSTRAINT recebiveis_contrato_or_pagador
  CHECK (contrato_id IS NOT NULL OR (pagador IS NOT NULL AND length(trim(pagador)) > 0));
