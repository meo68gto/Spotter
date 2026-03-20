-- Guest Orders Table
-- Stores orders for unauthenticated guest checkout

CREATE TABLE IF NOT EXISTS guest_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_session_id UUID NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES sponsor_events(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    stripe_payment_intent_id TEXT NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_guest_orders_session ON guest_orders(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_guest_orders_event ON guest_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_orders_status ON guest_orders(status);
CREATE INDEX IF NOT EXISTS idx_guest_orders_payment_intent ON guest_orders(stripe_payment_intent_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_guest_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_guest_orders_updated_at ON guest_orders;
CREATE TRIGGER trigger_guest_orders_updated_at
    BEFORE UPDATE ON guest_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_orders_updated_at();

-- RLS policies (guest orders are accessed via edge functions, not direct client access)
ALTER TABLE guest_orders ENABLE ROW LEVEL SECURITY;

-- No direct client access - all access via edge functions with service role
CREATE POLICY "No direct access" ON guest_orders
    FOR ALL
    USING (false);
