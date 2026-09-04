// QA driver loaded by the in-sandbox browser: plays a round through the debug hooks and reports state.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errs = []; addEventListener('error', e => errs.push(String(e.error || e.message)));
  const out = { renderer: __m.GFX === __m.G3D ? 'WebGL' : 'Canvas2D', w: innerWidth, h: innerHeight };
  UI.closeAll(); if (Game.active) Game.quit(); UI.show('home'); await sleep(300);
  __m.Flow.play(); await sleep(1800);
  out.rect = Game.rect; out.cell = __m.GFX.cell; out.running = Game.running;
  const moves = []; for (let i = 0; i < 6; i++) { moves.push(__dbg.autoMove()); await sleep(650); }
  // pointer-driven swap through the real handlers (drag from tile a to tile b)
  const area = document.querySelector('#board-area');
  const ev = (type, p) => area.dispatchEvent(new PointerEvent(type, { clientX: p.sx, clientY: p.sy, pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true }));
  let ptr = 'skipped'; for (let i = 0; i < 10 && ptr === 'skipped'; i++) { const mv = __dbg.movePx(); if (mv && Game.canTouch() && !Game.tiles.some(t => t.st !== 0)) { const s0 = Game.score; ev('pointerdown', mv.a); ev('pointermove', mv.b); ev('pointerup', mv.b); await sleep(900); ptr = Game.score > s0 ? `ok ${s0}->${Game.score}` : `noscore ${s0}->${Game.score}`; } else await sleep(300); }
  out.moves = moves; out.pointerSwap = ptr; out.score = Game.score; out.tiles = Game.st.tiles; out.maxCombo = Game.st.maxCombo; out.specials = Game.st.specials; out.swaps = Game.st.swaps;
  out.errs = errs; window.__qa = out; return JSON.stringify(out);
})();
