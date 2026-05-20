
CREATE INDEX IF NOT EXISTS idx_recebiveis_empresa ON public.recebiveis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_recebiveis_status ON public.recebiveis(status);
CREATE INDEX IF NOT EXISTS idx_recebiveis_venc ON public.recebiveis(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_recebiveis_parent ON public.recebiveis(parent_id);
CREATE INDEX IF NOT EXISTS idx_recebiveis_contrato ON public.recebiveis(contrato_id);
CREATE INDEX IF NOT EXISTS idx_recebiveis_missao ON public.recebiveis(missao_id);
CREATE INDEX IF NOT EXISTS idx_recebiveis_created ON public.recebiveis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_despesas_empresa ON public.despesas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON public.despesas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_venc ON public.despesas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_parent ON public.despesas(parent_id);
CREATE INDEX IF NOT EXISTS idx_despesas_contrato ON public.despesas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_despesas_missao ON public.despesas(missao_id);
CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor ON public.despesas(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON public.despesas(categoria);
CREATE INDEX IF NOT EXISTS idx_despesas_created ON public.despesas(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contratos_empresa ON public.contratos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contratos_missao ON public.contratos(missao_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON public.contratos(status);

CREATE INDEX IF NOT EXISTS idx_missoes_status ON public.missoes(status);

CREATE INDEX IF NOT EXISTS idx_anexos_entidade ON public.anexos(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
