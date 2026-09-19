# Débito em conta nas Despesas

## Alterações
- Ampliar o tipo de forma de pagamento no banco para aceitar o valor `debito_em_conta`, sem alterar os valores existentes.
- Adicionar “DÉBITO EM CONTA” ao seletor de registro e edição de pagamentos somente quando o lançamento for uma despesa.
- Incluir o rótulo no mapeamento central para que filtros, histórico, listagem e relatórios exibam “Débito em conta” corretamente.
- Preservar as opções atuais e o comportamento do módulo Recebíveis.

## Validação
- Confirmar criação e edição de um pagamento de despesa com a nova opção.
- Verificar a exibição no histórico, filtro e exportação.
- Executar os testes financeiros existentes.
