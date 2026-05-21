
-- Fix: triggers antigos de parcelas (para recebíveis avulsos) estavam interferindo
-- nas parcelas geradas pelo contrato, sobrescrevendo valores e numero_parcela.

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  total_original numeric;
  base_cents bigint;
  per_cents bigint;
BEGIN
  -- Skip: parcelas geradas pelo contrato já vêm com valores e numero_parcela corretos
  IF NEW.contrato_id IS NOT NULL THEN RETURN NEW; END IF;
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
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  i integer; vparc numeric; vlast numeric;
  total_for_calc numeric; base_cents bigint; per_cents bigint; remainder_cents bigint;
BEGIN
  -- Skip: contratos já criam todas as parcelas
  IF NEW.contrato_id IS NOT NULL THEN RETURN NEW; END IF;
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

-- Limpa parcelas corrompidas dos contratos existentes (sem pagamentos) para regenerar
DELETE FROM public.recebiveis r
 WHERE r.contrato_id IS NOT NULL
   AND COALESCE(r.valor_pago, 0) = 0
   AND NOT EXISTS (SELECT 1 FROM public.registros_pagamento rp WHERE rp.recebivel_id = r.id);

-- Regenera parcelas dos contratos ativos disparando o trigger
UPDATE public.contratos SET updated_at = now() WHERE status <> 'cancelado';
