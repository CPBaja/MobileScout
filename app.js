// Register service worker for offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ---- Simple local storage DB (demo) ----
// In production, prefer IndexedDB via Dexie or PouchDB.
const DB_KEYS = {
  lineSamples: 'scout_line_samples_v1',
  completions: 'scout_completions_v1',
  pitLogs: 'scout_pit_logs_v1',
  settings: 'scout_settings_v1',
};

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- State ----
let lineSamples = load(DB_KEYS.lineSamples, []); // {eventName, timestamp, lineLength, windowMin, etaMinutes, runRate}
let completions = load(DB_KEYS.completions, []); // {eventName, timestamp}
let pitLogs = load(DB_KEYS.pitLogs, []);         // {carNumber, timestamp, direction, station}
let settings = load(DB_KEYS.settings, { tzMode: 'local' });

// ---- Utilities ----
function nowUtcIso() { return new Date().toISOString(); }
function toDisplay(ts) {
  const d = new Date(ts);
  if (settings.tzMode === 'utc') return d.toISOString().replace('T',' ').replace('Z',' UTC');
  return d.toLocaleString();
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// Compute run rate (# completions in last N minutes) / minutes
function computeRunRate(eventName, windowMin) {
  const cutoff = Date.now() - windowMin * 60 * 1000;
  const hits = completions.filter(c => c.eventName === eventName && new Date(c.timestamp).getTime() >= cutoff);
  const rate = hits.length / windowMin;
  return { rate, count: hits.length };
}

function renderDynamic() {
  const eventName = document.getElementById('eventName').value.trim() || 'Event';
  const windowMin = clamp(parseInt(document.getElementById('windowMin').value || '10', 10), 1, 60);
  const lineLengthVal = parseInt(document.getElementById('lineLength').value || '0', 10);
  const { rate, count } = computeRunRate(eventName, windowMin);
  const eta = rate > 0 ? (lineLengthVal / rate) : NaN;

  document.getElementById('runRate').textContent = rate.toFixed(2);
  document.getElementById('compWindow').textContent = String(count);
  document.getElementById('eta').textContent = isFinite(eta) ? eta.toFixed(1) : '–';

  // list recent activities (last 10)
  const log = document.getElementById('dynamicLog');
  log.innerHTML = '';
  const combined = [
    ...lineSamples.map(s => ({ type:'snapshot', ts: s.timestamp, text:`[Snapshot] ${s.eventName}: line=${s.lineLength}` })),
    ...completions.map(c => ({ type:'completion', ts: c.timestamp, text:`[Completion] ${c.eventName}` })),
  ].sort((a,b)=> new Date(b.ts)-new Date(a.ts)).slice(0,10);

  for (const item of combined) {
    const li = document.createElement('li');
    li.textContent = `${toDisplay(item.ts)} — ${item.text}`;
    log.appendChild(li);
  }
}

function renderPit() {
  const list = document.getElementById('pitLog');
  list.innerHTML = '';
  for (const p of [...pitLogs].sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp)).slice(0,20)) {
    const li = document.createElement('li');
    li.textContent = `${toDisplay(p.timestamp)} — Car ${p.carNumber}: ${p.direction.toUpperCase()} (${p.station})`;
    list.appendChild(li);
  }
}

function persistAll() {
  save(DB_KEYS.lineSamples, lineSamples);
  save(DB_KEYS.completions, completions);
  save(DB_KEYS.pitLogs, pitLogs);
  save(DB_KEYS.settings, settings);
}

// ---- Event handlers ----
document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.setAttribute('role', 'tab');
  });

  document.querySelector('nav.tabs').setAttribute('role', 'tablist');

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.setAttribute('role', 'tabpanel');
    if(!panel.classList.contains('active')) panel.hidden = true;
  });
  document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.tab;  
    //tabs
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t === btn);
      t.setAttribute('aria-selected', t === btn ? 'true' : 'false');
    });
    //panels

    document.querySelectorAll('.tab-panel').forEach(p => {
      const isTarget = p.id === targetId;
      p.classList.toggle('active', isTarget);
      p.hidden = !isTarget;
    });
    // render only the active tab
    if (targetId === 'dynamic') renderDynamic();
    else if (targetId === 'endurance') renderPit();
    // settings panel has no list render, so nothing to call
  


    });
  });

  // Settings
  const tzSel = document.getElementById('tzMode');
  tzSel.value = settings.tzMode || 'local';
  tzSel.addEventListener('change', () => {
    settings.tzMode = tzSel.value;
    persistAll();
    renderDynamic();
    renderPit();
  });

  // Dynamic day
  document.getElementById('snapshotBtn').addEventListener('click', () => {
    const eventName = document.getElementById('eventName').value.trim() || 'Event';
    const lineLength = parseInt(document.getElementById('lineLength').value || '0', 10);
    const windowMin = clamp(parseInt(document.getElementById('windowMin').value || '10', 10), 1, 60);
    const { rate } = computeRunRate(eventName, windowMin);
    const eta = rate > 0 ? (lineLength / rate) : NaN;
    const sample = {
      eventName, lineLength, windowMin,
      etaMinutes: isFinite(eta) ? Number(eta.toFixed(2)) : null,
      runRate: Number(rate.toFixed(4)),
      timestamp: nowUtcIso()
    };
    lineSamples.push(sample);
    persistAll();
    haptic();
    renderDynamic();
  });

  document.getElementById('plusOneBtn').addEventListener('click', () => {
    const eventName = document.getElementById('eventName').value.trim() || 'Event';
    completions.push({ eventName, timestamp: nowUtcIso() });
    persistAll();
    haptic();
    renderDynamic();
  });

  // Exports
  document.getElementById('exportDynamicCsv').addEventListener('click', () => {
    const rows = [['eventName','timestampUTC','lineLength','windowMinutes','runRateComputed','etaMinutes']];
    for (const s of lineSamples) {
      rows.push([s.eventName, s.timestamp, s.lineLength, s.windowMin, s.runRate, s.etaMinutes ?? '']);
    }
    exportCsv('LineSamples.csv', rows);
  });

  // Endurance
  document.getElementById('pitInBtn').addEventListener('click', () => addPit('in'));
  document.getElementById('pitOutBtn').addEventListener('click', () => addPit('out'));

  document.getElementById('exportPitCsv').addEventListener('click', () => {
    const rows = [['carNumber','timestampUTC','direction','station','sessionId']];
    for (const p of pitLogs) {
      rows.push([p.carNumber, p.timestamp, p.direction, p.station, p.sessionId]);
    }
    exportCsv('PitLogs.csv', rows);
  });

  // Settings buttons
  document.getElementById('exportAllBtn').addEventListener('click', () => {
    const payload = {
      lineSamples, completions, pitLogs, settings,
      exportedAtUTC: nowUtcIso()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob('scout_export.json', blob);
  });

  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (!confirm('Erase ALL on-device data? This cannot be undone.')) return;
    lineSamples = []; completions = []; pitLogs = [];
    persistAll(); renderDynamic(); renderPit();
  });

  // Offline badge
  function updateBadge(){
    const b = document.getElementById('offlineBadge');
    if (navigator.onLine) { b.textContent = 'Online'; b.style.background = '#238636'; }
    else { b.textContent = 'Offline'; b.style.background = '#6e7681'; }
  }
  updateBadge();
  window.addEventListener('online', updateBadge);
  window.addEventListener('offline', updateBadge);

  renderDynamic(); renderPit();
});

function addPit(direction) {
  const carNumber = (document.getElementById('carNumber').value || '').trim();
  if (!carNumber) { alert('Enter car number'); return; }
  const entry = {
    carNumber, direction,
    station: direction === 'in' ? 'entry' : 'exit',
    timestamp: nowUtcIso(),
    sessionId: new Date().toISOString().slice(0,10) // YYYY-MM-DD
  };
  pitLogs.push(entry);
  persistAll();
  haptic();
  renderPit();
}

// Haptic (iOS PWAs get light vibration via navigator.vibrate as a hint)
function haptic(){ try { navigator.vibrate?.(10); } catch {} }

// ---- CSV helpers ----
function exportCsv(filename, rows) {
  const csv = rows.map(r => r.map(field => toCsv(field)).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const file = new File([blob], filename, { type: 'text/csv' });

  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    navigator.share({ files: [file], title: filename, text: filename }).catch(()=>downloadBlob(filename, blob));
  } else {
    downloadBlob(filename, blob);
  }
}

function toCsv(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
}
