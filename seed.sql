-- seed.sql — synthetic test data for schema.sql (PostgreSQL 15)
-- Fictional entities only. Run after schema.sql, against an empty database.
--
-- Coverage:
--   client        — all three statuses
--   product       — all six types, one per type
--   rate          — all six rate_types, a two-row price history, and a
--                   three-band tiered product
--   usage_record  — 8 metered rows spanning clients/products/sources
--   deal_event    — 5 lifecycle events
--   change_log    — populated by log_change(); 2 UPDATEs and 1 DELETE at the end
--                   record before/after images.

BEGIN;

-- ---------------------------------------------------------------------------
-- client
-- ---------------------------------------------------------------------------
INSERT INTO client (id, name, external_ref, status, currency, metadata) VALUES
    ('c1000000-0000-4000-8000-000000000001', 'Northwind Testing Co',   'EXT-CLI-001', 'active',    'USD',
     '{"segment": "mid-market", "region": "us-west"}'),
    ('c1000000-0000-4000-8000-000000000002', 'Blue Harbor Fixtures',   'EXT-CLI-002', 'suspended', 'USD',
     '{"segment": "smb", "region": "us-east", "suspend_reason": "payment_hold"}'),
    ('c1000000-0000-4000-8000-000000000003', 'Quiet Meadow Holdings',  'EXT-CLI-003', 'churned',   'EUR',
     '{"segment": "enterprise", "region": "eu-central", "churn_reason": "budget"}');

-- ---------------------------------------------------------------------------
-- product — one row per product type
-- ---------------------------------------------------------------------------
INSERT INTO product (id, code, name, type, unit, is_active, metadata) VALUES
    ('b2000000-0000-4000-8000-000000000001', 'CORE-PLAT',  'Core Platform Plan',   'subscription', 'month',   true,
     '{"billing_cycle": "monthly"}'),
    ('b2000000-0000-4000-8000-000000000002', 'API-CALLS',  'Metered API Calls',    'usage',        'call',    true,
     '{"meter": "api.requests"}'),
    ('b2000000-0000-4000-8000-000000000003', 'ONBOARD-FEE','One-Time Onboarding',  'one_time',     'each',    true,
     '{"refundable": false}'),
    ('b2000000-0000-4000-8000-000000000004', 'SEAT-ADDON', 'Extra Seat Add-On',    'addon',        'seat',    true,
     '{"min_seats": 1}'),
    ('b2000000-0000-4000-8000-000000000005', 'PRO-SVC',    'Professional Services','service',      'hour',    true,
     '{"delivery": "remote"}'),
    ('b2000000-0000-4000-8000-000000000006', 'START-BNDL', 'Starter Bundle',       'bundle',       'bundle',  false,
     '{"includes": ["CORE-PLAT", "SEAT-ADDON"]}');

-- ---------------------------------------------------------------------------
-- rate — all six rate_types; API-CALLS carries a two-period price history and
-- SEAT-ADDON carries three concurrent quantity bands. The rate_no_overlap
-- exclusion constraint keeps bands disjoint per product and date range.
-- ---------------------------------------------------------------------------
INSERT INTO rate (id, product_id, rate_type, unit_amount, tier_from, tier_to, currency, effective_from, effective_to) VALUES
    -- flat: fixed monthly platform fee
    ('4a000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
     'flat',      499.000000,   0, NULL, 'USD', DATE '2026-01-01', NULL),
    -- per_unit, historical period (superseded)
    ('4a000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002',
     'per_unit',    0.004000,   0, NULL, 'USD', DATE '2025-01-01', DATE '2026-01-01'),
    -- per_unit, current period
    ('4a000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002',
     'per_unit',    0.003500,   0, NULL, 'USD', DATE '2026-01-01', NULL),
    -- package: one-time onboarding sold as a single package
    ('4a000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000003',
     'package',  2500.000000,   0, NULL, 'USD', DATE '2025-07-01', NULL),
    -- tiered: three concurrent seat bands, entry band first
    ('4a000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000004',
     'tiered',     22.000000,   0,   25, 'USD', DATE '2026-01-01', NULL),
    ('4a000000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000004',
     'tiered',     18.000000,  25,  100, 'USD', DATE '2026-01-01', NULL),
    ('4a000000-0000-4000-8000-000000000009', 'b2000000-0000-4000-8000-000000000004',
     'tiered',     14.000000, 100, NULL, 'USD', DATE '2026-01-01', NULL),
    -- volume: hourly services price, single open band
    ('4a000000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000005',
     'volume',    165.000000,   0, NULL, 'USD', DATE '2026-02-01', NULL),
    -- percent: retired bundle billed as a revenue share, stored as a fraction
    ('4a000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000006',
     'percent',     0.150000,   0, NULL, 'USD', DATE '2025-03-01', DATE '2026-03-01');

-- ---------------------------------------------------------------------------
-- usage_record
-- ---------------------------------------------------------------------------
INSERT INTO usage_record (id, client_id, product_id, usage_date, quantity, source, idempotency_key, metadata) VALUES
    ('5e000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
     'b2000000-0000-4000-8000-000000000002', DATE '2026-07-01',  125000.000000, 'meter',  'USG-2026-07-01-NW-API', '{"batch": 1}'),
    ('5e000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001',
     'b2000000-0000-4000-8000-000000000002', DATE '2026-07-02',   98450.000000, 'meter',  'USG-2026-07-02-NW-API', '{"batch": 2}'),
    ('5e000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001',
     'b2000000-0000-4000-8000-000000000004', DATE '2026-07-01',      42.000000, 'system', 'USG-2026-07-01-NW-SEAT', '{}'),
    ('5e000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001',
     'b2000000-0000-4000-8000-000000000005', DATE '2026-07-15',      12.500000, 'manual', 'USG-2026-07-15-NW-SVC', '{"ticket": "PS-118"}'),
    ('5e000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000002',
     'b2000000-0000-4000-8000-000000000002', DATE '2026-06-30',   14300.000000, 'meter',  'USG-2026-06-30-BH-API', '{"batch": 1}'),
    ('5e000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000002',
     'b2000000-0000-4000-8000-000000000001', DATE '2026-06-01',       1.000000, 'system', 'USG-2026-06-01-BH-CORE', '{}'),
    ('5e000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000003',
     'b2000000-0000-4000-8000-000000000002', DATE '2026-02-14',    5200.000000, 'meter',  'USG-2026-02-14-QM-API', '{"final": true}'),
    ('5e000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000003',
     'b2000000-0000-4000-8000-000000000006', DATE '2026-01-31',       1.000000, 'import', 'USG-2026-01-31-QM-BNDL', '{"legacy": true}');

-- ---------------------------------------------------------------------------
-- deal_event
-- ---------------------------------------------------------------------------
INSERT INTO deal_event (id, client_id, product_id, event_type, occurred_at, amount, currency, payload) VALUES
    ('de000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
     'b2000000-0000-4000-8000-000000000001', 'signed',    TIMESTAMPTZ '2026-01-05 15:00:00+00',  5988.000000, 'USD',
     '{"term_months": 12, "owner": "ae-104"}'),
    ('de000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001',
     'b2000000-0000-4000-8000-000000000004', 'upgraded',  TIMESTAMPTZ '2026-04-18 09:30:00+00',   756.000000, 'USD',
     '{"seats_from": 30, "seats_to": 42}'),
    ('de000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002',
     'b2000000-0000-4000-8000-000000000001', 'paused',    TIMESTAMPTZ '2026-07-10 12:00:00+00',          NULL, NULL,
     '{"reason": "payment_hold"}'),
    ('de000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000003',
     'b2000000-0000-4000-8000-000000000006', 'renewed',   TIMESTAMPTZ '2025-09-01 08:00:00+00',  9000.000000, 'EUR',
     '{"term_months": 12}'),
    ('de000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000003',
     NULL,                                   'cancelled', TIMESTAMPTZ '2026-03-01 17:45:00+00',          NULL, 'EUR',
     '{"notice_days": 30, "reason": "budget"}');

-- ---------------------------------------------------------------------------
-- Mutations — exercise log_change() UPDATE/DELETE paths so change_log holds
-- before/after images alongside the INSERT rows above.
-- ---------------------------------------------------------------------------

-- UPDATE 1: an account is re-segmented (status coverage is left intact so the
-- seeded set still spans active / suspended / churned).
UPDATE client
   SET metadata   = jsonb_set(metadata, '{segment}', '"enterprise"'),
       updated_at = now()
 WHERE id = 'c1000000-0000-4000-8000-000000000001';

-- UPDATE 2: the current metered price is repriced in place.
UPDATE rate
   SET unit_amount = 0.003250,
       updated_at  = now()
 WHERE id = '4a000000-0000-4000-8000-000000000003';

-- DELETE: a mis-keyed deal event is retracted.
DELETE FROM deal_event
 WHERE id = 'de000000-0000-4000-8000-000000000004';

COMMIT;
