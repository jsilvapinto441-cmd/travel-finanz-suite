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
      anexos: {
        Row: {
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          mime: string | null
          nome: string
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
          path?: string
          tamanho?: number | null
          user_id?: string | null
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
          missao_id: string | null
          num_passageiros: number | null
          numero: string | null
          observacoes: string | null
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
          missao_id?: string | null
          num_passageiros?: number | null
          numero?: string | null
          observacoes?: string | null
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
          missao_id?: string | null
          num_passageiros?: number | null
          numero?: string | null
          observacoes?: string | null
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
      despesas: {
        Row: {
          banco: string | null
          categoria: Database["public"]["Enums"]["categoria_despesa"]
          contrato_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          empresa_id: string | null
          fornecedor_id: string | null
          frequencia: string
          id: string
          missao_id: string | null
          numero_parcela: number
          observacoes: string | null
          parcelas: number
          parent_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"]
          updated_at: string
          valor: number
          valor_pago: number
        }
        Insert: {
          banco?: string | null
          categoria?: Database["public"]["Enums"]["categoria_despesa"]
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          frequencia?: string
          id?: string
          missao_id?: string | null
          numero_parcela?: number
          observacoes?: string | null
          parcelas?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          updated_at?: string
          valor?: number
          valor_pago?: number
        }
        Update: {
          banco?: string | null
          categoria?: Database["public"]["Enums"]["categoria_despesa"]
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          frequencia?: string
          id?: string
          missao_id?: string | null
          numero_parcela?: number
          observacoes?: string | null
          parcelas?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          updated_at?: string
          valor?: number
          valor_pago?: number
        }
        Relationships: [
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
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          cor: string | null
          created_at: string
          id: string
          nome: string
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      funcionarios: {
        Row: {
          alimentacao: number
          ativo: boolean
          cargo: string | null
          created_at: string
          custos_adicionais: number
          empresa_id: string | null
          fgts: number
          id: string
          inss: number
          nome: string
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
          empresa_id?: string | null
          fgts?: number
          id?: string
          inss?: number
          nome: string
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
          empresa_id?: string | null
          fgts?: number
          id?: string
          inss?: number
          nome?: string
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
          status: Database["public"]["Enums"]["status_generico"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_generico"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_generico"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
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
          created_at: string
          data_pagamento: string
          despesa_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacao: string | null
          recebivel_id: string | null
          user_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string
          despesa_id?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacao?: string | null
          recebivel_id?: string | null
          user_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          despesa_id?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacao?: string | null
          recebivel_id?: string | null
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "registros_pagamento_recebivel_id_fkey"
            columns: ["recebivel_id"]
            isOneToOne: false
            referencedRelation: "recebiveis"
            referencedColumns: ["id"]
          },
        ]
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
      forma_pagamento:
        | "pix"
        | "transferencia"
        | "boleto"
        | "cartao"
        | "dinheiro"
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
      ],
      forma_pagamento: ["pix", "transferencia", "boleto", "cartao", "dinheiro"],
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
