DELETE FROM public.registros_pagamento WHERE despesa_id IS NOT NULL AND despesa_id NOT IN (SELECT id FROM public.despesas);
ALTER TABLE public.registros_pagamento ADD CONSTRAINT registros_pagamento_despesa_id_fkey FOREIGN KEY (despesa_id) REFERENCES public.despesas(id) ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';