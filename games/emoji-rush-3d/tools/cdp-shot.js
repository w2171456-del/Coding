// Headless Chrome (SwiftShader WebGL) CDP harness: runs a scripted scenario against the game and saves screenshots.
// Usage: node games/emoji-rush-3d/tools/cdp-shot.js <url> <scenario> <outPrefix> [width height mobile]
// scenario: comma list of  home | play | modal:<name>[:tab] | fps
const { spawn } = require('child_process'), fs = require('fs'), http = require('http');
const CHROME = '/home/hoplite/.agent-browser/browsers/chrome-152.0.7977.42/chrome';
const [, , url, scenario = 'home', prefix = '/tmp/er-shots/cdp', W = '1440', H = '900', MOBILE = '0'] = process.argv;
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, `--user-data-dir=/tmp/cdp-prof-${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getWs() { for (let i = 0; i < 50; i++) { try { const j = await new Promise((res, rej) => http.get(`http://127.0.0.1:${port}/json/list`, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej)); const p = j.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) { } await sleep(200); } throw new Error('no cdp'); }
let id = 0; const pending = new Map(); let ws;
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${prefix}_${name}.png`, Buffer.from(r.data, 'base64')); console.log('shot', `${prefix}_${name}.png`); };
const click = async (sel) => evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('no '+${JSON.stringify(sel)}); e.click(); return true})()`);
const waitFor = async (expr, timeout = 30000, label = expr) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await evalJs(`!!(${expr})`)) return true; await sleep(150); } console.log('TIMEOUT waiting for', label); return false; };
const modalName = () => evalJs(`(()=>{const m=[...document.querySelectorAll('.mb')].pop(); return m? m.dataset.name : ''})()`);
const closeTop = () => evalJs(`(()=>{const o=[...document.querySelectorAll('.mb')].pop(); if(!o) return false; const b=o.querySelector('[data-act="skip"],[data-act="ok"],[data-act="cancel"],[data-act="no"],[data-act="done"],[data-act="home"],.x'); if(b){b.click(); return true} UI.close(); return true})()`);
const logs = [];
(async () => {
  ws = new WebSocket(await getWs());
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.consoleAPICalled') { logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ')); } else if (m.method === 'Runtime.exceptionThrown') { logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); } };
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: MOBILE === '1' ? 2 : 1, mobile: MOBILE === '1' });
  if (MOBILE === '1') await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Page.navigate', { url });
  await waitFor(`document.querySelector('#btn-start') && !document.querySelector('#btn-start').classList.contains('hidden')`, 20000, 'start button');
  await shot('loading');
  await click('#btn-start'); await waitFor(`document.querySelector('#scr-home.active')`, 5000, 'home'); await sleep(1200);
  console.log('renderer:', await evalJs(`__m.GFX===__m.G3D ? 'WebGL' : 'Canvas2D'`).catch(() => 'n/a')); console.log('bench(home):', JSON.stringify(await evalJs('__dbg.bench(120)')));
  await shot('home');
  for (const step of scenario.split(',')) {
    if (step === 'home') continue;
    if (step === 'fps') { const f = await evalJs(`new Promise(r=>{let n=0;const t0=performance.now();const s=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(s); else r((n/((performance.now()-t0)/1000)).toFixed(1))}; requestAnimationFrame(s)})`); console.log('fps (home showcase):', f); }
    if (step === 'play') {
      await click('#btn-play'); await waitFor(`Game.running`, 60000, 'game running'); await shot('game_start');
      await waitFor(`Game.canTouch() && !Game.tiles.some(t => t.st !== 0)`, 60000, 'board settled');
      // real pointer input: swap the first valid move by clicking both tiles through CDP mouse events
      const mv = await evalJs('JSON.stringify(__dbg.movePx())'); const M = JSON.parse(mv);
      if (M) { const tap = async p => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.sx, y: p.sy }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.sx, y: p.sy, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.sx, y: p.sy, button: 'left', clickCount: 1 }); }; await tap(M.a); await sleep(150); await tap(M.b); await waitFor('Game.score > ' + M.score + ' || (Game.st.swaps > 0 && !Game.tiles.some(t => t.st !== 0))', 30000, 'swap resolved'); const after = await evalJs('Game.score'); console.log('pointer swap:', M.score, '->', after, after > M.score ? 'OK' : 'NO SCORE CHANGE'); }
      for (let i = 0; i < 14; i++) { await evalJs(`__dbg.autoMove()`); await sleep(500); if (i === 3) await shot('game_mid'); if (i === 7) { await evalJs('__dbg.forceBlitz()'); await sleep(400); await shot('game_blitz'); } }
      await evalJs('__dbg.forcePower()'); await sleep(300); await shot('game_power');
      const f = await evalJs(`new Promise(r=>{let n=0;const t0=performance.now();const s=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(s); else r((n/((performance.now()-t0)/1000)).toFixed(1))}; requestAnimationFrame(s)})`); console.log('fps (in game):', f); console.log('bench(game):', JSON.stringify(await evalJs('__dbg.bench(120)')));
      await evalJs('__dbg.endRound()');
      if (await waitFor(`document.querySelector('.mb[data-name="continue"]')`, 120000, 'continue modal', 120000)) { await sleep(300); await shot('continue'); await evalJs(`document.querySelector('.mb[data-name="continue"] [data-act="no"]').click()`); }
      if (await waitFor(`document.querySelector('.mb[data-name="results"]')`, 60000, 'results modal')) { await sleep(400); await shot('results'); await evalJs(`document.querySelector('.mb[data-name="results"] [data-act="home"]').click()`); }
      for (let k = 0; k < 4; k++) { await sleep(900); const n = await modalName(); if (!n) break; await shot('post_' + n); await closeTop(); }
      await waitFor(`document.querySelector('#scr-home.active')`, 60000, 'home again'); await sleep(600); await shot('home_after');
    }
    if (step === 'flows') {
      const run = async (label, js, wait = 400) => { try { const r = await evalJs(js); await sleep(wait); console.log('flow', label, '->', r === undefined ? 'ok' : JSON.stringify(r)); } catch (e) { console.log('flow', label, 'THREW', e.message); } };
      await run('grant gems', `(__dbg.grant({gems: 3000, coins: 20000}), S.gems)`);
      await run('daily claim', `(UI.open('daily'), document.querySelector('.mb[data-name="daily"] [data-act="claim"]').click(), S.daily.streak)`, 800); await shot('flow_daily'); await evalJs('UI.closeAll()');
      await run('open gold box', `(UI.open('boxes'), document.querySelector('.mb[data-name="boxes"] [data-act="open"][data-box="gold"]').click(), true)`, 300);
      await run('tap box', `(document.querySelector('.mb[data-name="boxopen"] [data-act="tap"]').click(), true)`, 1800); await shot('flow_boxopen');
      await run('collect', `(document.querySelector('.mb[data-name="boxopen"] [data-act="done"]').click(), Object.keys(S.owned).length)`, 400); await evalJs('UI.closeAll()');
      await run('10x box', `(UI.open('boxes'), document.querySelector('.mb[data-name="boxes"] [data-act="open"][data-box="gold10"]').click(), document.querySelector('.mb[data-name="boxopen"] [data-act="tap"]').click(), true)`, 1800); await shot('flow_box10'); await evalJs('UI.closeAll()');
      await run('wheel spin (gems)', `(UI.open('wheel'), document.querySelector('.mb[data-name="wheel"] [data-mode="gems"]').click(), true)`, 2000); await shot('flow_wheel_spinning'); await sleep(3000); await evalJs('UI.closeAll()');
      await run('checkout starter', `(__m.IAP.buy('starter'), true)`, 500); await shot('flow_checkout');
      await run('confirm pay', `(document.querySelector('.mb[data-name="checkout"] [data-act="pay"]').click(), true)`, 1600); await shot('flow_after_starter');
      await run('starter fulfilled', `JSON.stringify({starter: S.iap.starter, gems: S.gems, owned: Object.keys(S.owned).length, queued: UI.queueList.length, open: UI.stack.map(m=>m.name)})`);
      for (let k = 0; k < 3; k++) { const n = await modalName(); if (!n) break; if (n === 'boxopen') { await evalJs(`(document.querySelector('.mb[data-name="boxopen"] [data-act="tap"]')||{click(){}}).click()`); await sleep(1500); await shot('flow_starter_box' + k); await evalJs(`(document.querySelector('.mb[data-name="boxopen"] [data-act="done"]')||{click(){}}).click()`); } else await closeTop(); await sleep(600); }
      await run('missions', `(UI.open('missions'), (document.querySelector('.mb[data-name="missions"] [data-act="claim"]')||{click(){}}).click(), __m.Missions.claimable())`, 500); await shot('flow_missions'); await evalJs('UI.closeAll()');
      await run('pass claim all', `(__m.Pass.addXp(2000), UI.open('pass'), (document.querySelector('.mb[data-name="pass"] [data-act="claimall"]')||{click(){}}).click(), __m.Pass.tier())`, 500); await shot('flow_pass'); await evalJs('UI.closeAll()');
      await run('buy pass', `(UI.open('pass'), document.querySelector('.mb[data-name="pass"] [data-act="buy"]').click(), true)`, 400); await run('pay', `(document.querySelector('.mb[data-name="checkout"] [data-act="pay"]').click(), true)`, 1500); await run('premium?', `S.pass.premium`); await evalJs('UI.closeAll()');
      await run('star up hero', `(S.owned.fox.shards = 99, UI.open('heroes'), document.querySelector('.mb[data-name="heroes"] [data-act="star"]').click(), S.owned.fox.stars)`, 500); await shot('flow_heroes'); await evalJs('UI.closeAll()');
      await run('equip other', `(UI.open('heroes'), (()=>{const id=Object.keys(S.owned).find(k=>k!=='fox'); document.querySelector('.mb[data-name="heroes"] [data-act="hero"][data-id="'+id+'"]').click(); document.querySelector('.mb[data-name="heroes"] [data-act="equip"]').click(); return S.equipped})())`, 400); await evalJs('UI.closeAll()');
      await run('settings toggles', `(UI.open('settings'), document.querySelector('.mb[data-name="settings"] [data-act="sw"][data-k="music"]').click(), document.querySelector('.mb[data-name="settings"] [data-act="q"][data-q="low"]').click(), JSON.stringify(S.settings))`, 400); await shot('flow_settings'); await evalJs('UI.closeAll()');
      await run('lives: unlimited', `(UI.open('lives'), document.querySelector('.mb[data-name="lives"] [data-act="unl"]').click(), __m.Econ.unlimited())`, 400); await evalJs('UI.closeAll()');
      await run('event double', `(UI.open('event'), document.querySelector('.mb[data-name="event"] [data-act="double"]').click(), S.event.double)`, 400); await evalJs('UI.closeAll()');
      await run('piggy fill+offer', `(S.piggy.gems = 500, UI.open('offer', {sku:'piggy'}), true)`, 400); await shot('flow_piggy_offer'); await evalJs('UI.closeAll()');
      await run('flash offer', `(S.flash.until = Date.now()+600000, UI.open('offer', {sku:'flash'}), true)`, 400); await shot('flow_flash'); await evalJs('UI.closeAll()');
      await run('vip offer', `(UI.open('offer', {sku:'vip'}), true)`, 400); await shot('flow_vip'); await evalJs('UI.closeAll()');
      await run('ad show+complete', `new Promise(r=>{ __m.Ads.show('lives', 2).then(ok=>r('ad ok='+ok)); setTimeout(()=>document.querySelector('#ad-x').click(), 2600); })`, 200);
      await run('save roundtrip', `(__m.Snd.stopMusic(), (()=>{const s=JSON.stringify(S); localStorage.setItem('emojiRush3D.v1', s); return s.length})())`);
    }
    if (step.startsWith('modal:')) {
      const [name, tab] = step.slice(6).split(':');
      await evalJs(`UI.open(${JSON.stringify(name)}, ${JSON.stringify(tab ? { tab } : {})})`); await sleep(700); await shot('modal_' + name + (tab ? '_' + tab : ''));
      await evalJs(`UI.closeAll()`); await sleep(150);
    }
  }
  console.log('--- console ---'); logs.slice(0, 40).forEach(l => console.log(l));
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('HARNESS ERROR', e); logs.slice(0, 40).forEach(l => console.log(l)); chrome.kill(); process.exit(1); });
