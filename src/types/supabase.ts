// Generated types from Supabase
// TODO: Generate these types using: npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          nit: string | null
          legal_name: string | null
          address: string | null
          city: string | null
          department: string | null
          phone: string | null
          email: string | null
          fiscal_regime: string
          logo_url: string | null
          dian_resolution: string | null
          is_active: boolean
          subscription_period: '3_months' | '6_months' | '1_year'
          subscription_start: string
          subscription_end: string | null
          subscription_status: 'pending' | 'active' | 'expired' | 'suspended'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      company_users: {
        Row: {
          id: string
          user_id: string
          company_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          role?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['company_users']['Insert']>
      }
      customers: {
        Row: {
          id: string
          company_id: string
          name: string
          doc_type: 'CC' | 'NIT' | 'CE' | 'PA' | 'TI' | 'RC' | 'TE' | 'PEP'
          doc_number: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          department: string | null
          fiscal_regime: 'iva' | 'no_iva' | 'gran_contribuyente'
          payment_type: string | null
          credit_days: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'company_id'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      categories: {
        Row: {
          id: string
          company_id: string
          name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      products: {
        Row: {
          id: string
          company_id: string
          category_id: string | null
          name: string
          sku: string | null
          description: string | null
          price: number
          stock: number
          tax_type: 'iva' | 'excluded' | 'exempt' | 'no_tax'
          tax_rate: number
          is_taxable: boolean
          unit: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      quotes: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          quote_number: string
          issue_date: string
          expiry_date: string | null
          subtotal: number
          tax: number
          total: number
          status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'quote_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          discount: number
          tax_rate: number
          subtotal: number
          tax: number
          total: number
        }
        Insert: Omit<Database['public']['Tables']['quote_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['quote_items']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          quote_id: string | null
          invoice_number: string
          issue_date: string
          due_date: string | null
          subtotal: number
          tax: number
          total: number
          balance_due: number
          document_type: 'invoice' | 'ticket'
          dian_status: 'not_applicable' | 'pending' | 'accepted' | 'rejected'
          cufe: string | null
          status: 'draft' | 'issued' | 'cancelled'
          payment_status: 'unpaid' | 'partial' | 'paid'
          notes: string | null
          created_by: string | null
          issued_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'invoice_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          discount: number
          tax_rate: number
          subtotal: number
          tax: number
          total: number
        }
        Insert: Omit<Database['public']['Tables']['invoice_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>
      }
      inventory_movements: {
        Row: {
          id: string
          company_id: string
          product_id: string
          movement_type: 'sale' | 'purchase' | 'adjustment' | 'return'
          quantity: number
          reference_type: string | null
          reference_id: string | null
          notes: string | null
          created_at: string
          created_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>
      }
      payment_methods: {
        Row: {
          id: string
          company_id: string
          name: string
          type: 'cash' | 'transfer' | 'card' | 'check' | 'other'
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payment_methods']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payment_methods']['Insert']>
      }
      receipts: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          invoice_id: string
          receipt_number: string
          total_amount: number
          amount_paid: number
          balance: number
          status: 'pending' | 'partial' | 'paid' | 'cancelled'
          due_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['receipts']['Row'], 'id' | 'receipt_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['receipts']['Insert']>
      }
      receipt_payments: {
        Row: {
          id: string
          receipt_id: string
          payment_method_id: string
          amount: number
          payment_date: string
          reference: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['receipt_payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['receipt_payments']['Insert']>
      }
      returns: {
        Row: {
          id: string
          company_id: string
          invoice_id: string
          return_number: string
          return_date: string
          reason: string | null
          total: number
          status: 'draft' | 'processed'
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['returns']['Row'], 'id' | 'return_number' | 'created_at'>
        Update: Partial<Database['public']['Tables']['returns']['Insert']>
      }
      accounts_receivable: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          invoice_id: string | null
          original_amount: number
          balance: number
          due_date: string | null
          status: 'pending' | 'paid' | 'overdue' | 'cancelled'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['accounts_receivable']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['accounts_receivable']['Insert']>
      }

      // ── Nuevas tablas para el sistema de módulos y superadmin ──────────────

      company_modules: {
        Row: {
          id: string
          company_id: string
          /** ID del módulo. Coincide con ModuleId en src/config/modules.ts */
          module_id: string
          is_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          company_id: string
          module_id: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['company_modules']['Insert']>
      }

      superadmins: {
        Row: {
          user_id: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          user_id: string
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['superadmins']['Insert']>
      }
    }
    // Campos requeridos por @supabase/supabase-js createClient<Database>
    // para que la inferencia de tipos funcione correctamente
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
