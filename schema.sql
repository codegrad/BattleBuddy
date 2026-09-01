-- schema.sql — PostgreSQL 15
-- Billing/contract core: clients, products, dated rates, metered usage,
-- commercial deal events, and a generic audit trail.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- client
-- ---------------------------------------------------------------------------
CREATE TABLE client (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text        NOT NULL,
    external_ref  text        UNIQUE,
    status        text        NOT NULL DEFAULT 'active',
    currency      char(3)     NOT NULL DEFAULT 'USD',
    metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT client_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT client_status_valid   CHECK (status IN ('active', 'suspended', 'churned')),
    CONSTRAINT client_currency_valid CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX client_status_idx ON client (status);

-- ---------------------------------------------------------------------------
-- product
-- ---------------------------------------------------------------------------
CREATE TABLE product (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text        NOT NULL UNIQUE,
    name        text        NOT NULL,
    unit        text        NOT NULL DEFAULT 'unit',
    is_active   boolean     NOT NULL DEFAULT true,
    metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT product_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT product_name_not_blank CHECK (btrim(name) <> '')
);

CREATE INDEX product_is_active_idx ON product (is_active);

-- ---------------------------------------------------------------------------
-- rate — dated price history per product; [effective_from, effective_to)
-- effective_to NULL means "still in force".
-- ---------------------------------------------------------------------------
CREATE TABLE rate (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     uuid          NOT NULL REFERENCES product (id) ON DELETE CASCADE,
    unit_amount    numeric(18,6) NOT NULL,
    currency       char(3)       NOT NULL DEFAULT 'USD',
    effective_from date          NOT NULL,
    effective_to   date,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT rate_unit_amount_nonneg CHECK (unit_amount >= 0),
    CONSTRAINT rate_currency_valid     CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT rate_period_ordered     CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT rate_no_overlap EXCLUDE USING gist (
        product_id WITH =,
        daterange(effective_from, effective_to, '[)') WITH &&
    )
);

CREATE INDEX rate_product_effective_idx ON rate (product_id, effective_from DESC);

-- ---------------------------------------------------------------------------
-- usage_record — metered consumption, idempotent per external key
-- ---------------------------------------------------------------------------
CREATE TABLE usage_record (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     uuid          NOT NULL REFERENCES client (id) ON DELETE CASCADE,
    product_id    uuid          NOT NULL REFERENCES product (id) ON DELETE RESTRICT,
    usage_date    date          NOT NULL,
    quantity      numeric(18,6) NOT NULL,
    source        text          NOT NULL DEFAULT 'system',
    idempotency_key text        UNIQUE,
    metadata      jsonb         NOT NULL DEFAULT '{}'::jsonb,
    recorded_at   timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT usage_record_quantity_nonneg CHECK (quantity >= 0)
);

CREATE INDEX usage_record_client_date_idx  ON usage_record (client_id, usage_date);
CREATE INDEX usage_record_product_date_idx ON usage_record (product_id, usage_date);

-- ---------------------------------------------------------------------------
-- deal_event — commercial lifecycle events on a client relationship
-- ---------------------------------------------------------------------------
CREATE TABLE deal_event (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   uuid          NOT NULL REFERENCES client (id) ON DELETE CASCADE,
    product_id  uuid          REFERENCES product (id) ON DELETE SET NULL,
    event_type  text          NOT NULL,
    occurred_at timestamptz   NOT NULL DEFAULT now(),
    amount      numeric(18,6),
    currency    char(3),
    payload     jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT deal_event_type_valid CHECK (
        event_type IN ('created', 'quoted', 'signed', 'renewed', 'upgraded',
                       'downgraded', 'paused', 'resumed', 'cancelled')
    ),
    CONSTRAINT deal_event_currency_valid CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
    CONSTRAINT deal_event_amount_currency CHECK (amount IS NULL OR currency IS NOT NULL)
);

CREATE INDEX deal_event_client_occurred_idx ON deal_event (client_id, occurred_at DESC);
CREATE INDEX deal_event_type_idx            ON deal_event (event_type);

-- ---------------------------------------------------------------------------
-- change_log — append-only audit trail written by log_change()
-- ---------------------------------------------------------------------------
CREATE TABLE change_log (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  text        NOT NULL,
    record_id   uuid,
    operation   text        NOT NULL,
    old_data    jsonb,
    new_data    jsonb,
    changed_by  text        NOT NULL DEFAULT current_user,
    changed_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT change_log_operation_valid CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX change_log_table_record_idx ON change_log (table_name, record_id, changed_at DESC);
CREATE INDEX change_log_changed_at_idx   ON change_log (changed_at DESC);

-- ---------------------------------------------------------------------------
-- log_change() — generic row-level audit trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
    v_new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
BEGIN
    -- Skip updates that change nothing.
    IF TG_OP = 'UPDATE' AND v_old IS NOT DISTINCT FROM v_new THEN
        RETURN NEW;
    END IF;

    INSERT INTO change_log (table_name, record_id, operation, old_data, new_data)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(v_new ->> 'id', v_old ->> 'id')::uuid,
        TG_OP,
        v_old,
        v_new
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER client_change_log
    AFTER INSERT OR UPDATE OR DELETE ON client
    FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER product_change_log
    AFTER INSERT OR UPDATE OR DELETE ON product
    FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER rate_change_log
    AFTER INSERT OR UPDATE OR DELETE ON rate
    FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER deal_event_change_log
    AFTER INSERT OR UPDATE OR DELETE ON deal_event
    FOR EACH ROW EXECUTE FUNCTION log_change();

-- ---------------------------------------------------------------------------
-- rate_as_of(product_id, as_of) — the unit amount in force on a given date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rate_as_of(p_product_id uuid, p_as_of date)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
    SELECT r.unit_amount
    FROM rate r
    WHERE r.product_id = p_product_id
      AND r.effective_from <= p_as_of
      AND (r.effective_to IS NULL OR r.effective_to > p_as_of)
    ORDER BY r.effective_from DESC
    LIMIT 1;
$$;

COMMIT;
