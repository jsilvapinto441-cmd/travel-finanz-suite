DO $$
DECLARE
  src uuid := '799d544f-329b-496f-a0a4-2def69f5bec1';
  dst uuid := 'ffac6dc1-99ea-40ab-8b4e-2fcfbf40daf9';
BEGIN
  UPDATE public.contratos SET owner_id = src WHERE owner_id = dst;
  UPDATE public.recebiveis SET owner_id = src WHERE owner_id = dst;
  UPDATE public.despesas SET owner_id = src WHERE owner_id = dst;
  UPDATE public.despesa_rateios SET owner_id = src WHERE owner_id = dst;
  UPDATE public.registros_pagamento SET owner_id = src WHERE owner_id = dst;
  UPDATE public.fornecedores SET owner_id = src WHERE owner_id = dst;
  UPDATE public.prestadores_mei SET owner_id = src WHERE owner_id = dst;
  UPDATE public.consolidadoras SET owner_id = src WHERE owner_id = dst;
  UPDATE public.anexos SET owner_id = src WHERE owner_id = dst;
  UPDATE public.movimentacoes_financeiras SET owner_id = src WHERE owner_id = dst;
  UPDATE public.empresa_contas_bancarias SET owner_id = src WHERE owner_id = dst;
  UPDATE public.backups SET owner_id = src WHERE owner_id = dst;
  UPDATE public.backup_jobs SET owner_id = src WHERE owner_id = dst;
  UPDATE public.backup_schedules SET owner_id = src WHERE owner_id = dst;
  UPDATE public.ai_threads SET owner_id = src WHERE owner_id = dst;
  UPDATE public.ai_messages SET owner_id = src WHERE owner_id = dst;

  UPDATE public.empresas SET owner_id = src WHERE owner_id = dst AND id NOT IN (
    '60cc74c7-78e0-4e05-9410-980f088bf865',
    '25d84f7c-365b-4138-a286-7c9251bf9a59',
    'f737e887-06b8-4e40-a622-da1c4932697a',
    '1140d533-def1-4ff7-8d0d-d87db4f141c3',
    'ff4f3e40-fe0f-4f4d-bbe5-b077b18fae90',
    'aac24c6a-2be9-404e-a690-e52daa4076ec',
    'd5b1eb5f-e588-4bca-aad9-dd9e31093596'
  );
  UPDATE public.missoes SET owner_id = src WHERE owner_id = dst AND id NOT IN (
    '2c04a884-8003-42fc-9d7f-57ae6a125bb8',
    '0708f593-51f6-49de-8064-8de8863d9e8d',
    '70053eb5-b5d8-4fef-87f7-cdfe8400cf39',
    '3ee9e123-e1c3-483f-83fb-096780baf4bf'
  );
  UPDATE public.funcionarios SET owner_id = src WHERE owner_id = dst AND id NOT IN (
    '1202a5e2-8321-49c4-aed0-71ae50f258e0',
    'c833edfc-af4f-41eb-b699-4868426cb64a'
  );
  UPDATE public.contas_bancarias SET owner_id = src
   WHERE owner_id = dst AND NOT banco ILIKE 'Santander';
END $$;