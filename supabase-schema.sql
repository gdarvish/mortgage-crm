-- MortgageCRM Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Advisor Settings
CREATE TABLE advisor_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  license_number TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1a4f8a',
  secondary_color TEXT DEFAULT '#e8f0fe',
  footer_text TEXT,
  logo_size TEXT DEFAULT 'medium',
  logo_position TEXT DEFAULT 'right',
  whatsapp_templates JSONB,
  alert_window_months INTEGER DEFAULT 6,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Referral Partners (must be created before customers due to FK)
CREATE TABLE referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  phone TEXT,
  email TEXT,
  company TEXT,
  total_referrals INTEGER DEFAULT 0,
  converted_referrals INTEGER DEFAULT 0,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  marital_status TEXT,
  children INTEGER DEFAULT 0,
  monthly_income NUMERIC,
  partner_income NUMERIC,
  own_capital NUMERIC,
  existing_obligations NUMERIC DEFAULT 0,
  lead_source TEXT,
  status TEXT DEFAULT 'ליד',
  notes TEXT,
  referral_partner_id UUID REFERENCES referral_partners(id),
  questionnaire_token TEXT UNIQUE,
  questionnaire_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'חדש',
  notes TEXT,
  referral_partner_id UUID REFERENCES referral_partners(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'ממתין',
  ocr_data JSONB,
  expires_at DATE,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  category TEXT
);

-- Signatures
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  document_type TEXT,
  signature_url TEXT,
  signed_at TIMESTAMPTZ,
  token TEXT UNIQUE,
  status TEXT DEFAULT 'ממתין'
);

-- Mortgages
CREATE TABLE mortgages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'חדשה',
  property_price NUMERIC,
  property_type TEXT,
  own_capital NUMERIC,
  loan_amount NUMERIC,
  status TEXT DEFAULT 'טיוטה',
  compliance_status JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Loan Tracks
CREATE TABLE loan_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mortgage_id UUID REFERENCES mortgages(id) ON DELETE CASCADE,
  type TEXT,
  amount NUMERIC,
  interest_rate NUMERIC,
  period_months INTEGER,
  monthly_payment NUMERIC,
  is_existing BOOLEAN DEFAULT false,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bank Responses
CREATE TABLE bank_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mortgage_id UUID REFERENCES mortgages(id) ON DELETE CASCADE,
  bank_name TEXT,
  response_type TEXT,
  file_url TEXT,
  notes TEXT,
  response_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  loan_track_id UUID REFERENCES loan_tracks(id),
  alert_date DATE,
  days_until_end INTEGER,
  status TEXT DEFAULT 'פתוח',
  snoozed_until DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'בינונית',
  status TEXT DEFAULT 'פתוחה',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Commissions
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  mortgage_id UUID REFERENCES mortgages(id),
  amount NUMERIC,
  status TEXT DEFAULT 'ממתין',
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Interest Rates
CREATE TABLE interest_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_type TEXT,
  rate NUMERIC,
  bank_name TEXT,
  effective_date DATE,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT,
  direction TEXT,
  content TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- CPI Index
CREATE TABLE cpi_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE,
  value NUMERIC,
  change_percent NUMERIC
);

-- Row Level Security Policies
ALTER TABLE advisor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE mortgages ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpi_index ENABLE ROW LEVEL SECURITY;

-- RLS Policies for advisor_settings
CREATE POLICY "Users can view own settings" ON advisor_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON advisor_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON advisor_settings FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for customers
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for leads
CREATE POLICY "Users can view own leads" ON leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leads" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON leads FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for referral_partners
CREATE POLICY "Users can view own partners" ON referral_partners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own partners" ON referral_partners FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own partners" ON referral_partners FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own partners" ON referral_partners FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for documents (via customer ownership)
CREATE POLICY "Users can view own documents" ON documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = documents.customer_id AND customers.user_id = auth.uid()));
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM customers WHERE customers.id = documents.customer_id AND customers.user_id = auth.uid()));
CREATE POLICY "Users can update own documents" ON documents FOR UPDATE
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = documents.customer_id AND customers.user_id = auth.uid()));
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = documents.customer_id AND customers.user_id = auth.uid()));

-- Public access for questionnaire/signature (token-based)
CREATE POLICY "Public can view customer by questionnaire token" ON customers FOR SELECT
  USING (questionnaire_token IS NOT NULL);
CREATE POLICY "Public can update customer by questionnaire token" ON customers FOR UPDATE
  USING (questionnaire_token IS NOT NULL);

CREATE POLICY "Public can view signatures by token" ON signatures FOR SELECT
  USING (token IS NOT NULL);
CREATE POLICY "Public can update signatures by token" ON signatures FOR UPDATE
  USING (token IS NOT NULL);

-- RLS for mortgages (via customer)
CREATE POLICY "Users can manage own mortgages" ON mortgages FOR ALL
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = mortgages.customer_id AND customers.user_id = auth.uid()));

-- RLS for loan_tracks (via mortgage -> customer)
CREATE POLICY "Users can manage own loan tracks" ON loan_tracks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM mortgages
    JOIN customers ON customers.id = mortgages.customer_id
    WHERE mortgages.id = loan_tracks.mortgage_id AND customers.user_id = auth.uid()
  ));

-- RLS for bank_responses
CREATE POLICY "Users can manage own bank responses" ON bank_responses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM mortgages
    JOIN customers ON customers.id = mortgages.customer_id
    WHERE mortgages.id = bank_responses.mortgage_id AND customers.user_id = auth.uid()
  ));

-- RLS for alerts
CREATE POLICY "Users can manage own alerts" ON alerts FOR ALL
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = alerts.customer_id AND customers.user_id = auth.uid()));

-- RLS for tasks
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- RLS for commissions
CREATE POLICY "Users can manage own commissions" ON commissions FOR ALL
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = commissions.customer_id AND customers.user_id = auth.uid()));

-- RLS for interest_rates (public read, admin write)
CREATE POLICY "Anyone can view interest rates" ON interest_rates FOR SELECT USING (true);
CREATE POLICY "Auth users can manage rates" ON interest_rates FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS for messages
CREATE POLICY "Users can manage own messages" ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = messages.customer_id AND customers.user_id = auth.uid()));

-- RLS for CPI (public read)
CREATE POLICY "Anyone can view CPI" ON cpi_index FOR SELECT USING (true);
CREATE POLICY "Auth users can manage CPI" ON cpi_index FOR ALL USING (auth.uid() IS NOT NULL);

-- Updated_at trigger for customers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);

-- Storage policies
CREATE POLICY "Auth users can upload documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can view documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can manage logos" ON storage.objects FOR ALL
  USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can manage signatures" ON storage.objects FOR ALL
  USING (bucket_id = 'signatures' AND auth.uid() IS NOT NULL);
