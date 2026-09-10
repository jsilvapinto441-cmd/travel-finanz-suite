-- ETAPA 8 — RLS E POLÍTICAS (idênticas à origem)

ALTER TABLE public.activity_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_threads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_schedules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidadoras            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_bancarias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_rateios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_contas_bancarias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missoes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores_mei           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebiveis                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebivel_abatimentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_pagamento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles                ENABLE ROW LEVEL SECURITY;

-- activity_logs
CREATE POLICY "logs_insert_auth" ON public.activity_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "logs_select_own_or_admin" ON public.activity_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (user_id = auth.uid())));
CREATE POLICY "logs_no_delete" ON public.activity_logs AS RESTRICTIVE FOR DELETE TO public USING (false);
CREATE POLICY "logs_no_update" ON public.activity_logs AS RESTRICTIVE FOR UPDATE TO public USING (false) WITH CHECK (false);

-- IA
CREATE POLICY "ai_messages_owner_all" ON public.ai_messages FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "ai_threads_owner_all" ON public.ai_threads FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));

-- anexos / backups
CREATE POLICY "anexos_owner_all" ON public.anexos FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "Owner manages own backup jobs" ON public.backup_jobs FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "backup_schedules_own" ON public.backup_schedules FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "backups_own" ON public.backups FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));

-- cadastros e financeiro (isolamento por owner_id)
CREATE POLICY "consolidadoras owner" ON public.consolidadoras FOR ALL TO public
  USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));
CREATE POLICY "prestadores_mei owner" ON public.prestadores_mei FOR ALL TO public
  USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));
CREATE POLICY "contas_bancarias_owner_all" ON public.contas_bancarias FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "contratos_owner_all" ON public.contratos FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "Owners manage own despesa_rateios" ON public.despesa_rateios FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "despesas_owner_all" ON public.despesas FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "Owner manages empresa_contas_bancarias" ON public.empresa_contas_bancarias FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "empresas_owner_all" ON public.empresas FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "fornecedores_owner_all" ON public.fornecedores FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "funcionarios_owner_all" ON public.funcionarios FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "missoes_owner_all" ON public.missoes FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "movs_owner_all" ON public.movimentacoes_financeiras FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "recebiveis_owner_all" ON public.recebiveis FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "Owner manages own abatimentos" ON public.recebivel_abatimentos FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "reg_pag_owner_all" ON public.registros_pagamento FOR ALL TO authenticated
  USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (id = auth.uid())));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));

-- sessões ativas
CREATE POLICY "Users manage own active session" ON public.user_active_sessions FOR ALL TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- papéis
CREATE POLICY "roles_select_admin" ON public.user_roles FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (user_id = auth.uid())));
CREATE POLICY "roles_insert_admin" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "roles_update_admin" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "roles_delete_admin" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
