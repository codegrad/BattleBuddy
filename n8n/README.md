# Content Video Batch Pipeline

n8n workflow that generates the AI video library for the home screen's
swipe-right content feed: Claude writes per-theme prompts, **Google Veo 3.1**
renders the clips, **Gemini 2.5 Flash Image** ("Nano Banana") renders a
matching thumbnail, Cloudflare R2 stores both, and Supabase catalogues the
results for the mobile app to query.

Live on `strangepair.app.n8n.cloud` as workflow `bmQ7fCdA8JVtAxjJ`.

## 1. Run the Supabase migrations first

```sh
psql "$SUPABASE_DB_URL" -f ../server/migrations/005_content_videos.sql
psql "$SUPABASE_DB_URL" -f ../server/migrations/006_content_videos_thumbnails.sql
```

Or paste the file contents into the Supabase SQL Editor, in order. `005`
creates the `content_videos` table; `006` adds the `r2_thumbnail_url` column
for the generated thumbnail. The workflow will fail on every "Save to
Supabase" / "Log Failure to Supabase" node until both have run.

## 2. Credentials (not environment variables)

n8n Cloud doesn't expose OS environment variables to workflow expressions,
and the Variables feature requires a higher license tier than this instance
has — so every secret the workflow needs lives in an n8n **credential**,
referenced by each node's `genericCredentialType: httpCustomAuth` (or, for
R2, the native `s3` credential type). Create these in n8n before activating
the workflow:

| Credential name | Type | Contents |
|---|---|---|
| `Anthropic API (BattleBuddy)` | Custom Auth (`httpCustomAuth`) | `{"headers": {"x-api-key": "<ANTHROPIC_API_KEY>"}}` |
| `Google AI API (BattleBuddy)` | Custom Auth (`httpCustomAuth`) | `{"headers": {"x-goog-api-key": "<GOOGLE_AI_API_KEY>"}}` |
| `Supabase Service Role (BattleBuddy)` | Custom Auth (`httpCustomAuth`) | `{"headers": {"apikey": "<SUPABASE_SERVICE_KEY>", "Authorization": "Bearer <SUPABASE_SERVICE_KEY>"}}` |
| `Cloudflare R2 (S3-compatible)` | S3 | endpoint `https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`, access key + secret from an R2 API token scoped to **Object Read & Write** on this bucket, **Force Path Style** enabled |

Two non-secret values are hardcoded directly into node expressions instead
(no var store to reference them from): the Supabase project URL (in the
`url` field of the three Supabase-writing nodes) and the R2 public dev URL
(in `Save to Supabase`'s `r2_url`/`r2_thumbnail_url` construction). If either
changes, those nodes need a manual edit — search the workflow JSON for the
old value.

The Custom Auth `json` field is a **JSON string**, not a nested object —
double-encode it (`{"json": "{\"headers\":{...}}"}`) if you're scripting
credential creation via the API.

## 3. Import the workflow

1. In n8n: **Workflows → Import from File** → select `content-video-pipeline.json`.
2. n8n creates all 27 nodes and connections, but every node referencing a
   credential (by id) will show as unlinked until you create the credentials
   above and rebind each node to the real one — credential IDs aren't
   portable across n8n instances.
3. Set the workflow as its own **Error Workflow** (Workflow Settings → Error
   Workflow → select this workflow) so the `Error Trigger` node fires on
   unhandled node failures and logs a `status: 'failed'` row to Supabase.

## 4. Run it

- **Manual test**: trigger via the `Manual Trigger` node (Test Workflow).
- **Scheduled**: the `Schedule Trigger` node runs daily at 2am server time —
  active as soon as the workflow is activated. Currently **left inactive**
  intentionally — see cost note below before activating.

The workflow loops: 10 themes × `VIDEOS_PER_THEME` (default 3) prompts each
→ ~30 videos (+ 30 thumbnails) per run. Adjust `VIDEOS_PER_THEME` or the
`THEMES` array in the **Set Config** node to change batch size — themes
should stay in sync with [`../content/video-themes.md`](../content/video-themes.md).

## How it works

1. **Set Config** — fixes `VIDEO_API` (`veo`), `VIDEOS_PER_THEME`, and the `THEMES` list for the run.
2. **Split By Theme** loops one theme at a time into **Generate Prompts (Claude)**, which asks `claude-haiku-4-5-20251001` for `VIDEOS_PER_THEME` cinematic prompts (each prompt doubles as the thumbnail's still-frame description) and returns them as JSON.
3. **Parse Claude Response** extracts the JSON array (fans 1 Claude response out into N prompt items — runs in `runOnceForAllItems` mode, not per-item); **Split By Prompt** loops one prompt at a time.
4. **Generate Video (Veo)** POSTs to `veo-3.1-generate-preview:predictLongRunning` (8s, 9:16 portrait) and **Store Operation Name** saves the returned long-running operation name.
5. **Generate Thumbnail (Gemini)** POSTs to `gemini-2.5-flash-image:generateContent` with `generationConfig.responseModalities: ["IMAGE"]` (synchronous — no polling) using the same prompt; **Decode Thumbnail** finds the `inlineData` part in the response and turns its base64 payload into binary; **Upload Thumbnail to R2** stores it at `images/{theme}/{operationId}.png`.
6. **Wait 30s → Poll Veo Operation → Read Poll Status** checks the operation. This is a quality-first batch job (runs offline overnight), so the poll loop is patient: Veo jobs typically resolve in 60–90s, but the loop tolerates up to **10 retries at a 30s interval** (~5.5 minutes total) before giving up on a single video — **Increment Attempt → Check Retry Limit** tracks the count across loop iterations.
7. On success (`operation.done && !operation.error`, with a video URI present): **Download Video** (authenticated with the Google AI credential, since Google's file URIs aren't public) **→ Upload to R2 → Save to Supabase** (status `active`, `r2_url` + `r2_thumbnail_url` both set), then **Wait Between Videos** (5s, rate-limit friendly) before looping to the next prompt.
8. On Veo-reported error or retry-limit exhaustion (timeout): **Log Failure to Supabase** writes a `status: 'failed'` row — including the last known status and poll-attempt count in `r2_key` for debugging — and the loop continues to the next prompt.
9. Any unhandled node error anywhere in the run is caught by **Error Trigger → Log Critical Failure**.

## Estimated cost per run

> Pricing changes — verify current rates on Google's [Gemini API pricing
> page](https://ai.google.dev/gemini-api/docs/pricing) before relying on
> this. Confirmed against that page on 2026-06-30: Veo 3.1 Standard (720p/1080p,
> audio included) is **$0.40/sec**; Gemini 2.5 Flash Image is **$0.039/image**
> (up to 1024×1024). The workflow doesn't pin an explicit resolution on the
> Veo request — if Google's default ever lands in the 4K tier, that's
> $0.60/sec instead of $0.40/sec.

```
10 themes × 3 videos/theme = 30 videos + 30 thumbnails

Video:     30 × 8 seconds × $0.40/sec ≈ $96.00/batch
Thumbnail: 30 × $0.039               ≈  $1.17/batch
                                     ─────────────
                                     ≈ $97.17/batch
```

This is markedly more expensive than a faster/cheaper video API — that's the
deliberate trade-off: this pipeline runs offline overnight and prioritizes
output quality over cost or generation speed. Claude Haiku prompt-generation
calls (10 requests/run, ~1K output tokens each) add well under $0.05/run and
are not a meaningful cost driver. Adjust `VIDEOS_PER_THEME` to scale spend
linearly — e.g. 5 videos/theme ≈ $162/batch.

## Known model deprecation

Imagen 4.0 (`imagen-4.0-generate-001`, the model this pipeline originally
used for thumbnails) is deprecated and Google has stated it shuts down
**2026-08-17**. Already migrated to Gemini 2.5 Flash Image for that reason —
no action needed, just documenting why the thumbnail node doesn't match
earlier conversation history if you're reading old commits.
