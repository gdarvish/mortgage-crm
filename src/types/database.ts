export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      advisor_settings: {
        Row: AdvisorSettings
        Insert: Partial<AdvisorSettings>
        Update: Partial<AdvisorSettings>
      }
      customers: {
        Row: Customer
        Insert: Partial<Customer>
        Update: Partial<Customer>
      }
      leads: {
        Row: Lead
        Insert: Partial<Lead>
        Update: Partial<Lead>
      }
      referral_partners: {
        Row: ReferralPartner
        Insert: Partial<ReferralPartner>
        Update: Partial<ReferralPartner>
      }
      documents: {
        Row: Document
        Insert: Partial<Document>
        Update: Partial<Document>
      }
      signatures: {
        Row: Signature
        Insert: Partial<Signature>
        Update: Partial<Signature>
      }
      mortgages: {
        Row: Mortgage
        Insert: Partial<Mortgage>
        Update: Partial<Mortgage>
      }
      loan_tracks: {
        Row: LoanTrack
        Insert: Partial<LoanTrack>
        Update: Partial<LoanTrack>
      }
      bank_responses: {
        Row: BankResponse
        Insert: Partial<BankResponse>
        Update: Partial<BankResponse>
      }
      alerts: {
        Row: Alert
        Insert: Partial<Alert>
        Update: Partial<Alert>
      }
      tasks: {
        Row: Task
        Insert: Partial<Task>
        Update: Partial<Task>
      }
      commissions: {
        Row: Commission
        Insert: Partial<Commission>
        Update: Partial<Commission>
      }
      interest_rates: {
        Row: InterestRate
        Insert: Partial<InterestRate>
        Update: Partial<InterestRate>
      }
      messages: {
        Row: Message
        Insert: Partial<Message>
        Update: Partial<Message>
      }
      cpi_index: {
        Row: CpiIndex
        Insert: Partial<CpiIndex>
        Update: Partial<CpiIndex>
      }
      obligations: {
        Row: Obligation
        Insert: Partial<Obligation>
        Update: Partial<Obligation>
      }
      appraisals: {
        Row: Appraisal
        Insert: Partial<Appraisal>
        Update: Partial<Appraisal>
      }
      bank_offers: {
        Row: BankOffer
        Insert: Partial<BankOffer>
        Update: Partial<BankOffer>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export interface AdvisorSettings {
  id: string
  name: string | null
  title: string | null
  license_number: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
  footer_text: string | null
  logo_size: string
  logo_position: string
  whatsapp_templates: Json | null
  alert_window_months: number
  dti_obligation_months_threshold?: number
  expected_annual_cpi?: number
  refinance_gap_threshold?: number
  created_at: string
}

export interface Customer {
  id: string
  user_id?: string | null
  first_name: string
  last_name: string
  id_number: string | null
  phone: string | null
  whatsapp_phone?: string | null
  email: string | null
  address: string | null
  marital_status: string | null
  children: number
  monthly_income: number | null
  partner_income: number | null
  own_capital: number | null
  existing_obligations: number
  lead_source: string | null
  status: CustomerStatus
  notes: string | null
  referral_partner_id: string | null
  questionnaire_token: string | null
  questionnaire_token_expires_at?: string | null
  questionnaire_completed: boolean
  employment_type?: string | null
  has_existing_property?: boolean | null
  existing_property_value?: number | null
  credit_card_frames?: number | null
  mortgage_purpose?: string | null
  requested_amount?: number | null
  portal_token?: string | null
  portal_token_expires_at?: string | null
  created_at: string
  updated_at: string
}

export type CustomerStatus = 'ליד' | 'פגישה' | 'מסמכים' | 'הגשה' | 'אישור' | 'סגירה'

export interface Lead {
  id: string
  user_id?: string | null
  name: string | null
  phone: string | null
  email: string | null
  source: string | null
  score: number
  status: LeadStatus
  notes: string | null
  referral_partner_id: string | null
  converted_to_customer_id?: string | null
  converted_at?: string | null
  created_at: string
}

export type LeadStatus = 'חדש' | 'יצירת קשר' | 'פגישה נקבעה' | 'הפך ללקוח' | 'נסגר'

export interface ReferralPartner {
  id: string
  name: string
  type: string | null
  phone: string | null
  email: string | null
  company: string | null
  total_referrals: number
  converted_referrals: number
  notes: string | null
  last_contact: string | null
  created_at: string
}

export interface Document {
  id: string
  customer_id: string
  type: string
  file_url: string | null
  file_name: string | null
  file_size: number | null
  status: DocumentStatus
  ocr_data: Json | null
  ocr_completed_at?: string | null
  expires_at: string | null
  uploaded_at: string
  category: DocumentCategory | null
}

export type DocumentStatus = 'תקין' | 'ממתין' | 'חסר' | 'פג תוקף'
export type DocumentCategory = 'זיהוי' | 'הכנסות' | 'חשבון_בנק' | 'נכס' | 'בנק_חוזר' | 'כללי'

export interface Signature {
  id: string
  customer_id: string
  document_type: string | null
  document_name?: string | null
  customer_name?: string | null
  signature_url: string | null
  signed_at: string | null
  signed_ip?: string | null
  signed_user_agent?: string | null
  signer_name?: string | null
  signer_id?: string | null
  token: string | null
  token_expires_at?: string | null
  status: 'ממתין' | 'נחתם'
}

export interface Mortgage {
  id: string
  customer_id: string
  type: MortgageType
  property_price: number | null
  property_type: PropertyType | null
  own_capital: number | null
  loan_amount: number | null
  status: MortgageStatus
  compliance_status: Json | null
  notes: string | null
  approval_date?: string | null
  approval_expires_at?: string | null
  created_at: string
}

export type MortgageType = 'חדשה' | 'מחזור' | 'איחוד'
export type PropertyType = 'דירה_ראשונה' | 'משפרי_דיור' | 'להשקעה'
export type MortgageStatus = 'טיוטה' | 'הוגש' | 'אושר' | 'נדחה' | 'נסגר'

export interface LoanTrack {
  id: string
  user_id: string
  mortgage_id: string
  type: LoanTrackType
  amount: number | null
  interest_rate: number | null
  period_months: number | null
  monthly_payment: number | null
  is_existing: boolean
  start_date: string | null
  end_date: string | null
  created_at: string
}

export type LoanTrackType = 'פריים' | 'קל"צ' | 'קל"ב' | 'משתנה_צמודה' | 'משתנה_לא_צמודה' | 'זכאות'

export interface BankResponse {
  id: string
  user_id: string
  mortgage_id: string
  bank_name: string | null
  response_type: string | null
  file_url: string | null
  notes: string | null
  response_date: string | null
  created_at: string
}

export interface Alert {
  id: string
  user_id: string
  customer_id: string
  loan_track_id: string | null
  mortgage_id?: string | null
  document_id?: string | null
  appraisal_id?: string | null
  disbursement_id?: string | null
  metadata?: Record<string, unknown> | null
  alert_type?: 'track_ending' | 'document_expiring' | 'approval_expiring' | 'appraisal_pending' | 'disbursement_due' | 'refinance_opportunity'
  alert_date: string | null
  days_until_end: number | null
  urgency?: 'דחוף' | 'אזהרה' | 'תקין'
  status: 'פתוח' | 'טופל' | 'נדחה'
  snoozed_until: string | null
  handled_at?: string | null
  track_type?: string | null
  track_amount?: number | null
  track_end_date?: string | null
  document_type?: string | null
  created_at: string
}

export interface Task {
  id: string
  customer_id: string | null
  title: string
  due_date: string | null
  priority: 'נמוכה' | 'בינונית' | 'גבוהה' | 'דחופה'
  status: 'פתוחה' | 'בתהליך' | 'הושלמה'
  notes: string | null
  created_at: string
}

export interface Commission {
  id: string
  customer_id: string
  mortgage_id: string | null
  amount: number | null
  status: 'ממתין' | 'שולם'
  payment_date: string | null
  notes: string | null
  created_at: string
}

export interface InterestRate {
  id: string
  track_type: string | null
  rate: number | null
  bank_name: string | null
  effective_date: string | null
  source: string | null
  created_at: string
}

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'received'

export interface Message {
  id: string
  customer_id: string
  channel: 'וואטסאפ' | 'אימייל' | 'SMS'
  direction: 'נשלח' | 'התקבל'
  content: string | null
  sent_at: string
  provider_message_id?: string | null
  delivery_status?: MessageDeliveryStatus | null
  read_at?: string | null
  template_id?: string | null
}

export interface CpiIndex {
  id: string
  date: string | null
  value: number | null
  change_percent: number | null
}

export type ObligationType =
  | 'הלוואה בנקאית' | 'הלוואה חוץ בנקאית' | 'ליסינג'
  | 'משכנתא קיימת' | 'מזונות' | 'אחר'

export interface Obligation {
  id: string
  user_id: string
  customer_id: string
  type: ObligationType
  lender: string | null              // name of the lending bank / institution
  monthly_payment: number            // monthly repayment — this is what enters DTI
  balance: number | null             // outstanding balance (display only)
  end_date: string | null            // ISO — loan end date
  include_in_dti: boolean            // auto-computed, manually overridable
  notes: string | null
  created_at: string
}

export interface BankOfferTrack {
  type: LoanTrackType
  amount: number
  interest_rate: number
  period_months: number
}

export interface BankOffer {
  id: string
  user_id: string
  customer_id: string
  mortgage_id: string
  bank_name: string
  round: number                      // negotiation round: 1 = first offer, 2 = improved...
  offer_date: string | null
  valid_until: string | null
  tracks: BankOfferTrack[]           // embedded array — stored together
  status: 'התקבלה' | 'נבחרה' | 'נדחתה'
  bank_response_id: string | null    // optional link to a file in bank_responses
  notes: string | null
  created_at: string
}

export type AppraisalStatus = 'הוזמנה' | 'בוצע ביקור' | 'התקבלה'

export interface Appraisal {
  id: string
  user_id: string
  customer_id: string
  mortgage_id: string | null
  property_address: string | null
  appraiser_name: string | null
  appraiser_phone: string | null
  status: AppraisalStatus
  ordered_at: string | null          // ISO
  scheduled_at: string | null        // appraiser visit
  received_at: string | null         // report received
  purchase_price: number | null      // snapshot of purchase price at order time
  appraised_value: number | null
  document_id: string | null         // link to the uploaded appraisal report
  notes: string | null
  created_at: string
}

// Extended types with relations
export interface CustomerWithRelations extends Customer {
  documents?: Document[]
  mortgages?: MortgageWithTracks[]
  tasks?: Task[]
  messages?: Message[]
  commissions?: Commission[]
  referral_partner?: ReferralPartner | null
}

export interface MortgageWithTracks extends Mortgage {
  loan_tracks?: LoanTrack[]
  bank_responses?: BankResponse[]
}

export interface AlertWithCustomer extends Alert {
  customer?: Customer
  loan_track?: LoanTrack
}

export type ActivityEventType =
  | 'customer_created'
  | 'status_changed'
  | 'document_uploaded'
  | 'mortgage_created'
  | 'signature_received'
  | 'commission_paid'

export interface ActivityEvent {
  id: string
  user_id: string
  event_type: ActivityEventType
  entity_type: 'customer' | 'lead' | 'document' | 'mortgage' | 'signature' | 'commission'
  entity_id: string
  entity_name: string
  description: string
  metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogEntry {
  id: string
  user_id: string | null
  entity_type: 'customer' | 'lead' | 'mortgage' | 'document'
  entity_id: string
  changes: Record<string, { from: unknown; to: unknown }>
  changed_fields: string[]
  changed_at: string
}
