# Integração Contratos ↔ Recebíveis

Refatora as áreas de **Contratos** e **Recebíveis** para que funcionem conectadas: o contrato passa a ser a fonte da verdade (dados da viagem + plano financeiro) e os recebíveis são gerados automaticamente como parcelas filhas. Pagamentos passam a viver em uma nova entidade `registros_pagamento`, e o status é sempre calculado.

---

## 1. Banco de dados (migration)

### Tabela `contratos` — novos campos
- `destino` (text)
- `data_embarque` (date), `data_retorno` (date)
- `num_passageiros` (int)
- `tipo_servico` (enum: `pacote_completo`, `so_aereo`, `so_hospedagem`, `personalizado`)
- `valor_entrada` (numeric, default 0)
- `valor_saldo` (coluna gerada = `valor - valor_entrada`)
- `parcelas` (int, default 1)
- `frequencia` (text: `mensal` | `quinzenal` | `semanal`)
- `dia_vencimento` (int 1–31)
- Enum `status_contrato` ampliado: adiciona `em_analise`, `aguardando_pagamento`
- `numero` passa a ser auto-gerado quando vazio: `CTR-YYYY-NNN` via trigger (sequência por ano)

### Tabela `recebiveis` — ajustes
- Manter colunas atuais; passa a depender **sempre** de `contrato_id` quando gerada pelo contrato (avulsos permitidos sem contrato, mas exigem `pagador`).
- `status` adiciona `pago_parcial` (substituindo o atual `parcial` para alinhar ao prompt — manter compatibilidade mapeando ambos no badge).
- Remove edição manual de `valor_pago` (passa a ser somatório dos pagamentos).

### Nova tabela `registros_pagamento`
- `id`, `recebivel_id` (FK), `data_pagamento` (date), `valor` (numeric), `forma_pagamento` (enum: `pix`, `transferencia`, `boleto`, `cartao`, `dinheiro`), `observacao` (text), `user_id`, `created_at`
- RLS: select para `authenticated`; insert/update/delete para `admin`/`financeiro`.

### Triggers / funções
- `gerar_recebiveis_do_contrato(contrato)`: ao INSERT ou UPDATE de campos financeiros (`valor`, `valor_entrada`, `parcelas`, `frequencia`, `dia_vencimento`, `data_inicio`) — gera as parcelas:
  - Se `valor_entrada > 0`, cria recebível de entrada (`numero_parcela = 0`, vence em `data_inicio`).
  - Divide `saldo = valor - valor_entrada` em `parcelas` (último ajusta centavos).
  - Calcula vencimentos a partir de `data_inicio + 1 ciclo` usando `dia_vencimento` e `frequencia`.
- Regeneração: mantém recebíveis com `valor_pago > 0` (marca como pago/parcial); apaga apenas os que ainda não tiveram pagamento.
- `recalc_valor_pago_recebivel()` (trigger em `registros_pagamento` AFTER INS/UPD/DEL): soma pagamentos → atualiza `valor_pago` no recebível.
- `compute_status_recebivel` (já existe) — ajustado para usar `pago_parcial`.
- `sync_status_contrato(contrato_id)` (trigger AFTER em `recebiveis`): recalcula status do contrato:
  - Cancelado → mantém
  - Todos pagos → `concluido`
  - Algum vencido → `aguardando_pagamento`
  - Caso contrário com parcelas em aberto → `ativo`
- Triggers antigos (`gerar_parcelas_recebiveis*`) são removidos para parcelas vindas de contrato — recebível avulso continua suportando o fluxo antigo (parcelas livres).

---

## 2. Frontend

### `src/routes/_app.contratos.tsx`
Reformula o formulário com seções:
- **Cliente & Viagem**: cliente, destino, num_passageiros, data_embarque, data_retorno, tipo_servico
- **Vínculos**: empresa, missão, numero (auto)
- **Financeiro**: valor_total, valor_entrada, parcelas, frequencia, dia_vencimento, vigência (data_inicio/fim)
- **Status & Observações**
- Mostra **preview das parcelas** que serão geradas (mesma lógica visual do recebível atual).
- Ao editar contrato com parcelas já pagas → modal de confirmação: *"Este contrato já possui parcelas geradas. Deseja regenerar? Pagamentos serão preservados."*

### `src/routes/_app.recebiveis.tsx`
- Lista: nova coluna **Ações** com botão **Registrar pagamento**.
- Formulário:
  - Se vinculado a contrato → campos `pagador`, `empresa`, `missao`, `contrato` ficam **read-only** com fundo `bg-muted/40` e ícone "link para contrato".
  - Remove campo "Valor já pago" editável; mostra como leitura + histórico.
  - Remove geração de parcelas no recebível (passa a ser exclusiva do contrato). Mantém criação avulsa simples (1 parcela).
- Novo `PagamentoDialog` com campos: data, valor, forma, observação. Salva em `registros_pagamento`.
- Card de detalhes / drawer com **histórico de pagamentos** (lista das entradas de `registros_pagamento`).

### `src/components/status-badge.tsx`
- Adiciona `pago_parcial`, `vencido`, `em_analise`, `aguardando_pagamento`.

### `src/routes/_app.dashboard.tsx`
- Atualiza KPIs:
  - **Total a receber** = soma `valor - valor_pago` de `em_aberto + pago_parcial`
  - **Total vencido** = soma `valor - valor_pago` de `vencido`
  - **Recebido no mês** = soma `valor` de `registros_pagamento` do mês corrente
  - **Inadimplência** = % de contratos com ao menos 1 recebível vencido

---

## 3. Restrições garantidas
- `valor_pago` é somente trigger-managed; UI nunca grava diretamente.
- `status` do recebível é trigger-managed; UI exibe como badge (sem select).
- Recebíveis com pagamento **nunca** são apagados em regeneração.
- Recebível exige `contrato_id` **ou** `pagador` preenchido (check no banco).

---

## 4. Arquivos afetados (resumo)
- Migration nova (schema + enums + triggers + RLS de `registros_pagamento`).
- `src/routes/_app.contratos.tsx` (refatorado)
- `src/routes/_app.recebiveis.tsx` (refatorado + dialog de pagamento)
- `src/components/status-badge.tsx` (novos status)
- `src/components/pagamento-dialog.tsx` (novo)
- `src/routes/_app.dashboard.tsx` (KPIs atualizados)
- `src/lib/lookups.ts` (hook `useRegistrosPagamento(recebivel_id)`)

Após aprovação, começo pela migration (precisa do seu OK) e depois aplico as mudanças de frontend em sequência.
