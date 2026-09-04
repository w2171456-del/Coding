/* ---------------- UI core: screens, modals, toasts, fx ---------------- */
const UI = {
  stack: [], queueList: [], sequencing: false, floaterPool: [], _tick: 0, screen: 'loading',
  NO_DISMISS: new Set(['results', 'continue', 'pause', 'checkout', 'boxopen', 'levelup', 'offer', 'lives-out']),
  init() {
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-open]'); if (!b) return; Snd.init(); Snd.resume(); Snd.click(); haptic(5);
      const [name, arg] = b.dataset.open.split(':');
      if (name === 'play') return Flow.play();
      this.open(name, arg ? { tab: arg } : {});
    });
    $('#modals').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.classList.contains('silent')) { Snd.click(); haptic(5); } });
    Bus.on('hud', () => this.refreshHud());
    Bus.on('currency', (k, n) => { if (n > 0) this.currencyPop(k, n); });
    addEventListener('resize', () => this.relayout()); addEventListener('orientationchange', () => setTimeout(() => this.relayout(), 60));
    if (window.visualViewport) visualViewport.addEventListener('resize', () => this.relayout());
    const ro = new ResizeObserver(() => this.relayout()); ro.observe($('#board-area')); ro.observe($('#showcase'));
    document.body.classList.toggle('reduce-motion', S.settings.reduceMotion);
  },
  relayout() { GFX.resize(); if (this.screen === 'game') Game.layout(); else if (this.screen === 'home') Home.layout(); },
  show(name) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name)); this.screen = name;
    if (name === 'home') Home.enter(); else if (name === 'game') { Home.leave(); requestAnimationFrame(() => Game.layout()); }
  },
  open(name, d = {}) {
    const build = MODALS[name]; if (!build) return console.warn('no modal', name);
    const existing = this.stack.find(m => m.name === name); if (existing) this.close(name);
    const mb = el(`<div class="mb" data-name="${name}"><div class="mw ${d.cls || ''}"><div class="modal ${d.cls || ''}" role="dialog"></div></div></div>`), mw = mb.firstElementChild, modal = mw.firstElementChild;
    const entry = { name, mb, modal, d, resolvers: [] };
    const api = { close: () => this.close(name), rerender: () => { api.acts = {}; build.call(MODALS, modal, d, api); }, acts: {}, entry };
    modal.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const fn = api.acts[b.dataset.act]; if (fn) fn(b, e); });
    mb.addEventListener('pointerdown', e => { if (e.target === mb && !this.NO_DISMISS.has(name) && !d.noDismiss) this.close(name); });
    build.call(MODALS, modal, d, api); $("#modals").appendChild(mb); this.stack.push(entry);
    if (!this.NO_DISMISS.has(name) && !d.noDismiss) { const x = el('<button class="x" aria-label="Close">✕</button>'); x.addEventListener('click', () => { Snd.click(); this.close(name); }); mw.appendChild(x); }
    return entry;
  },
  openAsync(name, d = {}) { return new Promise(res => { const e = this.open(name, d); if (!e) return res(); e.resolvers.push(res); }); },
  close(name) {
    const i = name ? this.stack.findIndex(m => m.name === name) : this.stack.length - 1; if (i < 0) return;
    const [e] = this.stack.splice(i, 1); e.mb.remove(); e.resolvers.forEach(r => r(e.result));
    if (e.name === 'pause' && Game.active && Game.paused && !Game.over) Game.resume();
    if (!this.sequencing) this.pump();
    if (this.screen === 'home') Home.render();
  },
  setResult(name, v) { const e = this.stack.find(m => m.name === name); if (e) e.result = v; },
  closeAll() { while (this.stack.length) this.close(); },
  isOpen(name) { return this.stack.some(m => m.name === name); },
  queue(name, d) { this.queueList.push({ name, d }); if (!this.sequencing) this.pump(); },
  queueBoxes(list) { for (const b of list) this.queue('boxopen', typeof b === 'string' ? { box: b } : b); },
  pump() { if (this.stack.length || !this.queueList.length) return; const n = this.queueList.shift(); this.open(n.name, n.d); },
  toast(msg) { const t = $('#toasts'); while (t.children.length >= 3) t.firstChild.remove(); const x = el(`<div class="toast">${msg}</div>`); t.appendChild(x); setTimeout(() => x.remove(), 2400); },
  announce(msg, cls) { const a = $('#announcer'); a.innerHTML = `<div class="${cls || ''}">${esc(msg)}</div>`; clearTimeout(this._annT); this._annT = setTimeout(() => { a.innerHTML = ''; }, 950); },
  floater(x, y, txt, cls) {
    if (S.settings.reduceMotion) return; const host = $('#floaters'); if (host.children.length > 40) host.firstChild.remove();
    const f = el(`<div class="floater ${cls || ''}">${esc(txt)}</div>`); f.style.left = x + 'px'; f.style.top = y + 'px'; host.appendChild(f);
    const dx = (Math.random() - .5) * 30; const an = f.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: `translate(calc(-50% + ${dx / 2}px),-90%) scale(1.15)`, opacity: 1, offset: .25 }, { transform: `translate(calc(-50% + ${dx}px),-190%) scale(1)`, opacity: 0 }], { duration: cls && cls.includes('big') ? 1300 : 900, easing: 'cubic-bezier(.2,.8,.2,1)' });
    an.onfinish = () => f.remove();
  },
  flash(a) { if (S.settings.reduceMotion) return; const f = $('#flash'); f.animate([{ opacity: a }, { opacity: 0 }], { duration: 350, easing: 'ease-out' }); },
  confetti(n = 90) {
    if (S.settings.reduceMotion) return; const host = $('#confetti'); const cols = ['#ff3d81', '#ffd166', '#22c55e', '#3b82f6', '#a855f7', '#67e8f9', '#fff'];
    for (let i = 0; i < n; i++) { const c = el('<i></i>'); c.style.left = rand(100) + 'vw'; c.style.background = pick(cols); c.style.animationDuration = rand(1.6, 3.2) + 's'; c.style.animationDelay = rand(0, .6) + 's'; c.style.transform = `rotate(${rand(360)}deg)`; c.style.width = rand(6, 11) + 'px'; host.appendChild(c); }
    setTimeout(() => { host.innerHTML = ''; }, 4200);
  },
  badge(name, n) { const b = $('#badge-' + name); if (!b) return; if (n > 0) { b.textContent = n > 9 ? '9+' : n; b.classList.remove('hidden'); } else b.classList.add('hidden'); },
  currencyPop(kind, n) {
    if (this.screen !== 'home') return; const pill = $(kind === 'gems' ? '.pill.gems' : '.pill.coins'); if (!pill) return; const r = pill.getBoundingClientRect();
    this.floater(r.left + r.width / 2, r.bottom + 14, `+${fmt(n)} ${kind === 'gems' ? '💎' : '🪙'}`, kind === 'gems' ? 'time' : 'coin'); if (kind === 'gems') Snd.gem(); else Snd.coin();
  },
  refreshHud() {
    $('#hud-coins').textContent = fmtShort(S.coins); $('#hud-gems').textContent = fmt(S.gems);
    const unl = Econ.unlimited(); $('#hud-lives').textContent = unl ? '∞' : S.lives; $('#hud-lives-timer').textContent = unl ? fmtTime(S.unlimitedUntil - now()) : (S.lives < Econ.livesMax() ? fmtTime(Econ.lifeCountdown()) : 'FULL');
    $('#lvl-num').textContent = S.level; $('#lvl-ring .ring').style.setProperty('--p', Math.round(S.xp / Econ.xpFor(S.level) * 100)); $('#xp-bar').style.width = Math.round(S.xp / Econ.xpFor(S.level) * 100) + '%';
    const sub = $('#play-sub'); if (sub) sub.textContent = unl ? 'unlimited lives' : S.lives > 0 ? `uses 1 ❤️ · ${S.lives} left` : 'no lives left';
  },
  tick(t) {
    if (t - this._tick < 1000) return; this._tick = t; Econ.tickLives();
    $$('[data-until]').forEach(e => { const left = +e.dataset.until - now(); e.textContent = e.dataset.fmt === 'dur' ? fmtDur(left) : fmtTime(left); if (left <= 0 && e.dataset.expire) { this.close(e.dataset.expire); } });
    if (this.screen === 'home') { this.refreshHud(); Home.tickRails(); }
  },
  heroCard(h, o, extra = '') { return `<div class="hcell rar-${h.rar} ${o ? '' : 'locked'} ${extra}" data-act="hero" data-id="${h.id}">${o && o.new ? '<span class="new">NEW</span>' : ''}<span class="e emoji">${h.e}</span><span class="n">${h.name}</span><span class="l">${o ? '★'.repeat(o.stars) + '☆'.repeat(5 - o.stars) : RAR[h.rar].n}</span></div>`; },
  rewardChips(rw) { return Rewards.label(rw).split(' · ').map(x => `<span>${x}</span>`).join(''); },
  timerHtml(until, fmtKind = 'time', expire) { return `<span class="countdown" data-until="${until}" data-fmt="${fmtKind}" ${expire ? `data-expire="${expire}"` : ''}>${fmtKind === 'dur' ? fmtDur(until - now()) : fmtTime(until - now())}</span>`; },
};

/* ---------------- home screen ---------------- */
const Home = {
  active: false, t: 0, views: [], orbit: [],
  init() {
    $('#btn-play').addEventListener('click', () => Flow.play());
    $('#boost-strip').addEventListener('click', e => { const b = e.target.closest('[data-boost]'); if (!b) return; const k = b.dataset.boost; Snd.click(); if ((S.boosts[k] || 0) <= 0) return UI.open('shop', { tab: 'boosts' }); S.boostsOn[k] = !S.boostsOn[k]; Save.commit(); this.render(); });
    $('#flash-banner').addEventListener('click', () => UI.open('offer', { sku: 'flash' }));
    this.orbit = FILLERS.slice(0, 3).map((g, i) => ({ g, a: i * Math.PI * 2 / 3, color: parseInt(TYPE_COLORS[(i + 1) % TYPE_COLORS.length].slice(1), 16) }));
  },
  enter() { this.active = true; GFX.setMode('showcase'); if (GFX.panel) GFX.panel.visible = false; requestAnimationFrame(() => this.layout()); this.render(); UI.refreshHud(); },
  leave() { this.active = false; if (GFX.panel) GFX.panel.visible = true; },
  layout() { const r = $('#showcase').getBoundingClientRect(); if (r.width < 10 || r.height < 10) return; GFX.setRect({ x: r.left, y: r.top, w: r.width, h: r.height }); },
  update(dt) {
    if (!this.active) return; this.t += dt; const h = HERO[S.equipped], cx = (GFX.cols - 1) / 2, cy = (GFX.rows - 1) / 2, V = this.views;
    const hero = V[0] || (V[0] = {}); Object.assign(hero, { x: cx, y: cy - 0.05 + Math.sin(this.t * 1.5) * 0.06, z: 0, s: 1.75, rot: Math.sin(this.t * 0.9) * 0.55, tilt: Math.sin(this.t * 0.7) * 0.15 - 0.1, color: parseInt(RAR[h.rar].c.slice(1), 16), glyph: Atlas.get(h.e), badge: null });
    const R = Math.min(1.35, (GFX.halfW || 2) * 0.72); // keep orbiters inside the visible width on narrow screens
    this.orbit.forEach((o, i) => { const a = o.a + this.t * 0.8, v = V[i + 1] || (V[i + 1] = {}); Object.assign(v, { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * 0.55 - 0.1, z: Math.sin(a) * 0.9 - 0.9, s: 0.5, rot: a, tilt: 0.3, color: o.color, glyph: Atlas.get(o.g), badge: null }); });
    GFX.drawTiles(V, 4);
  },
  render() {
    if (!this.active) return; const h = HERO[S.equipped], o = S.owned[h.id];
    $('#hc-emoji').textContent = h.e; $('#hc-name').textContent = h.name; $('#hc-rar').textContent = RAR[h.rar].n; $('#hero-card').className = `card hero-card rar-${h.rar}`; $('#hc-lvl').textContent = '★' + (o ? o.stars : 1); $('#hc-power').textContent = `${POWERS[h.power].ic} ${POWERS[h.power].name}: ${POWERS[h.power].d(o ? o.stars : 1)} · +${Econ.heroBonus(h.id)}% score`;
    $('#boost-strip').innerHTML = Object.entries(BOOSTS).map(([k, b]) => `<button class="boost ${S.boostsOn[k] && S.boosts[k] > 0 ? 'on' : ''}" data-boost="${k}" title="${b.d}"><span class="ic emoji">${b.ic}</span><span class="cnt">${S.boosts[k] > 0 ? '×' + S.boosts[k] : '+'}</span></button>`).join('');
    UI.badge('missions', Missions.claimable()); UI.badge('pass', Pass.claimable()); UI.badge('heroes', Object.values(S.owned).filter(o => o.new).length + HEROES.filter(x => Gacha.canStarUp(x.id)).length);
    const shopHot = Offers.starterActive() || Offers.flashActive() || (!S.iap.firstBonusUsed); $('#badge-shop').classList.toggle('hidden', !shopHot);
    UI.badge('boxes', 0);
    const fb = $('#flash-banner'); if (Offers.flashActive()) { fb.classList.remove('hidden'); fb.innerHTML = `<span class="emoji">⚡</span> FLASH SALE · 85% OFF <span class="t" data-until="${S.flash.until}" data-fmt="time">${fmtTime(Offers.flashLeft())}</span>`; } else fb.classList.add('hidden');
    $('#showcase-caption').innerHTML = S.stats.games ? `<span class="emoji">🏆</span> Best ${fmt(S.stats.best)} <span class="muted">· #${Leader.rank()} this week</span>` : `<span class="emoji">🏆</span> Score ${fmt(Leader.list()[9]?.score || 30000)}+ to enter the top 10`;
    this.tickRails(); UI.refreshHud(); this.renderSides();
  },
  tickRails() {
    $('#rail-daily').textContent = Daily.status() === 'ready' ? 'READY!' : 'claimed'; $$('[data-open="daily"]').forEach(b => b.classList.toggle('glow', Daily.status() === 'ready'));
    $('#rail-wheel').textContent = Wheel.canFree() ? 'FREE' : Wheel.adSpinsLeft() > 0 ? '📺 spin' : fmtTime(dayNum() * DAY + DAY - now()); $$('[data-open="wheel"]').forEach(b => b.classList.toggle('glow', Wheel.canFree()));
    $('#rail-piggy').textContent = Piggy.full() ? 'FULL!' : `${S.piggy.gems}💎`; $$('[data-open="piggy"]').forEach(b => b.classList.toggle('glow', Piggy.full()));
    $('#rail-event').textContent = fmtDur(weekEnd() - now());
  },
  renderSides() {
    if (!matchMedia('(min-width:1024px)').matches) return;
    Missions.ensure(); $('#side-missions').innerHTML = S.missions.list.map((m, i) => MODALS._mission(m, i, true)).join('');
    const t = Pass.tier(); $('#side-pass').innerHTML = `<div class="row sp small"><span>Tier ${t}/${CFG.passTiers}</span><span class="muted">${S.pass.premium ? '👑 Premium' : 'Free track'}</span></div><div class="bar gold" style="margin:6px 0"><i style="width:${Math.round((S.pass.xp % CFG.passXpPerTier) / CFG.passXpPerTier * 100)}%"></i></div><button class="btn xs gold" data-open="pass">${Pass.claimable() ? 'Claim ' + Pass.claimable() + ' rewards' : 'View pass'}</button>`;
    const list = Leader.list(); const meI = list.findIndex(x => x.me); const rows = list.slice(0, 5); if (meI >= 5) rows.push(list[meI]);
    $('#side-lb').innerHTML = rows.map(x => `<div class="lb-row ${x.me ? 'me' : ''}"><span class="rk ${list.indexOf(x) < 3 ? 'top' : ''}">${['🥇', '🥈', '🥉'][list.indexOf(x)] || '#' + (list.indexOf(x) + 1)}</span><span class="av emoji">${x.av}</span><span class="nm">${esc(x.name)}</span><span class="sc">${fmtShort(x.score)}</span></div>`).join('');
    const st = S.stats; $('#side-stats').innerHTML = `<div>Best<b>${fmt(st.best)}</b></div><div>Rounds<b>${st.games}</b></div><div>Blitzes<b>${st.blitzes}</b></div><div>Specials<b>${st.specials}</b></div><div>Best combo<b>x${st.combosBest}</b></div><div>Heroes<b>${Object.keys(S.owned).length}/${HEROES.length}</b></div>`;
  },
};

/* ---------------- round flow ---------------- */
const Flow = {
  busy: false,
  async play() {
    if (this.busy) return; Snd.init(); Snd.resume();
    if (Game.active && !Game.over) return;
    if (!Econ.canPlay()) { UI.open('lives'); return; }
    if (UI.isOpen('results')) UI.close('results'); UI.closeAll();
    Econ.useLife(); const boosts = {}; for (const k in S.boostsOn) if (S.boostsOn[k] && S.boosts[k] > 0) { boosts[k] = true; S.boosts[k]--; } S.boostsOn = {}; S.sessionGames++; Save.commit();
    UI.show('game'); Game.start({ boosts }); this.renderGameSides();
  },
  renderGameSides() {
    if (!matchMedia('(min-width:1024px)').matches) return;
    const st = S.stats; $('#g-side-stats').innerHTML = `<div>Best<b>${fmt(st.best)}</b></div><div>Rounds<b>${st.games}</b></div><div>Hero<b>${Game.hero.e} ★${Econ.heroLevel(Game.hero.id)}</b></div><div>Power<b>${POWERS[Game.hero.power].ic}</b></div>`;
    const list = Leader.list().slice(0, 6); $('#g-side-lb').innerHTML = list.map((x, i) => `<div class="lb-row ${x.me ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="av emoji">${x.av}</span><span class="nm">${esc(x.name)}</span><span class="sc">${fmtShort(x.score)}</span></div>`).join('');
    Missions.ensure(); $('#g-side-missions').innerHTML = S.missions.list.filter(m => !m.claimed).slice(0, 3).map((m, i) => MODALS._mission(m, i, true)).join('');
  },
  async onGameOver(res) {
    if (this.busy) return; this.busy = true;
    try {
      // 1) continue offer
      if (!res.quit && Game.continues < CFG.continueGemCosts.length && res.score > 500) {
        const choice = await UI.openAsync('continue', { res });
        if (choice === 'ad') { const ok = await Ads.rewarded('continue'); if (ok) { Game.adContinueUsed = true; this.busy = false; Game.continueRound(10); return; } }
        else if (choice === 'gems') { this.busy = false; Game.continueRound(15); return; }
      }
      // 2) settle
      const r = this.settle(res); Game.quit();
      const action = await UI.openAsync('results', { res, r });
      UI.sequencing = true;
      for (const lv of r.ups) await UI.openAsync('levelup', { lv });
      const offer = Offers.postRound(res); Offers.maybeTriggerFlash();
      if (offer) await UI.openAsync('offer', { sku: offer });
      await Ads.maybeInterstitial();
      UI.sequencing = false;
      if (action === 'again' && Econ.canPlay()) { this.busy = false; UI.show('home'); return this.play(); }
      UI.show('home'); UI.pump(); if (action === 'again') UI.open('lives');
    } finally { this.busy = false; UI.sequencing = false; }
  },
  settle(res) {
    const st = S.stats; st.games++; st.totalScore += res.score; st.tiles += res.stats.tiles; st.playMs += Math.round(res.elapsed * 1000); st.combosBest = Math.max(st.combosBest, res.stats.maxCombo);
    const newBest = res.score > st.best; if (newBest) st.best = res.score;
    const coins = Math.round((res.coins + Math.floor(res.score / 120)) * Econ.coinMult());
    const xp = 30 + Math.floor(res.score / 200) + res.stats.blitzes * 20;
    Econ.addCoins(coins, 'silent'); const ups = Econ.addXp(xp);
    const levelRewards = ups.map(lv => Econ.levelReward(lv));
    const missionsDone = Missions.progress(res); Pass.addXp(80 + Math.floor(res.score / 500)); const tokens = Event.earn(res);
    const piggy = Piggy.add(CFG.piggyPerGame + Math.floor(res.score / CFG.piggyPerPoints));
    const rank = Leader.submit(res.score);
    const heroO = S.owned[res.hero]; if (heroO && res.stats.hero >= 40 && Math.random() < 0.35) { heroO.shards += 1; }
    if (!S.tutorialDone) S.tutorialDone = true;
    Save.commit(); Bus.emit('hud');
    return { coins, xp, ups, levelRewards, missionsDone, tokens, piggy, rank, newBest };
  },
};
Bus.on('gameover', res => Flow.onGameOver(res));
