ALTER TABLE public.be_self_check_ins
  ADD COLUMN IF NOT EXISTS check_out_date date,
  ADD COLUMN IF NOT EXISTS allocated_room_type_id text,
  ADD COLUMN IF NOT EXISTS allocated_units text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allocation_override_id uuid,
  ADD COLUMN IF NOT EXISTS allocated_at timestamptz;