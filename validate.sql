-- validate.sql — read-only conformance checks for schema.sql + seed.sql
--
-- Usage:  psql -f schema.sql && psql -f seed.sql && psql -f validate.sql
--
-- Emits one "check_name | PASS/FAIL | detail" row per check. The whole script
-- runs in a READ ONLY transaction, so it can never modify the data it audits.
-- Contract file: do not edit in place. If an expectation here has to change,
-- the change belongs in schema.sql or seed.sql, or in a new validator.

BEGIN;
SET TRANSACTION READ ONLY;

\pset format unaligned
\pset tuples_only on
\pset footer off

WITH
counts AS (
    SELECT
        (SELECT count(*) FROM client)       AS n_client,
        (SELECT count(*) FROM product)      AS n_product,
        (SELECT count(*) FROM rate)         AS n_rate,
        (SELECT count(*) FROM usage_record) AS n_usage,
        (SELECT count(*) FROM deal_event)   AS n_deal,
        (SELECT count(*) FROM change_log)   AS n_log
),

-- 1. Seeded volumes are exactly what seed.sql claims to load.
row_counts AS (
    SELECT
        (n_client = 3 AND n_product = 6 AND n_rate = 9
         AND n_usage = 8 AND n_deal = 4 AND n_log = 26) AS ok,
        format('client=%s product=%s rate=%s usage_record=%s deal_event=%s change_log=%s'
               ' (want 3/6/9/8/4/26)',
               n_client, n_product, n_rate, n_usage, n_deal, n_log) AS detail
    FROM counts
),

-- 2. Every product type permitted by the schema is exercised by the seed.
product_types AS (
    SELECT
        array_agg(DISTINCT type ORDER BY type) AS seen
    FROM product
),
product_types_covered AS (
    SELECT
        -- Containment both ways: collation-independent set equality.
        (seen @> ARRAY['addon','bundle','one_time','service','subscription','usage']
         AND seen <@ ARRAY['addon','bundle','one_time','service','subscription','usage']) AS ok,
        format('types present: %s', array_to_string(seen, ',')) AS detail
    FROM product_types
),

-- 3. Every rate_type permitted by the schema is exercised by the seed.
rate_types AS (
    SELECT array_agg(DISTINCT rate_type ORDER BY rate_type) AS seen FROM rate
),
rate_types_covered AS (
    SELECT
        (seen @> ARRAY['flat','per_unit','tiered','volume','package','percent']
         AND seen <@ ARRAY['flat','per_unit','tiered','volume','package','percent']) AS ok,
        format('rate_types present: %s', array_to_string(seen, ',')) AS detail
    FROM rate_types
),

-- 4. Percent rates are stored as fractions in (0,1], never whole percentages.
percent_rates AS (
    SELECT
        count(*) AS n,
        count(*) FILTER (WHERE unit_amount > 0 AND unit_amount <= 1) AS n_fraction,
        max(unit_amount) AS max_amount
    FROM rate WHERE rate_type = 'percent'
),
percent_is_fraction AS (
    SELECT
        (n > 0 AND n = n_fraction) AS ok,
        format('%s percent rate(s), %s stored as a fraction, max=%s',
               n, n_fraction, coalesce(max_amount::text, 'n/a')) AS detail
    FROM percent_rates
),

-- 5. Banded pricing really is banded: each tiered product has >1 band, the
--    bands start at 0, and they are contiguous with an open top band.
tiered_products AS (
    SELECT
        product_id,
        count(*)                                        AS bands,
        min(tier_from)                                  AS first_from,
        count(*) FILTER (WHERE tier_to IS NULL)         AS open_bands,
        count(*) FILTER (
            WHERE tier_to IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM rate nxt
                  WHERE nxt.product_id = r.product_id
                    AND nxt.rate_type  = 'tiered'
                    AND nxt.tier_from  = r.tier_to
              )
        ) AS gaps
    FROM rate r
    WHERE r.rate_type = 'tiered'
    GROUP BY product_id
),
tiered_has_tiers AS (
    SELECT
        (count(*) > 0
         AND count(*) FILTER (
             WHERE bands > 1 AND first_from = 0 AND open_bands = 1 AND gaps = 0
         ) = count(*)) AS ok,
        format('%s tiered product(s); bands=%s; malformed=%s',
               count(*),
               coalesce(string_agg(bands::text, ',' ORDER BY bands), 'none'),
               count(*) FILTER (
                   WHERE NOT (bands > 1 AND first_from = 0 AND open_bands = 1 AND gaps = 0)
               )) AS detail
    FROM tiered_products
),

-- 6. rate_as_of() picks the period in force, not merely the newest row.
history AS (
    SELECT
        rate_as_of('b2000000-0000-4000-8000-000000000002', DATE '2025-06-01') AS old_price,
        rate_as_of('b2000000-0000-4000-8000-000000000002', DATE '2026-07-01') AS new_price,
        rate_as_of('b2000000-0000-4000-8000-000000000002', DATE '2024-01-01') AS before_any
),
rate_history_resolves AS (
    SELECT
        (old_price = 0.004000 AND new_price = 0.003250 AND before_any IS NULL) AS ok,
        format('2025-06-01=%s 2026-07-01=%s 2024-01-01=%s (want 0.004000/0.003250/NULL)',
               coalesce(old_price::text, 'NULL'),
               coalesce(new_price::text, 'NULL'),
               coalesce(before_any::text, 'NULL')) AS detail
    FROM history
),

-- 7. log_change() recorded both UPDATEs with a genuine before/after delta.
upd AS (
    SELECT
        count(*) AS n,
        count(*) FILTER (
            WHERE old_data IS NOT NULL
              AND new_data IS NOT NULL
              AND old_data IS DISTINCT FROM new_data
              AND record_id IS NOT NULL
        ) AS n_valid,
        count(*) FILTER (WHERE table_name = 'rate'
                           AND old_data->>'unit_amount' = '0.003500'
                           AND new_data->>'unit_amount' = '0.003250') AS n_reprice
    FROM change_log WHERE operation = 'UPDATE'
),
changelog_captured_updates AS (
    SELECT
        (n = 2 AND n_valid = 2 AND n_reprice = 1) AS ok,
        format('%s UPDATE row(s), %s with a before/after delta, reprice captured=%s'
               ' (want 2/2/1)', n, n_valid, n_reprice) AS detail
    FROM upd
),

-- 8. The DELETE was captured with a before image, no after image, and the row
--    really is gone from the source table.
del AS (
    SELECT
        count(*) AS n,
        count(*) FILTER (WHERE old_data IS NOT NULL AND new_data IS NULL) AS n_valid,
        count(*) FILTER (
            WHERE NOT EXISTS (SELECT 1 FROM deal_event d WHERE d.id = change_log.record_id)
        ) AS n_gone
    FROM change_log WHERE operation = 'DELETE'
),
changelog_captured_delete AS (
    SELECT
        (n = 1 AND n_valid = 1 AND n_gone = 1) AS ok,
        format('%s DELETE row(s), %s with before-image only, %s absent from deal_event'
               ' (want 1/1/1)', n, n_valid, n_gone) AS detail
    FROM del
),

-- 9. Every audited table logged an INSERT for every row it ever received.
ins AS (
    SELECT
        count(*) FILTER (WHERE table_name = 'client')     AS n_client,
        count(*) FILTER (WHERE table_name = 'product')    AS n_product,
        count(*) FILTER (WHERE table_name = 'rate')       AS n_rate,
        count(*) FILTER (WHERE table_name = 'deal_event') AS n_deal,
        count(*) FILTER (WHERE table_name = 'usage_record') AS n_usage,
        count(*) FILTER (WHERE new_data IS NULL OR old_data IS NOT NULL) AS n_malformed
    FROM change_log WHERE operation = 'INSERT'
),
changelog_covers_inserts AS (
    SELECT
        (n_client = 3 AND n_product = 6 AND n_rate = 9 AND n_deal = 5
         AND n_usage = 0 AND n_malformed = 0) AS ok,
        format('INSERT logs client=%s product=%s rate=%s deal_event=%s'
               ' (want 3/6/9/5); unaudited usage_record=%s (want 0); malformed=%s',
               n_client, n_product, n_rate, n_deal, n_usage, n_malformed) AS detail
    FROM ins
),

results AS (
    SELECT 1 AS seq, 'row_counts'                 AS check_name, ok, detail FROM row_counts
    UNION ALL SELECT 2, 'product_types_covered',       ok, detail FROM product_types_covered
    UNION ALL SELECT 3, 'rate_types_covered',          ok, detail FROM rate_types_covered
    UNION ALL SELECT 4, 'percent_is_fraction',         ok, detail FROM percent_is_fraction
    UNION ALL SELECT 5, 'tiered_has_tiers',            ok, detail FROM tiered_has_tiers
    UNION ALL SELECT 6, 'rate_history_resolves',       ok, detail FROM rate_history_resolves
    UNION ALL SELECT 7, 'changelog_captured_updates',  ok, detail FROM changelog_captured_updates
    UNION ALL SELECT 8, 'changelog_captured_delete',   ok, detail FROM changelog_captured_delete
    UNION ALL SELECT 9, 'changelog_covers_inserts',    ok, detail FROM changelog_covers_inserts
)
SELECT
    rpad(check_name, 28) || ' ' ||
    CASE WHEN coalesce(ok, false) THEN 'PASS' ELSE 'FAIL' END || '  ' ||
    coalesce(detail, '(no rows)') AS result
FROM results
ORDER BY seq;

COMMIT;
