import { createFileRoute } from "@tanstack/react-router";
import { CadastroParceiro } from "@/components/cadastro-parceiro";

export const Route = createFileRoute("/_app/prestadores-mei")({ component: Page });

function Page() {
  return (
    <CadastroParceiro
      table="prestadores_mei"
      title="Prestador MEI"
      pageTitle="Prestadores de Serviço (MEI)"
      description="Cadastro dos MEIs contratados. O valor contratado é apenas informativo — o custo é contabilizado quando uma despesa é lançada na categoria MEI."
      filename="prestadores-mei"
    />
  );
}
