CREATE OR REPLACE FUNCTION public.add_freq(base_date date, freq text, n integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE freq
    WHEN 'diario'    THEN base_date + n
    WHEN 'semanal'   THEN base_date + (n * 7)
    WHEN 'quinzenal' THEN base_date + (n * 15)
    WHEN 'anual'     THEN (base_date + (n || ' year')::interval)::date
    ELSE                   (base_date + (n || ' month')::interval)::date
  END
$function$;