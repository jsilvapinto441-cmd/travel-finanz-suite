-- ETAPA 6 — FUNÇÕES (cópias fiéis do banco de origem)

CREATE OR REPLACE FUNCTION public.add_freq(base_date date, freq text, n integer)
 RETURNS date LANGUAGE sql IMMUTABLE SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.set_owner_id()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $function$;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT auth.uid() IS NOT NULL $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  -- Novos usuários NÃO recebem role automática (sistema SaaS isolado por owner_id)
  RETURN NEW;
END $function$;

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

CREATE OR REPLACE FUNCTION public.compute_status_recebivel()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE valor_parc numeric;
BEGIN
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;
  valor_parc := GREATEST(
    COALESCE(NEW.valor_parcela, NEW.valor_total, 0) - COALESCE(NEW.total_abatimentos, 0),
    0
  );
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

CREATE OR REPLACE FUNCTION public.gerar_parcelas_despesas()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas < 1 THEN NEW.parcelas := 1; END IF;
  IF COALESCE(NEW.valor, 0) < 0 THEN NEW.valor := 0; END IF;
  NEW.numero_parcela := COALESCE(NEW.numero_parcela, 1);
  -- valor NÃO é mais dividido: cada parcela mantém o valor informado
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_despesas_after()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
      descricao, categoria, categoria_personalizada, valor, parcelas, numero_parcela, frequencia,
      data_vencimento, banco, status, observacoes,
      metodo_pagamento, numero_nota_fiscal, nome_empresa
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.missao_id, NEW.contrato_id, NEW.fornecedor_id,
      NEW.descricao, NEW.categoria, NEW.categoria_personalizada, NEW.valor, total, i, NEW.frequencia,
      public.add_freq(NEW.data_vencimento, NEW.frequencia, i - 1),
      NEW.banco, 'em_aberto', NEW.observacoes,
      NEW.metodo_pagamento, NEW.numero_nota_fiscal, NEW.nome_empresa
    );
  END LOOP;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_recebiveis()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
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
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.gerar_recebiveis_do_contrato()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.guard_parcela_imutavel_despesas()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
END $function$;

-- Observação: a função guard_parcela_imutavel_recebiveis existe no banco de origem,
-- mas o gatilho correspondente está DESATIVADO/REMOVIDO em recebiveis (campos liberados
-- para edição). A função é recriada aqui apenas por fidelidade; NÃO crie o trigger.
CREATE OR REPLACE FUNCTION public.guard_parcela_imutavel_recebiveis()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.inherit_owner_despesas()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    IF NEW.parent_id IS NOT NULL THEN
      SELECT owner_id INTO NEW.owner_id FROM public.despesas WHERE id = NEW.parent_id;
    END IF;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.inherit_owner_despesa_rateios()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.despesas WHERE id = NEW.despesa_id;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.inherit_owner_recebiveis()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    IF NEW.parent_id IS NOT NULL THEN
      SELECT owner_id INTO NEW.owner_id FROM public.recebiveis WHERE id = NEW.parent_id;
    ELSIF NEW.contrato_id IS NOT NULL THEN
      SELECT owner_id INTO NEW.owner_id FROM public.contratos WHERE id = NEW.contrato_id;
    END IF;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.inherit_owner_recebivel_abatimentos()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.recebiveis WHERE id = NEW.recebivel_id;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.inherit_owner_registros_pagamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    IF NEW.recebivel_id IS NOT NULL THEN
      SELECT owner_id INTO NEW.owner_id FROM public.recebiveis WHERE id = NEW.recebivel_id;
    ELSIF NEW.despesa_id IS NOT NULL THEN
      SELECT owner_id INTO NEW.owner_id FROM public.despesas WHERE id = NEW.despesa_id;
    END IF;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.set_empresa_conta_owner()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.empresas WHERE id = NEW.empresa_id;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.recalc_total_abatimentos()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE rid uuid; total numeric;
BEGIN
  rid := COALESCE(NEW.recebivel_id, OLD.recebivel_id);
  IF rid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(valor), 0) INTO total
    FROM public.recebivel_abatimentos WHERE recebivel_id = rid;
  UPDATE public.recebiveis SET total_abatimentos = total WHERE id = rid;
  RETURN COALESCE(NEW, OLD);
END $function$;

CREATE OR REPLACE FUNCTION public.recalc_valor_pago_despesa()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE did uuid; total numeric;
BEGIN
  did := COALESCE(NEW.despesa_id, OLD.despesa_id);
  IF did IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(valor),0) INTO total
    FROM public.registros_pagamento WHERE despesa_id = did;
  UPDATE public.despesas SET valor_pago = total WHERE id = did;
  RETURN COALESCE(NEW, OLD);
END $function$;

CREATE OR REPLACE FUNCTION public.recalc_valor_pago_recebivel()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE rid uuid; total numeric;
BEGIN
  rid := COALESCE(NEW.recebivel_id, OLD.recebivel_id);
  SELECT COALESCE(SUM(valor),0) INTO total
    FROM public.registros_pagamento WHERE recebivel_id = rid;
  UPDATE public.recebiveis SET valor_pago = total WHERE id = rid;
  RETURN COALESCE(NEW, OLD);
END $function$;

CREATE OR REPLACE FUNCTION public.saldo_conta_bancaria(_conta_id uuid)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT saldo_inicial FROM public.contas_bancarias WHERE id = _conta_id), 0)
       + COALESCE((SELECT SUM(CASE WHEN tipo='entrada' THEN valor ELSE -valor END)
                     FROM public.movimentacoes_financeiras WHERE conta_bancaria_id = _conta_id), 0);
$function$;

CREATE OR REPLACE FUNCTION public.set_contrato_numero()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.sync_movimentacao_from_pagamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.sync_status_contrato()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
    RETURN COALESCE(NEW, OLD);
  ELSIF pagos = total THEN
    UPDATE public.contratos SET status = 'concluido' WHERE id = cid;
  ELSIF vencidos > 0 THEN
    UPDATE public.contratos SET status = 'aguardando_pagamento' WHERE id = cid;
  ELSE
    UPDATE public.contratos SET status = 'ativo' WHERE id = cid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $function$;

CREATE OR REPLACE FUNCTION public.marcar_atrasados()
 RETURNS void LANGUAGE sql SET search_path TO 'public'
AS $function$
  UPDATE public.recebiveis SET status = 'atrasado'
    WHERE status = 'em_aberto' AND data_vencimento < CURRENT_DATE AND COALESCE(valor_pago,0) = 0;
  UPDATE public.despesas SET status = 'atrasado'
    WHERE status = 'em_aberto' AND data_vencimento < CURRENT_DATE AND COALESCE(valor_pago,0) = 0;
$function$;
