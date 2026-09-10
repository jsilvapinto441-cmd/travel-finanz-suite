-- ETAPA 9 — STORAGE (buckets e políticas) E AGENDAMENTO DE BACKUP

-- 9.1 Buckets (todos PRIVADOS, sem limite de tamanho definido na origem).
-- Se o painel do destino não permitir INSERT direto em storage.buckets,
-- crie os três buckets pela UI: Storage > New bucket (marcar como privado).
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos','anexos', false), ('avatars','avatars', false), ('backups','backups', false)
ON CONFLICT (id) DO NOTHING;

-- 9.2 Políticas em storage.objects (isolamento por pasta = auth.uid())
CREATE POLICY "anexos_storage_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = 'anexos') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "anexos_storage_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'anexos') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "anexos_storage_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING ((bucket_id = 'anexos') AND ((storage.foldername(name))[1] = (auth.uid())::text))
  WITH CHECK ((bucket_id = 'anexos') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "anexos_storage_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'anexos') AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY "Avatars owner read" ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = 'avatars') AND ((auth.uid())::text = (storage.foldername(name))[1]));
CREATE POLICY "Avatars owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'avatars') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "Avatars owner update" ON storage.objects FOR UPDATE TO authenticated
  USING ((bucket_id = 'avatars') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "Avatars owner delete" ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'avatars') AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY "backups_storage_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = 'backups') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "backups_storage_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'backups') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "backups_storage_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING ((bucket_id = 'backups') AND ((storage.foldername(name))[1] = (auth.uid())::text))
  WITH CHECK ((bucket_id = 'backups') AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "backups_storage_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'backups') AND ((storage.foldername(name))[1] = (auth.uid())::text));

-- 9.3 Agendamento do backup automático (pg_cron + pg_net)
-- Na origem existe o job "rotas-backup-automatico", executado a cada hora (minuto 5),
-- que chama o endpoint público do app. TROQUE a URL pela do seu domínio/deploy
-- e a chave pela sua chave pública (anon/publishable) do projeto de destino.
--
-- select cron.schedule(
--   'rotas-backup-automatico',
--   '5 * * * *',
--   $$
--   select net.http_post(
--     url:='https://SEU-DOMINIO/api/public/hooks/backup-cron',
--     headers:='{"Content-Type": "application/json", "apikey": "SUA_CHAVE_PUBLICA"}'::jsonb,
--     body:='{}'::jsonb
--   ) as request_id;
--   $$
-- );
--
-- Se o destino não tiver pg_cron, use qualquer agendador externo (GitHub Actions,
-- cron do servidor, EasyCron) fazendo POST no mesmo endpoint com o header `apikey`.
