import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tabelas que refletem mudanças relevantes para a UI. Mantém apenas 1 canal Realtime.
const TABLES = [
  "despesas",
  "recebiveis",
  "contratos",
  "registros_pagamento",
  "movimentacoes_financeiras",
  "empresas",
  "missoes",
  "contas_bancarias",
  "empresa_contas_bancarias",
  "funcionarios",
  "prestadores_mei",
  "consolidadoras",
  "fornecedores",
] as const;

export function useRealtimeSync(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel("global-sync");

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          // Invalida tudo — react-query dedupa e refaz apenas o que está montado.
          qc.invalidateQueries();
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
