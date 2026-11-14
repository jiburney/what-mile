# Daily summary redesign: design reference

Source canvas (Claude Design, owner-only): https://claude.ai/artifact/FNEu5GVAde5AEqn7h5MSff
Exported here on 2026-11-14 so Claude Code can read it. The canvas is the visual
source of truth. This file records its values plus decisions made after it.

## Decisions that override the canvas

- Layout: mobile uses **Option B** ("sign in from the Shelter Log"). There is no separate
  sign-in panel ("TrailRegister"); signing happens in the player's own Shelter Log row.
- **No year hiked anywhere.** The canvas still shows a "Year hiked" select and
  "[Trail name] · [year]" rows. Ignore both. The DB column `year_hiked` stays, unused.
- Name field: one text input, visible label **"Name or trail name"**, maxLength 50.
- Unsigned players appear to others as **"Anonymous hiker"**.
- Signed player's own row: `<name> (you)` (no year suffix).

## Page order

Mobile (390 wide, padding 24px 16px 40px, sections gap 28px):
1. Header  2. Score hero  3. Recap map  4. Photo list  5. Shelter Log  6. Summary actions

Desktop (content 1200 wide, padding 48px 0 64px, gap 40px):
- Row 1: two columns `minmax(0,1fr) 560px`, gap 48px: left = Score hero + Summary actions,
  right = Recap map
- Row 2: Photo grid (5 columns)
- Row 3: Shelter Log

Page background `#f7f4ef`, body text `#1a1a18`.

## Type and color tokens

- Display / numbers: Zilla Slab 700 (fallback Georgia, serif). Body: Source Sans 3
  (fallback system-ui). Adding these web fonts is a separate prompt; until then use
  existing tokens.
- Green (primary, header) `#2d5016`; darker green border `#1f3a0e`
- Cream `#f7f4ef`; secondary text `#4a4a42`, `#3d3b36`
- Shelter Log frame brown `#5a4430`; log rule lines `#ddd5c4`; own-row highlight `#e3ead8`
- Input border `#b9c4a8`; error text `#8a2a1a`
- Tier colors: Thru-Hiker `#2d6a1e`, LASHer `#6b5d0f`, Section Hiker `#a5561a`,
  Day Hiker `#a3321f`

## Shelter Log (component: ShelterLogSignIn)

Structure:
- Outer `section`: background `#5a4430`, radius 10px, padding 6px
- Inner frame: 2px border `rgba(247,244,239,0.55)`, radius 6px, padding mobile
  `16px 12px 14px` / desktop `22px 24px 24px`, column, gap 12px
- Header row (cream text `#f7f4ef`): "Shelter Log" (Zilla Slab 700, 22px mobile / 26px
  desktop) left; "[N] hikers today" (14px, `#efe6d6`) right
- Log page: `ol`, background `#f7f4ef`, radius 4px, padding `4px 12px`
- Rows: grid columns mobile `26px minmax(0,1fr) 64px` / desktop `36px minmax(0,1fr) 90px`,
  gap 8px, padding 11px 0, 1px bottom border `#ddd5c4`, font 15px mobile / 16px desktop.
  Columns: rank (700), name (ellipsis), score (right-aligned, Zilla Slab 700)
- Gap marker row: centered "· · ·", color `#6b675f`, letter-spacing 0.3em

Which rows show:
- Player rank 1-5: ranks 1-5 with the player's row in place
- Player rank > 5: ranks 1-3, gap marker, then the player's row with real rank

The player's row (always present once the score is saved):
- `li` with margin `6px -8px`, padding `10px 8px`, background `#e3ead8`, radius 6px,
  column, gap 10px, `aria-label="Your entry"`
- Top line uses the same grid as other rows: rank / name / score
- **Unsigned:** name "You", with a second line "Not in the log yet" (13px, `#3d4a2f`).
  Below it a full-width "Sign the log" button: 44px tall, background `#2d5016`, text
  `#f7f4ef`, 700, 14px, uppercase, letter-spacing 0.06em, radius 6px
- **Editing:** inside the same row: labeled input "Name or trail name" (label 12px 700;
  input 44px tall, 16px text, border `1px solid #b9c4a8`, radius 4px, white bg), then a
  button row: "Sign" (primary style, flex 1) and "Cancel" (outline, `#b9c4a8` border,
  transparent bg)
- **Error:** same as editing plus `role="alert"` text in the row: "Couldn't save. Try
  again." (14px, `#8a2a1a`). Nothing else on the page moves or disappears
- **Signed:** name reads `<name> (you)`; no button

Focus ring: `2px solid #2d5016`, offset 2px.

## Score hero

- Eyebrow: "Daily Challenge · Oct 12" (mobile) / "Daily Challenge · Monday, October 12"
  (desktop); 12/13px, 700, uppercase, letter-spacing 0.14em, `#4a4a42`
- Headline: "You hiked like a <Tier>." Zilla Slab 700, 34px mobile / 56px desktop
- Score: Zilla Slab 700, 64px / 92px, `#2d5016`; then "/ 2197.9" 20px / 28px `#4a4a42`
- Tier chip (e.g. LASHER) + "67% accuracy" (16px)
- One-line stats sentence (16px / 18px, `#3d3b36`)

## Recap map

Whole-trail map with the five photo locations (numbered green pins `#2d5016`, numbers
match the photo cards) and the player's guesses (cream circles outlined in the round's
tier color, joined to the photo pin by a dashed line). Legend: "Photo location", "Your
guess". Container background `#ede9e1`, radius 10px. Real implementation should use the
existing Leaflet map and trail route, not the canvas SVG.

## Photo list (mobile) / Photo grid (desktop)

- Heading "Your five photos" (Zilla Slab 700, 22px / 26px)
- Mobile: one card per round; tap the row to expand the full uncropped photo and caption
  in place (one open at a time). Row: 76px square thumb with round-number badge, county +
  state, season line, "<distance> off · <tier>", round score, chevron. Hint text "Tap a
  photo to see it whole"
- Desktop: 5-column grid; square image with number badge, state (uppercase eyebrow),
  county, season, distance off, tier, score

## Summary actions

"Share result" (primary) and "Free play" (outline, 2px green border), uppercase 700;
"Next Daily Challenge in Xh Ym". Column/stretched on mobile (52px tall), row on desktop
(48px tall).

## Header

Height 52px mobile / 60px desktop; background `#2d5016`; bottom border 3px `#1f3a0e`;
wordmark "What Mile?" in Zilla Slab 700 (21px / 26px); five round pips; mode label
(desktop only) and running score.
