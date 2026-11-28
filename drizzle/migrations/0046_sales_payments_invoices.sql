CREATE TABLE public.be_sales_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.be_enquiries(id) ON DELETE CASCADE,
  property_id text NOT NULL,
  amount_rupees numeric(12,2) NOT NULL CHECK (amount_rupees > 0 AND amount_rupees <= 10000000),
  method text NOT NULL CHECK (method IN ('cash','upi','card','bank_transfer','other')),
  paid_on date NOT NULL,
  note text CHECK (char_length(note) <= 300),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX be_sales_payments_enquiry_idx ON public.be_sales_payments(enquiry_id);
GRANT SELECT, INSERT, DELETE ON public.be_sales_payments TO authenticated;
GRANT ALL ON public.be_sales_payments TO service_role;
ALTER TABLE public.be_sales_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_sales_payments_select ON public.be_sales_payments FOR SELECT TO authenticated USING ((SELECT public.be_can_manage_property(property_id)));
CREATE POLICY be_sales_payments_insert ON public.be_sales_payments FOR INSERT TO authenticated WITH CHECK ((SELECT public.be_can_manage_property(property_id)));
CREATE POLICY be_sales_payments_delete ON public.be_sales_payments FOR DELETE TO authenticated USING ((SELECT public.be_can_manage_property(property_id)));

CREATE TABLE public.be_sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL UNIQUE REFERENCES public.be_enquiries(id) ON DELETE RESTRICT,
  property_id text NOT NULL,
  kind text NOT NULL,
  fy text NOT NULL,
  seq integer NOT NULL,
  number text NOT NULL UNIQUE,
  folio jsonb NOT NULL,
  business_snapshot jsonb NOT NULL,
  total_rupees numeric(12,2) NOT NULL,
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.be_sales_invoices TO authenticated;
GRANT ALL ON public.be_sales_invoices TO service_role;
ALTER TABLE public.be_sales_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_sales_invoices_select ON public.be_sales_invoices FOR SELECT TO authenticated USING ((SELECT public.be_can_manage_property(property_id)));
CREATE POLICY be_sales_invoices_insert ON public.be_sales_invoices FOR INSERT TO authenticated WITH CHECK ((SELECT public.be_can_manage_property(property_id)));