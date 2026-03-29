-- ============================================================================
-- Fox Phase 5B: Pairings, Vendors & Upsells
-- Tables: flights, flight_players, vendors, upsells, upsell_purchases
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- Flights (tee times / groupings for a tournament round)
CREATE TABLE IF NOT EXISTS public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.organizer_events(id) ON DELETE CASCADE,
  flight_name text NOT NULL,
  tee_time timestamptz NOT NULL,
  starting_hole integer DEFAULT 1,
  course_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flights_tournament_id ON public.flights(tournament_id);
CREATE INDEX IF NOT EXISTS idx_flights_tee_time ON public.flights(tee_time);

-- Flight players (junction: players assigned to a flight)
CREATE TABLE IF NOT EXISTS public.flight_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,  -- position in flight (1=first, 2=second, etc.)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flight_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_flight_players_flight_id ON public.flight_players(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_players_player_id ON public.flight_players(player_id);

-- Vendors (sponsors / vendors at a tournament)
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.organizer_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  logo_url text,
  website_url text,
  booth_location text,
  contact_email text,
  contact_phone text,
  tier text DEFAULT 'standard',  -- 'standard', 'featured', 'title'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_tournament_id ON public.vendors(tournament_id);

-- Upsells (optional add-ons purchasable at tournament)
CREATE TABLE IF NOT EXISTS public.upsells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.organizer_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  max_quantity integer,
  sold_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsells_tournament_id ON public.upsells(tournament_id);

-- Upsell purchases (which players bought which upsells)
CREATE TABLE IF NOT EXISTS public.upsell_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upsell_id uuid NOT NULL REFERENCES public.upsells(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.organizer_events(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  total_cents integer NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsell_purchases_upsell_id ON public.upsell_purchases(upsell_id);
CREATE INDEX IF NOT EXISTS idx_upsell_purchases_player_id ON public.upsell_purchases(player_id);
CREATE INDEX IF NOT EXISTS idx_upsell_purchases_tournament_id ON public.upsell_purchases(tournament_id);

-- RLS for all new tables
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsell_purchases ENABLE ROW LEVEL SECURITY;

-- Flights RLS
CREATE POLICY "Operators can manage flights for their tournaments"
  ON public.flights
  FOR ALL
  USING (
    tournament_id IN (
      SELECT id FROM public.organizer_events
      WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
    )
  )
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM public.organizer_events
      WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
    )
  );

-- Flight players RLS
CREATE POLICY "Operators can manage flight players for their tournaments"
  ON public.flight_players
  FOR ALL
  USING (
    flight_id IN (
      SELECT f.id FROM public.flights f
      WHERE f.tournament_id IN (
        SELECT id FROM public.organizer_events
        WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
      )
    )
  )
  WITH CHECK (
    flight_id IN (
      SELECT f.id FROM public.flights f
      WHERE f.tournament_id IN (
        SELECT id FROM public.organizer_events
        WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
      )
    )
  );

-- Vendors RLS
CREATE POLICY "Operators can manage vendors for their tournaments"
  ON public.vendors
  FOR ALL
  USING (
    tournament_id IN (
      SELECT id FROM public.organizer_events
      WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
    )
  )
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM public.organizer_events
      WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
    )
  );

-- Upsells RLS
CREATE POLICY "Operators can manage upsells for their tournaments"
  ON public.upsells
  FOR ALL
  USING (
    tournament_id IN (
      SELECT id FROM public.organizer_events
      WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
    )
  )
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM public.organizer_events
      WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
    )
  );

-- Upsell purchases RLS
CREATE POLICY "Operators can view upsell purchases for their tournaments"
  ON public.upsell_purchases
  FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.organizer_events
      WHERE organizer_id = current_setting('app.organizer_id', true)::uuid
    )
  );

-- ============================================
-- DOWN MIGRATION
-- ============================================

DROP POLICY IF EXISTS "Operators can manage flights for their tournaments" ON public.flights;
DROP POLICY IF EXISTS "Operators can manage flight players for their tournaments" ON public.flight_players;
DROP POLICY IF EXISTS "Operators can manage vendors for their tournaments" ON public.vendors;
DROP POLICY IF EXISTS "Operators can manage upsells for their tournaments" ON public.upsells;
DROP POLICY IF EXISTS "Operators can view upsell purchases for their tournaments" ON public.upsell_purchases;

DROP TABLE IF EXISTS public.upsell_purchases;
DROP TABLE IF EXISTS public.upsells;
DROP TABLE IF EXISTS public.vendors;
DROP TABLE IF EXISTS public.flight_players;
DROP TABLE IF EXISTS public.flights;
