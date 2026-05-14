export type EncryptionMethod = "pbkdf2-aes-gcm" | "nip44"

export type PaymentFrequency = "monthly" | "weekly" | "custom"

export type PaymentStatus =
  | "pending"
  | "tentative_created"
  | "funding_issued"
  | "invoice_paid"
  | "confirmed"
  | "failed"
  | "timeout"

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          salt: string
          nostr_pubkey: string | null
          prefers_nostr_auth: boolean
          created_at: string
        }
        Insert: {
          id: string
          salt: string
          nostr_pubkey?: string | null
          prefers_nostr_auth?: boolean
          created_at?: string
        }
        Update: {
          salt?: string
          nostr_pubkey?: string | null
          prefers_nostr_auth?: boolean
        }
      }
      wapu_credentials: {
        Row: {
          user_id: string
          encrypted_api_token: string
          encryption_method: EncryptionMethod
          updated_at: string
        }
        Insert: {
          user_id: string
          encrypted_api_token: string
          encryption_method: EncryptionMethod
          updated_at?: string
        }
        Update: {
          encrypted_api_token?: string
          encryption_method?: EncryptionMethod
          updated_at?: string
        }
      }
      nwc_connections: {
        Row: {
          id: string
          user_id: string
          label: string
          encrypted_connection_string: string
          encryption_method: EncryptionMethod
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label: string
          encrypted_connection_string: string
          encryption_method: EncryptionMethod
          created_at?: string
        }
        Update: {
          label?: string
          encrypted_connection_string?: string
          encryption_method?: EncryptionMethod
        }
      }
      contacts_cache: {
        Row: {
          id: string
          user_id: string
          wapu_contact_id: string
          alias: string
          receiver_name: string | null
          kind: string | null
          is_favourite: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          wapu_contact_id: string
          alias: string
          receiver_name?: string | null
          kind?: string | null
          is_favourite?: boolean
          updated_at?: string
        }
        Update: {
          alias?: string
          receiver_name?: string | null
          kind?: string | null
          is_favourite?: boolean
          updated_at?: string
        }
      }
      scheduled_payments: {
        Row: {
          id: string
          user_id: string
          contact_alias: string
          receiver_name: string | null
          amount_ars: number
          frequency: PaymentFrequency
          day_of_month: number | null
          weekday: number | null
          next_run: string | null
          paused: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_alias: string
          receiver_name?: string | null
          amount_ars: number
          frequency: PaymentFrequency
          day_of_month?: number | null
          weekday?: number | null
          next_run?: string | null
          paused?: boolean
          created_at?: string
        }
        Update: {
          contact_alias?: string
          receiver_name?: string | null
          amount_ars?: number
          frequency?: PaymentFrequency
          day_of_month?: number | null
          weekday?: number | null
          next_run?: string | null
          paused?: boolean
        }
      }
      payment_runs: {
        Row: {
          id: string
          scheduled_payment_id: string
          user_id: string
          status: PaymentStatus
          tentative_uuid: string | null
          wapu_tx_id: string | null
          invoice_bolt11: string | null
          sats_paid_estimate: number | null
          ars_amount: number
          started_at: string
          confirmed_at: string | null
          error_message: string | null
          raw_wapu_response: unknown | null
        }
        Insert: {
          id?: string
          scheduled_payment_id: string
          user_id: string
          status?: PaymentStatus
          tentative_uuid?: string | null
          wapu_tx_id?: string | null
          invoice_bolt11?: string | null
          sats_paid_estimate?: number | null
          ars_amount: number
          started_at?: string
          confirmed_at?: string | null
          error_message?: string | null
          raw_wapu_response?: unknown | null
        }
        Update: {
          status?: PaymentStatus
          tentative_uuid?: string | null
          wapu_tx_id?: string | null
          invoice_bolt11?: string | null
          sats_paid_estimate?: number | null
          confirmed_at?: string | null
          error_message?: string | null
          raw_wapu_response?: unknown | null
        }
      }
    }
  }
}
