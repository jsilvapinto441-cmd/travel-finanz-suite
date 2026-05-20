
-- 1) Recreate parcel generation functions (idempotent, safe on UPDATE)

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas < 1 THEN NEW.parcelas := 1; END IF;
  IF COALESCE(NEW.valor_total, 0) < 0 THEN NEW.valor_total := 0; END IF;
  IF NEW.parcelas <= 1 THEN
    NEW.valor_parcela := NEW.valor_total;
    NEW.numero_parcela := 1;
  ELSE
    NEW.valor_parcela := ROUND(NEW.valor_total / NEW.parcelas, 2);
    NEW.numero_parcela := COALESCE(NEW.numero_parcela, 1);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis_after()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE i integer; vparc numeric;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas <= 1 THEN RETURN NEW; END IF;
  IF NEW.data_vencimento IS NULL THEN RETURN NEW; END IF;
  -- Safety: never duplicate if children already exist
  IF EXISTS (SELECT 1 FROM public.recebiveis WHERE parent_id = NEW.id) THEN
    RETURN NEW;
  END IF;
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

CREATE OR REPLACE FUNCTION public.gerar_parcelas_despesas()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas < 1 THEN NEW.parcelas := 1; END IF;
  IF COALESCE(NEW.valor, 0) < 0 THEN NEW.valor := 0; END IF;
  IF NEW.parcelas > 1 THEN
    NEW.valor := ROUND(NEW.valor / NEW.parcelas, 2);
    NEW.numero_parcela := COALESCE(NEW.numero_parcela, 1);
  ELSE
    NEW.numero_parcela := 1;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_despesas_after()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE i integer; total integer;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  total := COALESCE(NEW.parcelas, 1);
  IF total <= 1 THEN RETURN NEW; END IF;
  IF NEW.data_vencimento IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.despesas WHERE parent_id = NEW.id) THEN
    RETURN NEW;
  END IF;
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

-- 2) Guard: prevent reshaping a parent that already has children
CREATE OR REPLACE FUNCTION public.guard_parcela_imutavel_recebiveis()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parent_id IS NULL AND EXISTS (SELECT 1 FROM public.recebiveis WHERE parent_id = NEW.id) THEN
    IF NEW.parcelas IS DISTINCT FROM OLD.parcelas
       OR NEW.valor_total IS DISTINCT FROM OLD.valor_total
       OR NEW.frequencia IS DISTINCT FROM OLD.frequencia
       OR NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
      RAISE EXCEPTION 'Não é possível alterar valor, parcelas, frequência ou vencimento de um recebível parcelado já gerado. Exclua e recadastre.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_parcela_imutavel_despesas()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parent_id IS NULL AND EXISTS (SELECT 1 FROM public.despesas WHERE parent_id = NEW.id) THEN
    IF NEW.parcelas IS DISTINCT FROM OLD.parcelas
       OR NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.frequencia IS DISTINCT FROM OLD.frequencia
       OR NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
      RAISE EXCEPTION 'Não é possível alterar valor, parcelas, frequência ou vencimento de uma despesa parcelada já gerada. Exclua e recadastre.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 3) Attach triggers (idempotent)
DROP TRIGGER IF EXISTS trg_recebiveis_parcelas_before ON public.recebiveis;
DROP TRIGGER IF EXISTS trg_recebiveis_parcelas_after  ON public.recebiveis;
DROP TRIGGER IF EXISTS trg_recebiveis_guard_update    ON public.recebiveis;
DROP TRIGGER IF EXISTS trg_despesas_parcelas_before   ON public.despesas;
DROP TRIGGER IF EXISTS trg_despesas_parcelas_after    ON public.despesas;
DROP TRIGGER IF EXISTS trg_despesas_guard_update      ON public.despesas;

CREATE TRIGGER trg_recebiveis_parcelas_before
  BEFORE INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_recebiveis();

CREATE TRIGGER trg_recebiveis_parcelas_after
  AFTER INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_recebiveis_after();

CREATE TRIGGER trg_recebiveis_guard_update
  BEFORE UPDATE ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.guard_parcela_imutavel_recebiveis();

CREATE TRIGGER trg_despesas_parcelas_before
  BEFORE INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_despesas();

CREATE TRIGGER trg_despesas_parcelas_after
  AFTER INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_despesas_after();

CREATE TRIGGER trg_despesas_guard_update
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.guard_parcela_imutavel_despesas();

-- 4) Profit views
DROP VIEW IF EXISTS public.lucro_por_contrato;
CREATE VIEW public.lucro_por_contrato WITH (security_invoker = true) AS
SELECT
  c.id AS contrato_id,
  c.empresa_id,
  c.cliente,
  c.numero,
  c.valor AS valor_contrato,
  COALESCE(r.recebido, 0)    AS receita_realizada,
  COALESCE(r.previsto, 0)    AS receita_prevista,
  COALESCE(d.pago, 0)        AS despesa_realizada,
  COALESCE(d.previsto, 0)    AS despesa_prevista,
  COALESCE(r.recebido, 0) - COALESCE(d.pago, 0) AS lucro_realizado,
  (COALESCE(r.recebido,0) + COALESCE(r.previsto,0))
    - (COALESCE(d.pago,0) + COALESCE(d.previsto,0)) AS lucro_projetado
FROM public.contratos c
LEFT JOIN (
  SELECT contrato_id,
    SUM(CASE WHEN status = 'pago' THEN valor_parcela ELSE 0 END) AS recebido,
    SUM(CASE WHEN status <> 'pago' THEN valor_parcela ELSE 0 END) AS previsto
  FROM public.recebiveis
  WHERE contrato_id IS NOT NULL
  GROUP BY contrato_id
) r ON r.contrato_id = c.id
LEFT JOIN (
  SELECT contrato_id,
    SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) AS pago,
    SUM(CASE WHEN status <> 'pago' THEN valor ELSE 0 END) AS previsto
  FROM public.despesas
  WHERE contrato_id IS NOT NULL
  GROUP BY contrato_id
) d ON d.contrato_id = c.id;

DROP VIEW IF EXISTS public.lucro_por_empresa;
CREATE VIEW public.lucro_por_empresa WITH (security_invoker = true) AS
SELECT
  e.id AS empresa_id,
  e.nome,
  e.cor,
  COALESCE(r.recebido, 0) AS receita_realizada,
  COALESCE(r.previsto, 0) AS receita_prevista,
  COALESCE(d.pago, 0)     AS despesa_realizada,
  COALESCE(d.previsto, 0) AS despesa_prevista,
  COALESCE(r.recebido,0) - COALESCE(d.pago,0) AS lucro_realizado,
  (COALESCE(r.recebido,0) + COALESCE(r.previsto,0))
    - (COALESCE(d.pago,0) + COALESCE(d.previsto,0)) AS lucro_projetado
FROM public.empresas e
LEFT JOIN (
  SELECT empresa_id,
    SUM(CASE WHEN status = 'pago' THEN valor_parcela ELSE 0 END) AS recebido,
    SUM(CASE WHEN status <> 'pago' THEN valor_parcela ELSE 0 END) AS previsto
  FROM public.recebiveis GROUP BY empresa_id
) r ON r.empresa_id = e.id
LEFT JOIN (
  SELECT empresa_id,
    SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) AS pago,
    SUM(CASE WHEN status <> 'pago' THEN valor ELSE 0 END) AS previsto
  FROM public.despesas GROUP BY empresa_id
) d ON d.empresa_id = e.id;
