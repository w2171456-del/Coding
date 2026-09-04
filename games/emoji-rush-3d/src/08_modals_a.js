/* ---------------- modals (part A: shop, offers, checkout, lives, heroes, boxes) ---------------- */
const MODALS = {
  _mission(m, i, compact) {
    const d = Missions.desc(m), pct = Math.round(m.prog / m.goal * 100);
    const action = m.done && !m.claimed ? `<button class="btn xs green" data-act="claim" data-i="${i}">CLAIM</button>` : m.claimed ? '<span class="tiny muted">✓ claimed</span>' : (!compact && !S.missions.rerollAd ? `<button class="btn xs ghost" data-act="reroll" data-i="${i}">📺 Swap</button>` : '');
    return `<div class="mission ${m.done ? 'done' : ''}"><span class="ic emoji">${d.ic}</span><div class="body"><div class="t">${d.text}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="tiny muted">${fmt(m.prog)} / ${fmt(m.goal)}</div></div><div class="rw">${Rewards.label(d.rw)}${action}</div></div>`;
  },

  shop(m, d, api) {
    const tabs = [['gems', '💎 Gems'], ['coins', '🪙 Coins'], ['boosts', '⚡ Boosts'], ['offers', '🔥 Offers'], ['vip', '👑 VIP']];
    const hot = Offers.starterActive() || Offers.flashActive();
    const tab = d.tab && tabs.some(t => t[0] === d.tab) ? d.tab : (hot ? 'offers' : 'gems');
    let body = '';
    if (tab === 'gems') {
      const first = !S.iap.firstBonusUsed ? '<div class="item hl" style="margin-bottom:10px"><span class="ic emoji">🎉</span><div class="body"><div class="t">First purchase = DOUBLE gems</div><div class="d">One-time welcome bonus on any gem pack</div></div></div>' : '';
      body = `${first}<div class="grid3">${GEM_PACKS.map(p => `<div class="pack ${p.pop || p.best ? 'pop' : ''}">${p.pop ? '<span class="ribbon">Popular</span>' : p.best ? '<span class="ribbon gold">Best value</span>' : ''}<span class="ic emoji">${p.ic}</span><div class="t">${fmt(p.gems)} 💎</div><div class="bonus">${p.bonus ? p.bonus + ' bonus' : '&nbsp;'}</div><button class="btn sm gold" data-act="buy" data-sku="${p.sku}">${money(p.price)}</button></div>`).join('')}</div><div class="odds">Demo store: no real charges are made.</div>`;
    } else if (tab === 'coins') {
      body = `<div class="list">${COIN_PACKS.map(p => `<div class="item"><span class="ic emoji">🪙</span><div class="body"><div class="t">${fmt(p.coins)} coins</div>${p.bonus ? `<div class="d" style="color:var(--green2)">${p.bonus} bonus</div>` : ''}</div><button class="btn sm blue" data-act="coins" data-id="${p.id}"><span class="emoji">💎</span> ${p.gems}</button></div>`).join('')}<div class="item"><span class="ic emoji">📺</span><div class="body"><div class="t">Watch ad: +150 coins</div><div class="d">${Ads.left('gems')} free ads left today</div></div><button class="btn sm green" data-act="adcoins" ${Ads.left('gems') <= 0 ? 'disabled' : ''}>Watch</button></div></div>`;
    } else if (tab === 'boosts') {
      body = `<div class="list">${Object.entries(BOOSTS).map(([k, b]) => `<div class="item"><span class="ic emoji">${b.ic}</span><div class="body"><div class="t">${b.name} <span class="muted small">×${S.boosts[k] || 0}</span></div><div class="d">${b.d}</div></div><button class="btn sm" data-act="boost" data-k="${k}"><span class="emoji">🪙</span> ${b.coins}</button></div>`).join('')}<div class="item hl"><span class="ic emoji">🎒</span><div class="body"><div class="t">Boost Bundle</div><div class="d">3 of every boost</div></div><button class="btn sm blue" data-act="bundle"><span class="emoji">💎</span> 120</button></div></div>`;
    } else if (tab === 'offers') {
      const parts = [];
      if (Offers.starterActive()) parts.push(this._offerCard('starter'));
      if (Offers.flashActive()) parts.push(this._offerCard('flash'));
      if (!S.iap.legend) parts.push(this._offerCard('legend'));
      if (Piggy.full()) parts.push(`<div class="item hl"><span class="ic emoji">🐷</span><div class="body"><div class="t">Piggy bank is FULL</div><div class="d">${S.piggy.gems} 💎 inside</div></div><button class="btn sm gold" data-act="piggy">${money(SKUS.piggy.price)}</button></div>`);
      if (!S.iap.noAds) parts.push(`<div class="item"><span class="ic emoji">🚫</span><div class="body"><div class="t">Remove Ads</div><div class="d">No interstitials, ever. Rewarded ads stay optional.</div></div><button class="btn sm" data-act="buy" data-sku="noads">${money(SKUS.noads.price)}</button></div>`);
      if (!S.pass.premium) parts.push(`<div class="item"><span class="ic emoji">🎟️</span><div class="body"><div class="t">Premium Pass</div><div class="d">Unlock 30 premium tiers incl. 2 heroes</div></div><button class="btn sm purple" data-act="buy" data-sku="pass">${money(SKUS.pass.price)}</button></div>`);
      body = `<div class="list">${parts.join('')}</div>`;
    } else if (tab === 'vip') {
      const cta = Econ.isVip() ? `<div class="center-note">Active · ${fmtDur(S.iap.vipUntil - now())} remaining</div><button class="btn block gold" data-act="buy" data-sku="vip" style="margin-top:8px">Extend 30 days · ${money(SKUS.vip.price)}</button>` : `<button class="btn block gold" data-act="buy" data-sku="vip">Join · ${money(SKUS.vip.price)} / 30 days</button>`;
      body = `<div class="card vip"><h3 style="text-align:center;font-size:22px;margin-bottom:8px">👑 VIP Club</h3><ul><li>6 lives instead of 5 · instant refill on join</li><li>+50% coins from every round</li><li>Double daily rewards, +50% mission rewards</li><li>+25% Season Pass XP</li><li>No interstitial ads</li></ul><div class="divider"></div>${cta}</div>`;
    }
    m.innerHTML = `<h2>Shop</h2><div class="row center" style="gap:6px;margin-bottom:10px"><span class="pill coins"><span class="emoji">🪙</span>${fmt(S.coins)}</span><span class="pill gems"><span class="emoji">💎</span>${fmt(S.gems)}</span></div><div class="tabs">${tabs.map(t => `<button class="${t[0] === tab ? 'on' : ''}" data-act="tab" data-tab="${t[0]}">${t[1]}${t[0] === 'offers' && hot ? '<span class="badge"></span>' : ''}</button>`).join('')}</div>${body}`;
    api.acts.tab = b => { d.tab = b.dataset.tab; api.rerender(); };
    api.acts.buy = async b => { await IAP.buy(b.dataset.sku); api.rerender(); };
    api.acts.coins = b => { const p = COIN_PACKS.find(x => x.id === b.dataset.id); if (!Econ.spend('gems', p.gems)) { d.tab = 'gems'; UI.toast('Not enough gems'); return api.rerender(); } Econ.addCoins(p.coins); UI.toast(`🪙 +${fmt(p.coins)} coins`); api.rerender(); };
    api.acts.adcoins = async () => { if (await Ads.rewarded('gems')) { Econ.addCoins(150); UI.toast('🪙 +150 coins'); } api.rerender(); };
    api.acts.boost = b => { const k = b.dataset.k; if (!Econ.spend('coins', BOOSTS[k].coins)) { UI.toast('Not enough coins'); d.tab = 'coins'; return api.rerender(); } S.boosts[k] = (S.boosts[k] || 0) + 1; Save.commit(); UI.toast(`${BOOSTS[k].ic} ${BOOSTS[k].name} +1`); api.rerender(); };
    api.acts.bundle = () => { if (!Econ.spend('gems', 120)) { d.tab = 'gems'; UI.toast('Not enough gems'); return api.rerender(); } for (const k in BOOSTS) S.boosts[k] = (S.boosts[k] || 0) + 3; Save.commit(); UI.toast('🎒 +3 of every boost'); api.rerender(); };
    api.acts.piggy = async () => { await IAP.buy('piggy'); api.rerender(); };
  },
  _offerCard(sku) {
    const o = SKUS[sku], pct = o.was ? Math.round((1 - o.price / o.was) * 100) : 0;
    const until = sku === 'starter' ? S.iap.starterSeenTs + CFG.starterPackHours * 3600000 : sku === 'flash' ? S.flash.until : 0;
    return `<div class="card offer">${pct ? `<span class="pct">-${pct}%</span>` : ''}<div class="big emoji">${o.ic}</div><h3 style="text-align:center;margin:6px 0">${o.name}</h3><div class="items">${o.items.map(i => `<span>${i}</span>`).join('')}</div><div class="row center" style="gap:10px;margin:10px 0 6px">${o.was ? `<span class="was">${money(o.was)}</span>` : ''}<span class="now">${money(o.price)}</span></div>${until ? `<div class="center-note">Ends in ${UI.timerHtml(until)}</div>` : ''}<button class="btn block gold" data-act="buy" data-sku="${sku}" style="margin-top:8px">BUY NOW</button></div>`;
  },

  offer(m, d, api) {
    const sku = d.sku, o = SKUS[sku];
    if (sku === 'piggy') {
      m.innerHTML = `<h2 class="gradient">Piggy is FULL!</h2><div class="piggy"><div class="pg emoji full">🐷</div><div class="amt">${S.piggy.gems} 💎</div><p class="small muted">You filled the piggy bank by playing. Break it to collect every gem inside!</p><button class="btn block gold" data-act="buy">BREAK IT · ${money(o.price)}</button><button class="link" data-act="skip">Keep saving</button></div>`;
    } else if (sku === 'pass') {
      m.innerHTML = `<h2 class="gradient">You're Tier ${Pass.tier()}!</h2><p class="sub">Premium rewards are piling up unclaimed</p><div class="card vip" style="text-align:center"><div style="font-size:60px" class="emoji">🎟️</div><ul><li>${Pass.tier()} premium rewards ready right now</li><li>Exclusive heroes 🥷 Shadow and 👑 Majesty</li><li>1 hour unlimited lives at tier 9</li></ul><div class="divider"></div><button class="btn block gold" data-act="buy">UNLOCK · ${money(o.price)}</button></div><button class="link" data-act="skip">No thanks</button>`;
    } else if (sku === 'vip') {
      m.innerHTML = `<h2 class="gradient">Join VIP Club</h2><div class="card vip"><div style="font-size:60px;text-align:center" class="emoji">👑</div><ul><li>6 lives, refilled instantly</li><li>+50% coins every round</li><li>No interstitial ads</li><li>Double daily rewards</li></ul><div class="divider"></div><button class="btn block gold" data-act="buy">${money(o.price)} / 30 days</button></div><button class="link" data-act="skip">Maybe later</button>`;
    } else {
      const pct = Math.round((1 - o.price / o.was) * 100), until = sku === 'starter' ? S.iap.starterSeenTs + CFG.starterPackHours * 3600000 : S.flash.until;
      m.innerHTML = `<div class="card offer" style="border:0;background:transparent"><span class="pct">-${pct}%</span><h2 class="gradient">${sku === 'starter' ? 'Welcome Offer' : 'Flash Sale'}</h2><div class="big emoji" style="font-size:90px;line-height:1.25">${o.ic}</div><p class="sub">${sku === 'starter' ? 'One-time deal for new players only' : 'Limited time — 15 minutes only'}</p><div class="items">${o.items.map(i => `<span>${i}</span>`).join('')}</div><div class="row center" style="gap:10px;margin:14px 0 6px"><span class="was">${money(o.was)}</span><span class="now">${money(o.price)}</span></div><div class="center-note">Offer ends in ${UI.timerHtml(until, 'time', 'offer')}</div><button class="btn block gold" data-act="buy" style="margin-top:12px;font-size:18px">CLAIM NOW</button></div><button class="link" data-act="skip">No thanks</button>`;
    }
    api.acts.buy = async () => { UI.setResult('offer', 'buy'); UI.close('offer'); await IAP.buy(sku); };
    api.acts.skip = () => UI.close('offer');
  },

  checkout(m, d, api) {
    m.innerHTML = `<h2>Checkout</h2><div class="checkout"><div style="font-size:64px" class="emoji">${d.ic}</div><div class="bold" style="font-size:18px">${esc(d.title)}</div><div class="sheet"><div class="r"><span>${esc(d.title)}</span><span>${money(d.price)}</span></div><div class="r"><span>Tax</span><span>$0.00</span></div><div class="r"><span>Total</span><span>${money(d.price)}</span></div></div><button class="btn block green" data-act="pay">Confirm purchase</button><button class="link" data-act="cancel">Cancel</button><div class="demo">Demo checkout: nothing is charged. Production builds route this through the platform store.</div></div>`;
    api.acts.pay = async b => { b.disabled = true; b.textContent = 'Processing…'; await sleep(900); UI.close('checkout'); d.onDone(true); };
    api.acts.cancel = () => { UI.close('checkout'); d.onDone(false); };
  },

  lives(m, d, api) {
    const unl = Econ.unlimited(), full = S.lives >= Econ.livesMax();
    const hearts = unl ? '♾️' : '❤️'.repeat(S.lives) + '🖤'.repeat(Math.max(0, Econ.livesMax() - S.lives));
    const status = unl ? 'Unlimited for ' + UI.timerHtml(S.unlimitedUntil) : full ? 'Lives are full' : 'Next life in ' + UI.timerHtml(S.lifeTs || now());
    m.innerHTML = `<h2>${S.lives <= 0 && !unl ? 'Out of Lives!' : 'Lives'}</h2><div class="center col" style="margin-bottom:12px"><div style="font-size:40px" class="emoji">${hearts}</div><div class="muted small">${status}</div></div><div class="lives-opt">
      <div class="item hl"><span class="ic emoji">📺</span><div class="body"><div class="t">Watch ad → +1 life</div><div class="d">${Ads.left('lives')} free lives left today</div></div><button class="btn sm green" data-act="ad" ${Ads.left('lives') <= 0 || full || unl ? 'disabled' : ''}>Watch</button></div>
      <div class="item"><span class="ic emoji">❤️</span><div class="body"><div class="t">Refill all lives</div><div class="d">Instant full refill</div></div><button class="btn sm blue" data-act="refill" ${full || unl ? 'disabled' : ''}><span class="emoji">💎</span> 30</button></div>
      <div class="item"><span class="ic emoji">♾️</span><div class="body"><div class="t">Unlimited lives · 1 hour</div><div class="d">Play as much as you want</div></div><button class="btn sm purple" data-act="unl"><span class="emoji">💎</span> 90</button></div>
      <div class="item"><span class="ic emoji">👑</span><div class="body"><div class="t">VIP Club</div><div class="d">6 lives, +50% coins, no ads</div></div><button class="btn sm gold" data-act="vip">${money(SKUS.vip.price)}</button></div>
      <div class="item"><span class="ic emoji">🔗</span><div class="body"><div class="t">Share for a life</div><div class="d">Once per refill cycle</div></div><button class="btn sm ghost" data-act="share" ${full || unl ? 'disabled' : ''}>Share</button></div></div>`;
    api.acts.ad = async () => { if (await Ads.rewarded('lives')) { Econ.addLives(1); UI.toast('❤️ +1 life'); } api.rerender(); };
    api.acts.refill = () => { if (!Econ.spend('gems', 30)) return UI.open('shop', { tab: 'gems' }); Econ.refill(); UI.toast('❤️ Lives refilled'); api.rerender(); };
    api.acts.unl = () => { if (!Econ.spend('gems', 90)) return UI.open('shop', { tab: 'gems' }); Rewards.grant({ unlimited: 60 }, null); UI.toast('♾️ Unlimited lives for 1 hour'); api.rerender(); };
    api.acts.vip = async () => { await IAP.buy('vip'); api.rerender(); };
    api.acts.share = async () => {
      const text = `I scored ${fmt(S.stats.best)} in Emoji Rush 3D! Can you beat me?`;
      try { if (navigator.share) await navigator.share({ title: 'Emoji Rush 3D', text, url: location.href }); else if (navigator.clipboard) await navigator.clipboard.writeText(text + ' ' + location.href); else return; } catch (e) { return; }
      Econ.addLives(1); UI.toast('❤️ +1 life for sharing'); api.rerender();
    };
  },

  heroes(m, d, api) {
    const sel = d.sel || S.equipped, h = HERO[sel], o = S.owned[sel], lv = o ? o.stars : 0;
    const groups = ['legendary', 'epic', 'rare', 'common'];
    const shardBar = o ? (o.stars < 5 ? `<div class="bar gold lg" style="width:100%"><i style="width:${Math.min(100, o.shards / STAR_SHARDS[o.stars] * 100)}%"></i><span class="lbl">${o.shards}/${STAR_SHARDS[o.stars]} shards</span></div>` : '<div class="small" style="color:var(--gold)">MAX STARS</div>') : '';
    const actions = (o ? `<button class="btn sm green" data-act="equip" ${S.equipped === sel ? 'disabled' : ''}>${S.equipped === sel ? 'Equipped' : 'Equip'}</button>` : '<button class="btn sm purple" data-act="boxes">Get from Boxes</button>') + (o && o.stars < 5 ? `<button class="btn sm gold" data-act="star" ${Gacha.canStarUp(sel) ? '' : 'disabled'}>Star up <span class="price"><span class="emoji">🪙</span>${fmt(STAR_COINS[o.stars])}</span></button>` : '');
    m.innerHTML = `<h2>Heroes <span class="muted small">${Object.keys(S.owned).length}/${HEROES.length}</span></h2>
      <div class="hero-detail rar-${h.rar}"><div class="big emoji">${h.e}</div><div class="row center"><b style="font-size:20px">${h.name}</b><span class="rtag">${RAR[h.rar].n}</span></div><div style="color:var(--gold)">${o ? '★'.repeat(o.stars) + '☆'.repeat(5 - o.stars) : '🔒 Not owned'}</div>
      <div class="pw"><b>${POWERS[h.power].ic} ${POWERS[h.power].name}</b> — ${POWERS[h.power].d(Math.max(1, lv))}<br><span class="muted">Score bonus +${h.bonus * Math.max(1, lv)}% · charges on ${h.e} matches</span></div>${shardBar}<div class="row center wrap">${actions}</div></div>
      <div class="divider"></div>${groups.map(g => `<div class="small muted bold" style="margin:6px 0 4px;text-transform:uppercase">${RAR[g].n}</div><div class="hero-grid rar-${g}">${HEROES.filter(x => x.rar === g).map(x => UI.heroCard(x, S.owned[x.id], x.id === sel ? 'sel' : '')).join('')}</div>`).join('')}`;
    if (o && o.new) { o.new = false; Save.commit(); }
    api.acts.hero = b => { d.sel = b.dataset.id; Snd.click(); api.rerender(); };
    api.acts.equip = () => { S.equipped = sel; Save.commit(); UI.toast(`${h.e} ${h.name} equipped`); api.rerender(); Home.render(); };
    api.acts.star = () => { if (Gacha.starUp(sel)) { Snd.levelup(); UI.confetti(40); UI.toast(`⭐ ${h.name} is now ${S.owned[sel].stars}★!`); api.rerender(); Home.render(); } };
    api.acts.boxes = () => { UI.close('heroes'); UI.open('boxes'); };
  },

  boxes(m, d, api) {
    const cards = Object.entries(BOXES).map(([k, b]) => `<div class="pack ${b.pop || b.best ? 'pop' : ''}">${b.pop ? '<span class="ribbon">Popular</span>' : b.best ? '<span class="ribbon gold">Epic guaranteed</span>' : ''}<span class="ic emoji">${b.ic}</span><div class="t">${b.name}</div><div class="tiny muted">${b.pulls} hero${b.pulls > 1 ? 'es' : ''} + bonus</div><div class="tiny" style="color:var(--gold)">Legendary ${b.odds.legendary}% · Epic ${b.odds.epic}%</div><button class="btn sm purple" data-act="open" data-box="${k}"><span class="emoji">💎</span> ${fmt(b.gems)}</button>${k === 'silver' ? `<button class="btn xs" data-act="coins" style="margin-top:4px"><span class="emoji">🪙</span> ${fmt(b.coins)}</button>` : ''}</div>`).join('');
    m.innerHTML = `<h2>Hero Boxes</h2><div class="row center" style="gap:6px;margin-bottom:10px"><span class="pill gems"><span class="emoji">💎</span>${fmt(S.gems)}</span><button class="btn xs gold" data-open="shop:gems">+ Gems</button></div><div class="grid2">${cards}</div>
      <div class="odds">Pity: Epic guaranteed within <b>${Math.max(0, 20 - S.pity.epic)}</b> pulls · Legendary within <b>${Math.max(0, 90 - S.pity.legendary)}</b>. Duplicates convert to star shards.</div>
      ${!S.iap.legend ? this._offerCard('legend').replace('data-act="buy"', 'data-act="legend"') : ''}`;
    api.acts.open = b => { const k = b.dataset.box; if (!Econ.spend('gems', BOXES[k].gems)) { UI.toast('Not enough gems'); return UI.open('shop', { tab: 'gems' }); } UI.close('boxes'); UI.open('boxopen', { box: k, back: true }); };
    api.acts.coins = () => { if (!Econ.spend('coins', BOXES.silver.coins)) { UI.toast('Not enough coins'); return; } UI.close('boxes'); UI.open('boxopen', { box: 'silver', back: true }); };
    api.acts.legend = async () => { await IAP.buy('legend'); api.rerender(); };
  },

  boxopen(m, d, api) {
    const boxId = d.box || 'gold', box = BOXES[boxId], ORDER = ['common', 'rare', 'epic', 'legendary'];
    if (d.hero) {
      const h = HERO[d.hero], r = Gacha.give(d.hero, 1);
      m.innerHTML = `<h2 class="gradient">LEGENDARY!</h2><div class="box-scene"><div class="reveal rar-${h.rar} legendary"><span class="e emoji">${h.e}</span><span class="n">${h.name}</span><span class="tag">${r.isNew ? 'NEW HERO' : '+' + r.shards + ' shards'}</span></div><button class="btn block gold" data-act="done">Awesome!</button></div>`;
      Snd.reveal('legendary'); UI.confetti(140); api.acts.done = () => UI.close('boxopen'); return;
    }
    m.innerHTML = `<h2>${box.name}</h2><div class="box-scene"><div class="box-art emoji" id="box-art">${box.ic}</div><div class="muted small">Tap to open</div><button class="btn block gold" data-act="tap">OPEN</button></div>`;
    api.acts.tap = async b => {
      b.disabled = true; const art = $('#box-art', m); art.classList.add('shake'); Snd.whoosh(); haptic([20, 30, 20, 30, 60]); await sleep(900); art.classList.remove('shake');
      const { out, bonus } = Gacha.pull(boxId); const best = out.reduce((a, x) => ORDER.indexOf(x.rar) > ORDER.indexOf(a.rar) ? x : a, out[0]);
      const scene = $('.box-scene', m), again = `<button class="btn sm ghost" data-act="again">Again <span class="price"><span class="emoji">💎</span>${fmt(box.gems)}</span></button><button class="btn sm green" data-act="done">Collect</button>`;
      if (out.length === 1) { const h = HERO[out[0].id]; scene.innerHTML = `<div class="reveal rar-${h.rar} ${h.rar}"><span class="e emoji">${h.e}</span><span class="n">${h.name}</span><span class="rtag">${RAR[h.rar].n}</span><span class="tag">${out[0].isNew ? '✨ NEW HERO' : '+' + out[0].shards + ' star shards'}</span></div><div class="small muted">Bonus: ${Rewards.label(bonus)}</div><div class="row center wrap">${again}</div>`; }
      else { scene.innerHTML = `<div class="multi">${out.map((x, i) => `<div class="mc rar-${HERO[x.id].rar}" style="animation-delay:${i * 90}ms"><span class="emoji">${HERO[x.id].e}</span><small>${x.isNew ? 'NEW' : '+' + x.shards + '⭐'}</small></div>`).join('')}</div><div class="small" style="color:var(--gold)">Best: ${HERO[best.id].e} ${HERO[best.id].name} (${RAR[best.rar].n})</div><div class="small muted">Bonus: ${Rewards.label(bonus)}</div><div class="row center wrap">${again}</div>`; }
      Snd.reveal(best.rar); if (best.rar === 'legendary') UI.confetti(140); else if (best.rar === 'epic') UI.confetti(60); haptic(best.rar === 'legendary' ? [50, 50, 50, 50, 200] : 30);
      api.acts.again = () => { if (!Econ.spend('gems', box.gems)) { UI.toast('Not enough gems'); UI.close('boxopen'); return UI.open('shop', { tab: 'gems' }); } api.rerender(); };
      api.acts.done = () => { UI.close('boxopen'); if (d.back) UI.open('boxes'); };
    };
  },
};
