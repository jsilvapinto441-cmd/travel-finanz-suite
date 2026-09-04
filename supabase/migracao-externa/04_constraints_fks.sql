-- ETAPA 4 — CHAVES PRIMÁRIAS, ÚNICAS, CHECKS E CHAVES ESTRANGEIRAS

-- 4.1 Primary keys
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_threads ADD CONSTRAINT ai_threads_pkey PRIMARY KEY (id);
ALTER TABLE public.anexos ADD CONSTRAINT anexos_pkey PRIMARY KEY (id);
ALTER TABLE public.backup_jobs ADD CONSTRAINT backup_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.backup_schedules ADD CONSTRAINT backup_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.backups ADD CONSTRAINT backups_pkey PRIMARY KEY (id);
ALTER TABLE public.consolidadoras ADD CONSTRAINT consolidadoras_pkey PRIMARY KEY (id);
ALTER TABLE public.contas_bancarias ADD CONSTRAINT contas_bancarias_pkey PRIMARY KEY (id);
ALTER TABLE public.contratos ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);
ALTER TABLE public.despesa_rateios ADD CONSTRAINT despesa_rateios_pkey PRIMARY KEY (id);
ALTER TABLE public.despesas ADD CONSTRAINT despesas_pkey PRIMARY KEY (id);
ALTER TABLE public.empresa_contas_bancarias ADD CONSTRAINT empresa_contas_bancarias_pkey PRIMARY KEY (id);
ALTER TABLE public.empresas ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);
ALTER TABLE public.fornecedores ADD CONSTRAINT fornecedores_pkey PRIMARY KEY (id);
ALTER TABLE public.funcionarios ADD CONSTRAINT funcionarios_pkey PRIMARY KEY (id);
ALTER TABLE public.missoes ADD CONSTRAINT missoes_pkey PRIMARY KEY (id);
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_pkey PRIMARY KEY (id);
ALTER TABLE public.prestadores_mei ADD CONSTRAINT prestadores_mei_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.recebiveis ADD CONSTRAINT recebiveis_pkey PRIMARY KEY (id);
ALTER TABLE public.recebivel_abatimentos ADD CONSTRAINT recebivel_abatimentos_pkey PRIMARY KEY (id);
ALTER TABLE public.registros_pagamento ADD CONSTRAINT registros_pagamento_pkey PRIMARY KEY (id);
ALTER TABLE public.user_active_sessions ADD CONSTRAINT user_active_sessions_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

-- 4.2 Unique
ALTER TABLE public.backup_schedules ADD CONSTRAINT backup_schedules_owner_id_key UNIQUE (owner_id);
ALTER TABLE public.despesa_rateios ADD CONSTRAINT despesa_rateios_despesa_id_missao_id_key UNIQUE (despesa_id, missao_id);
ALTER TABLE public.empresa_contas_bancarias ADD CONSTRAINT empresa_contas_bancarias_empresa_id_conta_bancaria_id_key UNIQUE (empresa_id, conta_bancaria_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- 4.3 Checks
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_role_check
  CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])));
ALTER TABLE public.backup_jobs ADD CONSTRAINT backup_jobs_status_check
  CHECK ((status = ANY (ARRAY['processando'::text, 'concluido'::text, 'erro'::text, 'cancelado'::text])));
ALTER TABLE public.backup_jobs ADD CONSTRAINT backup_jobs_tipo_check
  CHECK ((tipo = ANY (ARRAY['backup'::text, 'restauracao'::text, 'validacao'::text])));
ALTER TABLE public.missoes ADD CONSTRAINT missoes_status_check
  CHECK ((status = ANY (ARRAY['ativo'::text, 'concluido'::text])));
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_origem_check
  CHECK ((origem = ANY (ARRAY['manual'::text, 'pagamento_recebivel'::text, 'pagamento_despesa'::text, 'transferencia'::text, 'ajuste'::text])));
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_tipo_check
  CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])));
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_valor_check
  CHECK ((valor >= (0)::numeric));
ALTER TABLE public.recebiveis ADD CONSTRAINT recebiveis_contrato_or_pagador
  CHECK (((contrato_id IS NOT NULL) OR ((pagador IS NOT NULL) AND (length(TRIM(BOTH FROM pagador)) > 0))));
ALTER TABLE public.registros_pagamento ADD CONSTRAINT reg_pag_one_target_chk
  CHECK (((((recebivel_id IS NOT NULL))::integer + ((despesa_id IS NOT NULL))::integer) = 1));
ALTER TABLE public.registros_pagamento ADD CONSTRAINT registros_pagamento_valor_check
  CHECK ((valor > (0)::numeric));

-- 4.4 Foreign keys
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.ai_threads(id) ON DELETE CASCADE;
ALTER TABLE public.backup_jobs ADD CONSTRAINT backup_jobs_backup_id_fkey FOREIGN KEY (backup_id) REFERENCES public.backups(id) ON DELETE SET NULL;
ALTER TABLE public.consolidadoras ADD CONSTRAINT consolidadoras_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_missao_id_fkey FOREIGN KEY (missao_id) REFERENCES public.missoes(id) ON DELETE SET NULL;
ALTER TABLE public.despesa_rateios ADD CONSTRAINT despesa_rateios_despesa_id_fkey FOREIGN KEY (despesa_id) REFERENCES public.despesas(id) ON DELETE CASCADE;
ALTER TABLE public.despesa_rateios ADD CONSTRAINT despesa_rateios_missao_id_fkey FOREIGN KEY (missao_id) REFERENCES public.missoes(id) ON DELETE CASCADE;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_consolidadora_id_fkey FOREIGN KEY (consolidadora_id) REFERENCES public.consolidadoras(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_missao_id_fkey FOREIGN KEY (missao_id) REFERENCES public.missoes(id) ON DELETE SET NULL;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.despesas(id) ON DELETE CASCADE;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_prestador_mei_id_fkey FOREIGN KEY (prestador_mei_id) REFERENCES public.prestadores_mei(id) ON DELETE SET NULL;
ALTER TABLE public.empresa_contas_bancarias ADD CONSTRAINT empresa_contas_bancarias_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE CASCADE;
ALTER TABLE public.empresa_contas_bancarias ADD CONSTRAINT empresa_contas_bancarias_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.fornecedores ADD CONSTRAINT fornecedores_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.fornecedores ADD CONSTRAINT fornecedores_missao_id_fkey FOREIGN KEY (missao_id) REFERENCES public.missoes(id) ON DELETE SET NULL;
ALTER TABLE public.funcionarios ADD CONSTRAINT funcionarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE CASCADE;
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_despesa_id_fkey FOREIGN KEY (despesa_id) REFERENCES public.despesas(id) ON DELETE SET NULL;
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_recebivel_id_fkey FOREIGN KEY (recebivel_id) REFERENCES public.recebiveis(id) ON DELETE SET NULL;
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT movimentacoes_financeiras_registro_pagamento_id_fkey FOREIGN KEY (registro_pagamento_id) REFERENCES public.registros_pagamento(id) ON DELETE CASCADE;
ALTER TABLE public.prestadores_mei ADD CONSTRAINT prestadores_mei_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.recebiveis ADD CONSTRAINT recebiveis_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;
ALTER TABLE public.recebiveis ADD CONSTRAINT recebiveis_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.recebiveis ADD CONSTRAINT recebiveis_missao_id_fkey FOREIGN KEY (missao_id) REFERENCES public.missoes(id) ON DELETE SET NULL;
ALTER TABLE public.recebiveis ADD CONSTRAINT recebiveis_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.recebiveis(id) ON DELETE CASCADE;
ALTER TABLE public.recebivel_abatimentos ADD CONSTRAINT recebivel_abatimentos_recebivel_id_fkey FOREIGN KEY (recebivel_id) REFERENCES public.recebiveis(id) ON DELETE CASCADE;
ALTER TABLE public.registros_pagamento ADD CONSTRAINT registros_pagamento_conta_bancaria_id_fkey FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.registros_pagamento ADD CONSTRAINT registros_pagamento_despesa_id_fkey FOREIGN KEY (despesa_id) REFERENCES public.despesas(id) ON DELETE CASCADE;
ALTER TABLE public.registros_pagamento ADD CONSTRAINT registros_pagamento_recebivel_id_fkey FOREIGN KEY (recebivel_id) REFERENCES public.recebiveis(id) ON DELETE CASCADE;
ALTER TABLE public.user_active_sessions ADD CONSTRAINT user_active_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
