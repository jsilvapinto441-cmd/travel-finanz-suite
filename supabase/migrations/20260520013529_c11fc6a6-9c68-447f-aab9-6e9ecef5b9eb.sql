
ALTER TABLE public.recebiveis
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.recebiveis(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS numero_parcela integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS frequencia text NOT NULL DEFAULT 'mensal';

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.despesas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS numero_parcela integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcelas integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS frequencia text NOT NULL DEFAULT 'mensal';

CREATE INDEX IF NOT EXISTS idx_recebiveis_parent ON public.recebiveis(parent_id);
CREATE INDEX IF NOT EXISTS idx_recebiveis_venc ON public.recebiveis(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_parent ON public.despesas(parent_id);
CREATE INDEX IF NOT EXISTS idx_despesas_venc ON public.despesas(data_vencimento);

CREATE OR REPLACE FUNCTION public.add_freq(base_date date, freq text, n integer)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE freq
    WHEN 'semanal'   THEN base_date + (n * 7)
    WHEN 'quinzenal' THEN base_date + (n * 15)
    WHEN 'anual'     THEN (base_date + (n || ' year')::interval)::date
    ELSE                   (base_date + (n || ' month')::interval)::date
  END
$$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas <= 1 THEN
    IF COALESCE(NEW.valor_parcela,0) = 0 THEN
      NEW.valor_parcela := NEW.valor_total;
    END IF;
    RETURN NEW;
  END IF;
  NEW.valor_parcela := ROUND(NEW.valor_total / NEW.parcelas, 2);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis_after()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  i integer;
  vparc numeric;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas <= 1 THEN RETURN NEW; END IF;
  IF NEW.data_vencimento IS NULL THEN RETURN NEW; END IF;
  vparc := NEW.valor_parcela;
  FOR i IN 2..NEW.parcelas LOOP
    INSERT INTO public.recebiveis (
      parent_id, empresa_id, missao_id, contrato_id, pagador, numero_fatura,
      valor_total, valor_parcela, parcelas, numero_parcela, frequencia,
      data_vencimento, banco, status, categoria, observacoes
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.missao_id, NEW.contrato_id, NEW.pagador,
      NEW.numero_fatura, vparc, vparc, NEW.parcelas, i, NEW.frequencia,
      public.add_freq(NEW.data_vencimento, NEW.frequencia, i - 1),
      NEW.banco, 'em_aberto', NEW.categoria, NEW.observacoes
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recebiveis_parcelas ON public.recebiveis;
CREATE TRIGGER trg_recebiveis_parcelas BEFORE INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_recebiveis();

DROP TRIGGER IF EXISTS trg_recebiveis_parcelas_after ON public.recebiveis;
CREATE TRIGGER trg_recebiveis_parcelas_after AFTER INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_recebiveis_after();

CREATE OR REPLACE FUNCTION public.gerar_parcelas_despesas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas <= 1 THEN RETURN NEW; END IF;
  NEW.valor := ROUND(NEW.valor / NEW.parcelas, 2);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_despesas_after()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  i integer;
  total integer;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  total := COALESCE(NEW.parcelas, 1);
  IF total <= 1 THEN RETURN NEW; END IF;
  IF NEW.data_vencimento IS NULL THEN RETURN NEW; END IF;
  FOR i IN 2..total LOOP
    INSERT INTO public.despesas (
      parent_id, empresa_id, missao_id, contrato_id, fornecedor_id,
      descricao, categoria, valor, parcelas, numero_parcela, frequencia,
      data_vencimento, banco, status, observacoes
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.missao_id, NEW.contrato_id, NEW.fornecedor_id,
      NEW.descricao, NEW.categoria, NEW.valor, total, i, NEW.frequencia,
      public.add_freq(NEW.data_vencimento, NEW.frequencia, i - 1),
      NEW.banco, 'em_aberto', NEW.observacoes
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_despesas_parcelas ON public.despesas;
CREATE TRIGGER trg_despesas_parcelas BEFORE INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_despesas();

DROP TRIGGER IF EXISTS trg_despesas_parcelas_after ON public.despesas;
CREATE TRIGGER trg_despesas_parcelas_after AFTER INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_despesas_after();

CREATE OR REPLACE FUNCTION public.marcar_atrasados()
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE public.recebiveis SET status = 'atrasado'
    WHERE status = 'em_aberto' AND data_vencimento < CURRENT_DATE AND data_recebimento IS NULL;
  UPDATE public.despesas SET status = 'atrasado'
    WHERE status = 'em_aberto' AND data_vencimento < CURRENT_DATE AND data_pagamento IS NULL;
$$;

CREATE OR REPLACE VIEW public.fluxo_caixa_mensal AS
SELECT
  to_char(date_trunc('month', COALESCE(data_recebimento, data_vencimento)), 'YYYY-MM') AS mes,
  empresa_id,
  COALESCE(SUM(valor_total) FILTER (WHERE status <> 'cancelado'), 0) AS previsto_entradas,
  COALESCE(SUM(valor_total) FILTER (WHERE status = 'pago'), 0) AS realizado_entradas,
  0::numeric AS previsto_saidas,
  0::numeric AS realizado_saidas
FROM public.recebiveis
WHERE COALESCE(data_recebimento, data_vencimento) IS NOT NULL
GROUP BY 1, 2
UNION ALL
SELECT
  to_char(date_trunc('month', COALESCE(data_pagamento, data_vencimento)), 'YYYY-MM') AS mes,
  empresa_id,
  0::numeric, 0::numeric,
  COALESCE(SUM(valor) FILTER (WHERE status <> 'cancelado'), 0),
  COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0)
FROM public.despesas
WHERE COALESCE(data_pagamento, data_vencimento) IS NOT NULL
GROUP BY 1, 2;
