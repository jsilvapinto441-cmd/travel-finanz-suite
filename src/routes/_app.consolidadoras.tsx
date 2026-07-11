import { createFileRoute } from "@tanstack/react-router";
import { CadastroParceiro } from "@/components/cadastro-parceiro";

export const Route = createFileRoute("/_app/consolidadoras")({ component: Page });

function Page() {
  return (
    <CadastroParceiro
      table="consolidadoras"
      title="Consolidadora"
      pageTitle="Consolidadoras"
      description="Cadastro das consolidadoras. O valor contratado é apenas informativo — o custo é contabilizado quando uma despesa é lançada na categoria Consolidador."
      filename="consolidadoras"
    />
  );
}
