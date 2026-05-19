import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEmpresas() {
  return useQuery({
    queryKey: ["empresas-options"],
    queryFn: async () => (await supabase.from("empresas").select("id, nome").order("nome")).data ?? [],
  });
}
export function useMissoes() {
  return useQuery({
    queryKey: ["missoes-options"],
    queryFn: async () => (await supabase.from("missoes").select("id, nome").order("nome")).data ?? [],
  });
}
export function useContratos() {
  return useQuery({
    queryKey: ["contratos-options"],
    queryFn: async () => (await supabase.from("contratos").select("id, cliente, numero").order("created_at", { ascending: false })).data ?? [],
  });
}
export function useFornecedores() {
  return useQuery({
    queryKey: ["fornecedores-options"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome").order("nome")).data ?? [],
  });
}

export const nomeById = (list: { id: string; nome: string }[] | undefined, id: string | null) =>
  list?.find((x) => x.id === id)?.nome ?? "—";
