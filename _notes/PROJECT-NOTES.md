# What Mile? — Running Notes

A living log for this project: what's been worked on, known bugs/issues, and what's next. Update this whenever something ships, breaks, or gets deprioritized — not just at the end of a session.

**How this differs from `.claude/status.md` and `.claude/CLAUDE.md`:** those live in `.claude/` and are Claude Code's working context (current focus, durable project rules) — optimized for a coding agent picking up a task. This file is a plain chronological journal, for tracking what actually happened over time and why. Update both when something significant lands; they serve different purposes and can drift independently without a problem.

---

## Known bugs / issues

- **Admin upload rate limit** — bumped to 500/hour as a temporary workaround (auth-based bypass not yet built). Fine for now, revisit before public admin access is ever considered.
- **Admin password gate** — was removed (found to be ineffective client-side-only protection), then reverted back in. Needs an actual fix, not just a revert — currently unresolved either way.
- **`scripts/data/mile-calibration.json`** — known name-collision bug and a ~400-mile gap with no valid anchors. Do not use as a data source (trail-mile UI is intentionally not built yet, in part because of this).
- **`select_game_photos` Supabase RPC** — lives only in the Supabase SQL editor, not in any migration file. Inspect via `select * from select_game_photos(5, 1.0)` directly; not tracked in version control yet.

---

## Next priorities

Roughly in order:

1. **Merge `feat/core-redesign` to main.** Run `schema-v7.sql` (tightens the score CHECK constraint 2200 → 2197.9) as close to deploy as possible — there's a window where old production code could produce scores the new constraint would reject.
2. **Photo recognition** — not started.
3. **Footer info + "about me" callout** (with a link out) — not started.
4. Continue bulk photo upload/approval via `/admin`, batch by batch.
5. **Trail-mile accuracy** ("Road A") — re-pull the AT centerline from OSM as an ordered path, fixing the calibration bugs above, so `mile_nobo`/`mile_sobo` can actually be surfaced in the UI.
6. Regenerate photo descriptions once mile/shelter data is populated (descriptions can then reference real trail context).
7. **Monetization** — affiliate gear links (REI, Backcountry, Garmin, Amazon Associates) on the summary screen, leaning on James's thru-hiker credibility. Direct sponsorship is a later goal once Daily Challenge has retention data.
8. Shareable result card (post-v1).
9. Direct-to-R2 presigned PUT uploads, to reduce Vercel Fast Origin Transfer (explored, not implemented).
10. Client-side GPS pre-filter, to avoid uploading photos the server would reject anyway.

---

## Session log

Newest first.

### 2026-08-13 — Core loop stabilization, resume, and a very long CSS chase

Big session, mostly bug-fixing rather than new features — the redesign had accumulated real regressions that only showed up under actual play.

**Shipped:**
- Bigger, directly-interactive map by default on both platforms (was requiring an extra tap to expand before it was usable at all, especially bad on mobile).
- Persistent map view across rounds — no longer resets to full-trail view every round, no longer fully remounts (was `key={currentRound}`, forcing a fresh Leaflet instance every time).
- Round result moved from a separate full-screen swap to an overlay on the photo panel, with a minimize-to-strip control (mirrors the original pre-redesign app's simplicity, which turned out to be a good reference point throughout this session — see retro note below).
- Real Daily Challenge resume: leaving mid-game and coming back now shows the entry veil with "Resume Round N," restores prior round scores into game state, rather than silently restarting or blank-screening.
- Fixed a blank-screen bug on `/daily` — root cause was a reverted admin-password-gate commit, not the UI work it was first suspected to be part of.
- Removed map expand/collapse entirely. It was the source of nearly every layout regression this session (mobile clipping, button/toggle overlap, several different "shifting" bugs) because it introduced a resizable container that other elements were implicitly depending on. The bigger default map size (from earlier in the session) made the expand affordance mostly redundant anyway.
- Found and fixed a real CSS specificity bug: a shared `.btn-primary:active { transform: scale(0.97) }` rule was silently overriding a component's own centering `transform`, only while the button was actively pressed — invisible from reading the file at rest. Root-caused via a live DevTools-style trace after several rounds of container/layout theories didn't pan out. Added a permanent rule about this to `.claude/CLAUDE.md` under "CSS discipline."

**Not done, explicitly deferred:** photo recognition, footer/about-me callout. Flagged directly by James mid-session as the actual feature work that didn't move — everything above was fixing self-inflicted regressions, not new capability. Worth remembering going into the next session: the branch is in a materially more stable state now than at the start of this one, even though it doesn't look like forward motion from a feature-list perspective.

**Retro note worth keeping:** comparing screen recordings of the original (pre-redesign, still-live production) app against the redesign directly was the single most useful debugging input this session — more than any code review. The original's simplicity (fixed layout, nothing resizes, ever) wasn't just nostalgia, it was the reason it never broke. Worth reaching for a side-by-side comparison earlier next time something feels "off" rather than late.
