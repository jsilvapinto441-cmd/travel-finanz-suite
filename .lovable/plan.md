# Seleção múltipla nos filtros de Despesas

## Objetivo
Permitir combinar várias empresas e várias missões na tela de Despesas, mantendo intactas as regras atuais de vencimento, status, pagamentos, rateio, busca e permissões.

## Alterações
- Trocar os estados de Empresa e Missão de um único identificador para listas de identificadores selecionados.
- Substituir os dois seletores atuais pelo dropdown com checkboxes já usado em “Forma de pagamento”.
- Exibir “Todas as empresas/missões” sem seleção, o nome quando houver uma, e a quantidade com o substantivo correto quando houver várias.
- Incluir “Selecionar todas” no componente reutilizável; selecionar todas equivalerá ao estado sem restrição, evitando uma lista redundante de todos os IDs.
- Aplicar `OR` dentro de Empresa e dentro de Missão, e `AND` entre categorias diferentes.
- Manter Status como seleção única, pois seus estados são mutuamente exclusivos; manter período como intervalo e busca como texto. Forma de pagamento já é múltipla e será preservada.

## Regras de cálculo preservadas
- Uma despesa será incluída se sua empresa estiver entre as selecionadas.
- Para missões, serão considerados tanto `missao_id` direto quanto os rateios vinculados.
- Com várias missões selecionadas, o valor no escopo será a soma dos rateios dessas missões; pagamentos e saldos usarão a mesma proporção sobre o valor total.
- Despesas sem rateio continuarão usando o valor integral quando sua missão direta estiver selecionada.
- Listagem, grupos, quantidade, “Total a pagar”, “Pago”, “A pagar”, indicador diário, relatório e exportação usarão exatamente o mesmo conjunto filtrado e o mesmo valor rateado.
- Os nomes de todas as empresas e missões escolhidas serão registrados nos filtros do relatório exportado.

## Interface e validação
- Manter o menu aberto ao marcar ou desmarcar checkboxes.
- Ajustar largura e truncamento para desktop e mobile, sem mudar o layout geral.
- Validar no navegador combinações de duas empresas, duas missões e filtros combinados, incluindo uma despesa rateada.
- Executar os testes financeiros existentes e adicionar testes focados no cálculo de múltiplas missões se a lógica for extraída para uma função reutilizável.

## Fora do escopo
- Nenhuma alteração no banco de dados, estrutura das despesas, autenticação, permissões, status ou dados existentes.
