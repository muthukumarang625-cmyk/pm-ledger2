const KEY = 'pm-ledger-v1';
const $ = s => document.querySelector(s);
let assets = JSON.parse(localStorage.getItem(KEY) || '[]');
let editing = null, logging = null;
const save = () => { localStorage.setItem(KEY, JSON.stringify(assets)); render(); };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const diff = d => Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nextDue = a => a.last ? addDays(a.last, +a.interval) : today();
const status = a => { const d = diff(nextDue(a)); return d < 0 ? 'Overdue' : d <= 7 ? 'Due soon' : 'OK'; };

function render() {
  const q = $('#q').value.toLowerCase(), t = $('#fType').value, s = $('#fStatus').value;
  const list = assets.filter(a => (!t || a.type === t) && (!s || status(a) === s) &&
    [a.id, a.name, a.location].join(' ').toLowerCase().includes(q))
    .sort((a, b) => nextDue(a).localeCompare(nextDue(b)));
  $('#rows').innerHTML = list.map(a => { const st = status(a), i = assets.indexOf(a);
    return `<tr><td>${esc(a.id)}</td><td>${esc(a.name)}</td><td>${a.type}</td><td>${esc(a.location)}</td>
    <td>${a.interval}</td><td>${a.last || '—'}</td><td>${nextDue(a)}</td>
    <td><span class="tag ${st.replace(' ', '')}">${st}</span></td>
    <td><button data-act="log" data-i="${i}">Log done</button><button data-act="hist" data-i="${i}">History</button>
    <button data-act="edit" data-i="${i}">Edit</button><button data-act="del" data-i="${i}">✕</button></td></tr>`; }).join('');
  $('#empty').hidden = assets.length > 0;
  const c = k => assets.filter(a => status(a) === k).length;
  $('#stats').innerHTML = [['Total', assets.length], ['Overdue', c('Overdue')], ['Due in 7 days', c('Due soon')], ['OK', c('OK')]]
    .map(([l, n]) => `<div class="stat"><b>${n}</b>${l}</div>`).join('');
}

$('#add').onclick = () => { editing = null; $('#fAsset').reset(); $('#fAsset').id.readOnly = false; $('#dTitle').textContent = 'Add asset'; $('#dAsset').showModal(); };
$('#fAsset').onsubmit = e => {
  const f = Object.fromEntries(new FormData(e.target));
  if (editing === null) {
    if (assets.some(a => a.id === f.id)) return alert('Asset ID already exists');
    assets.push({ ...f, history: [] });
    if (f.last) assets.at(-1).history.push({ date: f.last, by: '', remarks: 'Initial record' });
  } else Object.assign(assets[editing], f);
  save();
};
$('#fLog').onsubmit = e => {
  const f = Object.fromEntries(new FormData(e.target)), a = assets[logging];
  a.history = a.history || []; a.history.push(f);
  if (!a.last || f.date > a.last) a.last = f.date;
  save();
};
$('#rows').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const i = +b.dataset.i, a = assets[i];
  if (b.dataset.act === 'del') { if (confirm(`Delete ${a.id}?`)) { assets.splice(i, 1); save(); } }
  if (b.dataset.act === 'edit') { editing = i; const f = $('#fAsset'); f.reset();
    for (const k of ['id','name','type','location','interval','last','notes']) f[k].value = a[k] ?? '';
    f.id.readOnly = true; $('#dTitle').textContent = 'Edit asset'; $('#dAsset').showModal(); }
  if (b.dataset.act === 'log') { logging = i; $('#fLog').reset(); $('#fLog').date.value = today(); $('#lTitle').textContent = `Log maintenance – ${a.id}`; $('#dLog').showModal(); }
  if (b.dataset.act === 'hist') { $('#hTitle').textContent = `History – ${a.id} ${a.name}`;
    $('#hBody').innerHTML = (a.history || []).slice().reverse().map(h => `<div class="h"><b>${h.date}</b> ${esc(h.by)}<br><small>${esc(h.remarks)}</small></div>`).join('') || '<p>No records yet.</p>';
    $('#dHist').showModal(); }
};
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
['#q', '#fType', '#fStatus'].forEach(s => $(s).oninput = render);

const download = (name, text, type) => { const u = URL.createObjectURL(new Blob([text], { type })); const l = document.createElement('a'); l.href = u; l.download = name; l.click(); URL.revokeObjectURL(u); };
$('#json').onclick = () => download(`pm-ledger-${today()}.json`, JSON.stringify(assets, null, 2), 'application/json');
$('#csv').onclick = () => {
  const h = ['ID','Name','Type','Location','Interval days','Last maintenance','Next due','Status','Notes'];
  const rows = assets.map(a => [a.id, a.name, a.type, a.location, a.interval, a.last, nextDue(a), status(a), a.notes]);
  download(`pm-ledger-${today()}.csv`, [h, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
};
$('#restore').onchange = async e => {
  try { const d = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(d)) throw 0;
    if (confirm('Replace current data with this backup?')) { assets = d; save(); } } catch { alert('Invalid backup file'); }
  e.target.value = '';
};
render();
