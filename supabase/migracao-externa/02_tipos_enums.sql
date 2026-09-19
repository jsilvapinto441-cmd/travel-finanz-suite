-- ETAPA 2 — TIPOS ENUM (ordem dos valores idêntica à origem)

CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'viewer');

CREATE TYPE public.categoria_despesa AS ENUM (
  'impostos','funcionarios','aluguel','luz','condominio','telefone',
  'parcelamento_simples','avulso','fornecedor','outros','prestador_mei','consolidadora'
);

CREATE TYPE public.forma_pagamento AS ENUM (
  'pix','transferencia','boleto','cartao','dinheiro','comissao','debito_em_conta'
);

CREATE TYPE public.status_contrato AS ENUM (
  'rascunho','ativo','concluido','cancelado','em_analise','aguardando_pagamento'
);

CREATE TYPE public.status_financeiro AS ENUM (
  'em_aberto','pago','atrasado','cancelado','parcial'
);

CREATE TYPE public.status_generico AS ENUM ('ativo','inativo');

CREATE TYPE public.tipo_servico_contrato AS ENUM (
  'pacote_completo','so_aereo','so_hospedagem','personalizado'
);
