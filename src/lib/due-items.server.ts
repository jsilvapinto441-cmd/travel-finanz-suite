import { fetchAllRows } from "./fetch-all";
import { sendFcm } from "./fcm.server";
import { addDias, classificarEtapa, deveEnviar, hojeSaoPaulo, montarMensagem, type ItemAviso, type TipoItem } from "./due-items";

type Resumo = { usuarios: number; pushes: number; erros: number; detalhes: string[] };

/**
 * check-due-items: avisos diários de recebíveis e despesas.
 * teste=true → ignora o histórico, não grava log e sempre envia algo ao usuário.
 */
export async function checkDueItems(opts: { userId?: string; teste?: boolean } = {}): Promise<Resumo> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const hoje = hojeSaoPaulo();
  const limite = addDias(hoje, 3);
  const r: Resumo = { usuarios: 0, pushes: 0, erros: 0, detalhes: [] };

  let q = db.from("notification_settings").select("*").eq("push_ativo", true);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data: settings, error } = await q;
  if (error) throw error;
  if (opts.teste && (!settings || settings.length === 0)) throw new Error("Ative as notificações push antes de testar.");

  for (const s of settings ?? []) {
    try {
      const { data: tokens } = await db.from("user_push_tokens").select("id, token").eq("user_id", s.user_id);
      if (!tokens?.length) {
        if (opts.teste) throw new Error("Nenhum dispositivo registrado. Desligue e ligue as notificações novamente.");
        continue;
      }
      r.usuarios++;
      const envios: { titulo: string; corpo: string; link: string; tipo: TipoItem; itens: ItemAviso[] }[] = [];

      for (const tipo of ["recebivel", "despesa"] as const) {
        if (tipo === "recebivel" ? !s.recebiveis_ativo : !s.despesas_ativo) continue;
        const rows = tipo === "recebivel"
          ? await fetchAllRows<{ id: string; data_vencimento: string; valor_parcela: number; valor_pago: number; total_abatimentos: number }>((f, t) =>
              db.from("recebiveis").select("id, data_vencimento, valor_parcela, valor_pago, total_abatimentos")
                .eq("owner_id", s.user_id).not("status", "in", "(pago,cancelado)").not("data_vencimento", "is", null)
                .lte("data_vencimento", limite).order("id").range(f, t))
          : await fetchAllRows<{ id: string; data_vencimento: string; valor: number; valor_pago: number }>((f, t) =>
              db.from("despesas").select("id, data_vencimento, valor, valor_pago")
                .eq("owner_id", s.user_id).not("status", "in", "(pago,cancelado)").not("data_vencimento", "is", null)
                .lte("data_vencimento", limite).order("id").range(f, t));

        let itens: ItemAviso[] = [];
        for (const row of rows as Array<Record<string, unknown>>) {
          const etapa = classificarEtapa(String(row["data_vencimento"]), hoje);
          if (!etapa) continue;
          const bruto = tipo === "recebivel"
            ? Number(row["valor_parcela"]) - Number(row["total_abatimentos"] ?? 0)
            : Number(row["valor"]);
          itens.push({ id: String(row["id"]), vencimento: String(row["data_vencimento"]), etapa, valor: Math.max(0, bruto - Number(row["valor_pago"] ?? 0)) });
        }

        if (!opts.teste && itens.length) {
          const logs: { item_id: string; etapa: string; enviado_em: string }[] = [];
          for (let i = 0; i < itens.length; i += 200) {
            const ids = itens.slice(i, i + 200).map((x) => x.id);
            const { data } = await db.from("notification_log").select("item_id, etapa, enviado_em")
              .eq("user_id", s.user_id).eq("tipo", tipo).in("item_id", ids);
            logs.push(...(data ?? []));
          }
          itens = itens.filter((it) => deveEnviar(it.etapa, logs.filter((l) => l.item_id === it.id)));
        }

        const msg = montarMensagem(tipo, itens);
        if (!msg) continue;
        const tela = tipo === "recebivel" ? "recebiveis" : "despesas";
        const link = `/${tela}?status=${msg.temAtrasados ? "atrasado" : "em_aberto"}`;
        envios.push({ titulo: msg.titulo, corpo: msg.corpo, link, tipo, itens });
      }

      if (opts.teste && envios.length === 0) {
        envios.push({ titulo: "Teste ✅", corpo: "Notificações funcionando. Nenhum vencimento pendente hoje.", link: "/configuracoes", tipo: "recebivel", itens: [] });
      }

      for (const e of envios) {
        let entregue = false;
        for (const t of tokens) {
          const res = await sendFcm(t.token, e.titulo, e.corpo, e.link, {
            tela: e.link.split("?")[0]!.slice(1),
            filtro: e.link.includes("atrasado") ? "atrasados" : "vencendo",
          });
          if (res.ok) entregue = true;
          else if (res.invalidToken) await db.from("user_push_tokens").delete().eq("id", t.id);
        }
        if (!entregue) { r.erros++; r.detalhes.push(`${s.user_id}: nenhum dispositivo aceitou o envio`); continue; }
        r.pushes++;
        if (!opts.teste && e.itens.length) {
          await db.from("notification_log").insert(e.itens.map((it) => ({ user_id: s.user_id, tipo: e.tipo, etapa: it.etapa, item_id: it.id })));
        }
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[check-due-items]", s.user_id, m);
      if (opts.teste) throw err;
      r.erros++;
      r.detalhes.push(`${s.user_id}: ${m}`);
    }
  }
  return r;
}
