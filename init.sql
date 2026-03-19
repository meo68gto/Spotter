-- Spotter Local PostgreSQL Schema
-- Matches Supabase structure for local development

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Engagement requests for moderation
CREATE TABLE IF NOT EXISTS engagement_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    engagement_mode VARCHAR(50) NOT NULL CHECK (engagement_mode IN ('text_answer', 'video_answer', 'video_call')),
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    public_opt_in BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Review orders for payments
CREATE TABLE IF NOT EXISTS review_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'requires_payment_method', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    authorization_expires_at TIMESTAMPTZ,
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refund requests for disputes
CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_order_id UUID NOT NULL REFERENCES review_orders(id),
    requester_user_id UUID NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reschedule requests for disputes
CREATE TABLE IF NOT EXISTS reschedule_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_request_id UUID NOT NULL REFERENCES engagement_requests(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    declined_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert sample data for testing
INSERT INTO engagement_requests (id, question_text, engagement_mode, moderation_status, public_opt_in, created_at) VALUES
    ('00000000-0000-0000-0000-000000000001', 'How do I improve my golf swing for better distance?', 'video_answer', 'pending', true, NOW() - INTERVAL '1 hour'),
    ('00000000-0000-0000-0000-000000000002', 'What are the best drills for bunker shots?', 'text_answer', 'pending', true, NOW() - INTERVAL '1 day'),
    ('00000000-0000-0000-0000-000000000003', 'Can you analyze my putting stroke?', 'video_call', 'pending', true, NOW() - INTERVAL '2 days'),
    ('00000000-0000-0000-0000-000000000004', 'Tips for driving accuracy?', 'text_answer', 'approved', true, NOW() - INTERVAL '3 days'),
    ('00000000-0000-0000-0000-000000000005', 'How to read greens better?', 'video_answer', 'rejected', true, NOW() - INTERVAL '4 days');

INSERT INTO review_orders (id, status, amount_cents, currency, authorization_expires_at, stripe_payment_intent_id, created_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'paid', 5000, 'usd', NULL, 'pi_1234567890', NOW() - INTERVAL '1 hour'),
    ('11111111-1111-1111-1111-111111111112', 'failed', 3000, 'usd', NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '1 day'),
    ('11111111-1111-1111-1111-111111111113', 'requires_payment_method', 7500, 'usd', NOW() + INTERVAL '2 days', NULL, NOW() - INTERVAL '2 days'),
    ('11111111-1111-1111-1111-111111111114', 'refunded', 2500, 'usd', NULL, 'pi_0987654321', NOW() - INTERVAL '3 days'),
    ('11111111-1111-1111-1111-111111111115', 'processing', 10000, 'usd', NOW() + INTERVAL '3 days', 'pi_processing123', NOW() - INTERVAL '30 minutes');

INSERT INTO refund_requests (id, review_order_id, requester_user_id, reason, status, created_at) VALUES
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111114', '33333333-3333-3333-3333-333333333333', 'Service not delivered', 'pending', NOW() - INTERVAL '2 hours'),
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111112', '33333333-3333-3333-3333-333333333334', 'Coach did not show up', 'approved', NOW() - INTERVAL '1 day');

INSERT INTO reschedule_requests (id, engagement_request_id, status, declined_reason, created_at) VALUES
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000004', 'declined', 'Coach unavailable at requested time', NOW() - INTERVAL '2 days'),
    ('44444444-4444-4444-4444-444444444445', '00000000-0000-0000-0000-000000000005', 'declined', 'No coaches available for that sport', NOW() - INTERVAL '3 days');

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_engagement_requests_moderation ON engagement_requests(moderation_status, public_opt_in);
CREATE INDEX IF NOT EXISTS idx_engagement_requests_created ON engagement_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_orders_status ON review_orders(status);
CREATE INDEX IF NOT EXISTS idx_review_orders_created ON review_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_status ON reschedule_requests(status);
