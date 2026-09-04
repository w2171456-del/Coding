/* ============================================================
   EMOJI RUSH 3D — single-file production build
   Sections: CFG · utils · Save · Snd · catalogs · Econ · G3D ·
             Game · meta systems · monetization · UI · Boot
   ============================================================ */
'use strict';

const CFG = {
  cols: 7, rows: 7, types: 5,
  roundSeconds: 60,
  livesMax: 5, lifeRegenMs: 15 * 60 * 1000,
  adSeconds: 10, interstitialSeconds: 5, interstitialSkipAfter: 3, interstitialEvery: 3, interstitialMinGapMs: 90 * 1000,
  continueGemCosts: [30, 60, 120, 240],
  blitzDuration: 8, comboWindow: 1.6, hintDelay: 4.5,
  piggyCap: 500, piggyPerGame: 3, piggyPerPoints: 3000,
  starterPackHours: 24, flashSaleMinutes: 15, flashSaleAfterGames: [2, 5, 9, 14, 20, 30],
  adLivesPerDay: 3, adGemsPerDay: 5, adSpinsPerDay: 3,
  passTiers: 30, passXpPerTier: 400, passSeasonDays: 28,
  tileScore: 50, specialScore: { 1: 300, 2: 300, 3: 500, 4: 1500 },
  maxComboMult: 5,
  saveKey: 'emojiRush3D.v1',
  version: '1.0.0',
};

const DAY = 86400000;
const now = () => Date.now();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmtShort = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : fmt(n);
const pad2 = n => String(n).padStart(2, '0');
const fmtTime = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h > 0 ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`; };
const fmtDur = ms => { const s = Math.floor(ms / 1000); if (s < 3600) return `${Math.floor(s / 60)}m ${pad2(s % 60)}s`; const h = Math.floor(s / 3600); if (h < 48) return `${h}h ${pad2(Math.floor(s % 3600 / 60))}m`; return `${Math.floor(h / 24)}d ${h % 24}h`; };
const todayKey = (t = now()) => new Date(t).toISOString().slice(0, 10);
const dayNum = (t = now()) => Math.floor(t / DAY);
const weekNum = (t = now()) => Math.floor((t + 3 * DAY) / (7 * DAY)); // weeks start Monday 00:00 UTC
const weekEnd = (t = now()) => (weekNum(t) + 1) * 7 * DAY - 3 * DAY;
const money = c => '$' + (c / 100).toFixed(2);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const weighted = (items, wKey = 'w') => { let s = 0; for (const it of items) s += it[wKey]; let r = Math.random() * s; for (const it of items) { r -= it[wKey]; if (r <= 0) return it; } return items[items.length - 1]; };
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const IS_MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) < 900;
const Bus = { h: {}, on(e, f) { (this.h[e] ||= []).push(f); }, emit(e, ...a) { (this.h[e] || []).forEach(f => f(...a)); } };

/* ---------------- catalogs ---------------- */
const POWERS = {
  row:       { name: 'Row Blast',     ic: '➡️', d: lv => `Clears ${1 + Math.floor((lv - 1) / 2)} row${lv >= 3 ? 's' : ''}` },
  col:       { name: 'Column Blast',  ic: '⬇️', d: lv => `Clears ${1 + Math.floor((lv - 1) / 2)} column${lv >= 3 ? 's' : ''}` },
  cross:     { name: 'Cross Blast',   ic: '➕', d: lv => `Clears a row + column${lv >= 3 ? ' twice' : ''}` },
  bomb:      { name: 'Triple Bomb',   ic: '💣', d: lv => `${2 + Math.floor(lv / 2)} bomb blasts` },
  convert:   { name: 'Color Wave',    ic: '🌊', d: lv => `Converts ${6 + lv * 2} emoji to your hero` },
  time:      { name: 'Time Warp',     ic: '⏰', d: lv => `+${4 + lv} seconds` },
  shuffle:   { name: 'Storm Shuffle', ic: '🌪️', d: lv => `Shuffles and spawns ${1 + Math.ceil(lv / 2)} specials` },
  coins:     { name: 'Coin Rain',     ic: '🪙', d: lv => `+${15 + lv * 10} coins, ${3 + lv} coin emoji` },
  lightning: { name: 'Lightning',     ic: '⚡', d: lv => `Zaps ${8 + lv * 2} emoji` },
  purge:     { name: 'Type Purge',    ic: '🧹', d: lv => `Removes an entire emoji type${lv >= 4 ? ' + specials' : ''}` },
  freeze:    { name: 'Time Freeze',   ic: '❄️', d: lv => `Freezes timer ${3 + lv}s` },
  stars:     { name: 'Star Shower',   ic: '🌟', d: lv => `Creates ${1 + Math.ceil(lv / 2)} rainbow stars` },
  double:    { name: 'Frenzy',        ic: '🔥', d: lv => `Double score for ${5 + lv}s` },
  blitz:     { name: 'Instant Blitz', ic: '💥', d: lv => `Fills Blitz meter ${Math.min(100, 50 + lv * 10)}%` },
};
const RAR = { common: { n: 'Common', w: 70, c: '#9aa5b1' }, rare: { n: 'Rare', w: 25, c: '#3b82f6' }, epic: { n: 'Epic', w: 4.5, c: '#a855f7' }, legendary: { n: 'Legendary', w: 0.5, c: '#f59e0b' } };
const H = (id, e, name, rar, power, bonus) => ({ id, e, name, rar, power, bonus });
const HEROES = [
  H('fox', '🦊', 'Foxy', 'common', 'row', 2), H('frog', '🐸', 'Ribbit', 'common', 'col', 2), H('panda', '🐼', 'Bamboo', 'common', 'lightning', 2),
  H('koala', '🐨', 'Snooze', 'common', 'time', 2), H('pig', '🐷', 'Truffle', 'common', 'coins', 2), H('monkey', '🐵', 'Chimpo', 'common', 'shuffle', 2),
  H('dog', '🐶', 'Biscuit', 'common', 'row', 2), H('cat', '🐱', 'Whiskers', 'common', 'col', 2), H('bunny', '🐰', 'Hopper', 'common', 'time', 2), H('bear', '🐻', 'Honeypaw', 'common', 'bomb', 2),
  H('unicorn', '🦄', 'Sparkle', 'rare', 'stars', 3), H('octo', '🐙', 'Inky', 'rare', 'cross', 3), H('lion', '🦁', 'Rexford', 'rare', 'bomb', 3),
  H('tiger', '🐯', 'Stripes', 'rare', 'lightning', 3), H('butterfly', '🦋', 'Flutter', 'rare', 'convert', 3), H('dino', '🦖', 'Chomp', 'rare', 'purge', 3),
  H('penguin', '🐧', 'Waddle', 'rare', 'freeze', 3), H('owl', '🦉', 'Professor', 'rare', 'shuffle', 3), H('bee', '🐝', 'Buzz', 'rare', 'coins', 3), H('shark', '🦈', 'Finn', 'rare', 'row', 3),
  H('wizard', '🧙', 'Merlyn', 'epic', 'convert', 5), H('mermaid', '🧜', 'Coral', 'epic', 'stars', 5), H('fairy', '🧚', 'Pixie', 'epic', 'time', 5),
  H('robot', '🤖', 'Bolt', 'epic', 'cross', 5), H('alien', '👽', 'Zorp', 'epic', 'purge', 5), H('hero', '🦸', 'Captain', 'epic', 'double', 5),
  H('vampire', '🧛', 'Fang', 'epic', 'freeze', 5), H('ninja', '🥷', 'Shadow', 'epic', 'lightning', 5), H('ring', '🎪', 'Ringmaster', 'epic', 'shuffle', 5),
  H('dragon', '🐉', 'Ancient', 'legendary', 'bomb', 8), H('blaze', '🔥', 'Blaze', 'legendary', 'double', 8), H('prism', '🌈', 'Prism', 'legendary', 'stars', 8), H('crown', '👑', 'Majesty', 'legendary', 'blitz', 8),
];
const HERO = Object.fromEntries(HEROES.map(h => [h.id, h]));
const FILLERS = ['🍎', '🍋', '🍇', '🍓', '🥝', '🍊', '🍉', '🍒'];
const GLYPHS = [...HEROES.map(h => h.e), ...FILLERS, '🌟', '🪙', '⏱️', '💣', '➡️', '⬇️', '🌪️', '⭐', '💎', '❤️'];
const TYPE_COLORS = ['#ff5f6d', '#3d9bff', '#3ecf6b', '#ffcf3d', '#c258ff', '#2dd4bf'];
const STAR_SHARDS = [0, 2, 4, 8, 16];
const STAR_COINS = [0, 500, 1500, 4000, 10000];

const BOOSTS = {
  time:    { ic: '⏰', name: '+5 Seconds', d: 'Start the round with 65s', coins: 300 },
  power:   { ic: '⚡', name: 'Power Start', d: 'Start with your power half charged', coins: 350 },
  coin:    { ic: '🪙', name: 'Coin Doubler', d: 'Double coins collected this round', coins: 250 },
  rainbow: { ic: '🌟', name: 'Star Start', d: 'Begin with 2 rainbow stars on the board', coins: 500 },
};

const GEM_PACKS = [
  { sku: 'gems_80', gems: 80, price: 99, name: 'Handful', ic: '💎' },
  { sku: 'gems_450', gems: 450, price: 499, name: 'Pouch', ic: '👝', bonus: '+12%' },
  { sku: 'gems_1000', gems: 1000, price: 999, name: 'Chest', ic: '🧰', bonus: '+25%', pop: true },
  { sku: 'gems_2200', gems: 2200, price: 1999, name: 'Vault', ic: '🏦', bonus: '+38%' },
  { sku: 'gems_6000', gems: 6000, price: 4999, name: 'Treasury', ic: '🏛️', bonus: '+50%', best: true },
  { sku: 'gems_13000', gems: 13000, price: 9999, name: 'Dragon Hoard', ic: '🐲', bonus: '+63%' },
];
const COIN_PACKS = [
  { id: 'c1', coins: 1000, gems: 50 }, { id: 'c2', coins: 5500, gems: 250, bonus: '+10%' }, { id: 'c3', coins: 12000, gems: 500, bonus: '+20%' },
];
const SKUS = {
  starter: { price: 299, was: 1499, name: 'Starter Pack', ic: '🎁', items: ['💎 300', '🪙 3,000', '🎁 2 Gold Boxes', '🧙 Guaranteed Epic'] },
  flash:   { price: 199, was: 1299, name: 'Flash Sale', ic: '⚡', items: ['💎 200', '🪙 2,000', '⏰ 3 Boosts'] },
  piggy:   { price: 299, name: 'Break the Piggy', ic: '🐷' },
  pass:    { price: 499, name: 'Premium Pass', ic: '🎟️' },
  vip:     { price: 999, name: 'VIP Club (30 days)', ic: '👑' },
  noads:   { price: 399, name: 'Remove Ads', ic: '🚫' },
  legend:  { price: 1999, was: 4999, name: 'Legendary Hunt', ic: '🐉', items: ['🎁 10 Gold Boxes', '⭐ 1 Legendary Guaranteed', '💎 500'] },
};

/* ---------------- persistence ---------------- */
const Save = {
  state: null,
  defaults() {
    const t = now();
    return {
      v: 1, created: t, name: 'Player' + randInt(1000, 9999), avatar: '🦊',
      coins: 500, gems: 40, lives: CFG.livesMax, lifeTs: 0, unlimitedUntil: 0,
      xp: 0, level: 1,
      owned: { fox: { stars: 1, shards: 0, new: false } }, equipped: 'fox',
      boosts: { time: 1, power: 1, coin: 1, rainbow: 1 }, boostsOn: {},
      stats: { games: 0, best: 0, totalScore: 0, tiles: 0, combosBest: 0, specials: 0, powers: 0, blitzes: 0, coinsEarned: 0, playMs: 0 },
      daily: { streak: 0, lastKey: '', claimedToday: false },
      missions: { key: '', list: [], rerollAd: false, allBonus: false },
      wheel: { key: '', free: true, adSpins: 0 },
      pass: { season: 0, xp: 0, premium: false, claimedFree: [], claimedPrem: [] },
      event: { week: 0, tokens: 0, claimed: [], double: false },
      piggy: { gems: 0 },
      pity: { epic: 0, legendary: 0, pulls: 0 },
      iap: { starter: false, starterSeenTs: 0, noAds: false, vipUntil: 0, spent: 0, purchases: [], firstBonusUsed: false, legend: false },
      flash: { until: 0, triggered: [] },
      ads: { key: '', lives: 0, gems: 0, spins: 0, watched: 0, lastInterstitial: 0 },
      settings: { sfx: true, music: true, haptics: true, quality: 'auto', reduceMotion: false },
      tutorialDone: false, sessionGames: 0, gamesSinceAd: 0,
      lb: { week: 0, best: 0, lastReward: 0 },
      seed: randInt(1, 1e9),
    };
  },
  load() {
    let s = this.defaults();
    try {
      const raw = localStorage.getItem(CFG.saveKey);
      if (raw) { const parsed = JSON.parse(raw); s = this.merge(s, parsed); }
    } catch (e) { console.warn('save load failed', e); }
    this.state = s; return s;
  },
  merge(def, src) {
    if (Array.isArray(def)) return Array.isArray(src) ? src : def;
    if (def && typeof def === 'object') {
      const out = { ...def };
      if (src && typeof src === 'object') for (const k of Object.keys(src)) out[k] = (k in def) ? this.merge(def[k], src[k]) : src[k];
      return out;
    }
    return src === undefined ? def : src;
  },
  _t: 0,
  commit() { clearTimeout(this._t); this._t = setTimeout(() => this.flush(), 400); },
  flush() { clearTimeout(this._t); try { localStorage.setItem(CFG.saveKey, JSON.stringify(this.state)); } catch (e) { /* storage unavailable (private mode) */ } },
  reset() { try { localStorage.removeItem(CFG.saveKey); } catch (e) { } location.reload(); },
};
const S = Save.load();
addEventListener('pagehide', () => Save.flush());
addEventListener('visibilitychange', () => { if (document.hidden) Save.flush(); });

/* ---------------- audio (procedural WebAudio) ---------------- */
const Snd = {
  ctx: null, master: null, sfxG: null, musG: null, ready: false, musicOn: false, intensity: 0, _sched: 0, _next: 0, _step: 0,
  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.sfxG = this.ctx.createGain(); this.sfxG.connect(this.master);
      this.musG = this.ctx.createGain(); this.musG.gain.value = 0.0; this.musG.connect(this.master);
      this.filter = this.ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 900; this.filter.connect(this.musG);
      this.ready = true; this.apply();
    } catch (e) { console.warn('audio init failed', e); }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  apply() { if (!this.ready) return; this.sfxG.gain.value = S.settings.sfx ? 1 : 0; if (S.settings.music) this.startMusic(); else this.stopMusic(); },
  tone(o) {
    if (!this.ready || !S.settings.sfx) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.dur || .2));
    const a = o.attack || 0.005, d = o.dur || 0.2, v = o.vol || 0.2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(this.sfxG); osc.start(t); osc.stop(t + d + 0.05);
  },
  noise(dur = 0.2, vol = 0.15, delay = 0) {
    if (!this.ready || !S.settings.sfx) return;
    const c = this.ctx, t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const g = c.createGain(); g.gain.value = vol; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    src.connect(f); f.connect(g); g.connect(this.sfxG); src.start(t);
  },
  pop(combo = 0) { const base = 440 * Math.pow(1.06, Math.min(combo, 16)); this.tone({ f: base, f2: base * 1.5, type: 'triangle', dur: .16, vol: .22 }); this.tone({ f: base * 2, dur: .08, vol: .06, type: 'sine', delay: .02 }); },
  swap() { this.tone({ f: 520, f2: 760, type: 'sine', dur: .09, vol: .12 }); },
  bad() { this.tone({ f: 220, f2: 140, type: 'sawtooth', dur: .18, vol: .12 }); },
  click() { this.tone({ f: 900, f2: 600, type: 'square', dur: .05, vol: .05 }); },
  coin() { this.tone({ f: 1320, type: 'square', dur: .07, vol: .08 }); this.tone({ f: 1760, type: 'square', dur: .18, vol: .08, delay: .06 }); },
  gem() { this.tone({ f: 1568, type: 'sine', dur: .25, vol: .12 }); this.tone({ f: 2093, type: 'sine', dur: .35, vol: .1, delay: .08 }); },
  tick() { this.tone({ f: 1000, type: 'square', dur: .04, vol: .09 }); },
  whoosh() { this.noise(.25, .18); },
  special() { this.noise(.35, .22); this.tone({ f: 300, f2: 1200, type: 'sawtooth', dur: .35, vol: .12 }); },
  boom() { this.noise(.5, .35); this.tone({ f: 120, f2: 40, type: 'sine', dur: .5, vol: .35 }); },
  power() { [0, .08, .16, .24].forEach((d, i) => this.tone({ f: 330 * Math.pow(1.26, i), type: 'triangle', dur: .3, vol: .16, delay: d })); this.noise(.4, .15, .2); },
  chime() { this.tone({ f: 880, dur: .12, vol: .1 }); this.tone({ f: 1320, dur: .25, vol: .12, delay: .1 }); },
  blitz() { [0, .1, .2, .3, .4].forEach((d, i) => this.tone({ f: 262 * Math.pow(1.19, i), type: 'square', dur: .25, vol: .14, delay: d })); this.noise(.8, .25, .3); },
  fanfare() { [[523, 0], [659, .12], [784, .24], [1047, .36], [784, .5], [1047, .6]].forEach(([f, d]) => this.tone({ f, type: 'triangle', dur: .35, vol: .16, delay: d })); },
  levelup() { [[392, 0], [523, .1], [659, .2], [784, .3], [1047, .45]].forEach(([f, d]) => this.tone({ f, type: 'sine', dur: .5, vol: .16, delay: d })); },
  reveal(rar) { const n = { common: 1, rare: 2, epic: 3, legendary: 5 }[rar] || 1; for (let i = 0; i < n; i++) this.tone({ f: 660 * Math.pow(1.2, i), type: 'triangle', dur: .4, vol: .15, delay: i * .09 }); if (rar === 'legendary') this.noise(1, .3, .3); },
  timeup() { this.tone({ f: 660, f2: 220, type: 'sawtooth', dur: .9, vol: .2 }); },
  startMusic() {
    if (!this.ready || this.musicOn) return; this.musicOn = true; this.musG.gain.setTargetAtTime(0.22, this.ctx.currentTime, 0.5);
    this._next = this.ctx.currentTime + 0.05; this._step = 0; this._sched = setInterval(() => this._schedule(), 90);
  },
  stopMusic() { if (!this.musicOn) return; this.musicOn = false; clearInterval(this._sched); if (this.ready) this.musG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); },
  setIntensity(v) { this.intensity = v; if (this.ready) this.filter.frequency.setTargetAtTime(700 + v * 3500, this.ctx.currentTime, 0.3); },
  _schedule() {
    const c = this.ctx, bpm = 112 + this.intensity * 40, spb = 60 / bpm / 2;
    const scale = [0, 3, 5, 7, 10, 12, 15, 17], root = 55 * Math.pow(2, 3 / 12);
    while (this._next < c.currentTime + 0.25) {
      const s = this._step, bar = Math.floor(s / 16) % 4, chordRoot = [0, 5, 3, 7][bar];
      const deg = scale[(s * 3 + bar) % scale.length] + chordRoot, f = root * Math.pow(2, (deg + 12) / 12);
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, this._next); g.gain.exponentialRampToValueAtTime(0.5, this._next + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, this._next + spb * 0.9);
      o.connect(g); g.connect(this.filter); o.start(this._next); o.stop(this._next + spb);
      if (s % 8 === 0) { const b = c.createOscillator(), bg = c.createGain(); b.type = 'sine'; b.frequency.value = root * Math.pow(2, chordRoot / 12) / 2; bg.gain.setValueAtTime(0.6, this._next); bg.gain.exponentialRampToValueAtTime(0.0001, this._next + spb * 3.5); b.connect(bg); bg.connect(this.filter); b.start(this._next); b.stop(this._next + spb * 4); }
      if (this.intensity > 0.5 && s % 4 === 2) { const h = c.createOscillator(), hg = c.createGain(); h.type = 'square'; h.frequency.value = f * 2; hg.gain.setValueAtTime(0.12, this._next); hg.gain.exponentialRampToValueAtTime(0.0001, this._next + spb * 0.5); h.connect(hg); hg.connect(this.filter); h.start(this._next); h.stop(this._next + spb); }
      this._next += spb; this._step++;
    }
  },
};
const haptic = (p) => { if (S.settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { } } };

/* ---------------- economy ---------------- */
const Econ = {
  xpFor: lv => Math.round(120 * Math.pow(lv, 1.45)),
  isVip: () => S.iap.vipUntil > now(),
  noAds: () => S.iap.noAds || Econ.isVip(),
  livesMax: () => CFG.livesMax + (Econ.isVip() ? 1 : 0),
  unlimited: () => S.unlimitedUntil > now(),
  tickLives() {
    const max = this.livesMax(); if (S.lives >= max) { S.lifeTs = 0; return; }
    if (!S.lifeTs) S.lifeTs = now() + CFG.lifeRegenMs;
    let changed = false;
    while (S.lives < max && S.lifeTs && now() >= S.lifeTs) { S.lives++; S.lifeTs += CFG.lifeRegenMs; changed = true; }
    if (S.lives >= max) S.lifeTs = 0;
    if (changed) { Save.commit(); Bus.emit('hud'); }
  },
  lifeCountdown() { return S.lifeTs ? Math.max(0, S.lifeTs - now()) : 0; },
  canPlay() { return this.unlimited() || S.lives > 0; },
  useLife() { if (this.unlimited()) return true; if (S.lives <= 0) return false; if (S.lives === this.livesMax()) S.lifeTs = now() + CFG.lifeRegenMs; S.lives--; Save.commit(); Bus.emit('hud'); return true; },
  addLives(n) { S.lives = Math.min(this.livesMax(), S.lives + n); if (S.lives >= this.livesMax()) S.lifeTs = 0; Save.commit(); Bus.emit('hud'); },
  refill() { S.lives = this.livesMax(); S.lifeTs = 0; Save.commit(); Bus.emit('hud'); },
  addCoins(n, src) { n = Math.round(n); if (!n) return; S.coins += n; if (n > 0) S.stats.coinsEarned += n; Save.commit(); Bus.emit('hud'); if (src !== 'silent') Bus.emit('currency', 'coins', n); },
  addGems(n, src) { n = Math.round(n); if (!n) return; S.gems += n; Save.commit(); Bus.emit('hud'); if (src !== 'silent') Bus.emit('currency', 'gems', n); },
  spend(kind, n) { if (S[kind] < n) return false; S[kind] -= n; Save.commit(); Bus.emit('hud'); return true; },
  addXp(n) {
    S.xp += Math.round(n); const ups = [];
    while (S.xp >= this.xpFor(S.level)) { S.xp -= this.xpFor(S.level); S.level++; ups.push(S.level); }
    Save.commit(); Bus.emit('hud'); return ups;
  },
  levelReward(lv) { const r = { coins: 150 + lv * 50, gems: 5 + Math.floor(lv / 2) }; if (lv % 5 === 0) r.box = 'gold'; else if (lv % 2 === 0) r.box = 'silver'; if (lv === 3) r.boost = 'time'; return r; },
  heroLevel(id) { const o = S.owned[id]; return o ? o.stars : 0; },
  heroBonus(id) { const h = HERO[id], o = S.owned[id]; return o ? h.bonus * o.stars : 0; },
  coinMult() { return Econ.isVip() ? 1.5 : 1; },
};
