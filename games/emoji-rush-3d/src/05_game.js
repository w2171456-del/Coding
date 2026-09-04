/* ---------------- match-3 blitz engine ---------------- */
const SP = { NONE: 0, ROW: 1, COL: 2, BOMB: 3, STAR: 4 };
const ST = { IDLE: 0, FALL: 1, SWAP: 2, DIE: 3 };
const SP_BADGE = { 1: '➡️', 2: '⬇️', 3: '💣' };
const ITEM_BADGE = { 1: '🪙', 2: '⏱️' };
const GRAV = 30;
let TILE_ID = 0;
class Tile {
  constructor(type, r, c) {
    this.id = TILE_ID++; this.type = type; this.r = r; this.c = c; this.x = c; this.y = r; this.z = 0; this.s = 1; this.rot = 0; this.tilt = 0;
    this.sp = 0; this.item = 0; this.st = ST.IDLE; this.vy = 0; this.t = 0; this.dur = 0; this.fx = 0; this.fy = 0; this.tx = 0; this.ty = 0;
    this.dieDelay = 0; this.dieT = 0; this.bounce = 0; this.hint = false; this.sel = false; this.noCheck = false; this.spawnDelay = 0; this.pop = 0; this.killed = false;
  }
}

const Game = {
  active: false, running: false, paused: false, ending: false, over: false, started: false,
  cols: CFG.cols, rows: CFG.rows, types: CFG.types, grid: [], tiles: [], views: [], colors: [], glyphs: [], roster: [],
  score: 0, time: 0, combo: 0, comboTimer: 0, meter: 0, blitz: false, blitzT: 0, power: 0, frenzyT: 0, freezeT: 0, coins: 0,
  st: null, hero: null, drag: null, sel: null, idleT: 0, hints: [], matchDirty: false, endT: 0, lastSec: -1, continues: 0, adContinueUsed: false, boosts: {}, elapsed: 0, hoverPick: null, rect: { x: 0, y: 0, w: 10, h: 10 },
  el: {},
  bind() {
    this.el = { area: $('#board-area'), score: $('#g-score'), best: $('#g-best'), timer: $('#g-timer'), timerWrap: $('#g-timer-wrap'), meter: $('#g-meter'), meterFill: $('#g-meter i'), combo: $('#g-combo'), coins: $('#g-coins'), power: $('#btn-power'), powerLbl: $('#power-lbl'), powerEmoji: $('#power-emoji'), coach: $('#coach') };
    const a = this.el.area;
    a.addEventListener('pointerdown', e => this.onDown(e)); a.addEventListener('pointermove', e => this.onMove(e)); a.addEventListener('pointerup', e => this.onUp(e)); a.addEventListener('pointercancel', () => { this.drag = null; });
    this.el.power.addEventListener('click', () => this.usePower());
    $('#btn-pause').addEventListener('click', () => this.pause());
    addEventListener('keydown', e => {
      if (!this.active) return;
      if (e.code === 'Space') { e.preventDefault(); if (this.running && !this.paused) this.usePower(); }
      else if (e.code === 'Escape' || e.code === 'KeyP') { if (this.running) this.paused ? UI.close('pause') : this.pause(); }
    });
  },
  layout() {
    const r = this.el.area.getBoundingClientRect(); const pad = 6;
    this.rect = { x: r.left + pad, y: r.top + pad, w: Math.max(10, r.width - pad * 2), h: Math.max(10, r.height - pad * 2) };
    GFX.setRect(this.rect);
  },
  start(opts = {}) {
    const hero = this.hero = HERO[S.equipped]; this.boosts = opts.boosts || {};
    this.st = { tiles: 0, specials: 0, powers: 0, blitzes: 0, maxCombo: 0, hero: 0, coinsTiles: 0, timeTiles: 0, swaps: 0, stars: 0, bombs: 0 };
    this.cols = CFG.cols; this.rows = CFG.rows; this.types = CFG.types;
    const others = shuffle(HEROES.filter(h => h.id !== hero.id && S.owned[h.id])).concat(shuffle(HEROES.filter(h => h.id !== hero.id && !S.owned[h.id]))).slice(0, this.types - 1);
    this.roster = [hero, ...others]; this.glyphs = this.roster.map(h => h.e);
    this.colors = TYPE_COLORS.map(c => parseInt(c.slice(1), 16));
    this.score = 0; this.combo = 0; this.comboTimer = 0; this.meter = 0; this.blitz = false; this.blitzT = 0; this.frenzyT = 0; this.freezeT = 0; this.coins = 0; this.continues = 0; this.adContinueUsed = false; this.elapsed = 0;
    this.time = CFG.roundSeconds + (this.boosts.time ? 5 : 0); this.power = this.boosts.power ? 0.5 : 0;
    this.tiles = []; this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null)); this.sel = null; this.drag = null; this.hints = []; this.idleT = 0; this.lastSec = -1;
    this.fill(true);
    if (this.boosts.rainbow) { for (let i = 0; i < 2; i++) { const t = this.grid[randInt(2, this.rows - 1)][randInt(0, this.cols - 1)]; if (t) this.makeStar(t); } }
    GFX.setGrid(this.cols, this.rows); GFX.setMode('board'); GFX.setBlitz(false); document.body.classList.remove('blitz');
    this.active = true; this.over = false; this.ending = false; this.paused = false; this.running = false; this.started = false;
    this.el.powerEmoji.textContent = hero.e; this.el.best.textContent = 'BEST ' + fmt(S.stats.best);
    this.updateHud(true); this.layout();
    Snd.setIntensity(0.3);
    this.startT = 1.0; // drop-in, then timer starts
    if (!S.tutorialDone) this.coach('Swap two emoji to match 3 or more!', '👆');
  },
  fill(initial) {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      let type; let tries = 0;
      do { type = randInt(0, this.types - 1); tries++; } while (tries < 20 && ((c >= 2 && this.grid[r][c - 1]?.type === type && this.grid[r][c - 2]?.type === type) || (r >= 2 && this.grid[r - 1][c]?.type === type && this.grid[r - 2][c]?.type === type)));
      const t = new Tile(type, r, c); t.y = -1 - (this.rows - 1 - r) * 0.6 - c * 0.15; t.st = ST.FALL; t.vy = 0; t.spawnDelay = initial ? c * 0.04 + (this.rows - 1 - r) * 0.03 : 0;
      this.grid[r][c] = t; this.tiles.push(t);
    }
    if (!this.hasMove()) this.shuffleBoard(false);
  },
  spawn(r, c, stackIdx) {
    let type = randInt(0, this.types - 1);
    const t = new Tile(type, r, c); t.y = -1 - stackIdx * 0.9; t.st = ST.FALL; t.vy = 0;
    const roll = Math.random();
    if (this.blitz && roll < 0.12) t.sp = pick([SP.ROW, SP.COL, SP.BOMB]);
    else if (roll < 0.035) t.item = 1; else if (roll < 0.05) t.item = 2;
    this.grid[r][c] = t; this.tiles.push(t); return t;
  },
  neighbors(t) { const n = []; if (t.c > 0) n.push(this.grid[t.r][t.c - 1]); if (t.c < this.cols - 1) n.push(this.grid[t.r][t.c + 1]); if (t.r > 0) n.push(this.grid[t.r - 1][t.c]); if (t.r < this.rows - 1) n.push(this.grid[t.r + 1][t.c]); return n.filter(Boolean); },
  /* ---- input ---- */
  pickTile(e) { const p = GFX.pick(e.clientX, e.clientY); if (!p) return null; const c = Math.round(p.x), r = Math.round(p.y); if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return null; return this.grid[r][c]; },
  canTouch() { return this.active && this.running && !this.paused && !this.ending; },
  onDown(e) {
    if (!this.canTouch()) return; this.idleT = 0; this.clearHints();
    const t = this.pickTile(e); if (!t || t.st !== ST.IDLE) { this.drag = null; return; }
    this.drag = { t, x: e.clientX, y: e.clientY, moved: false }; this.el.area.setPointerCapture?.(e.pointerId);
    Snd.resume();
  },
  onMove(e) {
    const d = this.drag; if (!d || d.moved || !this.canTouch()) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, cell = this.rect.w / (this.cols + 0.9), th = Math.max(10, cell * 0.22);
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    d.moved = true; const t = d.t; let o = null;
    if (Math.abs(dx) > Math.abs(dy)) o = this.grid[t.r][t.c + (dx > 0 ? 1 : -1)]; else o = this.grid[t.r + (dy > 0 ? 1 : -1)]?.[t.c];
    if (o) this.trySwap(t, o); this.setSel(null); this.drag = null;
  },
  onUp(e) {
    const d = this.drag; this.drag = null; if (!d || d.moved || !this.canTouch()) return;
    const t = d.t; if (t.st !== ST.IDLE) return;
    if (this.sel && this.sel !== t && Math.abs(this.sel.r - t.r) + Math.abs(this.sel.c - t.c) === 1) { this.trySwap(this.sel, t); this.setSel(null); }
    else if (this.sel === t) this.setSel(null); else { this.setSel(t); Snd.click(); }
  },
  setSel(t) { if (this.sel) this.sel.sel = false; this.sel = t; if (t) t.sel = true; },
  trySwap(a, b) {
    if (a.st !== ST.IDLE || b.st !== ST.IDLE) return false;
    this.st.swaps++; this.swap(a, b, false); Snd.swap(); haptic(8); return true;
  },
  swap(a, b, noCheck) {
    const ar = a.r, ac = a.c; a.r = b.r; a.c = b.c; b.r = ar; b.c = ac; this.grid[a.r][a.c] = a; this.grid[b.r][b.c] = b;
    for (const t of [a, b]) { t.st = ST.SWAP; t.t = 0; t.dur = 0.14; t.fx = t.x; t.fy = t.y; t.tx = t.c; t.ty = t.r; t.noCheck = noCheck; t.hint = false; }
    a.z = 0.01; b.z = 0; a.partner = b; b.partner = a;
  },
  onSwapDone(t) {
    const o = t.partner; t.partner = null; if (!o || o.st === ST.SWAP) return; // wait for both
    if (t.killed || o.killed) return; // a blast caught one mid-swap; never swap a dead tile back
    if (t.noCheck || o.noCheck) { t.noCheck = o.noCheck = false; return; }
    const pair = [t, o]; let handled = false;
    if (t.sp === SP.STAR || o.sp === SP.STAR) { const star = t.sp === SP.STAR ? t : o, other = star === t ? o : t; this.kill(star, 0, { starTarget: other.sp === SP.STAR ? -2 : other.type }); if (other.sp === SP.STAR) this.kill(other, 0.05, {}); handled = true; }
    else if (t.sp && o.sp) { this.kill(t, 0, {}); this.kill(o, 0.05, {}); handled = true; this.floatAt(t, 'COMBO!', 'big'); }
    if (!handled) {
      const groups = this.findMatches(); const hit = groups.filter(g => g.tiles.includes(t) || g.tiles.includes(o));
      if (hit.length) { this.resolveGroups(groups, pair); handled = true; }
    }
    if (!handled) { this.swap(t, o, true); Snd.bad(); haptic([10, 30, 10]); } else this.matchDirty = true;
  },
  /* ---- matching ---- */
  findMatches() {
    const g = this.grid, groups = [], seen = new Map();
    const runs = [];
    for (let r = 0; r < this.rows; r++) { let c = 0; while (c < this.cols) { const t = g[r][c]; if (!t || t.st !== ST.IDLE || t.type < 0) { c++; continue; } let e = c + 1; while (e < this.cols && g[r][e] && g[r][e].st === ST.IDLE && g[r][e].type === t.type) e++; if (e - c >= 3) runs.push({ h: true, tiles: g[r].slice(c, e) }); c = e; } }
    for (let c = 0; c < this.cols; c++) { let r = 0; while (r < this.rows) { const t = g[r][c]; if (!t || t.st !== ST.IDLE || t.type < 0) { r++; continue; } let e = r + 1; while (e < this.rows && g[e][c] && g[e][c].st === ST.IDLE && g[e][c].type === t.type) e++; if (e - r >= 3) { const ts = []; for (let k = r; k < e; k++) ts.push(g[k][c]); runs.push({ h: false, tiles: ts }); } r = e; } }
    for (const run of runs) {
      let grp = null; for (const t of run.tiles) if (seen.has(t)) { grp = seen.get(t); break; }
      if (!grp) { grp = { tiles: [], h: 0, v: 0, maxLine: 0, type: run.tiles[0].type }; groups.push(grp); }
      if (run.h) grp.h++; else grp.v++; grp.maxLine = Math.max(grp.maxLine, run.tiles.length);
      for (const t of run.tiles) if (!seen.has(t)) { seen.set(t, grp); grp.tiles.push(t); }
    }
    return groups;
  },
  resolveGroups(groups, swapped) {
    for (const grp of groups) {
      let special = SP.NONE;
      if (grp.maxLine >= 5) special = SP.STAR; else if (grp.h && grp.v) special = SP.BOMB; else if (grp.maxLine === 4) special = grp.h ? SP.COL : SP.ROW;
      let anchor = null; if (swapped) anchor = grp.tiles.find(t => swapped.includes(t)) || null; if (!anchor) anchor = grp.tiles[Math.floor(grp.tiles.length / 2)];
      const cx = grp.tiles.reduce((a, t) => a + t.x, 0) / grp.tiles.length, cy = grp.tiles.reduce((a, t) => a + t.y, 0) / grp.tiles.length;
      this.combo++; this.comboTimer = CFG.comboWindow; if (this.combo > this.st.maxCombo) this.st.maxCombo = this.combo;
      let pts = 0;
      for (const t of grp.tiles) { if (t === anchor && special) continue; pts += this.kill(t, 0.02 * Math.abs(t.x - cx) + 0.02 * Math.abs(t.y - cy), {}); }
      if (special) { pts += this.makeSpecial(anchor, special); }
      this.floatXY(cx, cy, '+' + fmt(pts), pts >= 1000 ? 'big' : '');
      this.announceCombo(); Snd.pop(this.combo);
    }
  },
  makeSpecial(t, sp) {
    if (sp === SP.STAR) return this.makeStar(t);
    t.sp = sp; t.pop = 1; this.st.specials++; S.stats.specials++; if (sp === SP.BOMB) this.st.bombs++; Snd.special();
    GFX.burst(t.x, t.y, 0xffffff, 12, { speed: 3, life: .4, size: .15, white: true });
    return Math.round(CFG.specialScore[sp] * this.mult());
  },
  makeStar(t) { t.sp = SP.STAR; t.type = -1; t.item = 0; t.pop = 1; this.st.specials++; this.st.stars++; S.stats.specials++; Snd.special(); GFX.burst(t.x, t.y, 0xffd166, 20, { speed: 3.5, life: .6, size: .2, white: true }); return Math.round(CFG.specialScore[4] * this.mult()); },
  mult() { const cm = Math.min(CFG.maxComboMult, 1 + Math.max(0, this.combo - 1) * 0.25); return cm * (this.blitz ? 2 : 1) * (this.frenzyT > 0 ? 2 : 1) * (1 + Econ.heroBonus(this.hero.id) / 100); },
  kill(t, delay, o) {
    if (!t || t.killed) return 0; t.killed = true; t.st = ST.DIE; t.dieDelay = delay; t.dieT = 0; t.hint = false; if (t.sel) this.setSel(null); t.killOpts = o || {};
    let pts = Math.round(CFG.tileScore * this.mult());
    this.score += pts; this.st.tiles++;
    if (!this.blitz) { this.meter = Math.min(1, this.meter + 1 / 36); if (this.meter >= 1) this.enterBlitz(); }
    if (t.type === 0) { this.st.hero++; if (this.power < 1) { this.power = Math.min(1, this.power + 1 / (13 - Econ.heroLevel(this.hero.id) * 1.2)); if (this.power >= 1) { Snd.chime(); haptic([20, 40, 20]); this.announce(this.hero.name.toUpperCase() + ' READY!'); } } }
    if (t.item === 1) { const c = Math.round(randInt(6, 12) * (this.boosts.coin ? 2 : 1) * Econ.coinMult()); this.coins += c; this.st.coinsTiles++; Snd.coin(); this.floatAt(t, '+' + c + ' 🪙', 'coin'); }
    if (t.item === 2) { this.time += 2; this.st.timeTiles++; this.floatAt(t, '+2s', 'time'); }
    return pts;
  },
  onDie(t) { // death actually begins (delay elapsed)
    const col = t.type >= 0 ? this.colors[t.type] : 0xffd166;
    GFX.burst(t.x, t.y, col, this.blitz ? 10 : 7, { speed: 3.2, life: .5, size: .18 });
    if (t.sp) this.activate(t);
  },
  activate(t) {
    const o = t.killOpts || {}, g = this.grid, kills = [];
    const add = (x, d) => { if (x && !x.killed) kills.push([x, d]); };
    if (t.sp === SP.ROW) { for (let c = 0; c < this.cols; c++) add(g[t.r][c], Math.abs(c - t.c) * 0.045); GFX.shake(0.25); this.floatAt(t, 'ROW BLAST!', 'big'); }
    else if (t.sp === SP.COL) { for (let r = 0; r < this.rows; r++) add(g[r][t.c], Math.abs(r - t.r) * 0.045); GFX.shake(0.25); this.floatAt(t, 'COLUMN BLAST!', 'big'); }
    else if (t.sp === SP.BOMB) { for (let r = t.r - 1; r <= t.r + 1; r++) for (let c = t.c - 1; c <= t.c + 1; c++) add(g[r]?.[c], 0.04); GFX.shake(0.5); Snd.boom(); haptic(40); GFX.burst(t.x, t.y, 0xff8a1f, 30, { speed: 6, life: .7, size: .3 }); }
    else if (t.sp === SP.STAR) {
      let target = o.starTarget; if (target === undefined) target = randInt(0, this.types - 1);
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const x = g[r][c]; if (x && !x.killed && (target === -2 || x.type === target)) add(x, 0.03 * (Math.abs(r - t.r) + Math.abs(c - t.c))); }
      GFX.shake(0.6); Snd.blitz(); haptic([30, 30, 60]); GFX.burst(t.x, t.y, 0xffd166, 40, { speed: 7, life: .9, size: .3, white: true }); this.floatAt(t, target === -2 ? 'MEGA STAR!' : 'RAINBOW!', 'big'); UI.flash(0.35);
    }
    if (kills.length) { this.combo++; this.comboTimer = CFG.comboWindow; if (this.combo > this.st.maxCombo) this.st.maxCombo = this.combo; let pts = 0; for (const [x, d] of kills) pts += this.kill(x, d, {}); this.floatXY(t.x, t.y - 0.8, '+' + fmt(pts), 'big'); this.announceCombo(); }
  },
  announceCombo() {
    const c = this.combo; const msg = c === 4 ? 'GOOD!' : c === 6 ? 'GREAT!' : c === 9 ? 'AMAZING!' : c === 13 ? 'UNBELIEVABLE!' : c === 18 ? 'LEGENDARY!' : null;
    if (msg) { this.announce(msg); Snd.fanfare(); haptic(30); }
  },
  announce(msg, cls) { UI.announce(msg, cls); },
  floatAt(t, txt, cls) { this.floatXY(t.x, t.y, txt, cls); },
  floatXY(x, y, txt, cls) { const p = GFX.project(x, y, 0.5); if (p) UI.floater(p.sx, p.sy, txt, cls); },
  enterBlitz() {
    this.blitz = true; this.blitzT = CFG.blitzDuration; this.meter = 1; this.st.blitzes++; S.stats.blitzes++;
    this.announce('BLITZ MODE!', 'blitz'); Snd.blitz(); haptic([50, 50, 50, 50, 100]); GFX.setBlitz(true); GFX.shake(0.4); document.body.classList.add('blitz'); UI.flash(0.5); Snd.setIntensity(1);
    for (let i = 0; i < 3; i++) { const t = pick(this.tiles.filter(x => x.st === ST.IDLE && !x.sp && x.type >= 0)); if (t) { t.sp = pick([SP.ROW, SP.COL, SP.BOMB]); t.pop = 1; } }
  },
  exitBlitz() { this.blitz = false; this.meter = 0; GFX.setBlitz(false); document.body.classList.remove('blitz'); Snd.setIntensity(0.5); },
  /* ---- powers ---- */
  usePower() {
    if (!this.canTouch() || this.power < 1) { if (this.power < 1 && this.canTouch()) { Snd.bad(); UI.toast(`${this.hero.e} Match ${this.hero.name} emoji to charge!`); } return; }
    this.power = 0; this.st.powers++; S.stats.powers++; Snd.power(); haptic([30, 20, 60]); UI.flash(0.25); GFX.shake(0.4);
    const lv = Econ.heroLevel(this.hero.id), P = this.hero.power, g = this.grid, idle = () => this.tiles.filter(t => t.st === ST.IDLE && !t.killed);
    this.announce(POWERS[P].name.toUpperCase() + '!'); this.combo++; this.comboTimer = CFG.comboWindow;
    const killRow = (r, d0 = 0) => { for (let c = 0; c < this.cols; c++) this.kill(g[r][c], d0 + c * 0.04, {}); };
    const killCol = (c, d0 = 0) => { for (let r = 0; r < this.rows; r++) this.kill(g[r][c], d0 + r * 0.04, {}); };
    const rows = shuffle([...Array(this.rows).keys()]), cols = shuffle([...Array(this.cols).keys()]);
    switch (P) {
      case 'row': { const n = 1 + Math.floor((lv - 1) / 2); for (let i = 0; i < n; i++) killRow(rows[i], i * 0.15); break; }
      case 'col': { const n = 1 + Math.floor((lv - 1) / 2); for (let i = 0; i < n; i++) killCol(cols[i], i * 0.15); break; }
      case 'cross': { const n = lv >= 3 ? 2 : 1; for (let i = 0; i < n; i++) { killRow(rows[i], i * 0.3); killCol(cols[i], i * 0.3 + 0.1); } break; }
      case 'bomb': { const n = 2 + Math.floor(lv / 2); for (let i = 0; i < n; i++) { const r = randInt(1, this.rows - 2), c = randInt(1, this.cols - 2); for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) this.kill(g[rr][cc], i * 0.2, {}); const t = g[r][c]; GFX.burst(c, r, 0xff8a1f, 20, { speed: 5 }); } Snd.boom(); break; }
      case 'convert': { const n = 6 + lv * 2; shuffle(idle().filter(t => t.type > 0)).slice(0, n).forEach((t, i) => { t.type = 0; t.pop = 1; GFX.burst(t.x, t.y, this.colors[0], 6, { speed: 2 }); }); this.matchDirty = true; break; }
      case 'time': { const n = 4 + lv; this.time += n; this.floatXY((this.cols - 1) / 2, 1, `+${n}s`, 'time big'); break; }
      case 'shuffle': { this.shuffleBoard(true); const n = 1 + Math.ceil(lv / 2); shuffle(idle()).slice(0, n).forEach(t => { t.sp = pick([SP.ROW, SP.COL, SP.BOMB]); t.pop = 1; }); break; }
      case 'coins': { const c = Math.round((15 + lv * 10) * (this.boosts.coin ? 2 : 1) * Econ.coinMult()); this.coins += c; Snd.coin(); this.floatXY((this.cols - 1) / 2, 1, `+${c} 🪙`, 'coin big'); shuffle(idle().filter(t => !t.item && !t.sp)).slice(0, 3 + lv).forEach(t => { t.item = 1; t.pop = 1; }); break; }
      case 'lightning': { const n = 8 + lv * 2; shuffle(idle()).slice(0, n).forEach((t, i) => { this.kill(t, i * 0.05, {}); GFX.burst(t.x, t.y, 0xfff176, 8, { speed: 4, white: true }); }); break; }
      case 'purge': { const ty = randInt(1, this.types - 1); idle().forEach(t => { if (t.type === ty || (lv >= 4 && t.sp)) this.kill(t, Math.random() * 0.3, {}); }); break; }
      case 'freeze': { this.freezeT = 3 + lv; this.floatXY((this.cols - 1) / 2, 1, `❄️ FROZEN ${this.freezeT}s`, 'time big'); break; }
      case 'stars': { const n = 1 + Math.ceil(lv / 2); shuffle(idle().filter(t => !t.sp)).slice(0, n).forEach(t => this.makeStar(t)); break; }
      case 'double': { this.frenzyT = 5 + lv; this.floatXY((this.cols - 1) / 2, 1, `🔥 2X SCORE ${this.frenzyT}s`, 'big'); break; }
      case 'blitz': { if (!this.blitz) { this.meter = Math.min(1, this.meter + Math.min(1, 0.5 + lv * 0.1)); if (this.meter >= 1) this.enterBlitz(); } else this.blitzT += 3; break; }
    }
    this.updateHud(true);
  },
  /* ---- board helpers ---- */
  hasMove() { return !!this.findMove(); },
  findMove() {
    const g = this.grid, R = this.rows, C = this.cols;
    const ty = (r, c) => { const t = g[r]?.[c]; return t && !t.killed ? t.type : -9; };
    const isMatchAt = (r, c, type) => { if (type < 0) return false; let n = 1; for (let k = c - 1; k >= 0 && ty(r, k) === type; k--) n++; for (let k = c + 1; k < C && ty(r, k) === type; k++) n++; if (n >= 3) return true; n = 1; for (let k = r - 1; k >= 0 && ty(k, c) === type; k--) n++; for (let k = r + 1; k < R && ty(k, c) === type; k++) n++; return n >= 3; };
    if (g.length < R) return null; // no board yet (before the first round)
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const a = g[r][c]; if (!a || a.killed) continue;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const b = g[r + dr]?.[c + dc]; if (!b || b.killed) continue;
        if (a.sp === SP.STAR || b.sp === SP.STAR || (a.sp && b.sp)) return [a, b];
        if (a.type === b.type) continue;
        // simulate
        a.type = [b.type, b.type = a.type][0];
        const ok = isMatchAt(r, c, a.type) || isMatchAt(r + dr, c + dc, b.type);
        a.type = [b.type, b.type = a.type][0];
        if (ok) return [a, b];
      }
    }
    return null;
  },
  shuffleBoard(withFx) {
    const live = this.tiles.filter(t => !t.killed && t.type >= 0);
    for (let attempt = 0; attempt < 30; attempt++) {
      const types = shuffle(live.map(t => t.type)); live.forEach((t, i) => t.type = types[i]);
      if (this.findMatches().length === 0 && this.hasMove()) break;
    }
    if (withFx) { live.forEach(t => { t.pop = 1; }); Snd.whoosh(); this.announce('SHUFFLE!'); }
    this.matchDirty = true;
  },
  clearHints() { for (const t of this.hints) t.hint = false; this.hints = []; },
  /* ---- loop ---- */
  update(dt) {
    if (!this.active || this.paused) return;
    // start delay (drop-in)
    if (!this.started) { this.startT -= dt; if (this.startT <= 0) { this.started = true; this.running = true; this.announce('GO!'); Snd.chime(); } }
    if (this.running && !this.ending) {
      if (this.freezeT > 0) this.freezeT -= dt; else this.time -= dt;
      this.elapsed += dt;
      if (this.time <= 0) { this.time = 0; this.ending = true; this.endT = 2.2; Snd.timeup(); this.announce("TIME'S UP!"); }
    }
    if (this.ending) { this.endT -= dt; const settled = !this.tiles.some(t => t.st !== ST.IDLE); if (this.endT <= 0 || (settled && this.endT < 1.6)) { this.finish(); return; } }
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    if (this.blitz) { this.blitzT -= dt; this.meter = Math.max(0, this.blitzT / CFG.blitzDuration); if (this.blitzT <= 0) this.exitBlitz(); }
    if (this.frenzyT > 0) this.frenzyT -= dt;
    // tiles
    let anyMoving = false;
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t = this.tiles[i];
      if (t.bounce > 0) t.bounce = Math.max(0, t.bounce - dt * 4);
      if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 3);
      if (t.st === ST.FALL) {
        anyMoving = true;
        if (t.spawnDelay > 0) { t.spawnDelay -= dt; continue; }
        t.vy += GRAV * dt; t.y += t.vy * dt;
        if (t.y >= t.r) { t.y = t.r; t.vy = 0; t.st = ST.IDLE; t.bounce = 1; this.matchDirty = true; }
      } else if (t.st === ST.SWAP) {
        anyMoving = true; t.t += dt; const k = Math.min(1, t.t / t.dur), e = 1 - Math.pow(1 - k, 3);
        t.x = lerp(t.fx, t.tx, e); t.y = lerp(t.fy, t.ty, e); t.z = (t.z > 0.005 ? 1 : 0) * Math.sin(k * Math.PI) * 0.5;
        if (k >= 1) { t.x = t.tx; t.y = t.ty; t.z = 0; t.st = ST.IDLE; this.onSwapDone(t); this.matchDirty = true; }
      } else if (t.st === ST.DIE) {
        anyMoving = true;
        if (t.dieDelay > 0) { t.dieDelay -= dt; if (t.dieDelay <= 0) this.onDie(t); continue; }
        t.dieT += dt; if (t.dieT >= 0.18) { this.grid[t.r][t.c] === t && (this.grid[t.r][t.c] = null); this.tiles.splice(i, 1); }
      } else if (t.st === ST.IDLE && t.y !== t.r) { t.y = t.r; t.x = t.c; }
    }
    this.gravity();
    if (this.matchDirty) { this.matchDirty = false; const groups = this.findMatches(); if (groups.length) { this.resolveGroups(groups, null); } }
    // hints
    if (this.running && !this.ending) {
      this.idleT += dt;
      if (!anyMoving && this.idleT > CFG.hintDelay && !this.hints.length) { const mv = this.findMove(); if (mv) { this.hints = mv; mv.forEach(t => t.hint = true); } else this.shuffleBoard(true); this.idleT = 0; }
    }
    this.buildViews(); this.updateHud(false);
    if (this.running && !this.ending && !this.blitz) Snd.setIntensity(this.time < 15 ? 0.85 : 0.3 + (1 - this.time / CFG.roundSeconds) * 0.4);
  },
  gravity() {
    const g = this.grid;
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const t = g[r][c];
        if (t && t.st === ST.DIE) { write = r - 1; continue; }
        if (t && t.st === ST.SWAP) { write = r - 1; continue; }
        if (t) { if (r !== write) { g[write][c] = t; g[r][c] = null; t.r = write; if (t.st === ST.IDLE) { t.st = ST.FALL; t.vy = 0; if (t.sel) this.setSel(null); t.hint = false; } } write--; }
      }
      let k = 0; for (let r = write; r >= 0; r--) { if (!g[r][c]) this.spawn(r, c, k++); }
    }
  },
  buildViews() {
    const V = this.views; let n = 0; const hint = Math.sin(performance.now() / 70) * 0.18;
    for (const t of this.tiles) {
      let v = V[n]; if (!v) v = V[n] = { x: 0, y: 0, z: 0, s: 1, rot: 0, tilt: 0, color: 0, glyph: null, badge: null };
      let s = 1, z = t.z, rot = 0, tilt = 0;
      if (t.st === ST.DIE) { if (t.dieDelay > 0) { s = 1 + Math.sin(t.dieDelay * 40) * 0.05; } else { const k = Math.min(1, t.dieT / 0.18); s = 1 - k; z = k * 0.8; rot = k * 2.5; } }
      if (t.bounce > 0) { s *= 1 + Math.sin(t.bounce * Math.PI) * 0.12 * t.bounce; }
      if (t.pop > 0) s *= 1 + Math.sin(t.pop * Math.PI) * 0.35;
      if (t.sel) { s *= 1.1; z += 0.35; rot += Math.sin(performance.now() / 150) * 0.12; }
      if (t.hint) { rot += hint; z += 0.15; }
      if (t.sp === SP.STAR) { rot += performance.now() / 900; }
      if (s <= 0.001) continue;
      v.x = t.x; v.y = t.y; v.z = z; v.s = s; v.rot = rot; v.tilt = tilt;
      v.color = t.type >= 0 ? this.colors[t.type] : 0xfff1b8; v.glyph = Atlas.get(t.type >= 0 ? this.glyphs[t.type] : '🌟');
      v.badge = t.sp && t.sp !== SP.STAR ? Atlas.get(SP_BADGE[t.sp]) : t.item ? Atlas.get(ITEM_BADGE[t.item]) : null;
      n++;
    }
    GFX.drawTiles(V, n);
  },
  _hud: { score: -1, time: -1, meter: -1, combo: -1, coins: -1, power: -1 },
  updateHud(force) {
    const h = this._hud, e = this.el;
    if (force || h.score !== this.score) { h.score = this.score; e.score.textContent = fmt(this.score); if (this.score > S.stats.best && S.stats.best > 0) e.best.textContent = 'NEW BEST!'; }
    const sec = Math.ceil(this.time); if (force || h.time !== sec) { h.time = sec; e.timer.textContent = this.freezeT > 0 ? '❄️' + sec : sec; e.timerWrap.classList.toggle('low', sec <= 10 && this.running); if (sec <= 5 && sec > 0 && this.running && !this.ending && this.lastSec !== sec) { this.lastSec = sec; Snd.tick(); } }
    const m = Math.round(this.meter * 100); if (force || h.meter !== m) { h.meter = m; e.meterFill.style.width = m + '%'; e.meter.classList.toggle('full', this.blitz); }
    const cm = this.combo; if (force || h.combo !== cm) { h.combo = cm; e.combo.textContent = 'x' + Math.min(CFG.maxComboMult, 1 + Math.max(0, cm - 1) * 0.25).toFixed(2).replace(/\.?0+$/, ''); }
    if (force || h.coins !== this.coins) { h.coins = this.coins; e.coins.textContent = fmt(this.coins); }
    const p = Math.round(this.power * 100); if (force || h.power !== p) { h.power = p; e.power.style.setProperty('--p', p); e.power.classList.toggle('ready', p >= 100); e.powerLbl.textContent = p >= 100 ? 'TAP!' : p + '%'; }
  },
  coach(msg, hand) { this.el.coach.innerHTML = `<div>${esc(msg)}</div>${hand ? `<div class="hand emoji">${hand}</div>` : ''}`; this.el.coach.classList.remove('hidden'); clearTimeout(this._coachT); this._coachT = setTimeout(() => this.el.coach.classList.add('hidden'), 5000); },
  pause() { if (!this.running || this.paused || this.ending) return; this.paused = true; UI.open('pause'); },
  resume() { this.paused = false; this.idleT = 0; },
  quit() { this.active = false; this.running = false; this.paused = false; GFX.setMode('none'); document.body.classList.remove('blitz'); Snd.setIntensity(0); },
  finish(quit) {
    this.running = false; this.ending = false; this.over = true; this.paused = true;
    if (this.blitz) this.exitBlitz();
    const res = { score: this.score, coins: this.coins, stats: { ...this.st }, hero: this.hero.id, elapsed: this.elapsed, continues: this.continues, quit: !!quit };
    Bus.emit('gameover', res);
  },
  continueRound(seconds) { this.time += seconds; this.over = false; this.paused = false; this.running = true; this.ending = false; this.continues++; this.announce(`+${seconds} SECONDS!`); Snd.fanfare(); this.updateHud(true); },
};
