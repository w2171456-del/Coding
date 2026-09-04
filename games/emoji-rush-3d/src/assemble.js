// Assembles the single-file game from the ordered parts and syntax-checks the script.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = __dirname;
const out = process.argv[2] || path.join(dir, '..', 'index.html');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const js = ['03_core.js', '04_gfx.js', '05_game.js', '06_meta.js', '07_ui.js', '08_modals_a.js', '09_modals_b.js', '10_boot.js'].map(read).join('\n');
// Syntax check (module semantics: dynamic import is allowed in SourceTextModule; fall back to a Script check with import() stubbed).
try { new vm.Script(js.replace(/\bimport\(/g, 'importShim('), { filename: 'game.js' }); } catch (e) { console.error('SYNTAX ERROR:', e.message); process.exit(1); }
const html = read('01_head.html') + read('02_body.html') + '<script type="module">\n' + js + '\n</script>\n</body>\n</html>\n';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KiB, ${html.split('\n').length} lines)`);
