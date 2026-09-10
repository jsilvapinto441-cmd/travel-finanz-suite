-- ETAPA 7 — GATILHOS (triggers), idênticos aos existentes na origem
-- IMPORTANTE: rode esta etapa DEPOIS da etapa 6 (funções) e ANTES de importar dados.
-- Ao importar dados, desative os triggers para não gerar parcelas duplicadas
-- (ver README, seção "Importação de dados").

-- auth.users -> profiles (requer permissão para criar trigger em auth.users;
-- no Supabase gerenciado isso é permitido via SQL Editor com o papel postgres)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ai_threads
CREATE TRIGGER trg_ai_threads_updated BEFORE UPDATE ON public.ai_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- anexos
CREATE TRIGGER trg_set_owner_anexos BEFORE INSERT ON public.anexos
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- backups / jobs / schedules
CREATE TRIGGER trg_backups_owner BEFORE INSERT ON public.backups
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_backups_updated BEFORE UPDATE ON public.backups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_backup_jobs_owner BEFORE INSERT ON public.backup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_backup_jobs_updated BEFORE UPDATE ON public.backup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_backup_schedules_owner BEFORE INSERT ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_backup_schedules_updated BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- consolidadoras
CREATE TRIGGER trg_consolidadoras_owner BEFORE INSERT ON public.consolidadoras
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_consolidadoras_updated_at BEFORE UPDATE ON public.consolidadoras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- contas_bancarias
CREATE TRIGGER contas_bancarias_updated_at BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- contratos
CREATE TRIGGER trg_set_owner_contratos BEFORE INSERT ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_set_contrato_numero BEFORE INSERT ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_contrato_numero();
CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gerar_recebiveis_contrato AFTER INSERT OR UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.gerar_recebiveis_do_contrato();

-- despesas
CREATE TRIGGER trg_inherit_owner_despesas BEFORE INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_despesas();
CREATE TRIGGER trg_despesas_parcelas BEFORE INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_despesas();
CREATE TRIGGER trg_despesas_parcelas_before BEFORE INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_despesas();
CREATE TRIGGER trg_compute_status_despesa BEFORE INSERT OR UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.compute_status_despesa();
CREATE TRIGGER trg_despesas_guard_update BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.guard_parcela_imutavel_despesas();
CREATE TRIGGER trg_despesas_updated BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_despesas_parcelas_after AFTER INSERT ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_despesas_after();

-- despesa_rateios
CREATE TRIGGER trg_inherit_owner_despesa_rateios BEFORE INSERT ON public.despesa_rateios
  FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_despesa_rateios();
CREATE TRIGGER trg_despesa_rateios_updated BEFORE UPDATE ON public.despesa_rateios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- empresas / vínculo com contas
CREATE TRIGGER trg_set_owner_empresas BEFORE INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_empresas_updated BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_empresa_conta_owner BEFORE INSERT ON public.empresa_contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_conta_owner();

-- fornecedores / funcionarios / missoes / prestadores_mei / profiles
CREATE TRIGGER trg_set_owner_fornecedores BEFORE INSERT ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_owner_funcionarios BEFORE INSERT ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_funcionarios_updated BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_owner_missoes BEFORE INSERT ON public.missoes
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_missoes_updated BEFORE UPDATE ON public.missoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prestadores_mei_owner BEFORE INSERT ON public.prestadores_mei
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_prestadores_mei_updated_at BEFORE UPDATE ON public.prestadores_mei
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- recebiveis
-- (NÃO existe trigger de "parcela imutável" em recebiveis: os campos são editáveis)
CREATE TRIGGER trg_inherit_owner_recebiveis BEFORE INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_recebiveis();
CREATE TRIGGER trg_recebiveis_parcelas BEFORE INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_recebiveis();
CREATE TRIGGER trg_recebiveis_parcelas_before BEFORE INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_recebiveis();
CREATE TRIGGER trg_compute_status_recebivel BEFORE INSERT OR UPDATE ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.compute_status_recebivel();
CREATE TRIGGER trg_recebiveis_updated BEFORE UPDATE ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_recebiveis_parcelas_after AFTER INSERT ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_recebiveis_after();
CREATE TRIGGER trg_sync_status_contrato AFTER INSERT OR UPDATE OR DELETE ON public.recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.sync_status_contrato();

-- recebivel_abatimentos
CREATE TRIGGER trg_inherit_owner_recebivel_abatimentos BEFORE INSERT ON public.recebivel_abatimentos
  FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_recebivel_abatimentos();
CREATE TRIGGER trg_recebivel_abatimentos_updated BEFORE UPDATE ON public.recebivel_abatimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_recalc_total_abatimentos AFTER INSERT OR UPDATE OR DELETE ON public.recebivel_abatimentos
  FOR EACH ROW EXECUTE FUNCTION public.recalc_total_abatimentos();

-- registros_pagamento
-- ATENÇÃO: a origem possui gatilhos duplicados de recálculo (trg_recalc_valor_pago_ins e
-- trg_recalc_valor_pago_recebivel executam a MESMA função). Mantidos por fidelidade;
-- são idempotentes (recalculam a soma total), então não somam em dobro.
CREATE TRIGGER trg_inherit_owner_reg_pag BEFORE INSERT ON public.registros_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_registros_pagamento();
CREATE TRIGGER trg_recalc_valor_pago_despesa AFTER INSERT OR UPDATE OR DELETE ON public.registros_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.recalc_valor_pago_despesa();
CREATE TRIGGER trg_recalc_valor_pago_ins AFTER INSERT OR UPDATE OR DELETE ON public.registros_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.recalc_valor_pago_recebivel();
CREATE TRIGGER trg_recalc_valor_pago_recebivel AFTER INSERT OR UPDATE OR DELETE ON public.registros_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.recalc_valor_pago_recebivel();
CREATE TRIGGER trg_sync_mov_pagamento_insert AFTER INSERT ON public.registros_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.sync_movimentacao_from_pagamento();

-- user_active_sessions
CREATE TRIGGER trg_user_active_sessions_updated BEFORE UPDATE ON public.user_active_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
