# Round result redesign: design reference

Source canvas: https://claude.ai/artifact/FNEu5GVAde5AEqn7h5MSff (boards "Round result ·
desktop" and "Round result · mobile"). Shared tokens and the Header spec are in
`daily-summary.md`.

The redesign's layout and interaction rules stay as they are: fixed two-panel layout,
result card over the photo panel, minimize button, persistent action button on the map,
no map resizing during a round, and the map viewport never derived from the answer's
coordinates before the guess is locked. This spec changes the CONTENT and STYLING of the
result card and adds a few map overlays. It does not change behavior.

## Result card (desktop: over the photo, bottom 20px inset; mobile: section between photo and map)

- Card: background `#f7f4ef`, radius 10px, shadow `0 14px 34px rgba(0,0,0,0.4)`,
  padding `18px 20px`, column, gap 12px (desktop)
- **Location as a wooden trail sign:** outer `#5a4430`, radius 6px, padding 3px; inner
  1.5px border `rgba(247,244,239,0.6)`, radius 4px, padding `6px 14px`; Zilla Slab 700,
  22px desktop / 18px mobile, cream text. Content: the round's county + state
  (e.g. "Berkshire County, MA")
- Mobile: month + year taken on the right of the sign ("Aug 2023": 12px, 700,
  uppercase, letter-spacing 0.1em, `#4a4a42`). Omit if no `taken_at`
- Caption (photo description): 16px desktop / 15px mobile, line-height 1.5, `#3d3b36`
- Stat boxes row. Desktop grid `repeat(3, minmax(0,1fr)) 1.2fr`, gap 10px; mobile three
  equal boxes, gap 8px:
  - Box style: white bg, 1px `#e4ddcf` border, radius 6px, padding `10px 12px`
    (mobile `8px 10px`); label 11px (mobile 10px) 700 uppercase, letter-spacing 0.12em,
    `#4a4a42`; value Zilla Slab 700, 24px (mobile 19px)
  - "Off by" → distance ("57 ft" under 1 mile, else "N mi")
  - "Tier" → round tier, value colored with the tier color
  - "Round score" (mobile label "Round") → round score
  - Desktop only, 4th box: green `#2d5016` bg, cream text, label "Total after N of 5",
    value = running total
- Minimize button stays (44px, white, 1px `#d8d2c4` border, radius 6px)

## Map overlays during the result

- Guess pin `#a5561a`, photo pin `#2d5016` (both white 2px outline)
- Dashed line between them (`#1a1a18`, 2px, dash 4 4) with a distance label chip
  (dark `#1a1a18` rounded rect, white 700 text, e.g. "57 ft")
- Legend chip top-left: "Photo location" (green dot) / "Your guess" (orange dot)
- Mobile: running total chip ("TOTAL" + value) beside the persistent action button
