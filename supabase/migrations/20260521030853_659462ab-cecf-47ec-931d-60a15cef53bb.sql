
ALTER TYPE public.status_financeiro ADD VALUE IF NOT EXISTS 'parcial';

ALTER TABLE public.recebiveis ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  total_original numeric;
  base_cents bigint;
  per_cents bigint;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas < 1 THEN NEW.parcelas := 1; END IF;
  IF COALESCE(NEW.valor_total, 0) < 0 THEN NEW.valor_total := 0; END IF;
  total_original := NEW.valor_total;
  IF NEW.parcelas <= 1 THEN
    NEW.valor_parcela := total_original;
    NEW.numero_parcela := 1;
  ELSE
    base_cents := ROUND(total_original * 100)::bigint;
    per_cents := base_cents / NEW.parcelas;
    NEW.valor_parcela := (per_cents::numeric) / 100;
    NEW.valor_total := NEW.valor_parcela;
    NEW.numero_parcela := 1;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis_after()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  i integer; vparc numeric; vlast numeric;
  total_for_calc numeric; base_cents bigint; per_cents bigint; remainder_cents bigint;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas <= 1 THEN RETURN NEW; END IF;
  IF NEW.data_vencimento IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.recebiveis WHERE parent_id = NEW.id) THEN RETURN NEW; END IF;
  vparc := NEW.valor_parcela;
  total_for_calc := vparc * NEW.parcelas;
  base_cents := ROUND(total_for_calc * 100)::bigint;
  per_cents := ROUND(vparc * 100)::bigint;
  remainder_cents := base_cents - (per_cents * NEW.parcelas);
  vlast := ((per_cents + remainder_cents)::numeric) / 100;
  FOR i IN 2..NEW.parcelas LOOP
    INSERT INTO public.recebiveis (
      parent_id, empresa_id, missao_id, contrato_id, pagador, numero_fatura,
      valor_total, valor_parcela, parcelas, numero_parcela, frequencia,
      data_vencimento, banco, status, categoria, observacoes
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.missao_id, NEW.contrato_id, NEW.pagador,
      NEW.numero_fatura,
      CASE WHEN i = NEW.parcelas THEN vlast ELSE vparc END,
      CASE WHEN i = NEW.parcelas THEN vlast ELSE vparc END,
      NEW.parcelas, i, NEW.frequencia,
      public.add_freq(NEW.data_vencimento, NEW.frequencia, i - 1),
      NEW.banco, 'em_aberto', NEW.categoria, NEW.observacoes
    );
  END LOOP;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.compute_status_recebivel()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE valor_parc numeric;
BEGIN
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;
  valor_parc := COALESCE(NEW.valor_parcela, NEW.valor_total, 0);
  IF COALESCE(NEW.valor_pago, 0) >= valor_parc AND valor_parc > 0 THEN
    NEW.status := 'pago';
    IF NEW.data_recebimento IS NULL THEN NEW.data_recebimento := CURRENT_DATE; END IF;
  ELSIF COALESCE(NEW.valor_pago, 0) > 0 THEN
    NEW.status := 'parcial';
  ELSIF NEW.data_vencimento IS NOT NULL AND NEW.data_vencimento < CURRENT_DATE THEN
    NEW.status := 'atrasado';
  ELSE
    NEW.status := 'em_aberto';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_compute_status_recebivel ON public.recebiveis;
CREATE TRIGGER trg_compute_status_recebivel
BEFORE INSERT OR UPDATE OF valor_pago, data_vencimento, data_recebimento, valor_parcela, valor_total
ON public.recebiveis FOR EACH ROW EXECUTE FUNCTION public.compute_status_recebivel();

CREATE OR REPLACE FUNCTION public.compute_status_despesa()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE valor_parc numeric;
BEGIN
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;
  valor_parc := COALESCE(NEW.valor, 0);
  IF COALESCE(NEW.valor_pago, 0) >= valor_parc AND valor_parc > 0 THEN
    NEW.status := 'pago';
    IF NEW.data_pagamento IS NULL THEN NEW.data_pagamento := CURRENT_DATE; END IF;
  ELSIF COALESCE(NEW.valor_pago, 0) > 0 THEN
    NEW.status := 'parcial';
  ELSIF NEW.data_vencimento IS NOT NULL AND NEW.data_vencimento < CURRENT_DATE THEN
    NEW.status := 'atrasado';
  ELSE
    NEW.status := 'em_aberto';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_compute_status_despesa ON public.despesas;
CREATE TRIGGER trg_compute_status_despesa
BEFORE INSERT OR UPDATE OF valor_pago, data_vencimento, data_pagamento, valor
ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.compute_status_despesa();

-- Legacy data fix: bypass immutability guard
ALTER TABLE public.recebiveis DISABLE TRIGGER USER;
UPDATE public.recebiveis
SET valor_total = valor_parcela
WHERE parent_id IS NULL AND parcelas > 1 AND valor_total <> valor_parcela AND valor_parcela > 0;
ALTER TABLE public.recebiveis ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.marcar_atrasados()
 RETURNS void LANGUAGE sql SET search_path TO 'public'
AS $function$
  UPDATE public.recebiveis SET status = 'atrasado'
    WHERE status = 'em_aberto' AND data_vencimento < CURRENT_DATE AND COALESCE(valor_pago,0) = 0;
  UPDATE public.despesas SET status = 'atrasado'
    WHERE status = 'em_aberto' AND data_vencimento < CURRENT_DATE AND COALESCE(valor_pago,0) = 0;
$function$;
