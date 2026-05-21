
-- Adiciona suporte a frequência 'unico' em add_freq
CREATE OR REPLACE FUNCTION public.add_freq(base_date date, freq text, n integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE freq
    WHEN 'unico'     THEN base_date
    WHEN 'diario'    THEN base_date + n
    WHEN 'semanal'   THEN base_date + (n * 7)
    WHEN 'quinzenal' THEN base_date + (n * 15)
    WHEN 'anual'     THEN (base_date + (n || ' year')::interval)::date
    ELSE                   (base_date + (n || ' month')::interval)::date
  END
$function$;

-- Corrige trigger: primeira parcela = data_inicio + 1 ciclo (não na própria data_inicio)
CREATE OR REPLACE FUNCTION public.gerar_recebiveis_do_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  saldo numeric; base_cents bigint; per_cents bigint; remainder_cents bigint;
  i int; total int; vparc numeric; vlast numeric;
  base_date date; dia int; anchor_date date;
BEGIN
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;

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

  -- Apaga apenas recebíveis sem qualquer pagamento
  DELETE FROM public.recebiveis
   WHERE contrato_id = NEW.id
     AND COALESCE(valor_pago, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM public.registros_pagamento rp WHERE rp.recebivel_id = recebiveis.id);

  -- Parcela de entrada (numero_parcela = 0) — vence em data_inicio
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

  -- Âncora: para "mensal", aplicar dia_vencimento; para outras, usar base_date
  IF COALESCE(NEW.frequencia,'mensal') = 'mensal' THEN
    anchor_date := make_date(
      EXTRACT(YEAR FROM base_date)::int,
      EXTRACT(MONTH FROM base_date)::int,
      LEAST(dia, EXTRACT(DAY FROM (date_trunc('month', base_date) + interval '1 month - 1 day'))::int)
    );
  ELSE
    anchor_date := base_date;
  END IF;

  -- Parcelas do saldo (i=1..total). A 1ª vence em anchor + 1 ciclo.
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
          total, i, COALESCE(NEW.frequencia,'mensal'),
          CASE
            WHEN COALESCE(NEW.frequencia,'mensal') = 'unico' THEN anchor_date
            ELSE public.add_freq(anchor_date, COALESCE(NEW.frequencia,'mensal'), i)
          END,
          'em_aberto', 'parcela'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $function$;
