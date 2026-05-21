
-- Allow registros_pagamento to point to either a recebivel or a despesa
ALTER TABLE public.registros_pagamento
  ALTER COLUMN recebivel_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS despesa_id uuid;

-- Exactly one of recebivel_id / despesa_id must be set
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reg_pag_one_target_chk'
  ) THEN
    ALTER TABLE public.registros_pagamento
      ADD CONSTRAINT reg_pag_one_target_chk
      CHECK ((recebivel_id IS NOT NULL)::int + (despesa_id IS NOT NULL)::int = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reg_pag_despesa ON public.registros_pagamento(despesa_id);

-- Recalculate valor_pago for a despesa from its registros_pagamento
CREATE OR REPLACE FUNCTION public.recalc_valor_pago_despesa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE did uuid; total numeric;
BEGIN
  did := COALESCE(NEW.despesa_id, OLD.despesa_id);
  IF did IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(valor),0) INTO total
    FROM public.registros_pagamento WHERE despesa_id = did;
  UPDATE public.despesas SET valor_pago = total WHERE id = did;
  RETURN COALESCE(NEW, OLD);
END $function$;

DROP TRIGGER IF EXISTS trg_recalc_valor_pago_despesa ON public.registros_pagamento;
CREATE TRIGGER trg_recalc_valor_pago_despesa
AFTER INSERT OR UPDATE OR DELETE ON public.registros_pagamento
FOR EACH ROW EXECUTE FUNCTION public.recalc_valor_pago_despesa();

-- Ensure existing recebivel trigger still fires (recreate if missing)
DROP TRIGGER IF EXISTS trg_recalc_valor_pago_recebivel ON public.registros_pagamento;
CREATE TRIGGER trg_recalc_valor_pago_recebivel
AFTER INSERT OR UPDATE OR DELETE ON public.registros_pagamento
FOR EACH ROW EXECUTE FUNCTION public.recalc_valor_pago_recebivel();
