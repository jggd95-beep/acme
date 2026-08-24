# Acme HVAC — project rules (sales tool)

Mike is the comfort-advisor owner. He tests on a phone. Brief replies: **action first**, then Mike's baby + time.

## Advisor-logic test lens (why Mike asks what he asks)

Walk every screen as a comfort advisor on a phone, standing at the equipment.

1. **Name the thing they already picked.** Not “Head 1.” “9k MFZ floor console in Living.” If both brands are live, both names are in the **same** question.
2. **Path is a suggestion, not a lock.** All-new does not mean everything is new. Existing pad / reconnect stay available, buried under **Also**.
3. **Ask in the order they see the house.** Room → style → size, then later Qs about *that* indoor (run, height, control). Filter first on anything with a blower. Pad after outdoor location.
4. **One writer.** Same short voice on every measure. No SKU, no furnish-and-install, no “professionally.”
5. **If it feels messy, it is messy.** Fix the screen he flagged. Do not hide it behind a full-app retest.

If you cannot click it as an advisor and know what you are answering, do not hand it back.

## After a note — paused 2026-08-22

The five-pack hard gate is **off** until Mike says “gate it” or we are about to go live.

Do **not** run `qa:preview` / `qa:critiques` / `qa:complete` / `qa:field` / `qa:advisor-click` / `qa:handoff` after a B1.

Do **not** add a hunter the same turn.

Do **not** re-run packs because old field fails are still red.

Do **not** touch other measures “while you’re in there.”

Do **not** restore the Flag pin and quote the prompt before talking unless the note is vague about which page.

Do **not** write a PASS rundown.

**Per B1:** find the cause on that page → fix it → phone-tap **that** path once (Back then forward if that’s the miss) → reply in a few lines.

Scripts stay in the repo. Run them only when Mike asks, or at go-live.

## Vet pack (Mike 2026-08-23)

After any walk / demo / site change, run `npm run qa:vet` (8 deadly walks: crash, loop, bounce, dead-end, wrong-job copy, single-SKU extra confirm, second-head bleed, chips). Do not hand a walk edit back if it is red.


## Product still true (not a test gate)

These are how the walk should work. They are not a checklist to execute after every note.

- First tap on a unit is **Main only**. Other units show **Option**. Continue is the second tap.
- **Never auto-pick or skip the picker.** Manufacturer, size, and unit are taps. One matching SKU still shows the unit card. Heat pump water heater cannot jump to site questions.
- Brand chips stay after the first logo.
- Bottom **Back** returns one screen and keeps the answers. It must not dump Quotes or wipe the grid.
- **Back then Continue:** first Back pins where they were. Unchanged Continue returns to that pin. A change walks only what that change broke, then returns to the pin — not the whole quote.
- Count pages keep **+ Add … (option)**.
- Ductless: Both → Living → Carrier 12k must leave Mitsubishi 15k on Indoor 1.
- Flag pins the live question (`attachments/walk-note-latest.json`, `/wizard?pin=1`). Fix that connection when it is the ask — do not treat it as a pre-talk ritual.

Families this must stay true for: heat pump, furnace, air handler, AC, ductless, water heater, wall heater, zoning.

## Owner-without-AI (go-live survival)

After go-live Mike must be able to fix small things from **Backend** with no Build session.

He **can** today:

- Add / edit / delete products (name, SKU, photo, price, hours, benefits, work scope).
- Set **Shows on this measure** (family) + **Manufacturer** + **Size chip** — without these the walk will skip the SKU.
- Labor rate, material/labor divisors, GP/man-day, **contractor markup %** (asbestos / crane, default 30).
- **Line / wire / pipe $/ft and hole costs** (Labor & markup → Line / wire / pipe rates).
- **Accessory kit hours, material, name, work-scope line, benefit** (Questions → Accessory kits). Option vs include stays the checklist above it.
- Site questions and answer copy (Questions).
- Pad / load-calc / conversion language (Language).
- **Size chips** (Language → Capacity filter chips). Units still have to exist in Products.
- Show or hide a measure chip (Measure chips).
- Pairing folders, job packages, financing, rebates, terms, company, team PIN.

Still **code-locked** (do not pretend otherwise — if he needs it, build a Backend field):

- New measure types (geothermal, package unit live).
- New indoor style tiles / water-heater type pictures / known-brand logos.
- Multi-zone outdoor SKU must still look like `MZ-3Z` or it will not show on that zone count.
- Electrical job SKUs (ELEC-120 etc.) — edit those as Products.
- Packet voice rules (the compiler).

## Living advisor-flag list

1. No tan coaching box on conversion + ductless.
2. Brand filter: selected brands stay; others hide.
3. Two-tap unit pick (Main, then Option / Continue).
4. Extra Continue on one-choice questions — product decision; do not auto-skip unless Mike says so.
5. **Back stays in the job.** Bottom Back walks **one previous screen**. Stage rail chips are tappable. Values stay until they pick something else.
6. Pictures on/off actually flips.
7. No generic water-heater placeholders.
8. Honeywell is not a heat-pump brand.
9. Line-set path / GFCI reconnect already in the tree.
10. Packet language compiles (no SKU, no furnish-and-install, same voice).
11. Tablet shading — path hides via `when`.
14. Backup / download shows size and date.
15. Ductless 2-zone offers both brands; 3+ zone shows a real outdoor list; heads first; 6k/15k on the grid; + Add a head (option); Back returns to the same heads.
17. Last extra head can be an **option package**. Even on a 4-zone pick, **+ Add a head (option)** stays on that page.
25. Zoning opens; New thermostat does not finish the measure.
31. Permit / load calc / HERS / conversion language are live chips.
32. Asbestos + crane are live contractor-supplied (type their cost; owner markup %).
36. Seismic valve includes 1¼".
41. **Owner can fix it without Build** — see section above.

42. **GP / man-day + options add up.** Each option is priced from its own hours and materials. Alternate-model options lock `live(target) − live(main)`. Selecting an option never dumps its hours into the main unit’s GP pool. Investment = main + selected option dollars, at GP $0 / $250 / $800 and every mix. **Draft quotes follow a new GP. Sent / viewed / signed quotes keep the dollars that went out.** Copying a sent quote unlocks it so the copy follows today’s GP.

43. **HP / AH / ductless site walk.** Outdoor location + 2-person set before pad. Line-set penetrations are multi then quantity. **All-new never hides reuse.** Existing pad / reconnect / old-pad sit under **Also — if this job isn’t a clean path**. Mini-split on an old AC pad stays legal. Filter first on furnace / AH. Heads named as the indoor they picked (12k / 15k high-wall in Living) — no SKU. Electrical: “Electrical requirements for the outdoor unit.”

44. **Present is the real packet.** Review / Present show measures + permits. No outline carousel.

45. **Sanden is Sanden.** Packet title and package headline say Sanden SANCO2. Never “gas water heater.”

54. **One customer name.** Language title, work scope, packet line, and three-plans all say the same customer name (`customerInstallName` / `packetFaceTitle`). Shop catalog title (Performance, gallons, SKU) must not win. Language chip: tap shows the words, tap again hides them.

55. **Picks stick.** Every pick, not one example. One brand is only that brand. Two brands never means all. Size you tap is the only size. Path you tap is the only path. Brand + size together. Extra hours / extra $ never go into the customer packet words. Phone: Carrier + Bosch must not list Navien or Goodman.

46. **Ductless order.** Walk **each indoor all the way** (room → style → size → height → line set takeoff) before the next indoor. Then outdoor. **Both brands:** group by manufacturer (Carrier, then Mitsubishi), size low → high inside that brand. One brand: lowest first, then ideal, then larger **up to 5-ton**. Line-set takeoff is **one compact page** on mini-split, heat pump, and AC: Access Easy / Medium / Hard (green / amber / blue) + Cover same (0 = skip). Copy: Easy = 1 story small ladder; Medium = above 1st or easy with offsets; Hard = tall ladder extra person. Sold line set rounded up. **Holes needed for line set?** with wall-type chips. Any cover quantity > 0 writes the HP cover work-scope line immediately after the line-set language. Previous is top-right. Indoor heads powered from outdoor — do not ask indoor power.

47. **Size survives the room tap.** Picking Living does not wipe the kBTU. Outdoor does not open on an indoor that still needs a room or a size. A kBTU tap sets **that brand only** — Carrier 12 + Mitsubishi 15 is legal. Tapping Carrier does not drop Mitsubishi or jump to the next indoor. Continue is the only way off that indoor.

48. **Previous walks one screen.** Bottom Previous / Back returns one screen and keeps the answers. First site question Previous pops to extras, then location, then the outdoor. Heads Previous reopens the prior indoor. Accessories Previous reopens location. Back never lands on a cover question they have not reached. Clear unselects a Main or Option already picked.

49. **Both brands are live, not a forced Main.** “Both — quote as options” does not stamp cheapest as Main. Main is the outdoor they tap. 75% can be Main; 100% can be Option. Tapping a live brand again drops it.

50. **Ducted indoor on a multi-zone** uses air-handler locations (nothing pre-selected). Custom location asks for a name. Wall control is in the box; ask where it lands. Visible heads default to remote + Wi-Fi. Height is only for high-wall / 1-way cassette.

51. **Pad.** Preformed pad is asked **right after the outdoor + location**, not buried in extras. Level ground next unless they included or optioned a custom concrete pad. Concrete pad is the recommended sit — bolt it down, it doesn’t move. Existing pad stays under Also.

52. **Future heads.** Multi-zone needs at least two heads. A third / fourth / sixth can be optional. Larger outdoor (up to 5-ton) sits at the **bottom of that manufacturer**. “Prep system for future head(s)” still flags that intent.

53. **Stay on the measure, then Order.** Last site question keeps them on the ductless measure with Main + Option dollars **and the work scope**. Continue — on this job leaves the walk. Bottom Next opens **Order** (equipment + permits, reorder) — not the contract.

54. **No blue Notes chip on the walk.** Packet notes are not a floating button. Flag is B1 critique only.

55. **1-to-1 outdoor cards** name the outdoor (MUZ-FS / 38MARB / 37MAHA). Option has a labeled **Remove**.

56. **1-to-1 pad** is Include / Option on extras after location — same as heat pump. Site pad questions wait until extras is done.

57. **Packet names the outdoor** on 1-to-1 (MUZ-FS12NA / 38MARB / 37MAHA), same role as Comfort 16 on heat pump. Chassis 27SCA5 stays off the packet.

58. **Ductless closer** is one short line like heat pump. Permit is not on this measure.

59. **New quote** starts empty. It does not restore the last walk.

60. **Both-brand outdoor list** is manufacturer, then size. Not interleaved. Not a Continue on the location chip.

61. **Location tap goes.** Front of home / Rear / Side is the answer. No expanded Continue in the middle of the grid. Custom still asks for a name, then Continue.

62. **Indoor room page shows every location up front.** Custom first, then the full list (Bed 2, Garage, Loft, Playroom, etc.). No **More rooms** gate. No blue down-arrow scroll cue sitting on Why? / Full screen.

63. **No leftover rail chrome.** Location / walk cards have no blue left stripe. Selected chips are a light ring, not a solid blue fill. B1 Flag stays a compact pill **above** the walk footer — it must not become a giant + covering Back.

64. **The live question owns the phone.** Path / location / sparse 2-choice fills the viewport (`min-h` ~ remaining screen). Packet “What we do” stays off until they open it. Path is one tap — tiles stay two-up, no solid blue Continue bar eating the other choice.

65. **Indoor room title names the indoor.** “Indoor 2 of 2 — which room?” not “Where does this indoor sit?”

66. **Heads and styles stay open.** Do not collapse finished heads into a Change chip. Do not hide indoor styles behind Also. High wall, floor, 1-way, 4-way, slimline, ducted AH are on the page.

67. **Unit actions never slide.** Select as main / Main ✓ stays full-width and does not become Continue. Option is a second full-width row. Continue is a reserved row under them. Remove is an overlay ×, not a chip that shoves the finger target.

68. **Outdoor location title** is “Outdoor — which side of the house?” not “Where does this outdoor unit go?”

69. **Tablet is not a stretched phone.** From 768px up: larger prompts (~2.15–2.5rem), chips ~4.25–4.75rem, location/rooms 4–5 columns, walk max-width 6xl. Phone layout stays.

70. **Tablet pane mock** (header **Tablet pane**, iPad+ only). Off by default. On: question left, large job art + label right. Phone never shows it.

71. **1-to-1 room title** is “Indoor head — which room?” never Indoor 1 of 1.
72. **Language** is an outline chip on the walk (packet copy). Not the old blue Notes FAB.
73. **Outdoor pull** uses 1-tech / 2-tech / stairs / hoist / roof — same family as the removal question, not Easy/Typical/Hard.
74. **Demo choice is an outline tile**, not a giant filled Continue. Path-suggested tile is a light ring. One tap.
75. **New line set vs reuse** are both on the page. Do not seed New and bury Reuse. Control-wire / interconnect Qs only after Reuse.

76. **Demo pull must leave.** Answering 1-tech / stairs / hoist sets site next. Never return to the same demo tiles with no Continue.

77. **Language chip toggles.** Hidden until tap. Tap again (or Hide language) closes it. Packet copy stays off until they open it.

78. **Packet product name is the customer face everywhere.** Rheem gas tank is “Rheem gas water heater” — not Performance, not gallons, not stripped to “Rheem.” Size lives in benefits. Catalog title stays in Backend.

79. **Flag pins the live question.** Flag writes the exact page so a later turn can open it (`/wizard?pin=1`). Tap Flag is enough. Use it when the note is about that page — not as a ritual before every reply.

## Packet

Customer document: succinct, same writer, no SKU, no “furnish and install.” Comfort advisor sees more detail in the walk. Owner edits language in Backend → Language / Questions.
