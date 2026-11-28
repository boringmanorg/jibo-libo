ALTER TABLE public.be_self_check_ins
  ADD COLUMN IF NOT EXISTS form_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_time time,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS selfie_path text,
  ADD COLUMN IF NOT EXISTS guest_documents jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS be_self_check_ins_property_date_idx ON public.be_self_check_ins (property_id, check_in_date DESC);