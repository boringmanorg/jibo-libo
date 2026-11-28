CREATE TABLE public.be_property_profiles (
  property_id text PRIMARY KEY,
  property_type text NOT NULL DEFAULT 'Hostel',
  display_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  google_place_id text,
  google_maps_uri text,
  google_rating numeric,
  google_review_count integer,
  google_reviews jsonb NOT NULL DEFAULT '[]'::jsonb,
  google_synced_at timestamptz,
  amenities text[] NOT NULL DEFAULT '{}',
  ota_presence text[] NOT NULL DEFAULT '{}',
  hidden_room_types text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT be_property_profiles_type CHECK (property_type IN ('Hotel','Homestay','Hostel','Motel','Camping'))
);
GRANT ALL ON public.be_property_profiles TO service_role;
ALTER TABLE public.be_property_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages property profiles" ON public.be_property_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.be_property_profiles (property_id, property_type, display_name, address) VALUES
 ('XTSY-SHL-HOSTEL','Hostel','XTSY Travellers Hostel','New Shillong Township, Meghalaya'),
 ('XTSY-SHN-CAMP','Camping','Shnonpedeng Riverside Camping by XTSY','Shnonpedeng, Meghalaya');