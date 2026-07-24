import { createFileRoute } from "@tanstack/react-router";
import { CadastroParceiro } from "@/components/cadastro-parceiro";

export const Route = createFileRoute("/_app/fornecedores")({ component: Page });

function Page() {
  return (
    <CadastroParceiro
      table="fornecedores"
      title="Fornecedor"
      pageTitle="Fornecedores"
      description="Cadastro de fornecedores. O valor contratado é apenas informativo — o custo é contabilizado quando uma despesa é lançada."
      filename="fornecedores"
      showMissao
    />
  );
}
