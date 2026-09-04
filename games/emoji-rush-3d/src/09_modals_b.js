/* ---------------- modals (part B: quests, daily, wheel, piggy, pass, event, ranks, settings, pause, continue, results, levelup) ---------------- */
Object.assign(MODALS, {
  missions(m, d, api) {
    Missions.ensure(); const reset = dayNum() * DAY + DAY;
    m.innerHTML = `<h2>Daily Quests</h2><p class="sub">Resets in ${UI.timerHtml(reset)} · clear all for a 🎁 Gold Box</p><div class="list">${S.missions.list.map((x, i) => this._mission(x, i, false)).join('')}</div>`;
    api.acts.claim = b => { const rw = Missions.claim(+b.dataset.i); if (rw) { Snd.coin(); UI.confetti(30); } api.rerender(); Home.render(); };
    api.acts.reroll = async b => { if (await Ads.rewarded('reroll')) { Missions.reroll(+b.dataset.i); S.missions.rerollAd = true; Save.commit(); } api.rerender(); };
  },

  daily(m, d, api) {
    const st = Daily.status(), idx = Daily.dayIndex();
    // claimed cells: everything before the next day to claim; if today was claimed, the streak already advanced
    const claimedUpTo = st === 'ready' ? idx : (S.daily.streak % 7 === 0 ? 7 : S.daily.streak % 7);
    const days = DAILY.map((x, i) => `<div class="day ${i === 6 ? 'big' : ''} ${i < claimedUpTo ? 'claimed' : ''} ${st === 'ready' && i === idx ? 'today' : ''}"><div class="tiny muted">Day ${i + 1}</div><span class="e emoji">${x.e}</span><span class="r">${Rewards.label(x.rw)}</span></div>`).join('');
    const cta = st === 'ready' ? `<button class="btn block green" data-act="claim">CLAIM DAY ${idx + 1}</button>` : `<button class="btn block ghost" disabled>Claimed · next in ${UI.timerHtml(dayNum() * DAY + DAY)}</button>`;
    m.innerHTML = `<h2>Daily Rewards</h2><p class="sub">Streak: <b style="color:var(--gold)">${S.daily.streak} day${S.daily.streak === 1 ? '' : 's'}</b> · come back tomorrow to keep it</p><div class="calendar">${days}</div><div style="margin-top:12px">${cta}<div class="center-note" style="margin-top:6px">${Econ.isVip() ? '👑 VIP: rewards doubled' : '👑 VIP members get double daily rewards'}</div></div>`;
    api.acts.claim = () => { const rw = Daily.claim(); if (rw) { Snd.fanfare(); UI.confetti(60); } api.rerender(); Home.render(); };
  },

  wheel(m, d, api) {
    const free = Wheel.canFree(), ads = Wheel.adSpinsLeft();
    const grad = WHEEL.map((s, i) => `${s.c} ${i * 45}deg ${(i + 1) * 45}deg`).join(',');
    const labels = WHEEL.map((s, i) => `<div class="seg" style="transform:rotate(${i * 45 + 22.5}deg)"><span>${s.l}</span></div>`).join('');
    const primary = free ? '<button class="btn block gold" data-act="spin" data-mode="free">FREE SPIN</button>' : `<button class="btn block green" data-act="spin" data-mode="ad" ${ads <= 0 ? 'disabled' : ''}>📺 Watch ad to spin (${ads} left)</button>`;
    m.innerHTML = `<h2>Lucky Spin</h2><div class="wheel-wrap"><div class="wheel-ptr"></div><div class="wheel" id="wheel" style="background:conic-gradient(${grad})">${labels}</div><div class="wheel-hub emoji">🎰</div></div><div class="col center">${primary}<button class="btn block purple" data-act="spin" data-mode="gems"><span class="emoji">💎</span> 20 · Spin</button></div>`;
    api.acts.spin = async b => {
      const mode = b.dataset.mode; $$('button', m).forEach(x => x.disabled = true);
      if (mode === 'free') S.wheel.free = false;
      else if (mode === 'ad') { if (!await Ads.rewarded('spins')) return api.rerender(); S.wheel.adSpins++; }
      else if (!Econ.spend('gems', 20)) { UI.toast('Not enough gems'); return api.rerender(); }
      Save.commit();
      const idx = Wheel.roll(), w = $('#wheel', m), target = 360 * 5 - (idx * 45 + 22.5) + (Math.random() - .5) * 30;
      Snd.whoosh(); w.style.transform = `rotate(${target}deg)`; let ticks = 0; const iv = setInterval(() => { Snd.tick(); if (++ticks > 30) clearInterval(iv); }, 120);
      await sleep(4300); clearInterval(iv); const seg = WHEEL[idx]; Rewards.grant(seg.rw, 'Spin'); Snd.fanfare(); UI.confetti(idx === 7 ? 120 : 30); haptic([30, 50, 30]);
      api.rerender(); Home.render();
    };
  },

  piggy(m, d, api) {
    const full = Piggy.full(), pct = Math.round(S.piggy.gems / CFG.piggyCap * 100);
    const cta = full ? `<button class="btn block gold" data-act="buy">BREAK · ${money(SKUS.piggy.price)}</button>` : `<button class="btn block ghost" disabled>Fill it to ${CFG.piggyCap} to break</button>`;
    const early = S.piggy.gems >= 100 && !full ? `<button class="link" data-act="early">Break early for ${money(SKUS.piggy.price + 200)}</button>` : '';
    m.innerHTML = `<h2>Piggy Bank</h2><div class="piggy"><div class="pg emoji ${full ? 'full' : ''}" style="transform:scale(${0.8 + pct / 500})">🐷</div><div class="amt">${S.piggy.gems} / ${CFG.piggyCap} 💎</div><div class="bar blue lg" style="width:100%"><i style="width:${pct}%"></i></div><p class="small muted">Every round you play drops gems into the piggy. When it's full, break it to collect them all.</p>${cta}<div class="center-note">${early}</div></div>`;
    api.acts.buy = async () => { await IAP.buy('piggy'); api.rerender(); Home.render(); };
    api.acts.early = async () => { await IAP.buy('piggy', { price: SKUS.piggy.price + 200 }); api.rerender(); Home.render(); };
  },

  pass(m, d, api) {
    Pass.ensure(); const t = Pass.tier(), prem = S.pass.premium;
    const rows = Array.from({ length: CFG.passTiers }, (_, i) => {
      const f = PASS_FREE(i), p = PASS_PREM(i), unlocked = i < t, fc = S.pass.claimedFree.includes(i), pc = S.pass.claimedPrem.includes(i);
      return `<div class="tier"><span class="n ${i === t ? 'cur' : ''}">${i + 1}</span><div class="rw ${fc ? 'claimed' : unlocked ? 'avail' : 'lock'}" ${unlocked && !fc ? `data-act="claim" data-i="${i}" data-p="0"` : ''}>${Rewards.label(f)}</div><div class="rw prem ${pc ? 'claimed' : unlocked && prem ? 'avail' : 'lock'}" ${unlocked && prem && !pc ? `data-act="claim" data-i="${i}" data-p="1"` : ''}>${Rewards.label(p)}</div></div>`;
    }).join('');
    const upsell = !prem ? `<div class="card vip" style="margin-bottom:10px;text-align:center"><b>👑 Premium track</b><div class="small muted" style="margin:4px 0 8px">Unlock all ${CFG.passTiers} premium rewards incl. 🥷 Shadow & 👑 Majesty</div><button class="btn block gold" data-act="buy">Unlock · ${money(SKUS.pass.price)}</button></div>` : '';
    m.innerHTML = `<h2>Season Pass</h2><p class="sub">Season ends in ${UI.timerHtml(Pass.seasonEnd(), 'dur')} · Tier ${t}/${CFG.passTiers}</p><div class="bar gold lg" style="margin-bottom:10px"><i style="width:${Math.round((S.pass.xp % CFG.passXpPerTier) / CFG.passXpPerTier * 100)}%"></i><span class="lbl">${S.pass.xp % CFG.passXpPerTier} / ${CFG.passXpPerTier} XP to next tier</span></div>${upsell}${Pass.claimable() ? `<button class="btn block green" data-act="claimall" style="margin-bottom:10px">Claim all (${Pass.claimable()})</button>` : ''}<div class="tier"><span class="n">Tier</span><span class="n">FREE</span><span class="n" style="color:var(--gold)">PREMIUM</span></div><div class="pass-track">${rows}</div>`;
    api.acts.buy = async () => { await IAP.buy('pass'); api.rerender(); };
    api.acts.claim = b => { if (Pass.claim(+b.dataset.i, b.dataset.p === '1')) { Snd.coin(); api.rerender(); } };
    api.acts.claimall = () => { Pass.claimAll(); Snd.fanfare(); UI.confetti(40); api.rerender(); };
  },

  event(m, d, api) {
    Event.ensure();
    const track = EVENT_MILESTONES.map((x, i) => { const got = S.event.claimed.includes(i), avail = !got && S.event.tokens >= x.n; return `<div class="m ${got ? 'got' : avail ? 'avail' : ''}" ${avail ? `data-act="claim" data-i="${i}"` : ''}><b>${x.n}</b>${Rewards.label(x.rw)}</div>`; }).join('');
    m.innerHTML = `<h2>Blitz Storm Event</h2><div class="card eventcard"><div class="row"><span class="e emoji">🌪️</span><div><b>Weekly event</b><div class="small">Earn storm tokens every round (1 per 4,000 pts, +2 per Blitz). Ends in ${UI.timerHtml(weekEnd(), 'dur')}</div></div></div><div style="font-size:28px;font-weight:700;margin:8px 0" class="tabular">🌪️ ${S.event.tokens} tokens</div><div class="token-track">${track}</div></div>
      <div class="item hl" style="margin-top:10px"><span class="ic emoji">⚡</span><div class="body"><div class="t">Double tokens all week</div><div class="d">Reach the 🐉 Ancient dragon twice as fast</div></div>${S.event.double ? '<span class="small" style="color:var(--green2)">Active</span>' : '<button class="btn sm gold" data-act="double"><span class="emoji">💎</span> 150</button>'}</div>`;
    api.acts.claim = b => { if (Event.claim(+b.dataset.i)) { Snd.fanfare(); UI.confetti(50); api.rerender(); } };
    api.acts.double = () => { if (!Econ.spend('gems', 150)) return UI.open('shop', { tab: 'gems' }); S.event.double = true; Save.commit(); UI.toast('⚡ Double tokens active'); api.rerender(); };
  },

  leaderboard(m, d, api) {
    const list = Leader.list(), meI = list.findIndex(x => x.me), rw = Leader.reward(meI + 1);
    const rows = list.slice(0, 20).map((x, i) => `<div class="lb-row ${x.me ? 'me' : ''}"><span class="rk ${i < 3 ? 'top' : ''}">${['🥇', '🥈', '🥉'][i] || '#' + (i + 1)}</span><span class="av emoji">${x.av}</span><span class="nm">${esc(x.name)}${x.me ? ' (you)' : ''}</span><span class="sc">${fmt(x.score)}</span></div>`).join('');
    const me = meI >= 20 ? `<div class="center-note">…</div><div class="lb-row me"><span class="rk">#${meI + 1}</span><span class="av emoji">${S.avatar}</span><span class="nm">${esc(S.name)} (you)</span><span class="sc">${fmt(S.lb.best)}</span></div>` : '';
    m.innerHTML = `<h2>Weekly Ranks</h2><p class="sub">Resets in ${UI.timerHtml(weekEnd(), 'dur')} · Your rank: <b style="color:var(--gold)">#${meI + 1}</b> · Reward: ${Rewards.label(rw)}</p><div class="list" style="gap:4px">${rows}${me}</div><div class="center-note" style="margin-top:8px">Simulated league. Beat your weekly best to climb.</div>`;
  },

  settings(m, d, api) {
    const sw = (label, key) => `<div class="setting"><span>${label}</span><button class="switch ${S.settings[key] ? 'on' : ''}" data-act="sw" data-k="${key}"></button></div>`;
    const renderer = GFX === G3D ? 'WebGL 3D' + (G3D.lowfx ? ' (lite)' : '') : 'Canvas 2D';
    m.innerHTML = `<h2>Settings</h2><div class="list">${sw('Sound effects', 'sfx')}${sw('Music', 'music')}${sw('Haptics', 'haptics')}${sw('Reduce motion', 'reduceMotion')}
      <div class="setting"><span>Graphics</span><div class="seg">${['auto', 'low', 'high'].map(q => `<button class="${S.settings.quality === q ? 'on' : ''}" data-act="q" data-q="${q}">${q}</button>`).join('')}</div></div>
      <div class="setting"><span>Name</span><button class="btn xs ghost" data-act="name">${esc(S.name)} ✎</button></div>
      <div class="setting"><span>Renderer</span><span class="muted small">${renderer}</span></div>
      <div class="stat-grid"><div>Rounds<b>${S.stats.games}</b></div><div>Best<b>${fmt(S.stats.best)}</b></div><div>Emoji cleared<b>${fmt(S.stats.tiles)}</b></div><div>Play time<b>${fmtDur(S.stats.playMs)}</b></div></div>
      <div class="center-note">Emoji Rush 3D v${CFG.version} · progress saves locally in this browser</div><button class="link" data-act="reset">Reset all progress</button></div>`;
    api.acts.sw = b => { const k = b.dataset.k; S.settings[k] = !S.settings[k]; Save.commit(); Snd.init(); Snd.apply(); document.body.classList.toggle('reduce-motion', S.settings.reduceMotion); api.rerender(); };
    api.acts.q = b => { const q = b.dataset.q; S.settings.quality = q; Save.commit(); GFX.setDprCap(q === 'high' ? 2.5 : q === 'low' ? 1.25 : IS_MOBILE ? 1.75 : 2); document.body.classList.toggle('lowfx', q === 'low'); api.rerender(); };
    api.acts.name = () => { const n = prompt('Your name', S.name); if (n && n.trim()) { S.name = n.trim().slice(0, 14); Save.commit(); api.rerender(); } };
    api.acts.reset = () => { if (confirm('Reset ALL progress? This cannot be undone.')) Save.reset(); };
  },

  pause(m, d, api) {
    m.innerHTML = `<h2>Paused</h2><div class="pause-grid"><div class="stat-grid"><div>Score<b>${fmt(Game.score)}</b></div><div>Time<b>${Math.ceil(Game.time)}s</b></div></div><button class="btn block green" data-act="resume">Resume</button><button class="btn block ghost" data-act="settings">Settings</button><button class="btn block ghost" data-act="quit">Quit round</button><div class="center-note">Quitting keeps your score but the life is spent.</div></div>`;
    api.acts.resume = () => UI.close('pause');
    api.acts.settings = () => UI.open('settings');
    api.acts.quit = () => { UI.close('pause'); Game.paused = true; Game.finish(true); };
  },

  continue(m, d, api) {
    const cost = CFG.continueGemCosts[Game.continues], adOk = !Game.adContinueUsed;
    const hook = d.res.score > S.stats.best ? ' · NEW BEST so far!' : S.stats.best - d.res.score < 3000 ? ` · only ${fmt(S.stats.best - d.res.score)} from your best!` : '';
    m.innerHTML = `<h2 class="gradient">Keep going?</h2><p class="sub">Score ${fmt(d.res.score)}${hook}</p><div class="col"><div class="row center" style="font-size:40px;gap:4px"><span class="emoji">⏱️</span><span class="countdown" id="cont-cd">9</span></div>${adOk ? '<button class="btn block green" data-act="ad">📺 Watch ad · +10 seconds</button>' : ''}<button class="btn block purple" data-act="gems"><span class="emoji">💎</span> ${cost} · +15 seconds</button><button class="link" data-act="no">End round</button></div>`;
    let left = 9; const iv = setInterval(() => { left--; const c = $('#cont-cd', m); if (c) c.textContent = left; if (left <= 0) { clearInterval(iv); UI.setResult('continue', 'no'); UI.close('continue'); } }, 1000);
    const pickChoice = v => { clearInterval(iv); UI.setResult('continue', v); UI.close('continue'); };
    api.acts.ad = () => pickChoice('ad');
    api.acts.gems = () => { if (!Econ.spend('gems', cost)) { UI.toast('Not enough gems'); UI.open('shop', { tab: 'gems' }); return; } pickChoice('gems'); };
    api.acts.no = () => pickChoice('no');
  },

  results(m, d, api) {
    const { res, r } = d, st = res.stats, h = HERO[res.hero];
    m.innerHTML = `<div class="results"><div class="muted small">ROUND COMPLETE</div><div class="sc">${fmt(res.score)}</div>${r.newBest ? '<div class="nh">🏆 NEW BEST!</div>' : `<div class="muted small">Best ${fmt(S.stats.best)}</div>`}
      <div class="rw"><div class="rc"><small>Coins</small>🪙 +${fmt(r.coins)}</div><div class="rc"><small>XP</small>✨ +${r.xp}</div><div class="rc"><small>Tokens</small>🌪️ +${r.tokens}</div><div class="rc"><small>Piggy</small>🐷 +${r.piggy}</div></div>
      <div class="stat-grid" style="width:100%"><div>Emoji cleared<b>${st.tiles}</b></div><div>Best combo<b>x${st.maxCombo}</b></div><div>Specials<b>${st.specials}</b></div><div>Blitz<b>${st.blitzes}</b></div><div>${h.e} powers<b>${st.powers}</b></div><div>Rank<b>#${r.rank.after}${r.rank.after < r.rank.before ? ' ▲' : ''}</b></div></div>
      ${r.missionsDone ? `<div class="small" style="color:var(--green2)">🎯 ${r.missionsDone} quest${r.missionsDone > 1 ? 's' : ''} completed — claim in Quests!</div>` : ''}
      <div class="xpw"><div class="row sp tiny muted"><span>Level ${S.level}</span><span>${S.xp}/${Econ.xpFor(S.level)} XP</span></div><div class="bar xp"><i style="width:${Math.round(S.xp / Econ.xpFor(S.level) * 100)}%"></i></div></div>
      <div class="row center wrap" style="width:100%"><button class="btn sm ghost" data-act="dbl">📺 Double coins</button><button class="btn sm ghost" data-act="share">Share</button></div>
      <button class="btn block green play" data-act="again" style="animation:none;font-size:22px">PLAY AGAIN ${Econ.unlimited() ? '' : `<small>❤️ ${S.lives} left</small>`}</button><button class="link" data-act="home">Back to home</button></div>`;
    if (r.newBest) { UI.confetti(120); Snd.fanfare(); } else Snd.levelup();
    api.acts.dbl = async b => { b.disabled = true; if (await Ads.rewarded('double')) { Econ.addCoins(r.coins); UI.toast(`🪙 +${fmt(r.coins)} bonus coins`); b.textContent = '✓ Doubled'; } else b.disabled = false; };
    api.acts.share = async () => { const text = `I scored ${fmt(res.score)} in Emoji Rush 3D 🦊 Beat that!`; try { if (navigator.share) await navigator.share({ title: 'Emoji Rush 3D', text, url: location.href }); else if (navigator.clipboard) { await navigator.clipboard.writeText(text + ' ' + location.href); UI.toast('Copied to clipboard'); } } catch (e) { } };
    api.acts.again = () => { UI.setResult('results', 'again'); UI.close('results'); };
    api.acts.home = () => { UI.setResult('results', 'home'); UI.close('results'); };
  },

  levelup(m, d, api) {
    const rw = Econ.levelReward(d.lv);
    m.innerHTML = `<h2 class="gradient">LEVEL ${d.lv}!</h2><div class="results"><div style="font-size:80px" class="emoji">🎉</div><div class="small muted">Rewards</div><div class="rw">${Rewards.label(rw).split(' · ').map(x => `<div class="rc">${x}</div>`).join('')}</div><button class="btn block gold" data-act="ok">COLLECT</button></div>`;
    Snd.levelup(); UI.confetti(80);
    api.acts.ok = () => { Rewards.grant(rw, null); UI.close('levelup'); };
  },
});
