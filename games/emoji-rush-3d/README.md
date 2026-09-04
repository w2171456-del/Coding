# Emoji Rush 3D

A single-file, 60-second emoji match-3 blitz game with a full free-to-play meta layer. Everything ships in `index.html`; the only runtime dependencies are three.js (loaded from jsDelivr) and the Fredoka webfont (Google Fonts), both of which degrade gracefully if unreachable.

## Run

Serve the folder with any static server (needed because `three.module.min.js` is an ES module import):

```bash
python3 -m http.server 3000 --directory games/emoji-rush-3d
```

Append `?debug=1` to expose QA hooks (`__dbg.autoMove()`, `__dbg.movePx()`, `__dbg.forceBlitz()`, `__dbg.forcePower()`, `__dbg.endRound()`, `__dbg.grant({gems:500})`, `__dbg.bench()`) plus `window.Game`, `window.UI`, `window.S` and the module bag `window.__m`. `tools/qa-c2d.js` is a browser-side driver that plays a round through those hooks (used for the Canvas 2D fallback pass).

## Build

The HTML is assembled from the ordered parts in `src/` so it stays reviewable; edit the parts, never `index.html` directly:

```bash
node games/emoji-rush-3d/src/assemble.js   # writes games/emoji-rush-3d/index.html and syntax-checks the script
node games/emoji-rush-3d/tools/cdp-shot.js "http://127.0.0.1:3000/?debug=1" "home,play,flows" /tmp/er-shots/d 1440 900 0   # headless WebGL (SwiftShader) QA run + screenshots; last arg 1 = mobile emulation
```

## Gameplay

- 7×7 board, 5 emoji types (your equipped hero + 4 others), 60-second rounds.
- Match 4 → row/column blast, L/T shape → bomb, 5 in a row → rainbow star. Special + special swaps combine.
- Combo multiplier (up to 5×) with a 1.6 s window; the Blitz meter fills from clears and triggers 8 s of 2× score with bonus specials.
- Each hero has a power charged by clearing its emoji (14 distinct effects), plus a star level (1–5) that scales the power and score bonus.
- Coin and clock emoji spawn occasionally; boosts alter the start state.

## Monetization (all simulated — no network calls, no real charges)

- Lives (5, 15-minute regen), continue offers (rewarded ad → +10 s, gems → +15 s with escalating cost).
- Gem packs with first-purchase double bonus, starter pack (24 h timer), flash sale (15 min, triggered by round count), piggy bank, premium season pass, VIP subscription, remove-ads, legendary hunt bundle.
- Rewarded video: extra lives, coin doubling, wheel spins, mission rerolls — daily capped. Interstitials every 3 rounds with a 90 s cooldown (suppressed by Remove Ads / VIP).
- Hero gacha with published odds and pity counters (epic ≤ 20 pulls, legendary ≤ 90).

To go live, replace the bodies of `Ads.show` and `IAP.buy` with the ad-network / billing SDK calls; `Ads.rewarded` and `IAP.fulfill` are the grant points and already assume the callback is verified.

## Performance notes

- Rendering is three.js `InstancedMesh` (one draw call each for tile bodies, emoji faces, badges, shadows) plus one `Points` system; emoji are rasterised once into a canvas atlas.
- Frames are only rendered when something changed (`dirty` flag); DPR is capped per quality tier and device class; a lite path (Lambert lighting, fewer segments, lower DPR) is chosen automatically on low-core mobile devices.
- If WebGL is unavailable the same scene renders through a Canvas 2D fallback with an identical interface.
- Progress is saved to `localStorage` under `emojiRush3D.v1`.
