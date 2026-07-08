
ALTER TYPE public.categoria_despesa ADD VALUE IF NOT EXISTS 'prestador_mei';
ALTER TYPE public.categoria_despesa ADD VALUE IF NOT EXISTS 'consolidadora';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS metodo_pagamento text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS numero_nota_fiscal text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS nome_empresa text;
