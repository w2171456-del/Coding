/* ---------------- boot & main loop ---------------- */
const Boot = {
  tips: ['Match 4 in a row for a Row/Column Blast', 'Match 5 for a Rainbow Star — swap it with anything!', 'L or T shapes make a Bomb', 'Clear your hero emoji to charge their power', 'Fill the BLITZ meter for 8 seconds of 2× score', 'Come back daily for streak rewards', 'Duplicate heroes give star shards for upgrades'],
  async run() {
    const bar = $('#load-bar i'), tip = $('#load-tip'); const set = (p, t) => { bar.style.width = p + '%'; if (t) tip.textContent = t; };
    set(10, 'Warming up emoji…');
    try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 20px Fredoka'), sleep(1500)]); } catch (e) { }
    Atlas.build(GLYPHS, IS_MOBILE ? 112 : 128);
    set(35, 'Loading 3D engine…');
    const canvas = $('#gl');
    const ok = await G3D.init(canvas);
    if (!ok) { GFX = G2D; G2D.init(canvas); document.body.classList.add('lowfx'); }
    else if (G3D.lowfx) document.body.classList.add('lowfx');
    set(70, pick(this.tips));
    UI.init(); Home.init(); Game.bind(); GFX.resize();
    Missions.ensure(); Wheel.ensure(); Pass.ensure(); Event.ensure(); Ads.ensure(); Leader.ensure(); Econ.tickLives();
    set(100, pick(this.tips));
    await sleep(250);
    const start = $('#btn-start'); start.classList.remove('hidden'); tip.textContent = 'Tip: ' + pick(this.tips);
    const go = () => { start.disabled = true; Snd.init(); Snd.resume(); Snd.click(); UI.show('home'); this.onEnterHome(); };
    start.addEventListener('click', go, { once: true });
    addEventListener('keydown', e => { if (e.code === 'Enter' && UI.screen === 'loading') go(); }, { once: true });
    this.loop();
  },
  onEnterHome() {
    // returning-player hooks: daily reward first, then pending pass/mission badges show on rails
    if (Daily.status() === 'ready' && S.stats.games > 0) UI.queue('daily');
    if (S.stats.games === 0) UI.toast('🦊 Welcome! Tap PLAY for a 60-second blitz.');
    if (Econ.isVip() === false && S.iap.vipUntil && S.iap.vipUntil < now()) { S.iap.vipUntil = 0; Save.commit(); }
  },
  last: 0, acc: 0,
  loop() {
    const step = t => {
      requestAnimationFrame(step);
      let dt = (t - this.last) / 1000; this.last = t; if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
      if (document.hidden) return;
      if (UI.screen === 'game') Game.update(dt); else if (UI.screen === 'home') Home.update(dt);
      GFX.update(dt); GFX.render(); UI.tick(t);
    };
    requestAnimationFrame(t => { this.last = t; step(t); });
  },
};
if (new URLSearchParams(location.search).has('debug')) {
  // QA hooks (only with ?debug=1): drive the board without pointer events and force states for screenshots.
  window.UI = UI; window.Game = Game; window.S = S;
  window.__m = { Econ, Flow, Ads, IAP, Offers, Piggy, Pass, Missions, Daily, Wheel, Gacha, Leader, Event, Rewards, Snd, get GFX() { return GFX; }, G3D, G2D };
  window.__dbg = {
    autoMove() { const mv = Game.findMove(); if (!mv || !Game.canTouch()) return 'none'; if (mv[0].st !== ST.IDLE || mv[1].st !== ST.IDLE) return 'busy'; Game.trySwap(mv[0], mv[1]); return 'swapped'; },
    movePx() { if (!Game.active) return null; const mv = Game.findMove(); if (!mv) return null; const a = GFX.project(mv[0].x, mv[0].y, 0), b = GFX.project(mv[1].x, mv[1].y, 0); return { a, b, types: [mv[0].type, mv[1].type], score: Game.score }; },
    forceBlitz() { if (Game.canTouch() && !Game.blitz) Game.enterBlitz(); },
    forcePower() { if (Game.canTouch()) { Game.power = 1; Game.usePower(); } },
    endRound() { if (Game.running) Game.time = 0.01; },
    grant(o) { Rewards.grant(o, null); },
    bench(n = 300) { // CPU cost per frame of simulation + instance upload, excluding the GPU draw
      const t0 = performance.now(); for (let i = 0; i < n; i++) { if (UI.screen === 'game') Game.update(1 / 60); else Home.update(1 / 60); GFX.update(1 / 60); } const t1 = performance.now();
      for (let i = 0; i < n; i++) GFX.render(), GFX.dirty = true; const t2 = performance.now();
      return { updateMs: +((t1 - t0) / n).toFixed(3), renderMs: +((t2 - t1) / n).toFixed(3), renderer: GFX === G3D ? 'WebGL' : 'Canvas2D' };
    },
  };
}
addEventListener('visibilitychange', () => { if (document.hidden) { if (Game.active && Game.running && !Game.paused) Game.pause(); Snd.stopMusic(); } else { Snd.apply(); } });
addEventListener('error', e => { console.error(e.error || e.message); });
addEventListener('unhandledrejection', e => { console.error(e.reason); });
Boot.run();
