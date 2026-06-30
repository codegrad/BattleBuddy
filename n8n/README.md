# Content Video Batch Pipeline

n8n workflow that generates the AI video library for the home screen's
swipe-right content feed: Claude writes per-theme prompts, **Google Veo 3.1**
renders the clips, **Imagen 4.0** renders a matching thumbnail, Cloudflare R2
stores both, and Supabase catalogues the results for the mobile app to query.

## 1. Run the Supabase migrations first

```sh
psql "$SUPABASE_DB_URL" -f ../server/migrations/005_content_videos.sql
psql "$SUPABASE_DB_URL" -f ../server/migrations/006_content_videos_thumbnails.sql
```

Or paste the file contents into the Supabase SQL Editor, in order. `005`
creates the `content_videos` table; `006` adds the `r2_thumbnail_url` column
for the Imagen-generated thumbnail. The workflow will fail on every "Save to
Supabase" / "Log Failure to Supabase" node until both have run.

## 2. Required environment variables

Set these in n8n (Settings → Environment Variables, or your n8n host's env)
before running the workflow:

| Variable | Used for |
|---|---|
| `ANTHROPIC_API_KEY` | Generating per-theme video prompts via Claude (Messages API) |
| `GOOGLE_AI_API_KEY` | Generating video (Veo 3.1) and thumbnails (Imagen 4.0) via the Gemini API |
| `CF_ACCOUNT_ID` | Building the R2 S3-compatible endpoint (used in the R2 credential, not directly in node params) |
| `CF_R2_PUBLIC_URL` | Public base URL for the R2 bucket, used to build `r2_url` / `r2_thumbnail_url` rows in Supabase |
| `SUPABASE_URL` | Supabase project REST URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key — needed to insert past RLS |

The R2 upload itself uses an n8n **S3 credential** (R2 is S3-compatible), not
an env var on the node — see step 4 below.

## 3. Import the workflow

1. In n8n: **Workflows → Import from File** → select `content-video-pipeline.json`.
2. n8n will create all 27 nodes and connections as-is — nothing needs to be
   rewired, but two things need configuring post-import (steps 4–5).
3. Set the workflow as its own **Error Workflow** (Workflow Settings → Error
   Workflow → select this workflow) so the `Error Trigger` node fires on
   unhandled node failures and logs a `status: 'failed'` row to Supabase.

## 4. Configure the R2 credential

The **Upload to R2** and **Upload Thumbnail to R2** nodes use n8n's built-in
S3 node type pointed at Cloudflare R2's S3-compatible endpoint. Create a
credential named `Cloudflare R2 (S3-compatible)`:

- **Endpoint**: `https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com`
- **Region**: `auto`
- **Access Key ID**: `CF_R2_ACCESS_KEY`
- **Secret Access Key**: `CF_R2_SECRET_KEY`
- **Force Path Style**: enabled

Then assign it on both R2-upload nodes (they're referenced by name on
import; n8n will prompt you to bind them to a real credential).

## 5. Run it

- **Manual test**: trigger via the `Manual Trigger` node (Test Workflow).
- **Scheduled**: the `Schedule Trigger` node runs daily at 2am server time —
  active as soon as the workflow is activated.

The workflow loops: 10 themes × `VIDEOS_PER_THEME` (default 3) prompts each
→ ~30 videos (+ 30 thumbnails) per run. Adjust `VIDEOS_PER_THEME` or the
`THEMES` array in the **Set Config** node to change batch size — themes
should stay in sync with [`../content/video-themes.md`](../content/video-themes.md).

## How it works

1. **Set Config** — fixes `VIDEO_API` (`veo`), `VIDEOS_PER_THEME`, and the `THEMES` list for the run.
2. **Split By Theme** loops one theme at a time into **Generate Prompts (Claude)**, which asks `claude-haiku-4-5-20251001` for `VIDEOS_PER_THEME` cinematic prompts (each prompt doubles as the thumbnail's still-frame description) and returns them as JSON.
3. **Parse Claude Response** extracts the JSON array; **Split By Prompt** loops one prompt at a time.
4. **Generate Video (Veo)** POSTs to `veo-3.1-generate-preview:predictLongRunning` (8s, 9:16 portrait) and **Store Operation Name** saves the returned long-running operation name.
5. **Generate Thumbnail (Imagen)** POSTs to `imagen-4.0-generate-001:predict` (synchronous — no polling) using the same prompt; **Decode Thumbnail** turns the returned base64 PNG into binary; **Upload Thumbnail to R2** stores it at `images/{theme}/{operationId}.png`.
6. **Wait 30s → Poll Veo Operation → Read Poll Status** checks the operation. This is a quality-first batch job (runs offline overnight), so the poll loop is patient: Veo jobs typically resolve in 60–90s, but the loop tolerates up to **10 retries at a 30s interval** (~5.5 minutes total) before giving up on a single video — **Increment Attempt → Check Retry Limit** tracks the count across loop iterations.
7. On success (`operation.done && !operation.error`, with a video URI present): **Download Video** (authenticated with `x-goog-api-key`, since Google's file URIs aren't public) **→ Upload to R2 → Save to Supabase** (status `active`, `r2_url` + `r2_thumbnail_url` both set), then **Wait Between Videos** (5s, rate-limit friendly) before looping to the next prompt.
8. On Veo-reported error or retry-limit exhaustion (timeout): **Log Failure to Supabase** writes a `status: 'failed'` row — including the last known status and poll-attempt count in `r2_key` for debugging — and the loop continues to the next prompt.
9. Any unhandled node error anywhere in the run is caught by **Error Trigger → Log Critical Failure**.

## Estimated cost per run

> Veo/Imagen pricing changes — verify current rates on Google's Gemini API
> pricing page before relying on this. As of this writing, Veo 3.1 (with
> audio) runs roughly **$0.40/second** of generated video; Imagen 4.0 is
> roughly **$0.04/image**.

```
10 themes × 3 videos/theme = 30 videos + 30 thumbnails

Video:     30 × 8 seconds × $0.40/sec ≈ $96.00/batch
Thumbnail: 30 × $0.04               ≈  $1.20/batch
                                    ─────────────
                                    ≈ $97.20/batch
```

This is markedly more expensive than a faster/cheaper video API — that's the
deliberate trade-off: this pipeline runs offline overnight and prioritizes
output quality over cost or generation speed. Claude Haiku prompt-generation
calls (10 requests/run, ~1K output tokens each) add well under $0.05/run and
are not a meaningful cost driver. Adjust `VIDEOS_PER_THEME` to scale spend
linearly — e.g. 5 videos/theme ≈ $162/batch.
