/* ---------------- meta systems ---------------- */
const MISSION_DEFS = [
  { id: 'games', ic: '🎮', t: n => `Play ${n} rounds`, tiers: [2, 3, 5], key: 'games', rw: { coins: 200 } },
  { id: 'score', ic: '🏅', t: n => `Score ${fmtShort(n)} in one round`, tiers: [8000, 15000, 30000], key: 'score', single: true, rw: { gems: 10 } },
  { id: 'tiles', ic: '🧩', t: n => `Clear ${n} emoji`, tiles: 1, tiers: [150, 300, 600], key: 'tiles', rw: { coins: 300 } },
  { id: 'specials', ic: '💣', t: n => `Create ${n} specials`, tiers: [4, 8, 15], key: 'specials', rw: { gems: 8 } },
  { id: 'powers', ic: '⚡', t: n => `Use ${n} hero powers`, tiers: [2, 4, 8], key: 'powers', rw: { coins: 250 } },
  { id: 'combo', ic: '🔥', t: n => `Reach a ${n}x combo`, tiers: [5, 8, 12], key: 'maxCombo', single: true, rw: { gems: 12 } },
  { id: 'blitz', ic: '💥', t: n => `Enter Blitz Mode ${n} times`, tiers: [1, 2, 4], key: 'blitzes', rw: { box: 'silver' } },
  { id: 'coins', ic: '🪙', t: n => `Collect ${n} coins in rounds`, tiers: [100, 250, 500], key: 'coins', rw: { coins: 400 } },
  { id: 'hero', ic: '🎭', t: n => `Clear ${n} hero emoji`, tiers: [60, 120, 250], key: 'hero', rw: { shards: 3 } },
  { id: 'stars', ic: '🌟', t: n => `Create ${n} rainbow stars`, tiers: [1, 2, 4], key: 'stars', rw: { gems: 15 } },
];
const Missions = {
  ensure() {
    const k = todayKey(); if (S.missions.key === k && S.missions.list.length) return;
    const rng = mulberry(dayNum() * 7919 + S.seed % 1000);
    const defs = [...MISSION_DEFS].sort(() => rng() - 0.5).slice(0, 4);
    S.missions = { key: k, list: defs.map((d, i) => { const tier = Math.min(2, Math.floor(S.level / 6) + (i === 3 ? 1 : 0)); return { id: d.id, goal: d.tiers[tier], prog: 0, done: false, claimed: false }; }), rerollAd: false, allBonus: false };
    Save.commit();
  },
  progress(res) {
    this.ensure(); let completed = 0;
    for (const m of S.missions.list) {
      if (m.done) continue; const d = MISSION_DEFS.find(x => x.id === m.id); let val = 0;
      if (d.key === 'games') val = 1; else if (d.key === 'score') val = res.score; else if (d.key === 'coins') val = res.coins; else val = res.stats[d.key] || 0;
      if (d.single) m.prog = Math.max(m.prog, val); else m.prog += val;
      if (m.prog >= m.goal) { m.prog = m.goal; m.done = true; completed++; }
    }
    Save.commit(); return completed;
  },
  claimable() { this.ensure(); return S.missions.list.filter(m => m.done && !m.claimed).length; },
  claim(i) {
    const m = S.missions.list[i]; if (!m || !m.done || m.claimed) return null; m.claimed = true;
    const d = MISSION_DEFS.find(x => x.id === m.id); const rw = { ...d.rw }; if (Econ.isVip()) { if (rw.coins) rw.coins = Math.round(rw.coins * 1.5); if (rw.gems) rw.gems = Math.round(rw.gems * 1.5); }
    Rewards.grant(rw, 'Mission complete'); Pass.addXp(120);
    if (S.missions.list.every(x => x.claimed) && !S.missions.allBonus) { S.missions.allBonus = true; Rewards.grant({ box: 'gold' }, 'All missions cleared!'); }
    Save.commit(); return rw;
  },
  reroll(i) { const d = pick(MISSION_DEFS.filter(x => !S.missions.list.some(m => m.id === x.id))); const tier = Math.min(2, Math.floor(S.level / 6)); S.missions.list[i] = { id: d.id, goal: d.tiers[tier], prog: 0, done: false, claimed: false }; Save.commit(); },
  desc(m) { const d = MISSION_DEFS.find(x => x.id === m.id); return { ic: d.ic, text: d.t(m.goal), rw: d.rw }; },
};

const Rewards = {
  label(rw) { const p = []; if (rw.coins) p.push(`🪙 ${fmt(rw.coins)}`); if (rw.gems) p.push(`💎 ${rw.gems}`); if (rw.lives) p.push(`❤️ ${rw.lives}`); if (rw.box) p.push(`🎁 ${rw.box === 'gold' ? 'Gold' : rw.box === 'diamond' ? 'Diamond' : 'Silver'} Box`); if (rw.boost) p.push(`${BOOSTS[rw.boost].ic} ${BOOSTS[rw.boost].name}`); if (rw.shards) p.push(`⭐ ${rw.shards} shards`); if (rw.hero) p.push(`${HERO[rw.hero].e} ${HERO[rw.hero].name}`); if (rw.unlimited) p.push(`♾️ ${rw.unlimited}m lives`); if (rw.tokens) p.push(`🌪️ ${rw.tokens} tokens`); return p.join(' · '); },
  grant(rw, why) {
    const boxes = [];
    if (rw.coins) Econ.addCoins(rw.coins); if (rw.gems) Econ.addGems(rw.gems); if (rw.lives) Econ.addLives(rw.lives);
    if (rw.boost) { S.boosts[rw.boost] = (S.boosts[rw.boost] || 0) + (rw.boostN || 1); }
    if (rw.shards) { const o = S.owned[S.equipped]; if (o) o.shards += rw.shards; }
    if (rw.hero) Gacha.give(rw.hero, 1);
    if (rw.unlimited) S.unlimitedUntil = Math.max(S.unlimitedUntil, now()) + rw.unlimited * 60000;
    if (rw.tokens) S.event.tokens += rw.tokens;
    if (rw.box) boxes.push(rw.box);
    Save.commit(); Bus.emit('hud');
    if (why) UI.toast(`${why}: ${this.label(rw)}`);
    if (boxes.length) UI.queueBoxes(boxes);
  },
};

const DAILY = [
  { e: '🪙', rw: { coins: 300 } }, { e: '💎', rw: { gems: 15 } }, { e: '⏰', rw: { boost: 'time' } }, { e: '🪙', rw: { coins: 600 } },
  { e: '🎁', rw: { box: 'silver' } }, { e: '💎', rw: { gems: 30 } }, { e: '🎁', rw: { box: 'gold' } },
];
const Daily = {
  status() { const k = todayKey(), last = S.daily.lastKey; if (last === k) return 'claimed'; const y = todayKey(now() - DAY); if (last && last !== y) { S.daily.streak = 0; Save.commit(); } return 'ready'; },
  dayIndex() { return S.daily.streak % 7; },
  claim() {
    if (this.status() !== 'ready') return null; const i = this.dayIndex(); const d = DAILY[i]; const rw = { ...d.rw };
    if (Econ.isVip()) { if (rw.coins) rw.coins *= 2; if (rw.gems) rw.gems *= 2; }
    S.daily.streak++; S.daily.lastKey = todayKey(); Save.commit(); Rewards.grant(rw, `Day ${i + 1} reward`); Pass.addXp(100); return rw;
  },
};

const WHEEL = [
  { l: '100 🪙', rw: { coins: 100 }, w: 24, c: '#3b82f6' }, { l: '5 💎', rw: { gems: 5 }, w: 18, c: '#a855f7' }, { l: '300 🪙', rw: { coins: 300 }, w: 16, c: '#22c55e' }, { l: '❤️ Life', rw: { lives: 1 }, w: 12, c: '#ef4444' },
  { l: '⏰ Boost', rw: { boost: 'time' }, w: 10, c: '#f59e0b' }, { l: '25 💎', rw: { gems: 25 }, w: 8, c: '#ec4899' }, { l: '🎁 Box', rw: { box: 'silver' }, w: 8, c: '#14b8a6' }, { l: 'JACKPOT', rw: { gems: 100 }, w: 4, c: '#ffd166' },
];
const Wheel = {
  ensure() { const k = todayKey(); if (S.wheel.key !== k) { S.wheel = { key: k, free: true, adSpins: 0 }; Save.commit(); } },
  canFree() { this.ensure(); return S.wheel.free; },
  adSpinsLeft() { this.ensure(); return CFG.adSpinsPerDay - S.wheel.adSpins; },
  roll() { const seg = weighted(WHEEL); return WHEEL.indexOf(seg); },
};

const PASS_FREE = i => [{ coins: 200 }, { gems: 5 }, { coins: 300 }, { boost: 'coin' }, { gems: 10 }, { coins: 500 }, { box: 'silver' }, { gems: 10 }, { coins: 600 }, { boost: 'time' }][i % 10];
const PASS_PREM = i => [{ gems: 30 }, { coins: 1000 }, { box: 'gold' }, { gems: 40 }, { boost: 'rainbow', boostN: 2 }, { shards: 6 }, { gems: 50 }, { box: 'gold' }, { unlimited: 60 }, i >= 29 ? { hero: 'crown' } : i >= 19 ? { hero: 'ninja' } : { box: 'diamond' }][i % 10];
const Pass = {
  season() { return Math.floor((now() - 1700000000000) / (CFG.passSeasonDays * DAY)); },
  seasonEnd() { return 1700000000000 + (this.season() + 1) * CFG.passSeasonDays * DAY; },
  ensure() { const s = this.season(); if (S.pass.season !== s) { S.pass = { season: s, xp: 0, premium: false, claimedFree: [], claimedPrem: [] }; Save.commit(); } },
  tier() { this.ensure(); return Math.min(CFG.passTiers, Math.floor(S.pass.xp / CFG.passXpPerTier)); },
  addXp(n) { this.ensure(); const before = this.tier(); S.pass.xp += Math.round(n * (Econ.isVip() ? 1.25 : 1)); Save.commit(); if (this.tier() > before) { UI.toast(`🎟️ Season Pass tier ${this.tier()} reached!`); UI.badge('pass', this.claimable()); } },
  claimable() { this.ensure(); const t = this.tier(); let n = 0; for (let i = 0; i < t; i++) { if (!S.pass.claimedFree.includes(i)) n++; if (S.pass.premium && !S.pass.claimedPrem.includes(i)) n++; } return n; },
  claim(i, prem, quiet) { if (i >= this.tier()) return false; const arr = prem ? S.pass.claimedPrem : S.pass.claimedFree; if (arr.includes(i)) return false; if (prem && !S.pass.premium) return false; arr.push(i); Save.commit(); Rewards.grant(prem ? PASS_PREM(i) : PASS_FREE(i), quiet ? null : `Tier ${i + 1}`); return true; },
  claimAll() { const t = this.tier(); let n = 0; for (let i = 0; i < t; i++) { if (this.claim(i, false, true)) n++; if (this.claim(i, true, true)) n++; } if (n) UI.toast(`🎟️ Claimed ${n} pass reward${n > 1 ? 's' : ''}`); return n; },
};

const EVENT_MILESTONES = [{ n: 10, rw: { coins: 500 } }, { n: 25, rw: { gems: 20 } }, { n: 50, rw: { box: 'silver' } }, { n: 100, rw: { box: 'gold' } }, { n: 200, rw: { hero: 'dragon' } }];
const Event = {
  ensure() { const w = weekNum(); if (S.event.week !== w) { S.event = { week: w, tokens: 0, claimed: [], double: false }; Save.commit(); } },
  earn(res) { this.ensure(); const t = Math.max(1, Math.floor(res.score / 4000)) + (res.stats.blitzes || 0) * 2; const n = S.event.double ? t * 2 : t; S.event.tokens += n; Save.commit(); return n; },
  claim(i) { this.ensure(); const m = EVENT_MILESTONES[i]; if (!m || S.event.claimed.includes(i) || S.event.tokens < m.n) return false; S.event.claimed.push(i); Save.commit(); Rewards.grant(m.rw, 'Event milestone'); return true; },
  claimable() { this.ensure(); return EVENT_MILESTONES.filter((m, i) => !S.event.claimed.includes(i) && S.event.tokens >= m.n).length; },
};

const Piggy = {
  add(n) { const before = S.piggy.gems; S.piggy.gems = Math.min(CFG.piggyCap, S.piggy.gems + n); Save.commit(); return S.piggy.gems - before; },
  full() { return S.piggy.gems >= CFG.piggyCap; },
  breakIt() { const g = S.piggy.gems; S.piggy.gems = 0; Save.commit(); Econ.addGems(g); return g; },
};

/* ---------------- gacha / boxes ---------------- */
const BOXES = {
  silver:  { name: 'Silver Box', ic: '🎁', gems: 60, coins: 2500, odds: { common: 78, rare: 19, epic: 2.7, legendary: 0.3 }, pulls: 1, bonus: { coins: [100, 300] } },
  gold:    { name: 'Gold Box', ic: '🧰', gems: 150, odds: { common: 55, rare: 35, epic: 8.5, legendary: 1.5 }, pulls: 1, bonus: { coins: [300, 800] }, pop: true },
  diamond: { name: 'Diamond Box', ic: '💠', gems: 650, odds: { common: 0, rare: 62, epic: 32, legendary: 6 }, pulls: 1, bonus: { gems: [10, 40] } },
  gold10:  { name: '10x Gold Box', ic: '🎊', gems: 1350, odds: { common: 55, rare: 35, epic: 8.5, legendary: 1.5 }, pulls: 10, guaranteed: 'epic', bonus: { coins: [3000, 6000] }, best: true },
};
const Gacha = {
  rollRarity(box) {
    S.pity.pulls++; S.pity.epic++; S.pity.legendary++;
    let r = weighted(Object.entries(box.odds).map(([k, w]) => ({ k, w })), 'w').k;
    if (S.pity.legendary >= 90) r = 'legendary'; else if (S.pity.epic >= 20 && r !== 'legendary') r = 'epic';
    if (r === 'legendary') { S.pity.legendary = 0; S.pity.epic = 0; } else if (r === 'epic') S.pity.epic = 0;
    return r;
  },
  pull(boxId) {
    const box = BOXES[boxId], out = [];
    for (let i = 0; i < box.pulls; i++) {
      let rar = this.rollRarity(box);
      if (box.guaranteed && i === box.pulls - 1 && !out.some(x => x.rar === 'epic' || x.rar === 'legendary') && (rar === 'common' || rar === 'rare')) rar = box.guaranteed;
      const pool = HEROES.filter(h => h.rar === rar); const notOwned = pool.filter(h => !S.owned[h.id]);
      const h = (notOwned.length && Math.random() < 0.7) ? pick(notOwned) : pick(pool);
      out.push(this.give(h.id, 1));
    }
    const bonus = {}; if (box.bonus.coins) bonus.coins = randInt(...box.bonus.coins); if (box.bonus.gems) bonus.gems = randInt(...box.bonus.gems);
    Rewards.grant(bonus, null); Pass.addXp(60 * box.pulls); Save.commit(); return { out, bonus };
  },
  give(id, count) {
    const h = HERO[id]; let o = S.owned[id]; let isNew = false, shards = 0, starUp = false;
    if (!o) { o = S.owned[id] = { stars: 1, shards: 0, new: true }; isNew = true; count--; }
    if (count > 0) { shards = count * ({ common: 2, rare: 3, epic: 5, legendary: 10 }[h.rar]); o.shards += shards; }
    Save.commit(); return { id, rar: h.rar, isNew, shards, starUp };
  },
  canStarUp(id) { const o = S.owned[id]; return o && o.stars < 5 && o.shards >= STAR_SHARDS[o.stars] && S.coins >= STAR_COINS[o.stars]; },
  starUp(id) { const o = S.owned[id]; if (!this.canStarUp(id)) return false; Econ.spend('coins', STAR_COINS[o.stars]); o.shards -= STAR_SHARDS[o.stars]; o.stars++; Save.commit(); return true; },
};

/* ---------------- leaderboard (simulated global, deterministic per week) ---------------- */
const BOT_NAMES = ['Zoe', 'Mateo', 'Aiko', 'Liam', 'Priya', 'Noah', 'Sofia', 'Kai', 'Ava', 'Yusuf', 'Mia', 'Leo', 'Nia', 'Omar', 'Ella', 'Ivan', 'Luna', 'Theo', 'Sara', 'Max', 'Isla', 'Finn', 'Aria', 'Hugo', 'Emma', 'Ezra', 'Chloe', 'Arjun', 'Maya', 'Jonas'];
const BOT_AV = ['🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🐧', '🦊', '🐨', '🐰', '🐻', '🦖', '🐵', '🐶', '🐱', '🐝', '🦋', '🦉'];
const Leader = {
  ensure() { const w = weekNum(); if (S.lb.week !== w) { S.lb = { week: w, best: 0, lastReward: S.lb.best > 0 ? S.lb.best : 0 }; Save.commit(); } },
  bots() {
    this.ensure(); const rng = mulberry(weekNum() * 104729 + 7);
    const progress = Math.min(1, (now() - weekNum() * 7 * DAY + 3 * DAY) / (7 * DAY));
    const arr = []; for (let i = 0; i < 49; i++) { const base = 3000 + Math.pow(rng(), 2.2) * 90000; arr.push({ name: BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)] + (rng() < .4 ? Math.floor(rng() * 99) : ''), av: BOT_AV[Math.floor(rng() * BOT_AV.length)], score: Math.round(base * (0.55 + 0.45 * progress) + rng() * 500) }); }
    return arr;
  },
  list() { const me = { name: S.name, av: S.avatar, score: S.lb.best, me: true }; const all = [...this.bots(), me].sort((a, b) => b.score - a.score); return all; },
  rank() { return this.list().findIndex(x => x.me) + 1; },
  submit(score) { this.ensure(); const before = this.rank(); if (score > S.lb.best) { S.lb.best = score; Save.commit(); } return { before, after: this.rank() }; },
  reward(rank) { return rank <= 1 ? { gems: 200, box: 'diamond' } : rank <= 3 ? { gems: 100, box: 'gold' } : rank <= 10 ? { gems: 50 } : rank <= 25 ? { gems: 20 } : { coins: 500 }; },
};

/* ---------------- monetization: IAP simulation, ads, offers ---------------- */
const Ads = {
  ensure() { const k = todayKey(); if (S.ads.key !== k) { S.ads = { ...S.ads, key: k, lives: 0, gems: 0, spins: 0 }; Save.commit(); } },
  left(kind) { this.ensure(); return ({ lives: CFG.adLivesPerDay, gems: CFG.adGemsPerDay, spins: CFG.adSpinsPerDay }[kind] || 99) - (S.ads[kind] || 0); },
  creatives: [
    { e: '🏰', h: 'Kingdom Clash', p: 'Build. Raid. Rule. Play free today!' }, { e: '🧩', h: 'Puzzle Pals', p: 'Over 5,000 levels of cozy puzzles.' }, { e: '🚀', h: 'Star Racers', p: 'Race across the galaxy with friends.' }, { e: '🍰', h: 'Bake Story', p: 'Design the bakery of your dreams.' }, { e: '🐉', h: 'Dragon Merge', p: 'Merge, hatch, evolve legendary dragons!' },
  ],
  // Rewarded video. In production, replace the body of `show` with the ad-network SDK call and resolve on the "rewarded" callback.
  show(kind, seconds = CFG.adSeconds, skippable = false) {
    return new Promise(resolve => {
      if (Econ.noAds() && kind === 'interstitial') return resolve(true);
      const ad = $('#ad'), cnt = $('#ad-cnt'), x = $('#ad-x'), cr = $('#ad-creative'), c = pick(this.creatives);
      cr.innerHTML = `<div class="e emoji">${c.e}</div><h3>${esc(c.h)}</h3><p>${esc(c.p)}</p><button class="btn gold sm">Install (demo)</button>`;
      $('.ad-top span', ad).textContent = kind === 'interstitial' ? 'Sponsored · Interstitial' : 'Sponsored · Rewarded video';
      ad.classList.add('on'); x.classList.add('hidden'); let left = seconds, done = false;
      const end = ok => { if (done) return; done = true; clearInterval(iv); ad.classList.remove('on'); x.onclick = null; if (ok) { S.ads.watched++; Save.commit(); } resolve(ok); };
      cnt.textContent = left; const iv = setInterval(() => { left--; cnt.textContent = left > 0 ? left : '✓'; if (skippable && left <= seconds - CFG.interstitialSkipAfter) { x.classList.remove('hidden'); } if (left <= 0) { if (skippable) end(true); else { x.classList.remove('hidden'); cnt.textContent = 'Reward ready'; } } }, 1000);
      x.onclick = () => end(skippable ? true : left <= 0);
    });
  },
  async rewarded(kind) { const ok = await this.show(kind); if (ok && S.ads[kind] !== undefined) { S.ads[kind]++; Save.commit(); } return ok; },
  maybeInterstitial() {
    if (Econ.noAds()) return Promise.resolve(false); S.gamesSinceAd++;
    if (S.gamesSinceAd >= CFG.interstitialEvery && now() - S.ads.lastInterstitial > CFG.interstitialMinGapMs && S.stats.games >= 3) { S.gamesSinceAd = 0; S.ads.lastInterstitial = now(); Save.commit(); return this.show('interstitial', CFG.interstitialSeconds, true); }
    return Promise.resolve(false);
  },
};

const IAP = {
  // Simulated store. Production: route `buy` through the platform billing SDK (Google Play Billing / StoreKit / Stripe) and call `fulfill` from the verified receipt callback.
  buy(sku, meta = {}) {
    return new Promise(resolve => {
      const def = SKUS[sku] || GEM_PACKS.find(p => p.sku === sku); if (!def) return resolve(false);
      const price = meta.price ?? def.price;
      UI.open('checkout', { title: def.name, ic: def.ic, price, sku, meta, onDone: ok => { if (ok) { this.fulfill(sku, price, meta); } resolve(ok); } });
    });
  },
  fulfill(sku, price, meta) {
    S.iap.spent += price; S.iap.purchases.push({ sku, price, t: now() }); Snd.gem(); haptic([20, 40, 20]);
    const pack = GEM_PACKS.find(p => p.sku === sku);
    if (pack) { let g = pack.gems; if (!S.iap.firstBonusUsed) { g *= 2; S.iap.firstBonusUsed = true; UI.toast('🎉 First purchase bonus: DOUBLE gems!'); } Econ.addGems(g); UI.toast(`💎 +${fmt(g)} gems`); }
    else if (sku === 'starter') { S.iap.starter = true; Rewards.grant({ gems: 300, coins: 3000 }, 'Starter Pack'); Gacha.give(pick(HEROES.filter(h => h.rar === 'epic')).id, 1); UI.queueBoxes(['gold', 'gold']); }
    else if (sku === 'flash') { S.flash.until = 0; Rewards.grant({ gems: 200, coins: 2000, boost: 'time', boostN: 3 }, 'Flash Sale'); }
    else if (sku === 'piggy') { const g = Piggy.breakIt(); UI.toast(`🐷 Piggy broken! +${g} 💎`); UI.confetti(); }
    else if (sku === 'pass') { S.pass.premium = true; UI.toast('🎟️ Premium Pass unlocked!'); UI.confetti(); }
    else if (sku === 'vip') { S.iap.vipUntil = Math.max(now(), S.iap.vipUntil) + 30 * DAY; Econ.refill(); UI.toast('👑 Welcome to VIP Club!'); UI.confetti(); }
    else if (sku === 'noads') { S.iap.noAds = true; UI.toast('🚫 Ads removed. Thank you!'); }
    else if (sku === 'legend') { S.iap.legend = true; Econ.addGems(500); const leg = pick(HEROES.filter(h => h.rar === 'legendary' && !S.owned[h.id])) || pick(HEROES.filter(h => h.rar === 'legendary')); UI.queueBoxes(['gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', { hero: leg.id }]); }
    Save.commit(); Bus.emit('hud'); Bus.emit('purchase', sku);
  },
};

const Offers = {
  starterActive() { if (S.iap.starter) return false; if (!S.iap.starterSeenTs) return false; return now() < S.iap.starterSeenTs + CFG.starterPackHours * 3600000; },
  starterLeft() { return Math.max(0, S.iap.starterSeenTs + CFG.starterPackHours * 3600000 - now()); },
  flashActive() { return S.flash.until > now(); },
  flashLeft() { return Math.max(0, S.flash.until - now()); },
  maybeTriggerFlash() { const g = S.stats.games; if (!this.flashActive() && CFG.flashSaleAfterGames.includes(g) && !S.flash.triggered.includes(g)) { S.flash.triggered.push(g); S.flash.until = now() + CFG.flashSaleMinutes * 60000; Save.commit(); return true; } return false; },
  // Contextual offer selection for post-round upsell: returns a sku or null
  postRound(res) {
    if (S.stats.games === 1 && !S.iap.starter) { if (!S.iap.starterSeenTs) { S.iap.starterSeenTs = now(); Save.commit(); } return 'starter'; }
    if (this.flashActive() && S.stats.games % 2 === 0) return 'flash';
    if (Piggy.full() && S.stats.games % 3 === 0) return 'piggy';
    if (!S.pass.premium && Pass.tier() >= 3 && S.stats.games % 4 === 0) return 'pass';
    if (!Econ.isVip() && S.stats.games % 7 === 0 && S.stats.games > 6) return 'vip';
    if (this.starterActive() && S.stats.games % 3 === 0) return 'starter';
    return null;
  },
};
