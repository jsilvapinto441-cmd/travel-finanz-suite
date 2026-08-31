DO $$
DECLARE
  src uuid := '799d544f-329b-496f-a0a4-2def69f5bec1';
  dst uuid := 'ffac6dc1-99ea-40ab-8b4e-2fcfbf40daf9';
BEGIN
  UPDATE public.contratos SET owner_id = dst WHERE owner_id = src;
  UPDATE public.recebiveis SET owner_id = dst WHERE owner_id = src;
  UPDATE public.despesas SET owner_id = dst WHERE owner_id = src;
  UPDATE public.despesa_rateios SET owner_id = dst WHERE owner_id = src;
  UPDATE public.registros_pagamento SET owner_id = dst WHERE owner_id = src;
  UPDATE public.missoes SET owner_id = dst WHERE owner_id = src;
  UPDATE public.empresas SET owner_id = dst WHERE owner_id = src;
  UPDATE public.fornecedores SET owner_id = dst WHERE owner_id = src;
  UPDATE public.funcionarios SET owner_id = dst WHERE owner_id = src;
  UPDATE public.contas_bancarias SET owner_id = dst WHERE owner_id = src;
  UPDATE public.prestadores_mei SET owner_id = dst WHERE owner_id = src;
  UPDATE public.consolidadoras SET owner_id = dst WHERE owner_id = src;
  UPDATE public.anexos SET owner_id = dst WHERE owner_id = src;
  UPDATE public.movimentacoes_financeiras SET owner_id = dst WHERE owner_id = src;
  UPDATE public.backups SET owner_id = dst WHERE owner_id = src;
  UPDATE public.backup_jobs SET owner_id = dst WHERE owner_id = src;
  UPDATE public.backup_schedules SET owner_id = dst WHERE owner_id = src;
  UPDATE public.ai_threads SET owner_id = dst WHERE owner_id = src;
  UPDATE public.ai_messages SET owner_id = dst WHERE owner_id = src;

  -- Evita conflito de unicidade em empresa_contas_bancarias ao mover vínculos
  DELETE FROM public.empresa_contas_bancarias a
   USING public.empresa_contas_bancarias b
   WHERE a.owner_id = src AND b.owner_id = dst
     AND a.empresa_id = b.empresa_id
     AND a.conta_bancaria_id = b.conta_bancaria_id;
  UPDATE public.empresa_contas_bancarias SET owner_id = dst WHERE owner_id = src;
END $$;