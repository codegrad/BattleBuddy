# BattleBuddy — UX & Agent Experience Plan

**North star: "Always Here. Always Helpful. Always Heard."**
The feeling of being known, remembered, and cared for IS the product. Everything in this plan serves that.

*Doc 8 of the spec package. Prepared July 2026 · grounded in the live codebase (build 38, v1.3.1), 108 real sessions with Mike, and the BattleBuddy agent operations/architecture contracts. Intended to be shareable with collaborators.*

---

## Context

BattleBuddy has crossed the hardest threshold: the voice loop works, the memory pipeline works, and the founder uses it daily as a real quitter. Session 36 was the trust inflection point — BB remembered, and Mike said *"That's the thing with people — remember. So far, so good."*

But BB today is a **reactive** companion with **good memory and no initiative**. It never reaches out. Its event vocabulary is too coarse to capture how quitting actually works (urges without outcomes, conscious decisions vs. slips, triggers as first-class data). The user can't see their own journey. And a few reliability gaps (text-session extraction, duplicate messages) still occasionally break the illusion of being known — and every break costs trust that took weeks to build.

This plan defines what "premier personalized AI experience" means concretely, and sequences the work: **trust reliability → richer event language → proactive engagement (the moat) → visible journey → biometrics and beyond** — with privacy hardening (§6) woven through the first 90 days, because the same conversations that make BB valuable are some of the most personal words a user will ever say to software.

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
| Ending | Users hang up abruptly; that's fine | Sessions trail off; server finalizes (§7) |

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
- Auto-detected by the extraction/batch layer (milestone detection is currently unwired — §7), logged as `milestone` events, so BB and the dashboard share one source of truth

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

## 6. Privacy, Trust & Data Ownership

### Principle — two promises with equal weight

BattleBuddy's transcripts are addiction conversations: 2am cravings, slips a user hasn't told their family about, the reasons they started at age nine. That data is health-adjacent and deeply personal, and it is also *the product* — memory is what makes BB a companion. So the privacy stance is two promises, made in the same breath:

1. **"You can always see everything BB knows about you."** Reviewing your own transcripts and profile isn't a compliance checkbox — it's part of feeling heard. Rereading the conversation that got you through a Tuesday evening is product value.
2. **"No one else ever can."** Not other users, not advertisers, not data brokers, not a stranger with a URL. Protection has to be real at the engineering level, not just promised in a policy.

Trust is the moat's foundation: a user who doesn't fully trust BB with the 2am version of themselves will never generate the honest data the whole system runs on.

### Honest inventory — where the data lives and how it's protected today

| Data | Where it lives | Protection today | Target |
|---|---|---|---|
| Raw session transcripts (voice + text) | JSON files on the Railway volume (`context-store/session-transcripts/`) | TLS in transit; **plaintext at rest; read endpoint unauthenticated** | Encrypted at rest; authenticated, per-user access only |
| Profile JSON (facts, quotes, schedule model) | Railway volume (`context-store/{userId}.json`) | Same — **and the `PUT /context/profile/` write endpoint is also unauthenticated** | Same as transcripts |
| Event log, memories, insights | Supabase (`bb_events`, `user_memories`) | RLS designed, but effectively bypassed: no real user auth yet, so all reads flow through server endpoints with the service-role key | Real Supabase Auth so RLS does its job; server endpoints scoped per user |
| Voice audio | LiveKit (transport) + Deepgram (STT/TTS processing) | Not stored by us | Keep it that way — commit publicly: **we never retain audio recordings** |
| Push tokens, engagement stats | Supabase | Standard | Standard |
| Processors (must be named in the policy) | Anthropic (Claude API — does not train on API data), Deepgram, LiveKit, Supabase, Railway, Expo (push), Cloudflare R2 (content only, no user data) | Contracts/ToS | DPA review before scale |

### The gap to close first (blunt, verified July 2026)

`GET /context/transcripts/{userId}`, `GET/PUT /context/profile/{userId}`, and the `/admin/*` endpoints on bb-server have **no authentication**. Anyone who knows the Railway URL and a user ID (which are guessable timestamps) can read every transcript, read or **overwrite** a profile, or trigger admin jobs. Acceptable risk at n=1 with an obscure URL; a disqualifying breach vector for user #2. This is a Week 1 fix (§7): a server shared-secret/bearer token immediately, replaced by per-user tokens once real Supabase Auth lands. Real auth — already on the 90-day plan for multi-user — is equally a *privacy* feature: it's what lets RLS actually protect rows.

Two more honest items the policy must reflect, not hide:
- **Internal AI review exists.** The nightly transcript audit and the agent design loop read session data to catch failures and improve BB. Disclose it plainly ("BB's own quality checks review sessions to make BB better — no human reads your conversations as entertainment, and no data leaves our systems for it"), and offer an opt-out once multi-user.
- **Extraction derivatives.** Deleting a transcript deletes the raw record, but facts already extracted into the profile survive it. Honest deletion means: per-session delete also strips derived memories referencing it, and a full profile re-extraction (without the deleted session) is the guarantee path.

### User controls — the UX of data ownership

1. **See it.** Session cards in `history.tsx` open the **full transcript** (voice sessions included — "what BB heard"). A new **"What BB knows about me"** view renders the profile in human terms: facts, patterns, the schedule model, saved quotes — each with where it came from. This doubles as the memory-trust feature: users test BB's memory anyway (§1); let them see it.
2. **Correct or forget it.** Conversationally first — "that's wrong" already overwrites (persona rule), and "forget that" becomes a supported command. Plus per-fact remove in the profile view and per-session transcript delete (with derivative stripping as above). No argument, no friction, no "are you sure?" guilt trip.
3. **Export it.** One tap in `preferences.tsx` (placeholder exists) → complete readable archive: transcripts, profile, events, insights. Your quit journey is yours to take with you — including to a doctor or a human sponsor.
4. **Delete everything.** In-app account deletion with a full, tested cascade: profile JSON, transcripts, `bb_events`, `user_memories`, vector entries, push tokens. Immediate on request; backup copies purged within a stated window (e.g. 30 days), and that window is disclosed. No retention "for our records," no win-back dark patterns — success was always the user needing BB less.

### What the Privacy Policy & Terms must commit to — in BB's voice, not legalese

Draft the policy the way BB talks: short sentences, first person, no hedging. A lawyer tightens it *after* the human version is right. The commitments:

- **Your conversations belong to you.** We store them for one reason: so BB can remember you. That's the product you're using.
- **We will never sell your data.** No ads, no ad SDKs, no data brokers, no "partners." Ever.
- **Conversation content never leaves the conversation.** Product analytics sees de-identified events only ("a session happened"), never words. (Already an engineering rule — make it a public promise.)
- **Who can see your data:** you; BB's own systems; and the named processors that make BB work (Anthropic, Deepgram, LiveKit, Supabase, Railway, Expo — listed with what each does). Anthropic does not train models on your conversations. Founders and engineers do not browse user conversations; debugging access requires your consent, and automated quality review is disclosed above.
- **We never keep audio.** Voice is transcribed in the moment; recordings aren't stored.
- **Retention:** we keep your data while your account is active, because memory is the service. Delete any of it, or all of it, anytime; backups purge within the stated window.
- **Security:** encrypted in transit everywhere, encrypted at rest (with an honest date for when that's true), access-controlled endpoints, keys never on the device.
- **If we're breached, we tell you** — promptly, plainly, and with what it means for you.
- **Honest scope:** we're not a medical provider and not HIPAA-covered — we protect your data *as if* it were covered anyway, and we never claim compliance we don't have. 18+, US-only for now.
- **If this policy changes, we tell you in plain language** — never a silent update.

**Gate:** the policy/terms and the endpoint lockdown ship **before the second real user** (Alec). Nobody pours their addiction story into an app on a promise we haven't written down yet.

### Longer arc — local-first

The architecture contract's end state remains the goal: personally identifiable history lives **on-device**, the cloud holds encrypted, anonymized derivatives for recall and backup. That inverts today's layout (everything on a server volume) and is post-90-day work — but every near-term decision (encryption at rest, per-user tokens, export format) should be a step toward it, not away from it.

---

## 7. Prioritized Implementation Plan

### Sequencing logic

Trust before initiative (a companion that reaches out but misremembers is worse than one that waits). Data before dashboards (taxonomy v2 must land before charts, or we visualize lossy data). Auth before Alec (multi-user readiness gates the second real user). The moat — proactive engagement — ships within 30 days because Stage A needs no new infrastructure, only wiring what exists.

### 30-Day Plan

**Week 1 — Trust & Reliability (fix the spell-breakers)**
1. **Guaranteed text-session finalization:** server-side inactivity timeout finalizes any text session (extraction + report) regardless of whether the app calls `/session/report`. Kills the biggest memory hole.
2. Squash the open regression catalog: duplicate consecutive BB messages, wrong-greeting guard, breathing-protocol misfire guard ("not trying to resist" → listen).
3. **Verify push-token registration end-to-end** on build 38+ (the single gate on all proactive work). Wire quiet-hours preference from `routines.tsx` to the backend scheduler.
4. Session-accounting regression tests (double-count and ghost-session bugs stay dead).
5. **Lock down bb-server data endpoints** (§6): shared-secret bearer auth on `/context/*` and `/admin/*` (app + voice agent send it; everything else gets 401). Closes the read-anyone's-transcript / overwrite-anyone's-profile hole before any other user exists.

**Week 2 — Taxonomy v2 (teach BB the language of quitting)**
6. `bb_events`: add `urge` + `decision` types, structured `trigger` metadata, `source` field incl. `retroactive` (SQL via Supabase dashboard — Mike pastes; no DB password on dev machines).
7. Update tools (`log_event`, `update_event`, `get_usage_stats`) + voice-agent mirrors + system prompt: conversation-first logging rules, decision-vs-slip distinction, back-dating flow, silent mid-conversation logging.
8. Extend quick-log menu on the mascot to the full taxonomy.
9. Extraction (`contextAgent.js`): attach trigger metadata to mirrored events; begin populating the **schedule model** (routine blocks + vulnerability windows with reasons and provenance) in the profile schema.

**Weeks 3–4 — Proactive v1 (the moat, Stage A)**
10. Activate the risk-window sweep end-to-end: schedule model → engagement-window logic (server-side port of `engagementEngine.ts` semantics; single system-wide window config) → recognition-style nudge composed from the context-assembly bundle → push → deep link into chat/voice with trigger context pre-set.
11. Log `SELF_INITIATED` vs `PROMPTED` engagement as distinct events (feeds the independence trend later).
12. Context-assembly upgrades: last-event awareness + risk-window status + journey phase line injected per turn.
13. **Records v1:** records computation in `batchProfiler.js` (replacing streak logic), rework `goals.tsx` into the records wall, conversational surfacing rules in the prompt.

**30-day exit test:** Mike receives at least one nudge that references his actual pattern at the right moment, taps it, and lands in a conversation that continues the thought. A text session with no explicit close still produces a report. "I decided to have one last night" gets logged as a back-dated `decision` with zero friction. And an unauthenticated request to `/context/transcripts/*` returns 401.

### 90-Day Plan

- **Journey dashboard v2:** Arc chart, Hours heatmap, What-Works ranking, independence trend, BB-voiced insight cards + `/stats/*` endpoints. Insight-synthesis batch job with precision thresholds (time-of-day clustering, pre-lapse sequences, coping efficacy, cross-attempt comparison).
- **Auto-milestone detection** wired (extraction + batch → `milestone` events → conversational celebration + wall).
- **Emotional responsiveness:** conversational intensity capture (start→end delta), empathy-state polish, chat-screen entity presence (open design item).
- **Real Supabase auth** (magic link + Apple Sign-In) → migrate off `user-{timestamp}` IDs → per-user endpoint tokens replace the shared secret, RLS becomes real → **invite Alec** (the second real user, and the vaping test of the taxonomy). Gated on §6: policy/terms published and lockdown verified first.
- **Proactive Stage B:** event-informed outreach (unresolved urges, unusual gaps, morning-after check-ins, milestone moments). RELAPSE_TRACKING state honored: sustained non-resisting phase → lower frequency, warm presence, next-attempt intelligence.
- **Content system growth:** more videos through the n8n pipeline; `suggest_media` tool so BB can pull the right item at the right moment (mode-aware: voice = spoken quotes only); "Helped?" engagement persisted to `user_media_stats` to close the personalization loop.
- **HealthKit ingestion v1 (Stage C start):** device stream → server baselines → anomaly classification into the same engagement-window machine. Sub-second, no LLM in the detection path.
- **Privacy & data ownership build-out (§6):** encryption at rest for the context store; in-app transcript viewer (session card → full transcript) and "What BB knows about me" profile view; export-my-data endpoint + UI (placeholder exists); tested delete cascade (per-session with derivative stripping, and full account); Privacy Policy + Terms written in BB's voice, lawyer-tightened after. All of this lands **before Alec**.

### Beyond 90 days

BB Network (opted-in cohort wisdom surfaced at the right moment — peer insight, never comparison), on-device model for the instant/offline tier, dedicated hardware exploration, and the funding story: by then the demo is "watch BB reach out at exactly the right moment and reference exactly the right memory" — which no other cessation product can show.

### Success measures

- **The sentence:** Mike (then Alec) spontaneously asks "how did you know to message me right then?"
- First agent token <1s, held (measured, per CLAUDE.md).
- Text sessions with reports: 100%. Wrong-memory incidents per week: 0.
- Honest logging persists after slips (disclosure rate doesn't drop post-slip — the shame-free design working).
- Independence ratio (self-initiated : prompted) rises month over month — success is needing the app less.
- A stranger with the server URL can read nothing; a user can see, export, and delete everything (§6's two promises, both verifiable).

### Constraints honored throughout

Habit app, not crisis product — light safety footing stays exactly as is (988 disclaimer + soft model-level off-ramp; no crisis machinery). No medical/dosing advice. No shaming, no pain-based coping, always honest it's an AI. RLS + server-side keys + no conversation content in analytics. The working LiveKit + Anthropic path is preserved at all costs — everything here attaches at existing seams.
