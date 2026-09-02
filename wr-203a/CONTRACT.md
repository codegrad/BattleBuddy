# Ledger API Contract — WR-203A

Interface document for the builder-scoped ledger. Two read-only GET endpoints, each a
Cloudflare Pages Function, over the append-only `ledger_entry` table (`ledger_entry.sql`).
Consumers — including the coins-UI work request — build against this document.

## 1. Scope

- Two endpoints, both GET, both builder-scoped:
  - `GET /api/v1/ledger/balance`
  - `GET /api/v1/ledger/entries`
- A caller only ever sees its own builder's rows. The builder is taken from the **verified**
  session cookie, never from a query parameter, path segment, or request body.
- The ledger is append-only. These endpoints read; they never write. There is no
  create/update/delete surface in this contract.

## 2. Mount shape — Pages Functions

The routes are mounted by file position, one file per route, each exporting `onRequestGet`:

| File                                   | Route                      |
|----------------------------------------|----------------------------|
| `functions/api/v1/ledger/balance.js`   | `GET /api/v1/ledger/balance` |
| `functions/api/v1/ledger/entries.js`   | `GET /api/v1/ledger/entries` |

    export async function onRequestGet(context) { /* { request, env } */ }

There is no standalone Worker, no `fetch` router, and no in-code URL matching. Method and
path dispatch belong to the platform: a non-GET request to either path is answered by the
platform's own method handling, not by these files.

Bindings read from `context.env`:

- `env.DB` — the D1 binding holding `ledger_entry`.
- `env.SESSION_SECRET` — the secret `verifySession` checks the session signature against.

## 3. Request — the verified sp_session builder cookie

Both endpoints take no parameters. Identity comes from one cookie:

    Cookie: sp_session=<signed builder session>

- The cookie value is a **signed session token**. Each handler calls
  `verifySession(token, env.SESSION_SECRET)` from `_lib/session.js` and takes `builder_id`
  **only** from the verified result. An unverified cookie is never trusted for identity.
- No other request input is read. Requests are `GET` with no body.
- A request with no `sp_session` cookie, one whose signature does not verify, an expired
  session, or a verified session carrying no builder id is treated as having no builder
  session — see §6. These cases are indistinguishable to the caller, by design: the 401
  body never says which one it was.

## 4. GET /api/v1/ledger/balance

The sum of the authenticated builder's entry amounts.

**200 response**

    {
      "ok": true,
      "builder_id": "bld_7Q2h",
      "balance": 7,
      "currency": "SPC"
    }

| Field        | Type    | Notes                                              |
|--------------|---------|----------------------------------------------------|
| `ok`         | boolean | Always `true` on 200.                              |
| `builder_id` | string  | The builder resolved from the verified session.    |
| `balance`    | integer | Sum of `amount` over that builder's entries.       |
| `currency`   | string  | Always `"SPC"`.                                    |

A builder with no entries returns `balance: 0`, not a 404.

## 5. GET /api/v1/ledger/entries

The authenticated builder's ledger entries.

**200 response**

    {
      "ok": true,
      "entries": [
        {
          "id": "led_01J8",
          "room_id": "room_412",
          "wr_id": "WR-203A",
          "amount": 5,
          "kind": "earn",
          "created_at": "2026-09-01 14:02:11"
        }
      ],
      "more": false
    }

| Field                  | Type    | Notes                                      |
|------------------------|---------|--------------------------------------------|
| `ok`                   | boolean | Always `true` on 200.                      |
| `entries`              | array   | Empty array when the builder has no rows.  |
| `entries[].id`         | string  | Ledger entry id.                           |
| `entries[].room_id`    | string  | Room the entry was raised in.              |
| `entries[].wr_id`      | string  | Work Request the entry is against.         |
| `entries[].amount`     | integer | Whole SPC — see §7.                        |
| `entries[].kind`       | string  | `"earn"` or `"adjust"`.                    |
| `entries[].created_at` | string  | Timestamp as stored — see §9.              |
| `more`                 | boolean | Always `false` in v1 — see below.          |

Entries carry no other fields. Ordering is newest-first.

**Row cap and `more`.** The response is capped at **200 rows**. `more` is present on every
200 response and is **always `false` in v1**: there is no pagination surface, no cursor, and
no page parameter. Clients must read `more` rather than assume it — a later version may
turn it `true` and add a cursor alongside it, and a client that ignored the field would
silently show a truncated ledger. A builder holding more than 200 entries sees the most
recent 200 (see §9).

## 6. 401 — no builder session

Either endpoint, when there is no verified builder session:

    {
      "ok": false,
      "error": "no_builder_session"
    }

Status `401`. `ok` is `false` and `error` is a string. Clients should branch on
`ok`, not on the error text.

## 7. SPC / points rule

> Amounts are whole SPC (Strangepair Coins). v1 rule: 1 point == 1 SPC.

`amount` and `balance` are therefore integers in both endpoints. `currency` is `"SPC"`.
Clients must not divide, scale, or reformat amounts into fractional units.

## 8. STUB fixture — coins-UI parallel work

The coins-UI work request builds against this fixture while the live endpoints are being
wired. Copied verbatim from the brief:

> balance:7, entries:[ {wr_id:"WR-03",amount:5,kind:"earn"}, {wr_id:"WR-201",amount:2,kind:"earn"} ]

Placed into the response envelopes of §4 and §5, that fixture is:

    { "ok": true, "builder_id": "<stub builder>", "balance": 7, "currency": "SPC" }

    {
      "ok": true,
      "entries": [
        { "wr_id": "WR-03",  "amount": 5, "kind": "earn" },
        { "wr_id": "WR-201", "amount": 2, "kind": "earn" }
      ],
      "more": false
    }

The fixture states `wr_id`, `amount`, and `kind` only; live responses also carry `id`,
`room_id`, and `created_at` per §5, so the UI must tolerate those fields being present.
Note that 5 + 2 = 7, matching the fixture balance — a UI may display the balance from the
endpoint, but must not depend on recomputing it from a truncated entries list.

## 9. Documented v1 behavior

Accepted behavior for v1, stated here so consumers meet it in the contract rather than in
production.

**Balance is single-currency.** `balance` sums **all** of the builder's rows and reports
`currency` as the constant `"SPC"`. The schema permits a row in another currency; such a
row would be added into the SPC total. v1 assumes one currency across the ledger. Making
the balance per-currency is a v2 change, and it changes the §4 shape.

**`created_at` has no timezone marker.** It is stored and returned as SQLite's
`CURRENT_TIMESTAMP`: the string `"YYYY-MM-DD HH:MM:SS"`, in **UTC**, with a space separator
and no trailing `Z`. Lexical sorting of this format is chronologically correct. An
ISO-8601 parser must be given the missing marker — replace the space with `T` and append
`Z` before parsing:

    new Date(entry.created_at.replace(' ', 'T') + 'Z')

Treating the raw string as local time will shift it by the viewer's offset.

**Same-second entries tiebreak by id.** Ordering is `created_at DESC, id DESC`. Two entries
written within the same second are therefore ordered by id, which is arbitrary rather than
chronological. Ids are not time-ordered and must not be read as a sequence. The effect is
only ever visible at the 200-row boundary of §5.

## 10. Append-only guarantees

- `ledger_entry` is created with `CREATE TABLE IF NOT EXISTS` and its index with
  `CREATE INDEX IF NOT EXISTS`. No `ALTER`, no `DROP`.
- No `UPDATE` or `DELETE` statement exists against the ledger, anywhere.
- Corrections are made by appending a row with `kind: "adjust"`, never by editing history.
  A negative `adjust` amount is how a balance goes down.
- Both route files — `balance.js` and `entries.js` — are `SELECT`-only.
