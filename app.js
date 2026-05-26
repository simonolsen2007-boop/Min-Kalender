const BACKEND = 'https://kalenderai-backend.onrender.com';
// Keep backend awake
setInterval(() => fetch(BACKEND).catch(()=>{}), 10 * 60 * 1000);

let mode = 'text';
let events = [];
let editIdx = null;
let photoB64 = null;
let photoMime = 'image/jpeg';
let isRec = false;
let mediaRecorder = null;
let audioChunks = [];
let speech = '';

// Theme
const savedTheme = localStorage.getItem('kalenderai_theme') || 'dark';
if (savedTheme === 'light') applyTheme('light');

function applyTheme(t) {
  if (t === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
  document.getElementById('theme-dark').classList.toggle('active', t === 'dark');
  document.getElementById('theme-light').classList.toggle('active', t === 'light');
}
function setTheme(t) {
  applyTheme(t);
  localStorage.setItem('kalenderai_theme', t);
}

function setMode(m) {
  mode = m;
  ['text','photo','voice'].forEach(x => {
    document.getElementById('tab-'+x).classList.toggle('active', x===m);
  });
  document.getElementById('text-input').style.display = m==='text' ? 'block' : 'none';
  document.getElementById('photo-zone').style.display = m==='photo' ? 'flex' : 'none';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('voice-zone').style.display = m==='voice' ? 'flex' : 'none';
  const label = document.querySelector('.input-label');
  updateInputLabel();
}

function onPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = r => {
    const src = r.target.result;
    photoB64 = src.split(',')[1];
    photoMime = file.type || 'image/jpeg';
    const prev = document.getElementById('photo-preview');
    prev.src = src;
    prev.style.display = 'block';
    document.getElementById('photo-zone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function toggleVoice() {
  if (!isRec) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      toast(lang === 'de' ? '❌ Aufnahme wird von diesem Browser nicht unterstützt' : '❌ Recording not supported in this browser', true);
      document.getElementById('voice-status').textContent = lang === 'de' ? 'Nicht unterstützt' : 'Not supported';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        await transcribeAudio(blob);
      };
      mediaRecorder.start();
      isRec = true;
      document.getElementById('mic-btn').classList.add('recording');
      document.getElementById('mic-icon').outerHTML = '<svg id="mic-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="color:var(--red)"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';
      document.getElementById('voice-status').textContent = i18n.voiceRecording;
      document.getElementById('voice-transcript').textContent = '';
    } catch(err) {
      toast('❌ Mikrofon-Zugriff verweigert', true);
    }
  } else {
    mediaRecorder?.stop();
    isRec = false;
    document.getElementById('mic-btn').classList.remove('recording');
    document.getElementById('mic-icon').outerHTML = '<svg id="mic-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    document.getElementById('voice-status').textContent = i18n.voiceProcessing;
  }
}

async function transcribeAudio(blob) {
  try {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    const resp = await fetch(`${BACKEND}/api/transcribe`, { method: 'POST', body: formData });
    if (!resp.ok) throw new Error(await resp.text());
    speech = await resp.text();
    document.getElementById('voice-transcript').textContent = speech;
    document.getElementById('voice-status').textContent = i18n.voiceDone;
    toast(i18n.toastVoice);
  } catch(err) {
    toast('❌ Transkription fehlgeschlagen', true);
    document.getElementById('voice-status').textContent = 'Zum Aufnehmen tippen';
  }
}

async function analyze() {
  let messages = [];
  if (mode === 'text') {
    const txt = document.getElementById('text-input').value.trim();
    if (!txt) { toast('❌ ' + i18n.errorNoText, true); return; }
    messages = [{ role: 'user', content: txt }];
  } else if (mode === 'photo') {
    if (!photoB64) { toast('❌ ' + i18n.errorNoPhoto, true); return; }
    messages = [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:${photoMime};base64,${photoB64}` } },
      { type: 'text', text: 'Extrahiere alle Termine aus diesem Bild und antworte im gewünschten JSON-Format.' }
    ]}];
  } else {
    if (!speech) { toast('❌ ' + i18n.errorNoVoice, true); return; }
    messages = [{ role: 'user', content: speech }];
  }

  setLoading(true);
  try {
    const resp = await fetch(`${BACKEND}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, messages: [{ role: 'system', content: getSysPrompt() }, ...messages] })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || data.error);
    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g,'').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); }
        catch {
          let fixed = m[0]
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/([^"\\])\n/g, '$1 ')
            .replace(/[\u0000-\u001F]+/g, ' ');
          const openBrackets = (fixed.match(/\[/g)||[]).length;
          const closeBrackets = (fixed.match(/\]/g)||[]).length;
          const openBraces = (fixed.match(/\{/g)||[]).length;
          const closeBraces = (fixed.match(/\}/g)||[]).length;
          for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
          for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
          try { parsed = JSON.parse(fixed); }
          catch { throw new Error(lang === 'de' ? 'Ungültiges Antwortformat. Bitte erneut versuchen.' : 'Invalid response format. Please try again.'); }
        }
      } else {
        throw new Error(lang === 'de' ? 'Ungültiges Antwortformat. Bitte erneut versuchen.' : 'Invalid response format. Please try again.');
      }
    }
    events = (parsed.events || []).filter(ev => ev.title && ev.date && ev.startTime);
    if (!events.length) {
      document.querySelector('.empty-text').innerHTML = i18n.noResultsText;
      document.getElementById('results').style.display = 'none';
      document.getElementById('empty').style.display = 'block';
    } else {
      showEvents();
    }
  } catch(err) {
    toast('❌ ' + (err.message || 'Unbekannter Fehler'), true);
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  document.getElementById('loader').classList.toggle('on', on);
  const b = document.getElementById('btn-main');
  b.disabled = on;
  const modeMsg = mode === 'photo' ? i18n.analyzingPhoto : mode === 'voice' ? i18n.analyzingVoice : i18n.analyzing;
  b.innerHTML = on
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> ${modeMsg}`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> ${i18n.cta}`;
}

function showEvents() {
  const res = document.getElementById('results');
  const emp = document.getElementById('empty');
  const list = document.getElementById('ev-list');
  if (!events.length) {
    res.style.display = 'none'; emp.style.display = 'block'; return;
  }
  emp.style.display = 'none'; res.style.display = 'block';
  document.getElementById('count').textContent = events.length;
  document.querySelector('.results-title').textContent = i18n.resultsTitle;
  list.innerHTML = events.map((ev,i) => `
    <div class="ev-card glass" id="ec-${i}" style="animation-delay:${i*0.08}s">
      <div class="ev-top">
        <div class="ev-name">${ev.title}</div>
        <div class="ev-conf">${confLabel(ev.confidence || 90)}</div>
      </div>
      <div class="ev-chips">
        <div class="chip">📅 ${fmtDate(ev.date)}</div>
        <div class="chip">🕐 ${ev.startTime}${ev.endTime?' – '+ev.endTime:''}</div>
        ${ev.location?`<div class="chip">📍 ${ev.location}</div>`:''}
      </div>
      ${ev.description?`<div class="ev-desc">${ev.description}</div>`:''}
      <div class="ev-actions">
        <div class="cal-export-label" id="cal-label-${i}">${i18n.exportLabel || 'IN KALENDER EXPORTIEREN'}</div>
        <div class="cal-option-card selected" id="cal-google-${i}" onclick="toggleCalOption(${i},&quot;google&quot;)">
          <div class="cal-option-checkbox">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg>
          </div>
          <div class="cal-option-icon cal-icon-google">🗓</div>
          <div class="cal-option-info">
            <div class="cal-option-name">Google Calendar</div>
            <div class="cal-option-desc" id="cal-google-desc-${i}">${i18n.googleDesc || 'Direkt in deinen Kalender'}</div>
          </div>
        </div>
        <div class="cal-option-card" id="cal-ics-${i}" onclick="toggleCalOption(${i},&quot;ics&quot;)">
          <div class="cal-option-checkbox">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg>
          </div>
          <div class="cal-option-icon cal-icon-ics">📥</div>
          <div class="cal-option-info">
            <div class="cal-option-name">ICS-Datei</div>
            <div class="cal-option-desc" id="cal-ics-desc-${i}">${i18n.icsDesc || 'Apple, Outlook & andere'}</div>
          </div>
        </div>
        <button class="btn-confirm-export" id="cb-${i}" onclick="confirmExport(${i})">
          <span id="cb-label-${i}">${i18n.confirmExport || 'Bestätigen & exportieren'}</span>
        </button>
        <button class="btn-edit" onclick="openEdit(${i})">${i18n.editBtn}</button>
      </div>
    </div>`).join('');
}

function fmtDate(d) {
  if (!d) return '?';
  try { return new Date(d+'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', {day:'numeric',month:'short',year:'numeric'}); }
  catch { return d; }
}

function confLabel(pct) {
  if (pct >= 90) return lang === 'de' ? 'Sicher' : 'Certain';
  if (pct >= 70) return lang === 'de' ? 'Wahrscheinlich' : 'Likely';
  return lang === 'de' ? 'Prüfen' : 'Verify';
}

// ── Dropdown ─────────────────────────────────────────────────────────────────
let activeDropdownIdx = null;

const sharedMenu = document.getElementById('cal-menu-shared');

function buildCalMenu() {
  sharedMenu.innerHTML = `
    <div style="padding:6px 8px 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);font-family:var(--mono);">${i18n.calTitle || 'KALENDER'}</div>
    <button class="cal-pill-btn cal-google" onclick="handleCalChoice('google')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Google Calendar
    </button>
    <button class="cal-pill-btn cal-ics" onclick="handleCalChoice('ics')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      ICS / Andere
    </button>
  `;
}

function toggleDropdown(i, e) {
  e.stopPropagation();
  if (activeDropdownIdx === i) {
    closeAllDropdowns(); return;
  }
  closeAllDropdowns();
  activeDropdownIdx = i;
  const btn = document.getElementById('cb-' + i);
  const rect = btn.getBoundingClientRect();
  sharedMenu.style.display = 'block';
  const menuH = sharedMenu.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow >= menuH + 8) {
    sharedMenu.style.top = (rect.bottom + 6) + 'px';
  } else {
    sharedMenu.style.top = (rect.top - menuH - 6) + 'px';
  }
  sharedMenu.style.left = Math.max(8, rect.right - sharedMenu.offsetWidth) + 'px';
  sharedMenu.style.display = '';
  sharedMenu.classList.add('open');
}

function closeAllDropdowns() {
  sharedMenu.classList.remove('open');
  activeDropdownIdx = null;
}
document.addEventListener('click', closeAllDropdowns);

function handleCalChoice(type) {
  const idx = activeDropdownIdx;
  closeAllDropdowns();
  if (idx === -1) {
    events.forEach((_,i) => setTimeout(() => addToCalendar(i, type), i*400));
  } else if (idx !== null) {
    addToCalendar(idx, type);
  }
}

function toggleCalOption(i, type) {
  const card = document.getElementById('cal-' + type + '-' + i);
  if (card) card.classList.toggle('selected');
}

function confirmExport(i) {
  const googleCard = document.getElementById('cal-google-' + i);
  const icsCard = document.getElementById('cal-ics-' + i);
  const googleSelected = googleCard && googleCard.classList.contains('selected');
  const icsSelected = icsCard && icsCard.classList.contains('selected');
  if (!googleSelected && !icsSelected) {
    toast(lang === 'de' ? '⚠️ Bitte mindestens einen Kalender auswählen' : '⚠️ Please select at least one calendar', true);
    return;
  }
  if (googleSelected) addToCalendar(i, 'google');
  if (icsSelected) setTimeout(() => addToCalendar(i, 'ics'), googleSelected ? 500 : 0);
  const btn = document.getElementById('cb-' + i);
  const lbl = document.getElementById('cb-label-' + i);
  if (btn) { btn.classList.add('done'); btn.disabled = true; }
  if (lbl) lbl.textContent = lang === 'de' ? '✓ Gespeichert!' : '✓ Saved!';
}

// ── Calendar URLs ─────────────────────────────────────────────────────────────
function buildGoogleURL(ev) {
  const ds = (ev.date||'').replace(/-/g,'');
  const s = (ev.startTime||'09:00').replace(':','')+'00';
  const e = (ev.endTime||'10:00').replace(':','')+'00';
  const p = new URLSearchParams({ action:'TEMPLATE', text:ev.title||'Termin',
    dates:`${ds}T${s}/${ds}T${e}`, location:ev.location||'', details:ev.description||'' });
  return `https://calendar.google.com/calendar/render?${p}`;
}
function buildOutlookURL(ev) {
  const p = new URLSearchParams({ path:'/calendar/action/compose', rru:'addevent',
    subject:ev.title||'Termin', startdt:`${ev.date}T${ev.startTime||'09:00'}:00`,
    enddt:`${ev.date}T${ev.endTime||'10:00'}:00`, location:ev.location||'', body:ev.description||'' });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}
function buildICS(ev) {
  const ds = (ev.date||'').replace(/-/g,'');
  const s = (ev.startTime||'09:00').replace(':','')+'00';
  const e = (ev.endTime||'10:00').replace(':','')+'00';
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//KalenderAI//DE',
    'BEGIN:VEVENT',`DTSTART:${ds}T${s}`,`DTEND:${ds}T${e}`,
    `SUMMARY:${ev.title||'Termin'}`,`LOCATION:${ev.location||''}`,
    `DESCRIPTION:${ev.description||''}`, 'END:VEVENT','END:VCALENDAR'].join('\r\n');
  return URL.createObjectURL(new Blob([ics], {type:'text/calendar'}));
}

function addToCalendar(i, type) {
  const ev = events[i];
  if (type === 'google') {
    window.open(buildGoogleURL(ev), '_blank');
    toast(i18n.toastCalendar);
  } else {
    const a = document.createElement('a');
    a.href = buildICS(ev);
    a.download = `${(ev.title||'termin').replace(/[^a-z0-9]/gi,'_')}.ics`;
    a.click();
    toast(i18n.toastICS);
  }
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEdit(i) {
  editIdx = i; const ev = events[i];
  document.getElementById('e-title').value = ev.title||'';
  document.getElementById('e-date').value = ev.date||'';
  document.getElementById('e-start').value = ev.startTime||'';
  document.getElementById('e-end').value = ev.endTime||'';
  document.getElementById('e-loc').value = ev.location||'';
  document.getElementById('e-desc').value = ev.description||'';
  document.getElementById('overlay').classList.add('open');
}
function closeModal(e) {
  if (!e || e.target===document.getElementById('overlay'))
    document.getElementById('overlay').classList.remove('open');
}
function saveEdit() {
  if (editIdx === null) return;
  const title = document.getElementById('e-title').value.trim();
  const date = document.getElementById('e-date').value.trim();
  const startTime = document.getElementById('e-start').value.trim();
  if (!title) {
    toast(lang === 'de' ? '❌ Titel darf nicht leer sein' : '❌ Title cannot be empty', true);
    document.getElementById('e-title').focus();
    return;
  }
  if (!date) {
    toast(lang === 'de' ? '❌ Datum ist erforderlich' : '❌ Date is required', true);
    document.getElementById('e-date').focus();
    return;
  }
  if (!startTime) {
    toast(lang === 'de' ? '❌ Startzeit ist erforderlich' : '❌ Start time is required', true);
    document.getElementById('e-start').focus();
    return;
  }
  events[editIdx] = {
    ...events[editIdx],
    title,
    date,
    startTime,
    endTime: document.getElementById('e-end').value,
    location: document.getElementById('e-loc').value,
    description: document.getElementById('e-desc').value,
  };
  document.getElementById('overlay').classList.remove('open');
  showEvents();
  toast(i18n.toastUpdated);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, err=false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err?' err':'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── i18n ─────────────────────────────────────────────────────────────────────
const langs = {
  de: {
    themeLight: '☀️ Hell', themeDark: '🌙 Dunkel',
    langBtn: '🌐 EN',
    tabText: 'Text', tabPhoto: 'Foto', tabVoice: 'Sprache',
    inputLabelText: 'Termin beschreiben',
    inputLabelPhoto: 'Foto hochladen',
    inputLabelVoice: 'Termin ansagen',
    textPlaceholder: 'z.B. Zahnarzt Freitag um 10:30 Uhr, Dr. Müller\nTeam-Meeting Donnerstag 15. Mai um 14 Uhr im Konferenzraum',
    photoText: 'Foto aufnehmen oder aus Galerie wählen<br><span style="font-size:11px;opacity:0.6;">Einladung · Ticket · Notiz · Flyer</span>',
    voiceIdle: 'Zum Aufnehmen tippen',
    voiceRecording: 'Aufnahme läuft... Tippen zum Stoppen',
    voiceProcessing: 'Wird verarbeitet...',
    voiceDone: 'Transkription abgeschlossen ✓',
    cta: 'Termine mit KI erkennen',
    analyzing: 'KI analysiert...',
    analyzingPhoto: 'Bild wird analysiert...',
    analyzingVoice: 'Sprache wird analysiert...',
    noResultsText: 'Keine Termine gefunden.<br>Versuche eine detailliertere Beschreibung.',
    resultsTitle: 'Erkannte Termine',
    editBtn: '✏️ Bearbeiten',
    modalTitle: '✏️ Termin bearbeiten',
    labelTitle: 'Titel', labelDate: 'Datum', labelStart: 'Beginn',
    labelEnd: 'Ende', labelLoc: 'Ort', labelDesc: 'Beschreibung',
    saveBtn: 'Änderungen speichern',
    emptyText: 'Noch keine Termine erkannt.<br>Beschreibe einen Termin oben.',
    toastCalendar: '🗓 Google Kalender geöffnet!',
    toastOutlook: '📘 Outlook geöffnet!',
    toastSamsung: '📱 Samsung Kalender wird geöffnet!',
    toastICS: '📥 ICS-Datei heruntergeladen!',
    toastUpdated: '✅ Termin aktualisiert!',
    toastVoice: '🎙️ Sprache erkannt!',
    errorNoText: 'Bitte zuerst Text eingeben',
    errorNoPhoto: 'Bitte zuerst ein Foto auswählen',
    errorNoVoice: 'Bitte zuerst Sprache aufnehmen',
    calTitle: 'KALENDER WÄHLEN',
    exportLabel: 'IN KALENDER EXPORTIEREN',
    googleDesc: 'Direkt in deinen Kalender',
    icsDesc: 'Apple, Outlook & andere',
    confirmExport: 'Bestätigen & exportieren',
    savedBtn: '✅ Gespeichert!',
  },
  en: {
    themeLight: '☀️ Light', themeDark: '🌙 Dark',
    langBtn: '🌐 DE',
    tabText: 'Text', tabPhoto: 'Photo', tabVoice: 'Voice',
    inputLabelText: 'Describe your appointment',
    inputLabelPhoto: 'Upload a photo',
    inputLabelVoice: 'Say your appointment',
    textPlaceholder: 'e.g. Dentist Friday at 10:30am, Dr. Miller\nTeam meeting Thursday May 15 at 2pm in the conference room',
    photoText: 'Take a photo or choose from gallery<br><span style="font-size:11px;opacity:0.6;">Invitation · Ticket · Note · Flyer</span>',
    voiceIdle: 'Tap to start recording',
    voiceRecording: 'Recording... Tap to stop',
    voiceProcessing: 'Processing...',
    voiceDone: 'Transcription complete ✓',
    cta: 'Detect appointments with AI',
    analyzing: 'AI is analyzing...',
    analyzingPhoto: 'Analyzing image...',
    analyzingVoice: 'Analyzing voice...',
    noResultsText: 'No appointments found.<br>Try a more detailed description.',
    resultsTitle: 'Detected Appointments',
    editBtn: '✏️ Edit',
    modalTitle: '✏️ Edit appointment',
    labelTitle: 'Title', labelDate: 'Date', labelStart: 'Start',
    labelEnd: 'End', labelLoc: 'Location', labelDesc: 'Description',
    saveBtn: 'Save changes',
    emptyText: 'No appointments detected yet.<br>Describe an appointment above.',
    toastCalendar: '🗓 Google Calendar opened!',
    toastOutlook: '📘 Outlook opened!',
    toastSamsung: '📱 Samsung Calendar opening!',
    toastICS: '📥 ICS file downloaded!',
    toastUpdated: '✅ Appointment updated!',
    toastVoice: '🎙️ Voice recognized!',
    errorNoText: 'Please enter text first',
    errorNoPhoto: 'Please select a photo first',
    errorNoVoice: 'Please record voice first',
    calTitle: 'ADD TO CALENDAR',
    exportLabel: 'EXPORT TO CALENDAR',
    googleDesc: 'Directly to your calendar',
    icsDesc: 'Apple, Outlook & others',
    confirmExport: 'Confirm & export',
    savedBtn: '✅ Saved!',
  }
};

let lang = localStorage.getItem('kalenderai_lang') || 'de';

function getSysPrompt() {
  const isEN = lang === 'en';
  const now = new Date();
  const todayStr = now.toLocaleDateString(isEN ? 'en-US' : 'de-DE', {weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const todayISO = now.toISOString().split('T')[0];
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  const tomorrowISO = tomorrow.toISOString().split('T')[0];
  const dayAfter = new Date(now); dayAfter.setDate(now.getDate()+2);
  const dayAfterISO = dayAfter.toISOString().split('T')[0];

  if (isEN) {
    return `You are an assistant that extracts appointments from text, photos, and voice. Reply ONLY with valid JSON in this exact format:
{"events":[{"title":"Appointment name","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","location":"location or empty","description":"short description or empty","confidence":90}]}

IMPORTANT: If the input contains NO appointments, calendar events, or scheduling information, return EXACTLY: {"events":[]}
Do NOT invent, guess, or fabricate appointments. Only extract what is explicitly present.

Today is ${todayStr} (${todayISO}).
Tomorrow = ${tomorrowISO}. Day after tomorrow = ${dayAfterISO}.
- Always resolve relative dates: "tomorrow" = ${tomorrowISO}, "today" = ${todayISO}
- If no year given, use next possible future date
- If no end time given, add 1 hour to start time
- Write ALL fields in English
- Confidence = certainty 0-100
- For each extracted event: NEVER use undefined, null, or empty string for date/startTime/title`;
  } else {
    return `Du bist ein Assistent, der Termine aus Texten, Fotos und Sprache extrahiert. Antworte NUR mit validem JSON in diesem Format:
{"events":[{"title":"Terminname","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","location":"Ort oder leer","description":"kurze Beschreibung oder leer","confidence":90}]}

WICHTIG: Wenn der Input KEINE Termine, Kalendereinträge oder Termininfos enthält, antworte NUR mit: {"events":[]}
Erfinde, rate oder halluziniere KEINE Termine. Extrahiere nur was explizit vorhanden ist.

Heute ist ${todayStr} (${todayISO}).
Morgen = ${tomorrowISO}. Übermorgen = ${dayAfterISO}.
- Löse relative Datumsangaben immer auf: "morgen" = ${tomorrowISO}, "heute" = ${todayISO}, "übermorgen" = ${dayAfterISO}
- Wenn kein Jahr angegeben, nehme das nächste mögliche Datum in der Zukunft
- Wenn keine Endzeit angegeben, addiere 1 Stunde zur Startzeit
- Schreibe ALLE Felder auf Deutsch
- Confidence = Sicherheit 0-100
- Für jeden extrahierten Termin: Gib NIEMALS undefined, null oder leere Strings für date/startTime/title zurück`;
  }
}
let i18n = langs[lang];

function applyLang() {
  i18n = langs[lang];
  document.getElementById('lang-de').classList.toggle('active', lang === 'de');
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  const svgText = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
  const svgPhoto = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  const svgVoice = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  document.getElementById('tab-text').innerHTML = svgText + `<span>${i18n.tabText}</span>`;
  document.getElementById('tab-photo').innerHTML = svgPhoto + `<span>${i18n.tabPhoto}</span>`;
  document.getElementById('tab-voice').innerHTML = svgVoice + `<span>${i18n.tabVoice}</span>`;
  document.getElementById('txt-photo-text').innerHTML = i18n.photoText;
  document.querySelector('.btn-main').innerHTML = `<span>✨</span> ${i18n.cta}`;
  document.querySelector('.empty-text').innerHTML = i18n.emptyText;
  document.querySelector('.modal-title').textContent = i18n.modalTitle;
  const labels = document.querySelectorAll('.field label');
  const lkeys = ['labelTitle','labelDate','labelStart','labelEnd','labelLoc','labelDesc'];
  labels.forEach((l,idx) => { if(lkeys[idx]) l.textContent = i18n[lkeys[idx]]; });
  document.querySelector('.btn-save-modal').textContent = i18n.saveBtn;
  updateInputLabel();
  if (events.length) showEvents();
}

function updateInputLabel() {
  const labelMap = { text: i18n.inputLabelText, photo: i18n.inputLabelPhoto, voice: i18n.inputLabelVoice };
  document.getElementById('txt-input-label').textContent = labelMap[mode] || i18n.inputLabelText;
  if (mode === 'text') {
    document.getElementById('text-input').placeholder = i18n.textPlaceholder.replace(/\\n/g,'\n');
  }
}

function setLang(l) {
  lang = l;
  localStorage.setItem('kalenderai_lang', lang);
  document.documentElement.lang = lang;
  document.getElementById('lang-de').classList.toggle('active', lang === 'de');
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  applyLang();
  buildCalMenu();
  if (events.length > 0) {
    const hasText = document.getElementById('text-input').value.trim();
    const hasPhoto = photoB64;
    const hasSpeech = speech;
    if (hasText || hasPhoto || hasSpeech) {
      analyze();
    }
  }
}

// Init
document.documentElement.lang = lang;
buildCalMenu();
document.getElementById('lang-de').classList.toggle('active', lang === 'de');
document.getElementById('lang-en').classList.toggle('active', lang === 'en');
const _t = localStorage.getItem('kalenderai_theme') || 'dark';
document.getElementById('theme-dark').classList.toggle('active', _t === 'dark');
document.getElementById('theme-light').classList.toggle('active', _t === 'light');
applyLang();

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
