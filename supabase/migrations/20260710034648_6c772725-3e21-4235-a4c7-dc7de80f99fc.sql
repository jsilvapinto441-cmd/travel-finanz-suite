
-- 1) Cadastro puro: prestadores de serviço (MEI)
CREATE TABLE IF NOT EXISTS public.prestadores_mei (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  documento TEXT,
  valor_contratado NUMERIC NOT NULL DEFAULT 0,
  banco TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestadores_mei TO authenticated;
GRANT ALL ON public.prestadores_mei TO service_role;
ALTER TABLE public.prestadores_mei ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestadores_mei owner" ON public.prestadores_mei
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_prestadores_mei_updated_at BEFORE UPDATE ON public.prestadores_mei
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prestadores_mei_owner BEFORE INSERT ON public.prestadores_mei
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- 2) Cadastro puro: consolidadoras
CREATE TABLE IF NOT EXISTS public.consolidadoras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  documento TEXT,
  valor_contratado NUMERIC NOT NULL DEFAULT 0,
  banco TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consolidadoras TO authenticated;
GRANT ALL ON public.consolidadoras TO service_role;
ALTER TABLE public.consolidadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consolidadoras owner" ON public.consolidadoras
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_consolidadoras_updated_at BEFORE UPDATE ON public.consolidadoras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_consolidadoras_owner BEFORE INSERT ON public.consolidadoras
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- 3) Links opcionais em despesas para o campo dinâmico da Nova Despesa
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prestador_mei_id UUID REFERENCES public.prestadores_mei(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consolidadora_id UUID REFERENCES public.consolidadoras(id) ON DELETE SET NULL;

-- 4) Correção da geração de parcelas do contrato:
--    a 1ª parcela deve usar a própria data de início (âncora), não âncora + 1 ciclo.
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

  DELETE FROM public.recebiveis
   WHERE contrato_id = NEW.id
     AND COALESCE(valor_pago, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM public.registros_pagamento rp WHERE rp.recebivel_id = recebiveis.id);

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

  IF COALESCE(NEW.frequencia,'mensal') = 'mensal' THEN
    anchor_date := make_date(
      EXTRACT(YEAR FROM base_date)::int,
      EXTRACT(MONTH FROM base_date)::int,
      LEAST(dia, EXTRACT(DAY FROM (date_trunc('month', base_date) + interval '1 month - 1 day'))::int)
    );
    -- Se o dia âncora já passou dentro do mês de início, mover para o próximo mês
    IF anchor_date < base_date THEN
      anchor_date := (anchor_date + interval '1 month')::date;
    END IF;
  ELSE
    anchor_date := base_date;
  END IF;

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
            ELSE public.add_freq(anchor_date, COALESCE(NEW.frequencia,'mensal'), i - 1)
          END,
          'em_aberto', 'parcela'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $function$;
