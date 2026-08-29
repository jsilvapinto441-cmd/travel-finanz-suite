export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string | null
          entidade_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          parts: Json | null
          role: string
          thread_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          parts?: Json | null
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          parts?: Json | null
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      anexos: {
        Row: {
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          mime: string | null
          nome: string
          owner_id: string
          path: string
          tamanho: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entidade: string
          entidade_id: string
          id?: string
          mime?: string | null
          nome: string
          owner_id?: string
          path: string
          tamanho?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entidade?: string
          entidade_id?: string
          id?: string
          mime?: string | null
          nome?: string
          owner_id?: string
          path?: string
          tamanho?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_jobs: {
        Row: {
          backup_id: string | null
          created_at: string
          erro: string | null
          etapa: string | null
          id: string
          logs: Json
          owner_id: string
          progresso: number
          resultado: Json | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          backup_id?: string | null
          created_at?: string
          erro?: string | null
          etapa?: string | null
          id?: string
          logs?: Json
          owner_id: string
          progresso?: number
          resultado?: Json | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          backup_id?: string | null
          created_at?: string
          erro?: string | null
          etapa?: string | null
          id?: string
          logs?: Json
          owner_id?: string
          progresso?: number
          resultado?: Json | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_jobs_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "backups"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_schedules: {
        Row: {
          ativo: boolean
          created_at: string
          frequencia: string
          hora_utc: number
          id: string
          owner_id: string
          proxima_execucao: string | null
          reter_ultimos: number
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          frequencia?: string
          hora_utc?: number
          id?: string
          owner_id: string
          proxima_execucao?: string | null
          reter_ultimos?: number
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          frequencia?: string
          hora_utc?: number
          id?: string
          owner_id?: string
          proxima_execucao?: string | null
          reter_ultimos?: number
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      backups: {
        Row: {
          created_at: string
          criado_por: string | null
          erro: string | null
          id: string
          observacoes: string | null
          owner_id: string
          path: string | null
          restaurado_em: string | null
          status: string
          tabelas: Json
          tamanho_bytes: number
          tipo: string
          total_arquivos: number
          total_registros: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          erro?: string | null
          id?: string
          observacoes?: string | null
          owner_id: string
          path?: string | null
          restaurado_em?: string | null
          status?: string
          tabelas?: Json
          tamanho_bytes?: number
          tipo?: string
          total_arquivos?: number
          total_registros?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          erro?: string | null
          id?: string
          observacoes?: string | null
          owner_id?: string
          path?: string | null
          restaurado_em?: string | null
          status?: string
          tabelas?: Json
          tamanho_bytes?: number
          tipo?: string
          total_arquivos?: number
          total_registros?: number
          updated_at?: string
        }
        Relationships: []
      }
      consolidadoras: {
        Row: {
          ativo: boolean
          banco: string | null
          cnpj: string | null
          created_at: string
          documento: string | null
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          observacoes: string | null
          owner_id: string
          telefone: string | null
          updated_at: string
          valor_contratado: number
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          cnpj?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          owner_id?: string
          telefone?: string | null
          updated_at?: string
          valor_contratado?: number
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          cnpj?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          owner_id?: string
          telefone?: string | null
          updated_at?: string
          valor_contratado?: number
        }
        Relationships: [
          {
            foreignKeyName: "consolidadoras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidadoras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string
          chave_pix: string | null
          conta: string | null
          created_at: string
          digito: string | null
          documento: string | null
          id: string
          observacoes: string | null
          owner_id: string
          saldo_inicial: number
          tipo: string
          titular: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco: string
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          digito?: string | null
          documento?: string | null
          id?: string
          observacoes?: string | null
          owner_id?: string
          saldo_inicial?: number
          tipo?: string
          titular?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          digito?: string | null
          documento?: string | null
          id?: string
          observacoes?: string | null
          owner_id?: string
          saldo_inicial?: number
          tipo?: string
          titular?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contratos: {
        Row: {
          cliente: string
          created_at: string
          data_embarque: string | null
          data_fim: string | null
          data_inicio: string | null
          data_retorno: string | null
          destino: string | null
          dia_vencimento: number
          empresa_id: string | null
          frequencia: string
          id: string
          metodo_pagamento: string | null
          missao_id: string | null
          num_passageiros: number | null
          numero: string | null
          observacoes: string | null
          owner_id: string
          parcelas: number
          status: Database["public"]["Enums"]["status_contrato"]
          tipo_servico:
            | Database["public"]["Enums"]["tipo_servico_contrato"]
            | null
          updated_at: string
          valor: number
          valor_entrada: number
          valor_saldo: number | null
        }
        Insert: {
          cliente: string
          created_at?: string
          data_embarque?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_retorno?: string | null
          destino?: string | null
          dia_vencimento?: number
          empresa_id?: string | null
          frequencia?: string
          id?: string
          metodo_pagamento?: string | null
          missao_id?: string | null
          num_passageiros?: number | null
          numero?: string | null
          observacoes?: string | null
          owner_id?: string
          parcelas?: number
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo_servico?:
            | Database["public"]["Enums"]["tipo_servico_contrato"]
            | null
          updated_at?: string
          valor?: number
          valor_entrada?: number
          valor_saldo?: number | null
        }
        Update: {
          cliente?: string
          created_at?: string
          data_embarque?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_retorno?: string | null
          destino?: string | null
          dia_vencimento?: number
          empresa_id?: string | null
          frequencia?: string
          id?: string
          metodo_pagamento?: string | null
          missao_id?: string | null
          num_passageiros?: number | null
          numero?: string | null
          observacoes?: string | null
          owner_id?: string
          parcelas?: number
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo_servico?:
            | Database["public"]["Enums"]["tipo_servico_contrato"]
            | null
          updated_at?: string
          valor?: number
          valor_entrada?: number
          valor_saldo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "contratos_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
        ]
      }
      despesa_rateios: {
        Row: {
          created_at: string
          despesa_id: string
          id: string
          missao_id: string
          owner_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          despesa_id: string
          id?: string
          missao_id: string
          owner_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          despesa_id?: string
          id?: string
          missao_id?: string
          owner_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesa_rateios_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesa_rateios_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          banco: string | null
          categoria: Database["public"]["Enums"]["categoria_despesa"]
          categoria_personalizada: string | null
          consolidadora_id: string | null
          contrato_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          empresa_id: string | null
          fornecedor_id: string | null
          frequencia: string
          funcionario_id: string | null
          id: string
          metodo_pagamento: string | null
          missao_id: string | null
          nome_empresa: string | null
          numero_nota_fiscal: string | null
          numero_parcela: number
          observacoes: string | null
          owner_id: string
          parcelas: number
          parent_id: string | null
          prestador_mei_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"]
          updated_at: string
          valor: number
          valor_pago: number
        }
        Insert: {
          banco?: string | null
          categoria?: Database["public"]["Enums"]["categoria_despesa"]
          categoria_personalizada?: string | null
          consolidadora_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          frequencia?: string
          funcionario_id?: string | null
          id?: string
          metodo_pagamento?: string | null
          missao_id?: string | null
          nome_empresa?: string | null
          numero_nota_fiscal?: string | null
          numero_parcela?: number
          observacoes?: string | null
          owner_id?: string
          parcelas?: number
          parent_id?: string | null
          prestador_mei_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          updated_at?: string
          valor?: number
          valor_pago?: number
        }
        Update: {
          banco?: string | null
          categoria?: Database["public"]["Enums"]["categoria_despesa"]
          categoria_personalizada?: string | null
          consolidadora_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          frequencia?: string
          funcionario_id?: string | null
          id?: string
          metodo_pagamento?: string | null
          missao_id?: string | null
          nome_empresa?: string | null
          numero_nota_fiscal?: string | null
          numero_parcela?: number
          observacoes?: string | null
          owner_id?: string
          parcelas?: number
          parent_id?: string | null
          prestador_mei_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          updated_at?: string
          valor?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_consolidadora_id_fkey"
            columns: ["consolidadora_id"]
            isOneToOne: false
            referencedRelation: "consolidadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_contrato"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "despesas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_prestador_mei_id_fkey"
            columns: ["prestador_mei_id"]
            isOneToOne: false
            referencedRelation: "prestadores_mei"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_contas_bancarias: {
        Row: {
          conta_bancaria_id: string
          created_at: string
          empresa_id: string
          id: string
          owner_id: string
        }
        Insert: {
          conta_bancaria_id: string
          created_at?: string
          empresa_id: string
          id?: string
          owner_id: string
        }
        Update: {
          conta_bancaria_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_contas_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          conta_bancaria_id: string | null
          cor: string | null
          created_at: string
          endereco: string | null
          id: string
          nome: string
          owner_id: string
          razao_social: string | null
          socios: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          conta_bancaria_id?: string | null
          cor?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          owner_id?: string
          razao_social?: string | null
          socios?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          conta_bancaria_id?: string | null
          cor?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          owner_id?: string
          razao_social?: string | null
          socios?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          banco: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          missao_id: string | null
          nome: string
          observacoes: string | null
          owner_id: string
          responsavel: string | null
          telefone: string | null
          updated_at: string
          valor_contratado: number
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          missao_id?: string | null
          nome: string
          observacoes?: string | null
          owner_id?: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          valor_contratado?: number
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          missao_id?: string | null
          nome?: string
          observacoes?: string | null
          owner_id?: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          valor_contratado?: number
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "fornecedores_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          alimentacao: number
          ativo: boolean
          cargo: string | null
          created_at: string
          custos_adicionais: number
          data_admissao: string | null
          empresa_id: string | null
          encargos_auto: boolean
          fgts: number
          id: string
          inss: number
          nome: string
          owner_id: string
          salario: number
          updated_at: string
          vale_transporte: number
        }
        Insert: {
          alimentacao?: number
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          custos_adicionais?: number
          data_admissao?: string | null
          empresa_id?: string | null
          encargos_auto?: boolean
          fgts?: number
          id?: string
          inss?: number
          nome: string
          owner_id?: string
          salario?: number
          updated_at?: string
          vale_transporte?: number
        }
        Update: {
          alimentacao?: number
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          custos_adicionais?: number
          data_admissao?: string | null
          empresa_id?: string | null
          encargos_auto?: boolean
          fgts?: number
          id?: string
          inss?: number
          nome?: string
          owner_id?: string
          salario?: number
          updated_at?: string
          vale_transporte?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      missoes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes_financeiras: {
        Row: {
          comprovante_path: string | null
          conta_bancaria_id: string
          created_at: string
          data_movimentacao: string
          descricao: string | null
          despesa_id: string | null
          forma_pagamento: string | null
          id: string
          observacao: string | null
          origem: string
          owner_id: string
          recebivel_id: string | null
          registro_pagamento_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          comprovante_path?: string | null
          conta_bancaria_id: string
          created_at?: string
          data_movimentacao?: string
          descricao?: string | null
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          owner_id?: string
          recebivel_id?: string | null
          registro_pagamento_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          comprovante_path?: string | null
          conta_bancaria_id?: string
          created_at?: string
          data_movimentacao?: string
          descricao?: string | null
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          owner_id?: string
          recebivel_id?: string | null
          registro_pagamento_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_recebivel_id_fkey"
            columns: ["recebivel_id"]
            isOneToOne: false
            referencedRelation: "recebiveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_registro_pagamento_id_fkey"
            columns: ["registro_pagamento_id"]
            isOneToOne: false
            referencedRelation: "registros_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      prestadores_mei: {
        Row: {
          ativo: boolean
          banco: string | null
          cnpj: string | null
          created_at: string
          documento: string | null
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          observacoes: string | null
          owner_id: string
          telefone: string | null
          updated_at: string
          valor_contratado: number
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          cnpj?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          owner_id?: string
          telefone?: string | null
          updated_at?: string
          valor_contratado?: number
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          cnpj?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          owner_id?: string
          telefone?: string | null
          updated_at?: string
          valor_contratado?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestadores_mei_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestadores_mei_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          email: string
          empresa_nome: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          empresa_nome?: string | null
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          empresa_nome?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recebiveis: {
        Row: {
          banco: string | null
          categoria: string | null
          contrato_id: string | null
          created_at: string
          data_recebimento: string | null
          data_vencimento: string | null
          empresa_id: string | null
          frequencia: string
          id: string
          missao_id: string | null
          numero_fatura: string | null
          numero_parcela: number
          observacoes: string | null
          owner_id: string
          pagador: string
          parcelas: number
          parent_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"]
          updated_at: string
          valor_pago: number
          valor_parcela: number
          valor_total: number
        }
        Insert: {
          banco?: string | null
          categoria?: string | null
          contrato_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_vencimento?: string | null
          empresa_id?: string | null
          frequencia?: string
          id?: string
          missao_id?: string | null
          numero_fatura?: string | null
          numero_parcela?: number
          observacoes?: string | null
          owner_id?: string
          pagador: string
          parcelas?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          updated_at?: string
          valor_pago?: number
          valor_parcela?: number
          valor_total?: number
        }
        Update: {
          banco?: string | null
          categoria?: string | null
          contrato_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_vencimento?: string | null
          empresa_id?: string | null
          frequencia?: string
          id?: string
          missao_id?: string | null
          numero_fatura?: string | null
          numero_parcela?: number
          observacoes?: string | null
          owner_id?: string
          pagador?: string
          parcelas?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          updated_at?: string
          valor_pago?: number
          valor_parcela?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebiveis_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebiveis_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_contrato"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "recebiveis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebiveis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "recebiveis_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebiveis_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "recebiveis"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_pagamento: {
        Row: {
          comprovante_path: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_pagamento: string
          despesa_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacao: string | null
          owner_id: string
          recebivel_id: string | null
          user_id: string | null
          valor: number
        }
        Insert: {
          comprovante_path?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string
          despesa_id?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacao?: string | null
          owner_id?: string
          recebivel_id?: string | null
          user_id?: string | null
          valor: number
        }
        Update: {
          comprovante_path?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string
          despesa_id?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacao?: string | null
          owner_id?: string
          recebivel_id?: string | null
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "registros_pagamento_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_pagamento_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_pagamento_recebivel_id_fkey"
            columns: ["recebivel_id"]
            isOneToOne: false
            referencedRelation: "recebiveis"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_sessions: {
        Row: {
          created_at: string
          last_seen_at: string
          session_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string
          session_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string
          session_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      fluxo_caixa_mensal: {
        Row: {
          empresa_id: string | null
          mes: string | null
          previsto_entradas: number | null
          previsto_saidas: number | null
          realizado_entradas: number | null
          realizado_saidas: number | null
        }
        Relationships: []
      }
      lucro_por_contrato: {
        Row: {
          cliente: string | null
          contrato_id: string | null
          despesa_prevista: number | null
          despesa_realizada: number | null
          empresa_id: string | null
          lucro_projetado: number | null
          lucro_realizado: number | null
          numero: string | null
          receita_prevista: number | null
          receita_realizada: number | null
          valor_contrato: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "lucro_por_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      lucro_por_empresa: {
        Row: {
          cor: string | null
          despesa_prevista: number | null
          despesa_realizada: number | null
          empresa_id: string | null
          lucro_projetado: number | null
          lucro_realizado: number | null
          nome: string | null
          receita_prevista: number | null
          receita_realizada: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_freq: {
        Args: { base_date: string; freq: string; n: number }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
      marcar_atrasados: { Args: never; Returns: undefined }
      saldo_conta_bancaria: { Args: { _conta_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "financeiro" | "viewer"
      categoria_despesa:
        | "impostos"
        | "funcionarios"
        | "aluguel"
        | "luz"
        | "condominio"
        | "telefone"
        | "parcelamento_simples"
        | "avulso"
        | "fornecedor"
        | "outros"
        | "prestador_mei"
        | "consolidadora"
      forma_pagamento:
        | "pix"
        | "transferencia"
        | "boleto"
        | "cartao"
        | "dinheiro"
        | "comissao"
      status_contrato:
        | "rascunho"
        | "ativo"
        | "concluido"
        | "cancelado"
        | "em_analise"
        | "aguardando_pagamento"
      status_financeiro:
        | "em_aberto"
        | "pago"
        | "atrasado"
        | "cancelado"
        | "parcial"
      status_generico: "ativo" | "inativo"
      tipo_servico_contrato:
        | "pacote_completo"
        | "so_aereo"
        | "so_hospedagem"
        | "personalizado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "financeiro", "viewer"],
      categoria_despesa: [
        "impostos",
        "funcionarios",
        "aluguel",
        "luz",
        "condominio",
        "telefone",
        "parcelamento_simples",
        "avulso",
        "fornecedor",
        "outros",
        "prestador_mei",
        "consolidadora",
      ],
      forma_pagamento: [
        "pix",
        "transferencia",
        "boleto",
        "cartao",
        "dinheiro",
        "comissao",
      ],
      status_contrato: [
        "rascunho",
        "ativo",
        "concluido",
        "cancelado",
        "em_analise",
        "aguardando_pagamento",
      ],
      status_financeiro: [
        "em_aberto",
        "pago",
        "atrasado",
        "cancelado",
        "parcial",
      ],
      status_generico: ["ativo", "inativo"],
      tipo_servico_contrato: [
        "pacote_completo",
        "so_aereo",
        "so_hospedagem",
        "personalizado",
      ],
    },
  },
} as const
