
-- ============================================================
-- FASE 1: adicionar owner_id em todas as tabelas de dados
-- ============================================================
DO $$
DECLARE
  admin_id uuid := 'ffac6dc1-99ea-40ab-8b4e-2fcfbf40daf9';
  tbl text;
  tables text[] := ARRAY['empresas','contratos','despesas','recebiveis','funcionarios','fornecedores','missoes','registros_pagamento','anexos'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_id uuid', tbl);
    EXECUTE format('UPDATE public.%I SET owner_id = %L WHERE owner_id IS NULL', tbl, admin_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET NOT NULL', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET DEFAULT auth.uid()', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_owner ON public.%I(owner_id)', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- FASE 2: trigger genérico que garante owner_id = auth.uid() no INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;

-- Trigger para herdar owner do recebível pai (parcelas)
CREATE OR REPLACE FUNCTION public.inherit_owner_recebiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.inherit_owner_despesas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    IF NEW.parent_id IS NOT NULL THEN
      SELECT owner_id INTO NEW.owner_id FROM public.despesas WHERE id = NEW.parent_id;
    END IF;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.inherit_owner_registros_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

-- Aplica triggers
DROP TRIGGER IF EXISTS trg_set_owner_empresas ON public.empresas;
CREATE TRIGGER trg_set_owner_empresas BEFORE INSERT ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_set_owner_contratos ON public.contratos;
CREATE TRIGGER trg_set_owner_contratos BEFORE INSERT ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_set_owner_funcionarios ON public.funcionarios;
CREATE TRIGGER trg_set_owner_funcionarios BEFORE INSERT ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_set_owner_fornecedores ON public.fornecedores;
CREATE TRIGGER trg_set_owner_fornecedores BEFORE INSERT ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_set_owner_missoes ON public.missoes;
CREATE TRIGGER trg_set_owner_missoes BEFORE INSERT ON public.missoes FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_set_owner_anexos ON public.anexos;
CREATE TRIGGER trg_set_owner_anexos BEFORE INSERT ON public.anexos FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

DROP TRIGGER IF EXISTS trg_inherit_owner_recebiveis ON public.recebiveis;
CREATE TRIGGER trg_inherit_owner_recebiveis BEFORE INSERT ON public.recebiveis FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_recebiveis();

DROP TRIGGER IF EXISTS trg_inherit_owner_despesas ON public.despesas;
CREATE TRIGGER trg_inherit_owner_despesas BEFORE INSERT ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_despesas();

DROP TRIGGER IF EXISTS trg_inherit_owner_reg_pag ON public.registros_pagamento;
CREATE TRIGGER trg_inherit_owner_reg_pag BEFORE INSERT ON public.registros_pagamento FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_registros_pagamento();

-- ============================================================
-- FASE 3: dropar políticas antigas e recriar baseadas em owner_id
-- ============================================================

-- EMPRESAS
DROP POLICY IF EXISTS empresas_select_staff ON public.empresas;
DROP POLICY IF EXISTS empresas_insert_staff ON public.empresas;
DROP POLICY IF EXISTS empresas_update_staff ON public.empresas;
DROP POLICY IF EXISTS empresas_delete_admin ON public.empresas;
CREATE POLICY empresas_owner_all ON public.empresas FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- CONTRATOS
DROP POLICY IF EXISTS contratos_select_auth ON public.contratos;
DROP POLICY IF EXISTS contratos_insert_staff ON public.contratos;
DROP POLICY IF EXISTS contratos_update_staff ON public.contratos;
DROP POLICY IF EXISTS contratos_delete_admin ON public.contratos;
CREATE POLICY contratos_owner_all ON public.contratos FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- DESPESAS
DROP POLICY IF EXISTS despesas_select_auth ON public.despesas;
DROP POLICY IF EXISTS despesas_insert_staff ON public.despesas;
DROP POLICY IF EXISTS despesas_update_staff ON public.despesas;
DROP POLICY IF EXISTS despesas_delete_admin ON public.despesas;
CREATE POLICY despesas_owner_all ON public.despesas FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- RECEBIVEIS
DROP POLICY IF EXISTS recebiveis_select_auth ON public.recebiveis;
DROP POLICY IF EXISTS recebiveis_insert_staff ON public.recebiveis;
DROP POLICY IF EXISTS recebiveis_update_staff ON public.recebiveis;
DROP POLICY IF EXISTS recebiveis_delete_admin ON public.recebiveis;
CREATE POLICY recebiveis_owner_all ON public.recebiveis FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- FUNCIONARIOS
DROP POLICY IF EXISTS funcionarios_select_staff ON public.funcionarios;
DROP POLICY IF EXISTS funcionarios_insert_staff ON public.funcionarios;
DROP POLICY IF EXISTS funcionarios_update_staff ON public.funcionarios;
DROP POLICY IF EXISTS funcionarios_delete_admin ON public.funcionarios;
CREATE POLICY funcionarios_owner_all ON public.funcionarios FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- FORNECEDORES
DROP POLICY IF EXISTS fornecedores_select_staff ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_insert_staff ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_update_staff ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_delete_admin ON public.fornecedores;
CREATE POLICY fornecedores_owner_all ON public.fornecedores FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- MISSOES
DROP POLICY IF EXISTS missoes_select_auth ON public.missoes;
DROP POLICY IF EXISTS missoes_insert_staff ON public.missoes;
DROP POLICY IF EXISTS missoes_update_staff ON public.missoes;
DROP POLICY IF EXISTS missoes_delete_admin ON public.missoes;
CREATE POLICY missoes_owner_all ON public.missoes FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- REGISTROS_PAGAMENTO
DROP POLICY IF EXISTS reg_pag_select_auth ON public.registros_pagamento;
DROP POLICY IF EXISTS reg_pag_insert_staff ON public.registros_pagamento;
DROP POLICY IF EXISTS reg_pag_update_staff ON public.registros_pagamento;
DROP POLICY IF EXISTS reg_pag_delete_admin ON public.registros_pagamento;
CREATE POLICY reg_pag_owner_all ON public.registros_pagamento FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ANEXOS
DROP POLICY IF EXISTS anexos_select_auth ON public.anexos;
DROP POLICY IF EXISTS anexos_insert_staff ON public.anexos;
DROP POLICY IF EXISTS anexos_delete_admin ON public.anexos;
CREATE POLICY anexos_owner_all ON public.anexos FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- FASE 4: storage bucket "anexos" — isolar por owner via path prefix {auth.uid()}/...
-- ============================================================
DROP POLICY IF EXISTS anexos_storage_select_staff ON storage.objects;
DROP POLICY IF EXISTS anexos_storage_select ON storage.objects;
DROP POLICY IF EXISTS anexos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS anexos_storage_update ON storage.objects;
DROP POLICY IF EXISTS anexos_storage_delete ON storage.objects;

CREATE POLICY anexos_storage_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anexos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY anexos_storage_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY anexos_storage_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'anexos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- FASE 5: handle_new_user — não promover mais ninguém a admin automaticamente
-- (novos usuários começam SEM role de admin/financeiro; ficam só authenticated)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  -- Novos usuários NÃO recebem role automática (sistema SaaS isolado por owner_id)
  RETURN NEW;
END $$;
