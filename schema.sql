-- =============================================================================
-- Billing customer model — PostgreSQL 15 DDL
--
-- Runs top to bottom on an empty PostgreSQL 15 database.
-- No extensions required (gen_random_uuid() is built in as of PostgreSQL 13).
--
-- Objects, in creation order:
--   tables     client, product, rate, usage_record, deal_event, change_log
--   function   log_change()      -- audit trigger, attached to the 4 mutable tables
--   function   rate_as_of(uuid, date)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- client — the billable party.
-- -----------------------------------------------------------------------------
CREATE TABLE client (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref   text        UNIQUE,
    name           text        NOT NULL CHECK (length(btrim(name)) > 0),
    legal_name     text,
    status         text        NOT NULL DEFAULT 'prospect'
                               CHECK (status IN ('prospect', 'active', 'suspended', 'closed')),
    billing_email  text        CHECK (billing_email IS NULL OR billing_email LIKE '_%@_%._%'),
    currency       char(3)     NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    billing_day    smallint    NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
    onboarded_on   date,
    closed_on      date,
    metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT client_close_after_onboard
        CHECK (closed_on IS NULL OR onboarded_on IS NULL OR closed_on >= onboarded_on)
);

CREATE INDEX client_status_idx ON client (status);
CREATE INDEX client_name_idx   ON client (lower(name));

COMMENT ON TABLE client IS 'Billable party; one row per customer account.';


-- -----------------------------------------------------------------------------
-- product — the billable thing. Priced by rate, consumed by usage_record.
-- -----------------------------------------------------------------------------
CREATE TABLE product (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code          text        NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9._-]*$'),
    name          text        NOT NULL CHECK (length(btrim(name)) > 0),
    description   text,
    billing_model text        NOT NULL
                              CHECK (billing_model IN ('one_time', 'recurring', 'usage')),
    unit          text        NOT NULL DEFAULT 'unit',
    currency      char(3)     NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    is_active     boolean     NOT NULL DEFAULT true,
    metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_active_idx ON product (is_active) WHERE is_active;

COMMENT ON TABLE product IS 'Catalog of billable products/SKUs.';


-- -----------------------------------------------------------------------------
-- rate — price of a product over a date window.
--   client_id NULL  => list rate (applies to every client without an override)
--   client_id set   => negotiated rate for that client
--   effective_to NULL => open-ended
-- -----------------------------------------------------------------------------
CREATE TABLE rate (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     uuid          NOT NULL REFERENCES product (id) ON DELETE RESTRICT,
    client_id      uuid          REFERENCES client (id) ON DELETE CASCADE,
    unit_amount    numeric(14,6) NOT NULL CHECK (unit_amount >= 0),
    currency       char(3)       NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    min_quantity   numeric(18,6) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
    effective_from date          NOT NULL DEFAULT CURRENT_DATE,
    effective_to   date,
    note           text,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT rate_window_ordered
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- One rate per (scope, product) start date. NULLS NOT DISTINCT (PG15+) makes the
-- list-rate scope (client_id IS NULL) participate in the uniqueness check.
CREATE UNIQUE INDEX rate_scope_start_uniq
    ON rate (client_id, product_id, effective_from) NULLS NOT DISTINCT;

CREATE INDEX rate_lookup_idx ON rate (product_id, client_id, effective_from DESC);
CREATE INDEX rate_client_idx ON rate (client_id) WHERE client_id IS NOT NULL;

COMMENT ON TABLE rate IS 'Date-scoped price for a product, globally or per client.';


-- -----------------------------------------------------------------------------
-- usage_record — metered consumption, the raw material of an invoice line.
-- -----------------------------------------------------------------------------
CREATE TABLE usage_record (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       uuid          NOT NULL REFERENCES client (id) ON DELETE CASCADE,
    product_id      uuid          NOT NULL REFERENCES product (id) ON DELETE RESTRICT,
    rate_id         uuid          REFERENCES rate (id) ON DELETE SET NULL,
    quantity        numeric(18,6) NOT NULL CHECK (quantity >= 0),
    unit_amount     numeric(14,6) CHECK (unit_amount IS NULL OR unit_amount >= 0),
    amount          numeric(18,6) GENERATED ALWAYS AS (quantity * COALESCE(unit_amount, 0)) STORED,
    currency        char(3)       NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    occurred_at     timestamptz   NOT NULL,
    period_start    date,
    period_end      date,
    source          text          NOT NULL DEFAULT 'api',
    idempotency_key text          UNIQUE,
    invoiced_at     timestamptz,
    metadata        jsonb         NOT NULL DEFAULT '{}'::jsonb,
    recorded_at     timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT usage_record_period_ordered
        CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start)
);

CREATE INDEX usage_record_client_time_idx  ON usage_record (client_id, occurred_at DESC);
CREATE INDEX usage_record_product_time_idx ON usage_record (product_id, occurred_at DESC);
CREATE INDEX usage_record_unbilled_idx     ON usage_record (client_id, occurred_at)
    WHERE invoiced_at IS NULL;

COMMENT ON TABLE usage_record IS 'Metered consumption events priced against a rate.';


-- -----------------------------------------------------------------------------
-- deal_event — the commercial timeline of a client (signed, renewed, churned…).
-- -----------------------------------------------------------------------------
CREATE TABLE deal_event (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    uuid          NOT NULL REFERENCES client (id) ON DELETE CASCADE,
    product_id   uuid          REFERENCES product (id) ON DELETE SET NULL,
    event_type   text          NOT NULL CHECK (event_type IN (
                                   'created', 'signed', 'renewed', 'upgraded', 'downgraded',
                                   'paused', 'resumed', 'credit_issued', 'churned'
                               )),
    effective_on date          NOT NULL DEFAULT CURRENT_DATE,
    amount       numeric(18,6),
    currency     char(3)       CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
    term_months  smallint      CHECK (term_months IS NULL OR term_months > 0),
    note         text,
    payload      jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT deal_event_amount_needs_currency
        CHECK (amount IS NULL OR currency IS NOT NULL)
);

CREATE INDEX deal_event_client_idx ON deal_event (client_id, effective_on DESC);
CREATE INDEX deal_event_type_idx   ON deal_event (event_type, effective_on DESC);

COMMENT ON TABLE deal_event IS 'Append-oriented commercial timeline per client.';


-- -----------------------------------------------------------------------------
-- change_log — audit trail written by log_change().
-- -----------------------------------------------------------------------------
CREATE TABLE change_log (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  text        NOT NULL,
    row_id      uuid,
    action      text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data    jsonb,
    new_data    jsonb,
    changed_by  text        NOT NULL DEFAULT current_user,
    changed_at  timestamptz NOT NULL DEFAULT now(),
    txid        bigint      NOT NULL DEFAULT txid_current()
);

CREATE INDEX change_log_row_idx  ON change_log (table_name, row_id, changed_at DESC);
CREATE INDEX change_log_time_idx ON change_log (changed_at DESC);

COMMENT ON TABLE change_log IS 'Row-level audit trail; written only by log_change().';


-- -----------------------------------------------------------------------------
-- log_change() — generic row auditor.
-- Records the full before/after image of every mutation on the tables it is
-- attached to. UPDATEs that change nothing are skipped.
-- -----------------------------------------------------------------------------
CREATE FUNCTION log_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_old jsonb;
    v_new jsonb;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        v_old := to_jsonb(OLD);
    END IF;

    IF TG_OP <> 'DELETE' THEN
        v_new := to_jsonb(NEW);
    END IF;

    IF TG_OP = 'UPDATE' AND v_old IS NOT DISTINCT FROM v_new THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.change_log (table_name, row_id, action, old_data, new_data)
    VALUES (
        TG_TABLE_NAME,
        COALESCE((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
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

COMMENT ON FUNCTION log_change() IS 'AFTER ... FOR EACH ROW trigger: writes change_log entries.';


-- -----------------------------------------------------------------------------
-- Audit triggers. usage_record is deliberately excluded: it is append-only,
-- high-volume telemetry and auditing it would double the write cost.
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- rate_as_of(client_id, as_of_date)
-- The price list in force for one client on one day: every product that has a
-- rate covering that date, resolved client-specific-first with the list rate as
-- fallback. Ties on effective_from are broken by the most recently created row.
-- -----------------------------------------------------------------------------
CREATE FUNCTION rate_as_of(p_client_id uuid, p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    product_id      uuid,
    product_code    text,
    product_name    text,
    rate_id         uuid,
    unit_amount     numeric(14,6),
    currency        char(3),
    unit            text,
    min_quantity    numeric(18,6),
    effective_from  date,
    effective_to    date,
    client_specific boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT ON (p.id)
        p.id,
        p.code,
        p.name,
        r.id,
        r.unit_amount,
        r.currency,
        p.unit,
        r.min_quantity,
        r.effective_from,
        r.effective_to,
        (r.client_id IS NOT NULL)
    FROM rate r
    JOIN product p ON p.id = r.product_id
    WHERE (r.client_id = p_client_id OR r.client_id IS NULL)
      AND r.effective_from <= p_as_of
      AND (r.effective_to IS NULL OR r.effective_to > p_as_of)
    ORDER BY
        p.id,
        (r.client_id IS NOT NULL) DESC,  -- negotiated rate beats list rate
        r.effective_from DESC,           -- newest window in force wins
        r.created_at DESC;
$$;

COMMENT ON FUNCTION rate_as_of(uuid, date)
    IS 'Effective price list for a client on a given date; client rates override list rates.';
