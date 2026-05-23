-- 1. funcionarios: restringir SELECT a admin/financeiro
DROP POLICY IF EXISTS funcionarios_select_auth ON public.funcionarios;
CREATE POLICY funcionarios_select_staff ON public.funcionarios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

-- 2. fornecedores: restringir SELECT a admin/financeiro
DROP POLICY IF EXISTS fornecedores_select_auth ON public.fornecedores;
CREATE POLICY fornecedores_select_staff ON public.fornecedores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

-- 3. empresas: restringir SELECT a admin/financeiro
DROP POLICY IF EXISTS empresas_select_auth ON public.empresas;
CREATE POLICY empresas_select_staff ON public.empresas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

-- 4. activity_logs: admin vê tudo, demais usuários só veem os próprios
DROP POLICY IF EXISTS logs_select_auth ON public.activity_logs;
CREATE POLICY logs_select_own_or_admin ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());

-- 5. storage.objects: policy UPDATE explícita para o bucket anexos
DROP POLICY IF EXISTS anexos_update_staff ON storage.objects;
CREATE POLICY anexos_update_staff ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'anexos' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role)))
  WITH CHECK (bucket_id = 'anexos' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role)));

-- 6. user_roles: políticas explícitas só para admin (INSERT/UPDATE/DELETE) — fecha qualquer brecha do ALL anterior
DROP POLICY IF EXISTS roles_all_admin ON public.user_roles;
CREATE POLICY roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY roles_update_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));