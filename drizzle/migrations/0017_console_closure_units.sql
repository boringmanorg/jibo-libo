-- Console blocks can close part of a room type: e.g. 3 of the 8 beds in a dorm.
-- NULL keeps the old meaning: every bed or room of that type is closed.
ALTER TABLE public.console_inventory_overrides
  ADD COLUMN IF NOT EXISTS units integer CHECK (units IS NULL OR units BETWEEN 1 AND 50);
