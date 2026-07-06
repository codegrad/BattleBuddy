# BattleBuddy — UX & Agent Experience Plan

**North star: "Always Here. Always Helpful. Always Heard."**
The feeling of being known, remembered, and cared for IS the product. Everything in this plan serves that.

*Doc 8 of the spec package. Prepared July 2026 · grounded in the live codebase (build 38, v1.3.1), 108 real sessions with Mike, and the BattleBuddy agent operations/architecture contracts. Intended to be shareable with collaborators.*

---

## Context

BattleBuddy has crossed the hardest threshold: the voice loop works, the memory pipeline works, and the founder uses it daily as a real quitter. Session 36 was the trust inflection point — BB remembered, and Mike said *"That's the thing with people — remember. So far, so good."*

But BB today is a **reactive** companion with **good memory and no initiative**. It never reaches out. Its event vocabulary is too coarse to capture how quitting actually works (urges without outcomes, conscious decisions vs. slips, triggers as first-class data). The user can't see their own journey. And a few reliability gaps (text-session extraction, duplicate messages) still occasionally break the illusion of being known — and every break costs trust that took weeks to build.

This plan defines what "premier personalized AI experience" means concretely, and sequences the work: **trust reliability → richer event language → proactive engagement (the moat) → visible journey → biometrics and beyond.**

---

## 1. Current State Assessment

### What exists and works

| Capability | Where | Honest grade |
|---|---|---|
| Voice sessions (LiveKit + Deepgram STT/TTS + Haiku streaming) | `agent/agent.py`, `server/index.js` `/livekit/token` | **A-** — sub-1s first token, 73-msg sessions verified, prompt caching on |
| Text chat (SSE streaming, same brain) | `/session/turn`, `mobile/src/components/chat/ChatBottomSheet.tsx` | **B** — works, but no session-end guarantee and no entity presence on screen |
| Memory pipeline (Sonnet extraction → profile JSON → prompt injection) | `server/contextAgent.js`, context-store volume | **A-** — the differentiator; corrections overwrite; verbatim quotes; capped at 12K |
| Long-term recall (Postgres FTS `user_memories` + transcript search) | `server/vectorStore.js`, `recall_conversation` tool | **B+** — wired into every turn with 800ms budget; FTS not semantic |
| Event log (`bb_events`) + agent tools | `get_usage_stats`, `log_event`, `update_event` in `server/index.js:210–307` | **B** — live end-to-end (BB answered "when was my last cigarette" in prod), but taxonomy is coarse |
| Session analysis (trigger/outcome/arc/what-helped reports) | `/session/report` → `bb_events` as `session_report` rows | **B** — voice guaranteed, text not |
| Mascot-centric hub UI (no tab bar, 4-way swipe, 7-state animated mascot) | `mobile/src/components/home/`, `mascot/` | **A-** — distinctive, alive, ethereal design pass done |
| Push/nudge infrastructure | `server/notifications.js`, risk-window sweep in `index.js:1998–2080`, `usePushSetup.ts` | **C** — fully scaffolded (quiet hours, ≥90-min gap, ≤3/day, deep links) but **inert**: push tokens not yet registering, sweep unverified in prod |
| Client-side biometric/engagement stubs | `mobile/src/services/biometricStream.ts`, `engagementEngine.ts` | **D** — thresholds and window state machine sketched on device, nothing wired to backend |
| Basic stats screens (streak, resist rate, milestones, history, insights) | `mobile/app/(app)/analytics.tsx`, `goals.tsx`, `history.tsx`, `insights.tsx` | **C+** — scaffolding exists; thin data, no charts, insights are raw reports |
| Content feed (R2 videos, 10 themes stocked, served via `/content/feed`) | `content-feed.tsx`, `contentFeedService.ts` | **C+** — works; only a few active videos; no curation/moment-matching |

### Where the agent falls short of "premier"

1. **BB never makes the first move.** The proactive vision — *"I'm not waiting for you. You're not waiting for me."* — is the core differentiator, and it is 0% live. The scheduler exists; the pipe (push token → nudge → deep-linked conversation) has never fired for a real user.
2. **Memory is strong on facts, weak on rhythm.** BB knows Alec, the patch, the 45 years. It does not yet reliably hold Mike's *temporal* shape — the 4:50pm patch-off choice point, the morning drive, the evening danger zone — as operational data it acts on. `risk_windows` exists as a table and profile field but is sparsely populated and never drives behavior.
3. **The event vocabulary can't say what actually happens.** Today: `cigarette`, `urge_resisted`, `urge_gave_in`, `milestone`. Missing: an urge that's still in progress, the *trigger* as structured data, and Mike's key distinction — a **Decision** ("I'm going to have one" is a conscious choice, not a slip). Without these, both the agent's understanding and the future dashboard are built on lossy data.
4. **Reliability gaps still break the spell.** Text sessions only generate reports if the app remembers to call `/session/report`. The transcript audit caught duplicate BB messages, a wrong-name greeting, and a breathing-protocol misfire ("I'm not trying to resist" → BB launched Rule of Three anyway). Each one is a "you don't actually know me" moment.
5. **The user can't see their journey.** Analytics shows three numbers. There's no trend, no time-of-day picture, no "what works for you," no arc. For a product whose therapy is self-understanding, this is a major missing organ.
6. **Single-user assumptions everywhere.** Local AsyncStorage auth with `user-{timestamp}` IDs, identity aliasing to Mike's profile, RLS workarounds via server endpoints. Fine for n=1; blocks Alec.

### What matters most (triage)

**Fix first (trust):** text-session extraction guarantee, duplicate-message bug, push-token registration.
**Build next (differentiation):** taxonomy v2, proactive v1, personal schedule model.
**Then make visible (retention):** records/milestones, journey dashboard, BB-voiced insights.

---

## 2. The Personal Agent — What "Premier" Looks Like

### The test

After one week, a new user should think: *"It actually knows me."* After one month: *"How did you know to message me right then?"* Premier is not more features — it's the compounding accuracy of one relationship. The governing question before every single response (already in the system prompt, keep it sacred): **"Is my motive to get them through their urge or their current plan for resistance?"**

### What BB must know (the knowledge model)

Three memory tiers, all of which already exist in some form — the work is making each one *operational*, not just stored:

| Tier | Contents | Today | Gap |
|---|---|---|---|
| **Working** (this conversation) | Live transcript, trigger context, current emotional read | ✅ | Emotional read is implicit; no intensity signal |
| **Episodic** (what happened when) | Session reports, raw transcripts, `bb_events` timeline, `user_memories` | ✅ | Event timeline too coarse; recall is keyword FTS |
| **Semantic** (who this person is) | Profile JSON: family, quit mechanics, triggers, coping efficacy, verbatim quotes, `life_architecture`, `unknowns[]` | ✅ | Missing a first-class **personal schedule model** (see below) |

**The personal schedule model** is the single biggest addition. Per Mike's vision (recorded 2026-06-24): structure emerges from *conversation, not questionnaires*. The context agent should be extended to extract and maintain, inside the profile:

- **Routine blocks** — "work 9–12 protects him," "drives to the gym mornings," "patch comes off ~4:50pm."
- **Vulnerability windows** — time-of-day + day-of-week + why ("evenings: patch off, resistance drops"). These populate `risk_windows` (already in the profile schema) with a *reason string*, not just a weight — because the outreach message must say *why* ("I know this hour is rough for you"), never "an algorithm flagged you."
- **Life-change watch** — new job, travel, stress events that should trigger model updates through conversation ("You mentioned starting a new job — how's the stress been different?").

This is not a prediction engine. It's a sponsor who's been paying attention. The extraction prompt in `contextAgent.js` and the profile schema both need a dedicated `schedule_model` section with per-window provenance (which conversation taught us this).

### How the agent uses its stores each conversation (context assembly contract)

Adopt the operations-skill contract: **before every generation**, the context bundle answers five questions. Map onto the existing placeholder system in `server/prompts/system.battlebuddy.md`:

| Contract element | Existing placeholder | Change needed |
|---|---|---|
| Situation now (time, gap since last session, trigger context) | `{{session_context}}`, `{{trigger_context}}` | Add **last-event awareness**: minutes since last cigarette/urge from `bb_events`, current risk-window status ("it's 4:52pm — inside his patch-off window") |
| What's distinctive about now | — (new) | Computed line: how now differs from this person's normal (needs schedule model) |
| Journey phase | `{{profile}}` (implicit) | Surface `batchProfiler.js` phase (active_resistance / tapering / relapse) explicitly — one line, drives tone |
| What worked before, for THIS person | `{{profile}}` coping/what_works + `{{relevant_memories}}` | Rank coping strategies by observed efficacy (see §5), not just recency |
| Who/what matters (tone) | `{{profile}}` quotes, family | ✅ largely works |

Rules that stay non-negotiable (from 38 sessions of corrections): observe, don't interrogate. One question at a time. Never mention internal state ("my profile says…" is forbidden). Never fabricate history — say so when you don't know. Corrections overwrite, period. Quote the user's own words back — verbatim quotes are the most powerful tool BB has.

### Proactive engagement — when BB reaches out and what it says

Adopt the four-state runtime model from the operations contract: **LISTENING** (default, silent, logging) → **REACHING_OUT** (only when an engagement window closes unanswered) → **IN_CONVERSATION** → **RELAPSE_TRACKING** (sustained non-resisting phase: lower frequency, stay warm, gather next-attempt intelligence — BB never disappears).

**The engagement window is the nuance that keeps BB from being a nag.** A risk signal never auto-sends. It opens a window (single system-wide config value); if the user self-engages during it, that's logged as `SELF_INITIATED` (a *positive, distinct* event — the independence signal we'll chart later) and outreach is cancelled. Only an expired window triggers outreach, logged as `PROMPTED`. The client-side `engagementEngine.ts` already sketches exactly this machine — it moves server-side where the scheduler lives.

**Proactive maturity ladder** (build in this order):

1. **Stage A — Time-based (30 days).** The risk-window sweep already in bb-server, made real: schedule model populates windows → sweep checks user's local time → engagement window logic → push. Guards already implemented and kept: quiet hours (22:00–08:00), ≥90 min between nudges, ≤3/day, skip if session <1h ago.
2. **Stage B — Event-informed (90 days).** Outreach triggers from the event log, not just the clock: unusual gap since last log, a logged urge with no resolution, the morning after a disclosed slip (gentle, never about the slip itself), a milestone worth naming.
3. **Stage C — Biometric-informed (post-90).** HealthKit stream → server anomaly classification against personal baselines → same window machine. The device stubs (`biometricStream.ts`) become real ingestion.

**What outreach says.** Never "Stay strong! 💪" — hollow outreach erodes trust faster than silence. Every proactive message must contain: (a) recognition of the *specific* moment, (b) one personally-precedented option, (c) autonomy. Template from the contract, in BB's voice:

> *"Hey — it's almost 5. I know this is the hour the patch comes off and things get loud. Last Tuesday you walked the garage loop and it passed. Want to try that, or just talk for a minute?"*

Tapping the notification deep-links into chat/voice with `trigger_context` pre-set to the risk window (the deep-link plumbing in `usePushSetup.ts` already routes this way). If the user doesn't respond, that's logged too — and BB doesn't sulk or repeat itself.

**Content moments** (from Mike's directive, already partially in the prompt): bedtime → something worth pondering for the subconscious; morning → contextually hopeful; urge → Rule of Three first, content after. Until the library is deep, BB simulates it — a real, fitting quote beats polished-generic. Voice mode: quotes/insights only. Text mode: images, video, quotes.

### The Urge / Trigger / Resist / Decision taxonomy in conversation

**Schema evolution (`bb_events`):**

| Type | Meaning | Status |
|---|---|---|
| `urge` | A craving happened (may still be unresolved) | **new** |
| `urge_resisted` | Rode it out (the "Resist" rep) | exists |
| `urge_gave_in` | Impulse won | exists |
| `decision` | Conscious choice to smoke — *not* a slip | **new** |
| `cigarette` | A cigarette happened (links to `decision` or `urge_gave_in` when known) | exists |
| `milestone` | Marker reached | exists |
| **Trigger** | Not an event type — a **structured metadata dimension** on any event: `{trigger: {category: location\|activity\|emotion\|oral\|social\|time, label, confidence, source}}` | **new** |

Plus `source: conversation | quick_log | extraction | retroactive` on everything, and back-dating as a first-class flow (`occurred_at` ≠ `created_at` is already supported; the tools and prompt must make "I had one last night" trivially loggable at its true time).

**How BB handles each in real conversation — logging is conversational, never a form:**

- **Urge (live):** Rule of Three first — *"Three breaths. Three seconds each. In… out. I'm right here."* Walk all three, THEN ask what's happening. Log the `urge` silently mid-conversation (no "logging that for you" narration; the existing verbal-acknowledgment rule applies only to lookups the user asked for). Critical guard from the transcript audit: if the user says they're *not* trying to resist, don't run the protocol — listen.
- **Trigger:** never "what are your triggers?" BB *observes across sessions* and names patterns when confident: "I've noticed you always light up after you eat." Extraction (`contextAgent.js`) attaches trigger metadata to events from conversation context; the agent confirms tactfully rather than interrogating.
- **Resist:** mark the rep. Tie it to the person's arc, not generic praise: "That's the third evening urge this week you've ridden out." (This is also where records surface — §4.)
- **Decision:** respect it. No judgment, no press. *"Okay. That's a decision, not a slip — there's a difference, and it's yours to make."* Then curiosity, because a decision is the richest data BB gets: what led here, what the moment feels like. Mike's own words: staying in conversation during a slip means BB is *"gaining insight into when and why and how"* — that IS the win. Disclosure of any slip is treated as positive engagement (honesty is what we celebrate), anchored in the larger arc, never a broken anything.

The quick-log menu on the mascot (Resisted / Gave In) extends to the full taxonomy — one tap, optional one-line note, back-datable.

---

## 3. Conversation & Voice Experience

### Voice vs. text — different rooms, same friend

| | **Voice** (primary) | **Text** |
|---|---|---|
| When | The 5–15 minute craving window; hands busy; driving; presence needed | Reflection; bedtime/morning; public places; content delivery |
| Register | Short. If BB talks >10 seconds, it's talking too much. One question max. | Slightly fuller; markdown, images, videos, content cards allowed |
| Content | Quotes/insights spoken only | Full media |
| Latency | First token <1s — this is the product | Streaming SSE, same budget |
| Ending | Users hang up abruptly; that's fine | Sessions trail off; server finalizes (§6) |

The craving moment is where BB earns its existence — when someone is about to light up, they need something to *do* in the next 10 seconds, not a conversation opener. Voice is that channel. Both modes share one brain, one memory, one session (the switch-mode flow already carries the last 10 messages across).

### The session arc

**Opening — the first 5 seconds decide everything.**
- *Returning user, ordinary open:* greet by name + ONE specific remembered thing, then **wait**. Let them set the agenda. Weave in a `next_session_hint` naturally if there is one; never lead with it. Never re-onboard.
- *Resistance mode* (urgent tone, "I need help," known vulnerability window, or arrival via a risk-window nudge): skip pleasantries entirely. Rule of Three immediately.
- *Arrival via proactive nudge:* BB already said why it reached out — continue that thought, don't restart. ("You picked up. What's going on?")
- *New user, first session:* trust, not data. Name, "what's your thing — smoking, vaping, dipping?", brief conversational explanation of how BB works (training partner, every resist is a rep, every slip is data, the more we talk the better I get). Stop after basics. The deep questions come later, through observation.

**Middle — governed by the purpose question.** Observe, don't interrogate. One question at a time. Use the person's own past words. If BB doesn't know something, it asks plainly — never announces the gap. Content offered only when it fits the person and the moment.

**Close — never forced.** Short sessions (one exchange) are normal and good; the user sets the pace. The existing outcome-capture swipe (Resisted / Gave In) stays as an optional, frictionless close for urge sessions — extended with "Decision" and "Just talking" so non-urge sessions aren't forced into a false binary. On close, the extraction run captures disclosures, coping outcomes, and next-session hints.

### Emotional state detection — honest about today, ambitious about later

- **Now (text + voice words):** Haiku infers state from language, pace, and message length; trigger context and time-of-day prime it. The mascot's `empathy` state (slow 2s breathing) mirrors detected heaviness — the UI *showing* that BB noticed is part of being heard.
- **Near-term:** capture urge intensity (1–10) conversationally when natural ("how loud is it right now?") — the field already exists in session history; make it real data. Track intensity start→end per session: that delta is the product working, and it's chartable.
- **Later (post-90):** prosody analysis on the voice stream (energy/pace features, not full emotion AI) as a resistance-mode trigger; biometric corroboration (HR spike + sedentary + evening = pre-urge signature) once Stage C lands.
- **Always:** when unsure, ask — a sponsor checks in; an algorithm assumes.

---

## 4. Gamification Plan

**Decision (settled with Mike, July 2026): personal records, not live streaks.** Records only ever grow. A slip never resets anything visible. No comparison to other users, ever. No day-counter as identity ("Day 14" is a countdown app; BB is a companion). Shame is the saboteur; the abstinence-violation effect ("I already failed, so why stop") is the specific failure mode every mechanic must avoid.

### The three layers

**1. Personal Records (bests — permanent, only improve):**
- Longest stretch between cigarettes (honors tapering — Mike is at ~15/day from 30, not cold-turkey; reduction IS progress)
- Most urges ridden out in a day / a week
- Toughest window survived (an evening ridden out in his known danger zone counts double in spirit)
- Fastest urge crest (intensity drop, once intensity capture lands)
- Lowest-count day vs. personal baseline

**2. Competence Milestones (self-knowledge, from the operations contract — these are the real trophies):**
- "You've mapped your top trigger" · "Three coping moves that work for *you*" · "Ten evening urges ridden out" · "First urge handled with no session at all" (independence) · **"30 days of honest logging"** — honesty *including disclosed slips* is the achievement
- Auto-detected by the extraction/batch layer (milestone detection is currently unwired — §6), logged as `milestone` events, so BB and the dashboard share one source of truth

**3. Journey Milestones (arc markers):** first week below baseline, halved daily count, first full patch-off evening without a cigarette, one month of showing up.

### Surfacing — conversation first, dashboard second

- **BB names it in the moment, at natural beats:** "That's a new record — nine hours. Your longest yet." Mascot `celebrating` state + success haptic. Never every time (badge inflation kills badges); never mid-crisis.
- **Records wall** replaces the current `goals.tsx` streak ladder (1/3/7/14/30/60/100 consecutive resists — a fragile-streak design that must be reworked): a wall of bests and unlocked competence milestones, each with the date and, where possible, the story ("Feb evening, after the drive home").
- **On a slip:** nothing changes on the wall. Nothing greys out. BB's line: a dip in a line that's trending up.

### What progress feels like

- **Day 1:** BB knows your name and your habit. First resist logged = first record ("longest stretch: 3 hours — that's your baseline; everything from here beats it").
- **Week 1:** first pattern named ("evenings are your loud hours"), 2–3 records set, first competence milestone (top trigger mapped). The feeling: *it's paying attention.*
- **Month 1:** records wall has depth; "what works for you" has 2–3 ranked entries; at least one "how did you know to call me right then?" moment. The feeling: *it knows me.*
- **Month 3:** independence trend visible (more self-initiated, fewer prompted; some urges handled with no session at all — which BB celebrates, because success = needing the app less). The feeling: *I'm becoming someone who doesn't need this — and it's proud of me for that.*

---

## 5. Analytics & Dashboard

### Principle

The dashboard is BB's memory made visible — recognition and meaning, never a clinical readout. Every chart should feel like BB saying "look what I've noticed about you," not like a fitness app exporting CSVs. Raw percentages with no meaning are forbidden as the primary voice.

### What the user sees (rework of `analytics.tsx` → a "Journey" screen)

1. **The Arc (hero):** daily cigarette count vs. personal baseline over time — the taper line. One glance answers "is this working?" Slip days are visible, *in context of the trend* — that's deliberate (seeing a dip inside a falling line defuses the shame spiral).
2. **Your Hours (heatmap):** urges/events by time-of-day × day-of-week — the risk-window model made visible. The moment a user sees their own 5pm hotspot is a moment of self-understanding no lecture can produce. ("This is what BB watches for you.")
3. **What Works for You:** coping strategies ranked by observed success rate (walks: 8/10, breathing: 6/9…) — computed from event outcomes + session reports. This is the scientist's gift to the user.
4. **Records Wall** (§4) and **Timeline** (existing `history.tsx`, upgraded to the full taxonomy with trigger chips and retroactive entries rendered honestly).
5. **Independence Trend:** self-initiated vs. prompted engagement ratio over weeks — the mastery signal. Frame: "more and more, you're catching it yourself."
6. **Insight cards** (rework of `insights.tsx`): observations written by the batch job **in BB's voice**, not raw session reports. Precision threshold applies — a handful of consistent instances before asserting; below that, frame as a question ("I might be seeing a thing — do evenings feel harder?"). A confidently wrong pattern erodes the trust everything runs on.

Classic quit-app stats (money saved, cigarettes avoided) — available, not leading. They're motivating for some but they're day-counting in disguise; put them on a card, not the hero.

### The dashboard ↔ agent loop (one brain, two surfaces)

- **Single insight store:** the batch job (`batchProfiler.js` grown into the insight-synthesis engine) writes insight objects (finding + confidence + evidence + BB-voiced text) to `bb_events`/`user_memories`. The app renders them; the same objects are injected into `{{profile}}`/`{{relevant_memories}}` so **BB talks about what the dashboard shows and vice versa**: "Your evening urges have thinned out — it's on your Journey screen, worth a look."
- **Cards talk back:** every insight card has "talk about this" → opens chat with that insight as trigger context.
- **Data plumbing lesson (learned the hard way):** all reads via bb-server endpoints (service role), never direct Supabase queries from the app — RLS silently returned `[]` for weeks. New endpoints: `/stats/journey`, `/stats/heatmap`, `/stats/records`, `/insights`.

---

## 6. Prioritized Implementation Plan

### Sequencing logic

Trust before initiative (a companion that reaches out but misremembers is worse than one that waits). Data before dashboards (taxonomy v2 must land before charts, or we visualize lossy data). Auth before Alec (multi-user readiness gates the second real user). The moat — proactive engagement — ships within 30 days because Stage A needs no new infrastructure, only wiring what exists.

### 30-Day Plan

**Week 1 — Trust & Reliability (fix the spell-breakers)**
1. **Guaranteed text-session finalization:** server-side inactivity timeout finalizes any text session (extraction + report) regardless of whether the app calls `/session/report`. Kills the biggest memory hole.
2. Squash the open regression catalog: duplicate consecutive BB messages, wrong-greeting guard, breathing-protocol misfire guard ("not trying to resist" → listen).
3. **Verify push-token registration end-to-end** on build 38+ (the single gate on all proactive work). Wire quiet-hours preference from `routines.tsx` to the backend scheduler.
4. Session-accounting regression tests (double-count and ghost-session bugs stay dead).

**Week 2 — Taxonomy v2 (teach BB the language of quitting)**
5. `bb_events`: add `urge` + `decision` types, structured `trigger` metadata, `source` field incl. `retroactive` (SQL via Supabase dashboard — Mike pastes; no DB password on dev machines).
6. Update tools (`log_event`, `update_event`, `get_usage_stats`) + voice-agent mirrors + system prompt: conversation-first logging rules, decision-vs-slip distinction, back-dating flow, silent mid-conversation logging.
7. Extend quick-log menu on the mascot to the full taxonomy.
8. Extraction (`contextAgent.js`): attach trigger metadata to mirrored events; begin populating the **schedule model** (routine blocks + vulnerability windows with reasons and provenance) in the profile schema.

**Weeks 3–4 — Proactive v1 (the moat, Stage A)**
9. Activate the risk-window sweep end-to-end: schedule model → engagement-window logic (server-side port of `engagementEngine.ts` semantics; single system-wide window config) → recognition-style nudge composed from the context-assembly bundle → push → deep link into chat/voice with trigger context pre-set.
10. Log `SELF_INITIATED` vs `PROMPTED` engagement as distinct events (feeds the independence trend later).
11. Context-assembly upgrades: last-event awareness + risk-window status + journey phase line injected per turn.
12. **Records v1:** records computation in `batchProfiler.js` (replacing streak logic), rework `goals.tsx` into the records wall, conversational surfacing rules in the prompt.

**30-day exit test:** Mike receives at least one nudge that references his actual pattern at the right moment, taps it, and lands in a conversation that continues the thought. A text session with no explicit close still produces a report. "I decided to have one last night" gets logged as a back-dated `decision` with zero friction.

### 90-Day Plan

- **Journey dashboard v2:** Arc chart, Hours heatmap, What-Works ranking, independence trend, BB-voiced insight cards + `/stats/*` endpoints. Insight-synthesis batch job with precision thresholds (time-of-day clustering, pre-lapse sequences, coping efficacy, cross-attempt comparison).
- **Auto-milestone detection** wired (extraction + batch → `milestone` events → conversational celebration + wall).
- **Emotional responsiveness:** conversational intensity capture (start→end delta), empathy-state polish, chat-screen entity presence (open design item).
- **Real Supabase auth** (magic link + Apple Sign-In) → migrate off `user-{timestamp}` IDs → **invite Alec** (the second real user, and the vaping test of the taxonomy).
- **Proactive Stage B:** event-informed outreach (unresolved urges, unusual gaps, morning-after check-ins, milestone moments). RELAPSE_TRACKING state honored: sustained non-resisting phase → lower frequency, warm presence, next-attempt intelligence.
- **Content system growth:** more videos through the n8n pipeline; `suggest_media` tool so BB can pull the right item at the right moment (mode-aware: voice = spoken quotes only); "Helped?" engagement persisted to `user_media_stats` to close the personalization loop.
- **HealthKit ingestion v1 (Stage C start):** device stream → server baselines → anomaly classification into the same engagement-window machine. Sub-second, no LLM in the detection path.
- **Privacy debt:** transcripts currently sit plaintext on the Railway volume; encrypt at rest and revisit the local-first model (personal history on device, anonymized derivatives in cloud) per the architecture contract. Export-my-data endpoint (UI placeholder exists).

### Beyond 90 days

BB Network (opted-in cohort wisdom surfaced at the right moment — peer insight, never comparison), on-device model for the instant/offline tier, dedicated hardware exploration, and the funding story: by then the demo is "watch BB reach out at exactly the right moment and reference exactly the right memory" — which no other cessation product can show.

### Success measures

- **The sentence:** Mike (then Alec) spontaneously asks "how did you know to message me right then?"
- First agent token <1s, held (measured, per CLAUDE.md).
- Text sessions with reports: 100%. Wrong-memory incidents per week: 0.
- Honest logging persists after slips (disclosure rate doesn't drop post-slip — the shame-free design working).
- Independence ratio (self-initiated : prompted) rises month over month — success is needing the app less.

### Constraints honored throughout

Habit app, not crisis product — light safety footing stays exactly as is (988 disclaimer + soft model-level off-ramp; no crisis machinery). No medical/dosing advice. No shaming, no pain-based coping, always honest it's an AI. RLS + server-side keys + no conversation content in analytics. The working LiveKit + Anthropic path is preserved at all costs — everything here attaches at existing seams.
