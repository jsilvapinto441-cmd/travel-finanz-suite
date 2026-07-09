
-- Cada parcela de despesa recebe o valor TOTAL informado (não divide mais).
CREATE OR REPLACE FUNCTION public.gerar_parcelas_despesas()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.parcelas IS NULL OR NEW.parcelas < 1 THEN NEW.parcelas := 1; END IF;
  IF COALESCE(NEW.valor, 0) < 0 THEN NEW.valor := 0; END IF;
  NEW.numero_parcela := COALESCE(NEW.numero_parcela, 1);
  -- valor NÃO é mais dividido: cada parcela mantém o valor informado
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
END $$;
