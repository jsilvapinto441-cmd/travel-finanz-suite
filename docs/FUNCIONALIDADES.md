# Funcionalidades

Descrição dos módulos do Rotas e das principais regras de negócio implementadas.

[Voltar ao README](../README.md)

## Navegação

Menu lateral, nesta ordem: Dashboard, Bancos, Empresas, Missões, Contratos, Recebíveis, Despesas, Funcionários, Prestadores de Serviços (MEI), Consolidadoras, Fornecedores, Lucros, Login (perfil) e Administração (somente administradores). Configurações e saída ficam no rodapé do menu.

No celular, a navegação é feita pelo menu no canto superior esquerdo.

## Dashboard

Organizado em blocos:

1. **Financeiro** — total contratado, total recebido e a receber.
2. **Despesas** — operacionais, funcionários e total.
3. **Pendências** — cards de despesas em atraso e recebíveis em atraso; o clique abre a lista já filtrada.
4. **Resultado** — lucro líquido.
5. **Gráficos** — entradas x saídas em ordem cronológica e despesas por categoria (as cinco maiores no resumo; o clique abre o detalhamento completo).

Todos os indicadores respeitam os filtros de empresa, missão e período. Missões concluídas não entram nos cards financeiros.

## Contratos

- Cliente, valor, entrada, número de parcelas, dia de vencimento, destino e método de pagamento.
- Gera as parcelas como recebíveis. Editar uma parcela no contrato atualiza o recebível correspondente.
- Na prévia das parcelas, datas e valores podem ser ajustados manualmente. Alterar uma data recalcula as seguintes mês a mês, preservando as que foram editadas à mão.

## Recebíveis

- Listagem agrupada por lançamento, com parcelas expansíveis.
- **Baixa total ou parcial**, com forma de recebimento, conta bancária e comprovante. Excluir um pagamento reabre a parcela.
- **Abatimentos** (reembolso, comissão, desconto ou outros), um ou vários por recebível:
  - o valor original não é alterado;
  - valor líquido = valor original − total de abatimentos;
  - a baixa usa o valor líquido como padrão;
  - lançamentos sem abatimento têm valor líquido igual ao original.

## Despesas

- Categoria com campo complementar dinâmico (funcionário, fornecedor, MEI, consolidadora etc.).
- Lançamento único ou parcelado; em despesas parceladas, o valor informado se repete em cada parcela.
- **Rateio por missão:** uma única despesa dividida entre várias missões, com validação da soma. Ao filtrar por missão, listagens, totais, gráficos e relatórios consideram apenas a parte da missão.
- Formas de pagamento, incluindo **débito em conta**.
- Histórico de pagamentos parciais e anexos.
- Datas retroativas permitidas; datas fora do intervalo 2000–2100 bloqueiam o salvamento.

## Bancos e Empresas

- Contas bancárias com banco, agência, conta, titular, chave PIX e saldo inicial.
- Uma empresa pode ter várias contas. Nos seletores de conta aparece a empresa vinculada.
- Empresa com endereço e até três sócios; o nome abre uma janela de detalhes.

## Cadastros de parceiros

Missões (ativa/concluída), funcionários, prestadores de serviço (MEI), consolidadoras e fornecedores (vinculados a uma missão). Esses cadastros não geram custo sozinhos: o valor só entra no financeiro quando a despesa é lançada.

## Lucros e Fluxo de Caixa

Resultado por período e movimentações financeiras por conta.

## Filtros e busca

- Empresa e missão com seleção múltipla (lógica "OU" dentro do filtro e "E" entre filtros diferentes).
- Período, status (em aberto, pago, atrasado) e forma de pagamento.
- Busca que ignora acentos e maiúsculas/minúsculas.
- Períodos consideram a **data de vencimento**; status e valores pagos consideram todo o histórico de pagamentos.

## Relatórios e exportação

- **PDF** e **Excel (.xlsx)** em português, com datas `dd/MM/aaaa` e valores em R$.
- A exportação usa exatamente os filtros da tela, mostra nomes no lugar de identificadores, inclui totais do período e a logo da empresa do perfil.
- Registros ordenados por data em ordem crescente.

## Exclusão e histórico

- Exclusão com confirmação em todos os módulos.
- Bloqueada quando há registros vinculados, com o motivo informado.
- Ações registradas no histórico de atividades.

## Backup e restauração

Em **Configurações → Backup e Restauração**:

- backup completo dos dados do usuário, incluindo arquivos anexados;
- agendamento automático com retenção;
- download do arquivo e importação de um backup salvo;
- validação antes de restaurar e cópia de segurança automática do estado atual.

## Assistente de IA

- Chat sobre os dados financeiros do usuário.
- Transcrição de áudio.
- Extração de registros a partir de texto, planilhas, PDFs e imagens, com prévia antes da importação.

## Acesso e sessão

- Login por e-mail e senha, criação de conta e recuperação de senha por e-mail.
- Perfil individual com nome, logo e troca de e-mail (exige a senha atual).
- Perfis de acesso: `admin`, `financeiro` e `viewer`. O primeiro usuário vira administrador.
- Cada login vê apenas os próprios dados.
- Saída automática após 30 minutos sem atividade.
- Alterações aparecem automaticamente em outros dispositivos conectados (Realtime).

## Aplicativo instalável (PWA)

Manifesto, ícones e convite de instalação. A aplicação detecta novas versões publicadas e recarrega quando necessário.
