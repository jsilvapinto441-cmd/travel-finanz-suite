-- ETAPA 3 — TABELAS (colunas, tipos, defaults e NOT NULL idênticos à origem)
-- Chaves primárias, únicas, checks e FKs estão na etapa 4.

CREATE TABLE public.activity_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  acao text NOT NULL,
  entidade text,
  entidade_id uuid,
  detalhes jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_threads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  title text DEFAULT 'Nova conversa'::text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  thread_id uuid NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  role text NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  parts jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.anexos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  path text NOT NULL,
  nome text NOT NULL,
  mime text,
  tamanho bigint,
  user_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL
);

CREATE TABLE public.backups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  criado_por uuid,
  tipo text DEFAULT 'manual'::text NOT NULL,
  status text DEFAULT 'processando'::text NOT NULL,
  path text,
  tamanho_bytes bigint DEFAULT 0 NOT NULL,
  total_registros integer DEFAULT 0 NOT NULL,
  total_arquivos integer DEFAULT 0 NOT NULL,
  tabelas jsonb DEFAULT '{}'::jsonb NOT NULL,
  erro text,
  observacoes text,
  restaurado_em timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.backup_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  backup_id uuid,
  tipo text NOT NULL,
  status text DEFAULT 'processando'::text NOT NULL,
  progresso integer DEFAULT 0 NOT NULL,
  etapa text,
  logs jsonb DEFAULT '[]'::jsonb NOT NULL,
  erro text,
  resultado jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.backup_schedules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  ativo boolean DEFAULT false NOT NULL,
  frequencia text DEFAULT 'semanal'::text NOT NULL,
  hora_utc integer DEFAULT 6 NOT NULL,
  reter_ultimos integer DEFAULT 10 NOT NULL,
  ultima_execucao timestamptz,
  proxima_execucao timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.contas_bancarias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  banco text NOT NULL,
  agencia text,
  conta text,
  digito text,
  tipo text DEFAULT 'corrente'::text NOT NULL,
  chave_pix text,
  titular text,
  documento text,
  saldo_inicial numeric DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.empresas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  razao_social text,
  cnpj text,
  cor text DEFAULT '#0d7a5f'::text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  conta_bancaria_id uuid,
  endereco text,
  socios jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE public.empresa_contas_bancarias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  conta_bancaria_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.missoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  descricao text,
  status text DEFAULT 'ativo'::text NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL
);

CREATE TABLE public.consolidadoras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  nome text NOT NULL,
  documento text,
  valor_contratado numeric DEFAULT 0 NOT NULL,
  banco text,
  observacoes text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  empresa_id uuid,
  cnpj text,
  telefone text,
  email text
);

CREATE TABLE public.prestadores_mei (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  nome text NOT NULL,
  documento text,
  valor_contratado numeric DEFAULT 0 NOT NULL,
  banco text,
  observacoes text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  empresa_id uuid,
  cnpj text,
  telefone text,
  email text
);

CREATE TABLE public.fornecedores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  cnpj text,
  responsavel text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  empresa_id uuid,
  valor_contratado numeric DEFAULT 0 NOT NULL,
  banco text,
  missao_id uuid
);

CREATE TABLE public.funcionarios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  cargo text,
  salario numeric(14,2) DEFAULT 0 NOT NULL,
  vale_transporte numeric(14,2) DEFAULT 0 NOT NULL,
  alimentacao numeric(14,2) DEFAULT 0 NOT NULL,
  fgts numeric(14,2) DEFAULT 0 NOT NULL,
  inss numeric(14,2) DEFAULT 0 NOT NULL,
  custos_adicionais numeric(14,2) DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  data_admissao date,
  encargos_auto boolean DEFAULT true NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL
);

CREATE TABLE public.contratos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  empresa_id uuid,
  missao_id uuid,
  cliente text NOT NULL,
  numero text,
  valor numeric(14,2) DEFAULT 0 NOT NULL,
  data_inicio date,
  data_fim date,
  status public.status_contrato DEFAULT 'ativo'::public.status_contrato NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  destino text,
  data_embarque date,
  data_retorno date,
  num_passageiros integer,
  tipo_servico public.tipo_servico_contrato,
  valor_entrada numeric DEFAULT 0 NOT NULL,
  parcelas integer DEFAULT 1 NOT NULL,
  frequencia text DEFAULT 'mensal'::text NOT NULL,
  dia_vencimento integer DEFAULT 10 NOT NULL,
  valor_saldo numeric GENERATED ALWAYS AS (GREATEST((COALESCE(valor, (0)::numeric) - COALESCE(valor_entrada, (0)::numeric)), (0)::numeric)) STORED,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  metodo_pagamento text
);

CREATE TABLE public.recebiveis (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  empresa_id uuid,
  missao_id uuid,
  contrato_id uuid,
  pagador text NOT NULL,
  numero_fatura text,
  valor_total numeric(14,2) DEFAULT 0 NOT NULL,
  parcelas integer DEFAULT 1 NOT NULL,
  valor_parcela numeric(14,2) DEFAULT 0 NOT NULL,
  data_vencimento date,
  data_recebimento date,
  banco text,
  status public.status_financeiro DEFAULT 'em_aberto'::public.status_financeiro NOT NULL,
  categoria text,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  parent_id uuid,
  numero_parcela integer DEFAULT 1 NOT NULL,
  frequencia text DEFAULT 'mensal'::text NOT NULL,
  valor_pago numeric DEFAULT 0 NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  total_abatimentos numeric DEFAULT 0 NOT NULL
);

CREATE TABLE public.recebivel_abatimentos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  recebivel_id uuid NOT NULL,
  tipo text DEFAULT 'reembolso'::text NOT NULL,
  valor numeric DEFAULT 0 NOT NULL,
  descricao text,
  data_abatimento date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.despesas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  empresa_id uuid,
  missao_id uuid,
  contrato_id uuid,
  fornecedor_id uuid,
  descricao text NOT NULL,
  categoria public.categoria_despesa DEFAULT 'outros'::public.categoria_despesa NOT NULL,
  valor numeric(14,2) DEFAULT 0 NOT NULL,
  data_vencimento date,
  data_pagamento date,
  banco text,
  status public.status_financeiro DEFAULT 'em_aberto'::public.status_financeiro NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  parent_id uuid,
  numero_parcela integer DEFAULT 1 NOT NULL,
  parcelas integer DEFAULT 1 NOT NULL,
  frequencia text DEFAULT 'mensal'::text NOT NULL,
  valor_pago numeric DEFAULT 0 NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  categoria_personalizada text,
  metodo_pagamento text,
  numero_nota_fiscal text,
  nome_empresa text,
  funcionario_id uuid,
  prestador_mei_id uuid,
  consolidadora_id uuid
);

CREATE TABLE public.despesa_rateios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  despesa_id uuid NOT NULL,
  missao_id uuid NOT NULL,
  valor numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.registros_pagamento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  recebivel_id uuid,
  data_pagamento date DEFAULT CURRENT_DATE NOT NULL,
  valor numeric NOT NULL,
  forma_pagamento public.forma_pagamento DEFAULT 'pix'::public.forma_pagamento NOT NULL,
  observacao text,
  user_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  despesa_id uuid,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  conta_bancaria_id uuid,
  comprovante_path text
);

CREATE TABLE public.movimentacoes_financeiras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid DEFAULT auth.uid() NOT NULL,
  conta_bancaria_id uuid NOT NULL,
  tipo text NOT NULL,
  valor numeric NOT NULL,
  data_movimentacao date DEFAULT CURRENT_DATE NOT NULL,
  descricao text,
  origem text DEFAULT 'manual'::text NOT NULL,
  registro_pagamento_id uuid,
  recebivel_id uuid,
  despesa_id uuid,
  forma_pagamento text,
  comprovante_path text,
  observacao text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  telefone text,
  empresa_nome text,
  avatar_url text
);

CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.user_active_sessions (
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  user_agent text,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- GRANTS (a Data API do Supabase exige GRANT explícito além do RLS).
-- No banco de origem os três papéis têm privilégios completos em todas as
-- tabelas do schema public; o acesso real é controlado pelas policies (etapa 8).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
