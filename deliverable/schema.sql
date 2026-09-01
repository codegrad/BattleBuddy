-- schema.sql
-- Target: PostgreSQL 15
-- Billing / usage / deal-tracking core schema with row-level change auditing.

BEGIN;

SET client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- btree_gist lets the rate exclusion constraint mix equality columns with a
-- daterange overlap test.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

CREATE TYPE client_status AS ENUM (
    'prospect',
    'active',
    'suspended',
    'churned'
);

CREATE TYPE usage_source AS ENUM (
    'meter',
    'import',
    'manual',
    'adjustment'
);

CREATE TYPE deal_event_kind AS ENUM (
    'created',
    'stage_changed',
    'amount_changed',
    'won',
    'lost',
    'reopened',
    'renewed',
    'cancelled'
);

CREATE TYPE change_operation AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE'
);

-- ---------------------------------------------------------------------------
-- client
-- ---------------------------------------------------------------------------

CREATE TABLE client (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text          NOT NULL,
    legal_name    text,
    external_ref  text,
    status        client_status NOT NULL DEFAULT 'prospect',
    currency      char(3)       NOT NULL DEFAULT 'USD',
    billing_email text,
    metadata      jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz   NOT NULL DEFAULT now(),
    updated_at    timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT client_name_not_blank  CHECK (btrim(name) <> ''),
    CONSTRAINT client_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT client_external_ref_key UNIQUE (external_ref)
);

CREATE UNIQUE INDEX client_name_lower_key ON client (lower(name));
CREATE INDEX client_status_idx ON client (status);

COMMENT ON TABLE client IS 'Billable customer accounts.';

-- ---------------------------------------------------------------------------
-- product
-- ---------------------------------------------------------------------------

CREATE TABLE product (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text        NOT NULL,
    name        text        NOT NULL,
    description text,
    unit        text        NOT NULL DEFAULT 'unit',
    is_active   boolean     NOT NULL DEFAULT true,
    metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT product_code_key       UNIQUE (code),
    CONSTRAINT product_code_format    CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{1,63}$'),
    CONSTRAINT product_name_not_blank CHECK (btrim(name) <> '')
);

CREATE INDEX product_is_active_idx ON product (is_active);

COMMENT ON TABLE product IS 'Sellable / meterable items that usage is recorded against.';

-- ---------------------------------------------------------------------------
-- rate
-- ---------------------------------------------------------------------------
-- A rate row with client_id IS NULL is the list price for the product.
-- A rate row with client_id set is a client-specific override.
-- Validity is the half-open date range [effective_from, effective_to).

CREATE TABLE rate (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     uuid          NOT NULL REFERENCES product (id) ON DELETE CASCADE,
    client_id      uuid          REFERENCES client (id) ON DELETE CASCADE,
    unit_amount    numeric(18,6) NOT NULL,
    currency       char(3)       NOT NULL DEFAULT 'USD',
    minimum_units  numeric(18,6) NOT NULL DEFAULT 0,
    effective_from date          NOT NULL,
    effective_to   date,
    note           text,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT rate_unit_amount_non_negative   CHECK (unit_amount >= 0),
    CONSTRAINT rate_minimum_units_non_negative CHECK (minimum_units >= 0),
    CONSTRAINT rate_currency_format            CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT rate_period_valid               CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT rate_no_overlap EXCLUDE USING gist (
        product_id WITH =,
        (COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        currency WITH =,
        daterange(effective_from, effective_to, '[)') WITH &&
    )
);

CREATE INDEX rate_lookup_idx ON rate (product_id, client_id, effective_from DESC);
CREATE INDEX rate_client_id_idx ON rate (client_id) WHERE client_id IS NOT NULL;

COMMENT ON TABLE rate IS 'Time-bounded unit pricing; NULL client_id is the product list price.';

-- ---------------------------------------------------------------------------
-- usage_record
-- ---------------------------------------------------------------------------

CREATE TABLE usage_record (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   uuid          NOT NULL REFERENCES client (id) ON DELETE RESTRICT,
    product_id  uuid          NOT NULL REFERENCES product (id) ON DELETE RESTRICT,
    occurred_at timestamptz   NOT NULL,
    usage_date  date          GENERATED ALWAYS AS ((occurred_at AT TIME ZONE 'UTC')::date) STORED,
    quantity    numeric(18,6) NOT NULL,
    unit        text          NOT NULL DEFAULT 'unit',
    source      usage_source  NOT NULL DEFAULT 'meter',
    external_id text,
    metadata    jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT usage_record_quantity_non_negative CHECK (quantity >= 0),
    CONSTRAINT usage_record_external_id_key UNIQUE (client_id, source, external_id)
);

CREATE INDEX usage_record_client_occurred_idx ON usage_record (client_id, occurred_at DESC);
CREATE INDEX usage_record_product_occurred_idx ON usage_record (product_id, occurred_at DESC);
CREATE INDEX usage_record_usage_date_idx ON usage_record (usage_date);

COMMENT ON TABLE usage_record IS 'Immutable metered usage events priced via rate_as_of().';

-- ---------------------------------------------------------------------------
-- deal_event
-- ---------------------------------------------------------------------------

CREATE TABLE deal_event (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   uuid            NOT NULL REFERENCES client (id) ON DELETE CASCADE,
    deal_ref    text            NOT NULL,
    kind        deal_event_kind NOT NULL,
    occurred_at timestamptz     NOT NULL DEFAULT now(),
    stage_from  text,
    stage_to    text,
    amount      numeric(18,2),
    currency    char(3)         NOT NULL DEFAULT 'USD',
    payload     jsonb           NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT deal_event_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT deal_event_deal_ref_not_blank CHECK (btrim(deal_ref) <> '')
);

CREATE INDEX deal_event_client_occurred_idx ON deal_event (client_id, occurred_at DESC);
CREATE INDEX deal_event_deal_ref_idx ON deal_event (deal_ref, occurred_at DESC);
CREATE INDEX deal_event_kind_idx ON deal_event (kind);

COMMENT ON TABLE deal_event IS 'Append-only commercial lifecycle events per deal.';

-- ---------------------------------------------------------------------------
-- change_log
-- ---------------------------------------------------------------------------

CREATE TABLE change_log (
    id          bigint           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  text             NOT NULL,
    row_id      uuid,
    operation   change_operation NOT NULL,
    changed_at  timestamptz      NOT NULL DEFAULT now(),
    changed_by  text             NOT NULL DEFAULT current_user,
    txid        bigint           NOT NULL DEFAULT txid_current(),
    old_data    jsonb,
    new_data    jsonb
);

CREATE INDEX change_log_table_row_idx ON change_log (table_name, row_id, changed_at DESC);
CREATE INDEX change_log_changed_at_idx ON change_log (changed_at DESC);

COMMENT ON TABLE change_log IS 'Row-level audit trail written by log_change().';

-- ---------------------------------------------------------------------------
-- log_change() — generic row auditor
-- ---------------------------------------------------------------------------

CREATE FUNCTION log_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_old    jsonb;
    v_new    jsonb;
    v_row_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old    := to_jsonb(OLD);
        v_new    := NULL;
        v_row_id := (v_old ->> 'id')::uuid;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        IF v_old IS NOT DISTINCT FROM v_new THEN
            RETURN NULL;   -- no-op update, nothing worth auditing
        END IF;
        v_row_id := (v_new ->> 'id')::uuid;
    ELSE
        v_old    := NULL;
        v_new    := to_jsonb(NEW);
        v_row_id := (v_new ->> 'id')::uuid;
    END IF;

    INSERT INTO change_log (table_name, row_id, operation, changed_by, old_data, new_data)
    VALUES (TG_TABLE_NAME, v_row_id, TG_OP::change_operation, current_user, v_old, v_new);

    RETURN NULL;   -- AFTER trigger; return value is ignored
END;
$$;

COMMENT ON FUNCTION log_change() IS 'AFTER ROW trigger function; writes INSERT/UPDATE/DELETE images into change_log.';

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER client_log_change
    AFTER INSERT OR UPDATE OR DELETE ON client
    FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER product_log_change
    AFTER INSERT OR UPDATE OR DELETE ON product
    FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER rate_log_change
    AFTER INSERT OR UPDATE OR DELETE ON rate
    FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER deal_event_log_change
    AFTER INSERT OR UPDATE OR DELETE ON deal_event
    FOR EACH ROW EXECUTE FUNCTION log_change();

-- ---------------------------------------------------------------------------
-- rate_as_of(uuid, date) — effective rate card for a client on a date
-- ---------------------------------------------------------------------------
-- Returns one row per product that has a rate in force on p_as_of, preferring
-- the client-specific override over the product list price.

CREATE FUNCTION rate_as_of(p_client_id uuid, p_as_of date)
RETURNS TABLE (
    product_id         uuid,
    product_code       text,
    rate_id            uuid,
    unit_amount        numeric,
    currency           char(3),
    minimum_units      numeric,
    effective_from     date,
    effective_to       date,
    is_client_specific boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT ON (r.product_id)
           r.product_id,
           p.code,
           r.id,
           r.unit_amount,
           r.currency,
           r.minimum_units,
           r.effective_from,
           r.effective_to,
           (r.client_id IS NOT NULL)
    FROM rate r
    JOIN product p ON p.id = r.product_id
    WHERE (r.client_id = p_client_id OR r.client_id IS NULL)
      AND r.effective_from <= p_as_of
      AND (r.effective_to IS NULL OR r.effective_to > p_as_of)
    ORDER BY r.product_id,
             (r.client_id IS NOT NULL) DESC,
             r.effective_from DESC;
$$;

COMMENT ON FUNCTION rate_as_of(uuid, date) IS 'Effective rate card for a client on a given date; client override wins over list price.';

COMMIT;
