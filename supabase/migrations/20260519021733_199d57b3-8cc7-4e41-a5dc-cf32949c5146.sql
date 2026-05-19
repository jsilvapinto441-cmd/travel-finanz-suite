
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'viewer');
CREATE TYPE public.status_generico AS ENUM ('ativo', 'inativo');
CREATE TYPE public.status_financeiro AS ENUM ('em_aberto', 'pago', 'atrasado', 'cancelado');
CREATE TYPE public.status_contrato AS ENUM ('rascunho', 'ativo', 'concluido', 'cancelado');
CREATE TYPE public.categoria_despesa AS ENUM ('impostos','funcionarios','aluguel','luz','condominio','telefone','parcelamento_simples','avulso','fornecedor','outros');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT auth.uid() IS NOT NULL $$;

-- ============ EMPRESAS ============
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  cor TEXT DEFAULT '#0d7a5f',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- ============ MISSOES ============
CREATE TABLE public.missoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  status public.status_generico NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.missoes ENABLE ROW LEVEL SECURITY;

-- ============ FORNECEDORES ============
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  responsavel TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- ============ FUNCIONARIOS ============
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cargo TEXT,
  salario NUMERIC(14,2) NOT NULL DEFAULT 0,
  vale_transporte NUMERIC(14,2) NOT NULL DEFAULT 0,
  alimentacao NUMERIC(14,2) NOT NULL DEFAULT 0,
  fgts NUMERIC(14,2) NOT NULL DEFAULT 0,
  inss NUMERIC(14,2) NOT NULL DEFAULT 0,
  custos_adicionais NUMERIC(14,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- ============ CONTRATOS ============
CREATE TABLE public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  missao_id UUID REFERENCES public.missoes(id) ON DELETE SET NULL,
  cliente TEXT NOT NULL,
  numero TEXT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  status public.status_contrato NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- ============ RECEBIVEIS ============
CREATE TABLE public.recebiveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  missao_id UUID REFERENCES public.missoes(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  pagador TEXT NOT NULL,
  numero_fatura TEXT,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  parcelas INTEGER NOT NULL DEFAULT 1,
  valor_parcela NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_recebimento DATE,
  banco TEXT,
  status public.status_financeiro NOT NULL DEFAULT 'em_aberto',
  categoria TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recebiveis ENABLE ROW LEVEL SECURITY;

-- ============ DESPESAS ============
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  missao_id UUID REFERENCES public.missoes(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  categoria public.categoria_despesa NOT NULL DEFAULT 'outros',
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  banco TEXT,
  status public.status_financeiro NOT NULL DEFAULT 'em_aberto',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGER updated_at ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','empresas','missoes','fornecedores','funcionarios','contratos','recebiveis','despesas']) LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  -- First user becomes admin; subsequent users become viewer until promoted
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============
-- All authenticated users can read everything (internal centralized system)
-- Admin + financeiro can write; viewer is read-only

-- profiles: each user sees their own + admins see all
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

-- user_roles: only admins
CREATE POLICY "roles_select_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
CREATE POLICY "roles_all_admin" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- activity_logs: read for all auth, insert for all auth
CREATE POLICY "logs_select_auth" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_insert_auth" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Generic policies for business tables
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['empresas','missoes','fornecedores','funcionarios','contratos','recebiveis','despesas']) LOOP
    EXECUTE format('CREATE POLICY "%s_select_auth" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_staff" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''financeiro''))', t, t);
    EXECUTE format('CREATE POLICY "%s_update_staff" ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''financeiro''))', t, t);
    EXECUTE format('CREATE POLICY "%s_delete_admin" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))', t, t);
  END LOOP;
END $$;

-- ============ SEED EMPRESAS ============
INSERT INTO public.empresas (nome, cor) VALUES
  ('Produz Viagens', '#0d7a5f'),
  ('Produz Internacional', '#c9a84c'),
  ('Produz Eventos', '#064e3b'),
  ('Produz Corporate', '#8b6f4e'),
  ('Produz Lazer', '#0f766e');

INSERT INTO public.missoes (nome, descricao) VALUES
  ('Missão Nacional', 'Viagens dentro do território nacional'),
  ('Missão Internacional', 'Viagens internacionais'),
  ('Missão Mundial', 'Operações de cobertura mundial');
