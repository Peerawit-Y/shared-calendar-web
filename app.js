// Shared Calendar Web App with Supabase (PostgreSQL & Realtime DB)

// Supabase Client State & Realtime
let supabaseClient = null;
let realtimeChannel = null;

// Get Supabase Configuration (Strictly from Environment Variables or LocalStorage)
function getSupabaseConfig() {
  const envUrl = import.meta.env?.VITE_SUPABASE_URL;
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  const localUrl = localStorage.getItem('supabase_project_url');
  const localKey = localStorage.getItem('supabase_anon_key');

  const url = (localUrl || envUrl || '').trim();
  const key = (localKey || envKey || '').trim();
  return { url, key };
}

// Initialize Supabase Client
function initSupabase() {
  const { url, key } = getSupabaseConfig();
  if (url && key && window.supabase?.createClient) {
    try {
      supabaseClient = window.supabase.createClient(url, key);
      updateDbStatusBadge(true, 'Supabase (กำลังเชื่อมต่อ...)');
      setupSupabaseRealtime();
      return true;
    } catch (e) {
      console.warn('Supabase initialization failed:', e);
      updateDbStatusBadge(false, 'เกิดข้อผิดพลาดในการเริ่มระบบ', 'error');
    }
  } else {
    const missing = [];
    if (!url) missing.push('URL');
    if (!key) missing.push('Anon Key');
    const msg = missing.length > 0 ? `ยังไม่พบ ${missing.join(', ')} (คลิกตั้งค่า)` : 'ออฟไลน์ (คลิกตั้งค่า)';
    updateDbStatusBadge(false, msg, 'warning');
  }
  supabaseClient = null;
  return false;
}

// Update DB Connection Status Badge in Navbar
function updateDbStatusBadge(isConnected, label, statusType = 'normal') {
  const dot = document.getElementById('badgeDbStatusDot');
  const text = document.getElementById('labelDbStatus');
  if (dot) {
    if (isConnected) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    } else if (statusType === 'warning') {
      dot.className = 'w-2 h-2 rounded-full bg-amber-500';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    }
  }
  if (text) {
    text.textContent = label || (isConnected ? '⚡ Supabase ออนไลน์' : 'ออฟไลน์ (คลิกตั้งค่า)');
    if (isConnected) {
      text.className = 'text-emerald-600 font-semibold';
    } else if (statusType === 'warning') {
      text.className = 'text-amber-600 font-medium';
    } else {
      text.className = 'text-rose-500 font-medium';
    }
  }
}

// Setup Supabase Realtime Subscriptions (Broadcasts changes live across all open screens)
function setupSupabaseRealtime() {
  if (!supabaseClient) return;
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabaseClient.channel('db-live-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
      console.log('Realtime tasks update:', payload);
      loadData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_guides' }, (payload) => {
      console.log('Realtime exam guides update:', payload);
      // Reload if not currently active on this document
      if (!currentReadingGuide || payload.new?.id !== currentReadingGuide.id) {
        loadExamGuides();
      }
    })
    .subscribe();
}

// Local Storage Keys for Tasks
const STORAGE_TASKS_KEY = 'shared_calendar_tasks_v2';
const STORAGE_TASKS_INITIALIZED = 'shared_calendar_tasks_init_v2';

function getLocalTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_TASKS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeTask);
    }
  } catch (e) {}
  return null;
}

function saveLocalTasks(tasks) {
  try {
    if (!tasks || !Array.isArray(tasks)) return;
    localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {}
}

// Demo initial tasks (Imported from Google Sheet)
const defaultDemoData = [
  {
    id: "task_1",
    term: "1.2/2569",
    subject: "software",
    title: "สอบ Final วันจันทร์ที่ เวลา 9.30-12.30",
    type: "สอบ",
    due_date: "09/11/2026 09:30",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    id: "task_2",
    term: "1.2/2569",
    subject: "software",
    title: "เขียน BPM โดยใช้ program bizagi",
    type: "การบ้าน",
    due_date: "13/11/2026",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    id: "task_3",
    term: "1.2/2569",
    subject: "software",
    title: "Test plan ส่งวันที่ 07/11/2569 ก่อน 23.59",
    type: "การบ้าน",
    due_date: "07/11/2026",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    id: "task_4",
    term: "1.2/2569",
    subject: "อังกฤษ",
    title: "สอบ EDP",
    type: "สอบ",
    due_date: "12/11/2026",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    id: "task_5",
    term: "1.2/2569",
    subject: "ai",
    title: "สอบ โปรเจคปัญญาประดิษฐ์",
    type: "สอบ",
    due_date: "26/11/2026",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    id: "task_6",
    term: "1.2/2569",
    subject: "software",
    title: "ส่งสมุดท้ายบท 10 บท",
    type: "การบ้าน",
    due_date: "09/11/2026",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    id: "task_7",
    term: "1.2/2569",
    subject: "software",
    title: "ถ่ายคลิป",
    type: "นัดหมาย",
    due_date: "06/11/2026",
    status: "ยกเลิก",
    link: ""
  },
  {
    id: "task_8",
    term: "1.2/2569",
    subject: "AI",
    title: "สอบ AI (แบ่งรอบ เช้า-บ่าย)",
    type: "สอบ",
    due_date: "16/11/2026",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    id: "task_9",
    term: "1.2/2569",
    subject: "software",
    title: "ถ่ายคลิป",
    type: "นัดหมาย",
    due_date: "09/11/2026",
    status: "รอดำเนินการ",
    link: ""
  }
];

// Demo initial sample Exam Guides
const defaultDemoExamGuides = [
  {
    id: "guide_1",
    term: "1.2/2569",
    subject: "software",
    exam_type: "สอบปลายภาค (Final)",
    title: "แนวข้อสอบ Final Software + จุดเน้นข้อเขียน",
    format: "ปรนัย 40 ข้อ (40 คะแนน) • อัตนัย 2 ข้อ (20 คะแนน) • อนุญาตเครื่องคิดเลข FX-991 • ห้ามนำกระดาษทดเข้า",
    scope: "• บทที่ 5: Requirement Engineering (เน้น Use Case & Activity Diagram)\n• บทที่ 6: Agile, Scrum Process & Sprint Lifecycle\n• บทที่ 8: Software Testing (Unit Test, Integration Test, Black-box vs White-box)\n• บทที่ 9: Software Quality Assurance & Metrics",
    tips: "🔥 จุดที่อาจารย์ย้ำในคาบ:\n1. ให้อธิบายความแตกต่างของ Black-box vs White-box Testing ให้ละเอียด (ออกข้อเขียนแน่นอน 10 คะแนน)\n2. ให้ฝึกคำนวณ Cyclomatic Complexity ให้คล่อง\n3. เขียนอธิบายคำตอบแบบเป็นข้อๆ อย่าเขียนยาวเป็นพืด จะได้คะแนนง่ายขึ้น",
    pdf_link: "https://drive.google.com/file/d/1X-demo-sample-preview/view?usp=sharing",
    contributor: "เพื่อน Sec 1",
    created_at: "06/11/2026"
  },
  {
    id: "guide_2",
    term: "1.2/2569",
    subject: "อังกฤษ",
    exam_type: "สอบปลายภาค (Final)",
    title: "สรุปไวยากรณ์สอบ EDP + คำศัพท์ออกบ่อย 50 คำ",
    format: "ปรนัย 100 ข้อ (100 คะแนน) • เวลาสอบ 2 ชั่วโมง • ห้ามนำพจนานุกรมเข้า",
    scope: "• Grammar: Tenses (Present Perfect vs Past Simple), Subject-Verb Agreement\n• Business Email Reading Comprehension (บทความสั้น 3 บทความ)\n• Cloze Test 20 ข้อ เน้น Preposition และ Conjunction",
    tips: "⚠️ เน้นคำศัพท์ใน Unit 3-4 ออกเยอะมาก โดยเฉพาะคำเกี่ยวกับ Business Meeting และ Presentation เช่น adjourn, brainstorm, consensus",
    pdf_link: "",
    contributor: "ตัวแทนวิชา",
    created_at: "05/11/2026"
  },
  {
    id: "guide_3",
    term: "1.2/2569",
    subject: "ai",
    exam_type: "สอบปลายภาค (Final)",
    title: "แนวข้อสอบ & เกณฑ์พรีเซนต์โปรเจกต์ปัญญาประดิษฐ์",
    format: "พรีเซนต์โปรเจกต์กลุ่ม 15 นาที + ตอบคำถามอาจารย์ 5 นาที",
    scope: "• Architecture ของ Model ที่เลือกใช้ (CNN / NLP / Decision Tree)\n• Training & Validation Metrics (Accuracy, Precision, Recall, F1-Score)\n• Live Demonstration ระบบจริง",
    tips: "💡 เตรียมตอบว่าทำไมถึงเลือกใช้ Model นี้ และถ้าเจอปัญหา Overfitting จะมีวิธีแก้อย่างไร",
    pdf_link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    contributor: "Peerawit",
    created_at: "06/11/2026"
  }
];

// App State
let allTasks = [];
let allExamGuides = [];
let activeTab = 'calendar'; // 'calendar' or 'exam-vault'
let currentDetailTask = null;
let currentEditingTask = null;
let currentReadingGuide = null;
let currentEditingGuide = null;
let guideTypeFilter = 'ALL';
let calendar = null;

// Parse date string handling DD/MM/YYYY, YYYY-MM-DD, Buddhist Era (พ.ศ.), and optional time
function parseThaiDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  // 1. Check DD/MM/YYYY or D/M/YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[T\s](\d{1,2})[:\.](\d{2})(?:[:\.](\d{2}))?)?$/);
  if (dmy) {
    let day = parseInt(dmy[1], 10);
    let month = parseInt(dmy[2], 10) - 1;
    let year = parseInt(dmy[3], 10);
    if (year > 2400) year -= 543;

    const hasTime = dmy[4] !== undefined;
    let hours = hasTime ? parseInt(dmy[4], 10) : 0;
    let minutes = hasTime ? parseInt(dmy[5], 10) : 0;
    let seconds = dmy[6] !== undefined ? parseInt(dmy[6], 10) : 0;

    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : { date: d, hasTime: hasTime, hours: hours, minutes: minutes };
  }

  // 2. Check YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2})[:\.](\d{2})(?:[:\.](\d{2}))?)?$/);
  if (ymd) {
    let year = parseInt(ymd[1], 10);
    if (year > 2400) year -= 543;
    let month = parseInt(ymd[2], 10) - 1;
    let day = parseInt(ymd[3], 10);

    const hasTime = ymd[4] !== undefined;
    let hours = hasTime ? parseInt(ymd[4], 10) : 0;
    let minutes = hasTime ? parseInt(ymd[5], 10) : 0;
    let seconds = ymd[6] !== undefined ? parseInt(ymd[6], 10) : 0;

    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : { date: d, hasTime: hasTime, hours: hours, minutes: minutes };
  }

  // 3. Fallback standard parse
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    const hasTime = str.includes(':') || str.includes('T');
    return {
      date: fallback,
      hasTime: hasTime,
      hours: fallback.getHours(),
      minutes: fallback.getMinutes()
    };
  }

  return null;
}

// Format event start string for FullCalendar
function getEventStartString(parsed) {
  if (!parsed || !parsed.date) return '';
  const d = parsed.date;
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  // If time is 23:59 or no time, format as single-day (YYYY-MM-DD) so it never spans across 2 days
  if (parsed.hasTime && !(parsed.hours === 23 && parsed.minutes === 59)) {
    const hours = pad(parsed.hours);
    const mins = pad(parsed.minutes);
    return `${year}-${month}-${day}T${hours}:${mins}:00`;
  }
  return `${year}-${month}-${day}`;
}

// Format for HTML datetime-local input (YYYY-MM-DDTHH:mm)
function formatForDateTimeLocal(parsed, rawStr) {
  if (parsed && parsed.date) {
    const d = parsed.date;
    const pad = (n) => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    return `${y}-${m}-${day}T${hours}:${mins}`;
  }
  if (rawStr && typeof rawStr === 'string' && rawStr.includes('T')) {
    return rawStr.slice(0, 16);
  }
  return '';
}

// Format date into sheet style DD/MM/YYYY or DD/MM/YYYY HH:mm
function formatDateTimeForSheet(dtLocalValue) {
  if (!dtLocalValue) return '';
  const parts = dtLocalValue.split('T');
  const dateParts = parts[0].split('-');
  if (dateParts.length !== 3) return dtLocalValue;
  const d = parseInt(dateParts[2], 10);
  const m = parseInt(dateParts[1], 10);
  const y = dateParts[0];
  const time = parts[1];
  if (time && time !== '00:00' && time !== '23:59') {
    return `${d}/${m}/${y} ${time}`;
  }
  return `${d}/${m}/${y}`;
}

// Convert Google Drive & Direct PDF links to In-App Embedded Preview URL
function convertToEmbedUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();

  // 1. Google Drive Links: e.g. https://drive.google.com/file/d/{ID}/view...
  const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }
  const driveIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    return `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`;
  }

  // 2. Direct PDF link
  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`;
  }

  // 3. Already preview / embed or standard URL
  if (trimmed.includes('/preview') || trimmed.includes('/embed')) {
    return trimmed;
  }

  return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`;
}

// Normalize task object
function normalizeTask(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const getProp = (candidates) => {
    for (const c of candidates) {
      if (raw[c] !== undefined && raw[c] !== null && raw[c] !== '') return String(raw[c]).trim();
      const target = c.toLowerCase().replace(/[\s_-]+/g, '');
      const found = Object.keys(raw).find(k => k.toLowerCase().replace(/[\s_-]+/g, '') === target);
      if (found && raw[found] !== undefined && raw[found] !== null && raw[found] !== '') {
        return String(raw[found]).trim();
      }
    }
    return '';
  };

  let rawDate = getProp(['due_date', 'dueDate', 'Due Date', 'DueDate', 'Date', 'date']);
  // Clean trailing 23:59 if it was automatically appended previously
  if (rawDate && (rawDate.endsWith(' 23:59') || rawDate.endsWith(' 23:59:00'))) {
    rawDate = rawDate.replace(/\s+23:59(?::00)?$/, '');
  }

  const parsedDate = parseThaiDate(rawDate);

  return {
    id: raw.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    term: getProp(['term', 'Term']),
    subject: getProp(['subject', 'Subject', 'วิชา', 'ชื่อวิชา', 'course', 'Course']),
    title: getProp(['title', 'Title', 'name', 'Name']),
    type: getProp(['type', 'Type', 'category']),
    due_date: rawDate,
    parsedDate: parsedDate,
    eventStart: getEventStartString(parsedDate),
    status: getProp(['status', 'Status']) || 'รอดำเนินการ',
    link: getProp(['link', 'Link', 'URL', 'Url']),
    raw: raw
  };
}

// Normalize Exam Guide object
function normalizeExamGuide(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const getProp = (candidates) => {
    for (const c of candidates) {
      if (raw[c] !== undefined && raw[c] !== null && raw[c] !== '') return String(raw[c]).trim();
      const target = c.toLowerCase().replace(/[\s_-]+/g, '');
      const found = Object.keys(raw).find(k => k.toLowerCase().replace(/[\s_-]+/g, '') === target);
      if (found && raw[found] !== undefined && raw[found] !== null && raw[found] !== '') {
        return String(raw[found]).trim();
      }
    }
    return '';
  };

  const contentHtml = getProp(['content_html', 'contentHtml', 'html', 'HTML', 'body', 'Body']);
  const rawScope = getProp(['scope', 'Scope', 'ขอบเขต', 'เนื้อหา']);
  const rawPages = raw.pages && Array.isArray(raw.pages) ? raw.pages : null;

  return {
    id: getProp(['id', 'ID']) || `guide_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    term: getProp(['term', 'Term']),
    subject: getProp(['subject', 'Subject', 'วิชา', 'ชื่อวิชา']),
    exam_type: getProp(['exam_type', 'ExamType', 'Exam Type', 'type', 'Type']) || 'สอบปลายภาค (Final)',
    title: getProp(['title', 'Title', 'หัวข้อ', 'ชื่องาน']),
    format: getProp(['format', 'Format', 'รูปแบบ', 'กติกา']),
    scope: rawScope,
    tips: getProp(['tips', 'Tips', 'จุดเน้น', 'ข้อควรระวัง']),
    pdf_link: getProp(['pdf_link', 'PdfLink', 'PDF', 'Link', 'link', 'DriveUrl']),
    contributor: getProp(['contributor', 'Contributor', 'ผู้แชร์']) || 'เพื่อนร่วมชั้น',
    created_at: getProp(['created_at', 'CreatedAt', 'Date', 'date']) || new Date().toLocaleDateString('th-TH'),
    content_html: contentHtml || (rawScope && (rawScope.includes('<') || rawScope.includes('<!-- PAGE_BREAK -->')) ? rawScope : ''),
    pages: rawPages
  };
}

// Helpers for type and status mapping
function getTypeMeta(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('สอบ') || t.includes('exam')) {
    return { color: '#ef4444', badgeClass: 'bg-rose-100 text-rose-700' };
  }
  if (t.includes('การบ้าน') || t.includes('assignment') || t.includes('homework') || t.includes('essay')) {
    return { color: '#f59e0b', badgeClass: 'bg-amber-100 text-amber-700' };
  }
  if (t.includes('โปรเจกต์') || t.includes('project') || t.includes('lab') || t.includes('presentation')) {
    return { color: '#a855f7', badgeClass: 'bg-purple-100 text-purple-700' };
  }
  if (t.includes('นัดหมาย') || t.includes('meeting')) {
    return { color: '#0ea5e9', badgeClass: 'bg-sky-100 text-sky-700' };
  }
  return { color: '#6366f1', badgeClass: 'bg-indigo-100 text-indigo-700' };
}

function isCompleted(status) {
  const s = (status || '').toLowerCase();
  return s.includes('ส่งแล้ว') || s.includes('เสร็จ') || s.includes('completed') || s.includes('done');
}

function isCancelled(status) {
  const s = (status || '').toLowerCase();
  return s.includes('ยกเลิก') || s.includes('cancel');
}

function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (isCancelled(s)) return 'bg-slate-100 text-slate-500 font-medium border border-slate-200 line-through';
  if (isCompleted(s)) return 'bg-emerald-100 text-emerald-700 font-semibold';
  if (s.includes('กำลัง') || s.includes('in progress')) return 'bg-sky-100 text-sky-700';
  return 'bg-amber-100 text-amber-700';
}

// Calculate D-Day Countdown
function calculateCountdown(dueDateInfo, status) {
  if (isCancelled(status)) {
    return `<span class="text-xs font-semibold text-slate-400 line-through">⛔ ยกเลิกแล้ว</span>`;
  }
  if (isCompleted(status)) {
    return `<span class="text-xs font-semibold text-emerald-600">✅ เสร็จแล้ว</span>`;
  }
  if (!dueDateInfo || !dueDateInfo.date) return '-';

  const due = dueDateInfo.date;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const dueMidnight = new Date(due);
  dueMidnight.setHours(0, 0, 0, 0);

  const diffDays = Math.round((dueMidnight - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `<span class="text-xs font-semibold text-rose-600">⚠️ เลยกำหนด (${Math.abs(diffDays)} วัน)</span>`;
  } else if (diffDays === 0) {
    return `<span class="text-xs font-bold text-amber-600 animate-pulse">🔥 วันนี้!</span>`;
  } else if (diffDays <= 3) {
    return `<span class="text-xs font-semibold text-rose-500">⏳ อีก ${diffDays} วัน</span>`;
  } else {
    return `<span class="text-xs text-slate-500">อีก ${diffDays} วัน</span>`;
  }
}

// Format Thai Date
function formatThaiDateTime(dueDateInfo, rawFallback) {
  if (!dueDateInfo || !dueDateInfo.date) return rawFallback || '-';
  const d = dueDateInfo.date;

  const datePart = d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  });

  if (!dueDateInfo.hasTime || (dueDateInfo.hours === 23 && dueDateInfo.minutes === 59)) {
    return datePart;
  }

  const timePart = d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${datePart} ${timePart} น.`;
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initCalendar();
  initEventListeners();
  initSupabase();
  loadData();
  loadExamGuides();
});

// Tab Switcher logic
function switchTab(tabName) {
  activeTab = tabName;
  const tabCalBtn = document.getElementById('navTabCalendar');
  const tabVaultBtn = document.getElementById('navTabExamVault');
  const secCal = document.getElementById('sectionCalendar');
  const secVault = document.getElementById('sectionExamVault');
  const btnAddCal = document.getElementById('btnOpenAddModal');
  const btnAddGuide = document.getElementById('btnOpenAddGuideModal');
  const btnNavbarCreateDoc = document.getElementById('btnNavbarCreateWordDoc');

  if (tabName === 'calendar') {
    tabCalBtn.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-indigo-600 shadow-sm transition";
    tabVaultBtn.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 transition";
    secCal.classList.remove('hidden');
    secVault.classList.add('hidden');
    btnAddCal?.classList.remove('hidden');
    btnAddGuide?.classList.add('hidden');
    btnNavbarCreateDoc?.classList.add('hidden');
    setTimeout(() => {
      if (calendar) calendar.render();
    }, 50);
  } else {
    tabCalBtn.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 transition";
    tabVaultBtn.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-purple-600 shadow-sm transition";
    secCal.classList.add('hidden');
    secVault.classList.remove('hidden');
    btnAddCal?.classList.add('hidden');
    btnAddGuide?.classList.remove('hidden');
    btnNavbarCreateDoc?.classList.remove('hidden');
    renderExamGuides();
  }
  lucide.createIcons();
}

// FullCalendar Setup
function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth',
    eventDisplay: 'block',
    nextDayThreshold: '09:00:00',
    defaultTimedEventDuration: '00:00:00',
    forceEventDuration: false,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listMonth'
    },
    locale: 'th',
    buttonText: {
      today: 'วันนี้',
      month: 'เดือน',
      week: 'สัปดาห์',
      list: 'รายการ'
    },
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      omitZeroMinute: false
    },
    height: 'auto',
    eventClick: function(info) {
      showEventDetails(info.event.extendedProps);
    }
  });

  calendar.render();

  window.addEventListener('resize', () => {
    if (window.innerWidth < 768 && calendar.view.type === 'dayGridMonth') {
      calendar.changeView('listMonth');
    }
  });
}

// Data Sanitizers for PostgreSQL (Strict lowercase schema mapping)
function formatTaskForSupabase(raw) {
  if (!raw) return {};
  return {
    id: String(raw.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
    term: String(raw.term || raw.Term || ''),
    subject: String(raw.subject || raw.Subject || ''),
    title: String(raw.title || raw.Title || ''),
    type: String(raw.type || raw.Type || 'การบ้าน'),
    due_date: String(raw.due_date || raw['Due Date'] || raw.dueDate || ''),
    status: String(raw.status || raw.Status || 'รอดำเนินการ'),
    link: String(raw.link || raw.Link || '')
  };
}

function formatGuideForSupabase(raw) {
  if (!raw) return {};
  const pages = Array.isArray(raw.pages) ? raw.pages : (raw.content_html ? raw.content_html.split('<!-- PAGE_BREAK -->') : (raw.scope ? [raw.scope] : []));
  const contentHtml = raw.content_html || pages.join('<!-- PAGE_BREAK -->') || raw.scope || '';
  return {
    id: String(raw.id || `guide_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
    term: String(raw.term || raw.Term || ''),
    subject: String(raw.subject || raw.Subject || 'วิชาใหม่'),
    exam_type: String(raw.exam_type || raw.ExamType || 'สรุปบทเรียน & แนวข้อสอบ'),
    title: String(raw.title || raw.Title || 'เอกสารสรุปบทเรียน (หน้าใหม่)'),
    format: String(raw.format || raw.Format || ''),
    scope: String(raw.scope || raw.Scope || contentHtml || ''),
    tips: String(raw.tips || raw.Tips || ''),
    pdf_link: String(raw.pdf_link || raw.PdfLink || ''),
    contributor: String(raw.contributor || raw.Contributor || 'ฉันเอง'),
    content_html: String(contentHtml),
    pages: pages,
    created_at: String(raw.created_at || raw.CreatedAt || new Date().toLocaleDateString('th-TH'))
  };
}

// Auto-seed helpers: Automatically populate empty Supabase tables from current local data
async function autoSeedTasksToCloud(tasks) {
  if (!supabaseClient || !Array.isArray(tasks) || tasks.length === 0) return;
  try {
    const payload = tasks.map(formatTaskForSupabase);
    const { error } = await supabaseClient.from('tasks').upsert(payload);
    if (!error) {
      console.log('Auto-seeded tasks to Supabase Cloud successfully');
    }
  } catch (err) {
    console.warn('Auto-seed tasks to Cloud failed:', err);
  }
}

async function autoSeedExamGuidesToCloud(guides) {
  if (!supabaseClient || !Array.isArray(guides) || guides.length === 0) return;
  try {
    const payload = guides.map(formatGuideForSupabase);
    const { error } = await supabaseClient.from('exam_guides').upsert(payload);
    if (!error) {
      console.log('Auto-seeded exam_guides to Supabase Cloud successfully');
    }
  } catch (err) {
    console.warn('Auto-seed exam_guides to Cloud failed:', err);
  }
}

// Fetch Tasks (From Supabase with Local Storage Cache)
async function loadData() {
  const refreshIcon = document.getElementById('refreshIcon');
  refreshIcon?.classList.add('animate-spin');

  // STEP 1: Immediately render from LocalStorage! (Instant 0s load)
  const localTasks = getLocalTasks();
  if (localTasks !== null) {
    const hasOldMock = localTasks.some(t => t.subject === 'CS101' || t.term === '1/2569');
    if (hasOldMock) {
      allTasks = defaultDemoData.map(normalizeTask);
      saveLocalTasks(allTasks);
    } else {
      allTasks = localTasks;
    }
    renderAllViews();
  }

  // STEP 2: Supabase Priority (Fast, Realtime, No Quota Limit)
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('tasks').select('*');
      if (error) {
        console.warn('Supabase tasks load error:', error);
        updateDbStatusBadge(false, error.message?.includes('does not exist') ? 'ยังไม่ได้รัน SQL Schema' : 'เชื่อมต่อ Supabase ล้มเหลว', 'error');
      } else if (Array.isArray(data)) {
        updateDbStatusBadge(true, '⚡ Supabase ออนไลน์');
        if (data.length === 0 && allTasks.length > 0) {
          await autoSeedTasksToCloud(allTasks);
        } else if (data.length > 0) {
          allTasks = data.map(normalizeTask);
          saveLocalTasks(allTasks);
        }
        renderAllViews();
        refreshIcon?.classList.remove('animate-spin');
        return;
      }
    } catch (e) {
      console.warn('Supabase tasks load error:', e);
      updateDbStatusBadge(false, 'เชื่อมต่อ Supabase ล้มเหลว', 'error');
    }
  }

  // STEP 3: Fallback only if app has NEVER been initialized
  const isTasksInit = localStorage.getItem(STORAGE_TASKS_INITIALIZED);
  if (!isTasksInit && (!allTasks || allTasks.length === 0)) {
    allTasks = defaultDemoData.map(normalizeTask);
    saveLocalTasks(allTasks);
    localStorage.setItem(STORAGE_TASKS_INITIALIZED, 'true');
    renderAllViews();
  }

  refreshIcon?.classList.remove('animate-spin');
}

// Local-First Storage Keys
const STORAGE_EXAM_GUIDES_KEY = 'shared_calendar_exam_guides_v2';
const STORAGE_ACTIVE_DOC_KEY = 'shared_calendar_active_doc_v2';
const STORAGE_DELETED_GUIDES_KEY = 'shared_calendar_deleted_guide_ids_v2';
const STORAGE_GUIDES_INITIALIZED = 'shared_calendar_guides_init_v2';

// Tombstone Helpers: Never resurrect deleted guides on refresh!
function getDeletedGuideIds() {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_GUIDES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markGuideAsDeleted(id) {
  if (!id) return;
  try {
    const list = getDeletedGuideIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(STORAGE_DELETED_GUIDES_KEY, JSON.stringify(list));
    }
  } catch (e) {}
}

// Clean HTML to avoid bloating and staying well below Google Sheets 50,000 char cell limit
function cleanHtmlForStorage(html) {
  if (!html) return '';
  let s = html;

  // 1. Convert Lucide SVGs back to lightweight <i> tags
  s = s.replace(/<svg[^>]*data-lucide="([^"]+)"[^>]*>[\s\S]*?<\/svg>/gi, '<i data-lucide="$1"></i>');
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // 2. Strip Tailwind CSS variable garbage and browser paste garbage
  s = s.replace(/--tw-[^;]+;?/gi, '');
  s = s.replace(/--[a-zA-Z0-9_-]+:[^;]+;?/gi, '');
  s = s.replace(/line-height:\s*1\.15\s*!important;?/gi, '');
  s = s.replace(/margin-(top|bottom|left|right):\s*0px\s*!important;?/gi, '');
  s = s.replace(/font-family:\s*[^;]+!important;?/gi, '');

  // 3. Remove useless font wrappers from Google Docs
  s = s.replace(/<font[^>]*>/gi, '').replace(/<\/font>/gi, '');

  // 4. Remove empty style attributes and paste metadata
  s = s.replace(/\s*style="\s*"/gi, '');
  s = s.replace(/\s*dir="ltr"/gi, '');
  s = s.replace(/\s*data-path-to-node="[^"]*"/gi, '');
  s = s.replace(/\s*data-index-in-node="[^"]*"/gi, '');

  // 5. Clean up redundant spaces
  s = s.replace(/\s{2,}/g, ' ');

  return s.trim();
}

// LocalStorage Helpers (Guarantees zero data loss even if SheetDB is full/offline)
function getLocalExamGuides() {
  try {
    const raw = localStorage.getItem(STORAGE_EXAM_GUIDES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deletedIds = getDeletedGuideIds();
        return parsed.filter(g => !deletedIds.includes(g.id)).map(normalizeExamGuide);
      }
    }
  } catch (e) {
    console.warn('LocalStorage read error:', e);
  }
  return null;
}

function saveLocalExamGuides(guides) {
  try {
    if (!guides || !Array.isArray(guides)) return;
    localStorage.setItem(STORAGE_EXAM_GUIDES_KEY, JSON.stringify(guides));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

// Smart Merge: Remote data will NEVER overwrite local unsaved changes or active typing!
function mergeLocalAndRemoteGuides(localList, remoteList) {
  const deletedIds = getDeletedGuideIds();
  const filteredRemote = (remoteList || []).filter(rem => !deletedIds.includes(rem.id));
  const filteredLocal = (localList || []).filter(loc => !deletedIds.includes(loc.id));

  if (filteredRemote.length === 0) return filteredLocal;
  if (filteredLocal.length === 0) return filteredRemote;

  // Remote (Cloud) is the primary source of truth
  const remoteMap = new Map(filteredRemote.map(g => [g.id, g]));
  const merged = filteredRemote.map(rem => {
    const local = filteredLocal.find(l => l.id === rem.id);
    if (!local) return rem;
    // Protect local version if currently being edited or has unsaved edits
    const isCurrentlyOpen = currentReadingGuide && currentReadingGuide.id === local.id;
    if (isCurrentlyOpen || local._unsaved) {
      return local;
    }
    return {
      ...rem,
      pages: rem.pages || (rem.content_html ? rem.content_html.split('<!-- PAGE_BREAK -->') : local.pages)
    };
  });

  // Keep any brand new local drafts that haven't been pushed to cloud yet
  filteredLocal.forEach(loc => {
    if (!remoteMap.has(loc.id)) {
      merged.unshift(loc);
    }
  });

  return merged;
}

// Fetch Exam Guides (Local-First + Supabase)
async function loadExamGuides() {
  const badge = document.getElementById('badgeGuideCount');

  // STEP 1: Immediately render from LocalStorage! (Instant load, 0s delay, never loses text)
  const localCached = getLocalExamGuides();
  if (localCached !== null) {
    allExamGuides = localCached;
    if (badge) badge.textContent = allExamGuides.length;
    updateExamGuideFilterDropdowns();
    renderExamGuides();
    renderSidebarGuideList();
  }

  // STEP 2: Supabase Cloud Sync (Fast, Realtime, No Quota Limit)
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('exam_guides').select('*');
      if (!error && Array.isArray(data)) {
        if (data.length === 0 && allExamGuides.length > 0) {
          // Cloud table is empty! Auto-upload current local guides to Cloud so friends receive them!
          await autoSeedExamGuidesToCloud(allExamGuides);
        } else if (data.length > 0) {
          // Cloud has data: Cloud IS the single source of truth for all users!
          const normalizedRemote = data.map(normalizeExamGuide);
          allExamGuides = mergeLocalAndRemoteGuides(allExamGuides, normalizedRemote);
          saveLocalExamGuides(allExamGuides);
        }

        if (badge) badge.textContent = allExamGuides.length;
        updateExamGuideFilterDropdowns();
        renderExamGuides();
        renderSidebarGuideList();
        return;
      }
    } catch (e) {
      console.warn('Supabase exam guides sync error:', e);
    }
  }

  // STEP 3: Fallback only if app has NEVER been initialized
  const isGuidesInit = localStorage.getItem(STORAGE_GUIDES_INITIALIZED);
  if (!isGuidesInit && (!allExamGuides || allExamGuides.length === 0)) {
    const deletedIds = getDeletedGuideIds();
    allExamGuides = defaultDemoExamGuides.filter(g => !deletedIds.includes(g.id)).map(normalizeExamGuide);
    saveLocalExamGuides(allExamGuides);
    localStorage.setItem(STORAGE_GUIDES_INITIALIZED, 'true');
  }

  if (badge) badge.textContent = allExamGuides.length;
  updateExamGuideFilterDropdowns();
  renderExamGuides();
  renderSidebarGuideList();
}

// Render Calendar and Table based on current filters
function renderAllViews() {
  updateFilterDropdowns();
  renderFiltered();
}

function renderFiltered() {
  const selectedTerm = document.getElementById('filterTerm').value;
  const selectedSubject = document.getElementById('filterSubject')?.value || 'ALL';
  const selectedType = document.getElementById('filterType').value;
  const hideCancelled = document.getElementById('hideCancelled')?.checked;

  const filtered = allTasks.filter(item => {
    if (hideCancelled && isCancelled(item.status)) return false;
    const matchTerm = (selectedTerm === 'ALL' || item.term === selectedTerm);
    const matchSubject = (selectedSubject === 'ALL' || item.subject === selectedSubject);
    const matchType = (selectedType === 'ALL' || item.type === selectedType);
    return matchTerm && matchSubject && matchType;
  });

  // 1. Update Calendar Events
  calendar.removeAllEvents();
  const events = filtered.map(item => {
    const cancelled = isCancelled(item.status);
    let color = cancelled
      ? '#94a3b8'
      : (isCompleted(item.status) ? '#10b981' : getTypeMeta(item.type).color);

    const prefix = cancelled ? '❌ [ยกเลิก] ' : (item.subject ? `[${item.subject}] ` : '');

    // Check if event has a specific time or is all-day/end-of-day deadline
    const isDeadline2359 = item.parsedDate?.hasTime && item.parsedDate?.hours === 23 && item.parsedDate?.minutes === 59;
    const isAllDay = !item.parsedDate?.hasTime || isDeadline2359;

    let start = item.eventStart || item.due_date;
    if (isAllDay && item.parsedDate?.date) {
      const d = item.parsedDate.date;
      const pad = (n) => String(n).padStart(2, '0');
      start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    let end = undefined;
    if (!isAllDay && item.parsedDate?.date) {
      const d = item.parsedDate.date;
      const pad = (n) => String(n).padStart(2, '0');
      const y = d.getFullYear();
      const m = pad(d.getMonth() + 1);
      const day = pad(d.getDate());

      // Check if title mentions a time range like "9.30-12.30"
      const rangeMatch = item.title?.match(/(\d{1,2})[\.:](\d{2})\s*[-–至to]\s*(\d{1,2})[\.:](\d{2})/i);
      if (rangeMatch) {
        const endH = pad(parseInt(rangeMatch[3], 10));
        const endM = pad(parseInt(rangeMatch[4], 10));
        end = `${y}-${m}-${day}T${endH}:${endM}:00`;
      } else {
        // Safe end within the same day so it never crosses midnight
        const endH = Math.min(d.getHours() + 1, 23);
        const endM = endH === 23 ? 59 : d.getMinutes();
        end = `${y}-${m}-${day}T${pad(endH)}:${pad(endM)}:00`;
      }
    }

    return {
      title: `${prefix}${item.title}`,
      start: start,
      end: end,
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      classNames: cancelled ? ['opacity-60', 'line-through'] : [],
      extendedProps: item
    };
  });

  calendar.addEventSource(events);

  // 2. Update Table View
  renderTable(filtered);
}

// Render Upcoming Table
function renderTable(tasks) {
  const tbody = document.getElementById('taskTableBody');
  const countEl = document.getElementById('taskCount');
  tbody.innerHTML = '';

  countEl.textContent = `${tasks.length} รายการ`;

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          ยังไม่มีรายการงานในหมวดนี้
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  // Sort by due_date ascending
  const sorted = [...tasks].sort((a, b) => {
    const timeA = a.parsedDate?.date ? a.parsedDate.date.getTime() : 9999999999999;
    const timeB = b.parsedDate?.date ? b.parsedDate.date.getTime() : 9999999999999;
    return timeA - timeB;
  });

  sorted.forEach((t, idx) => {
    const tr = document.createElement('tr');
    const cancelled = isCancelled(t.status);
    tr.className = cancelled
      ? 'opacity-60 bg-slate-50/70 hover:bg-slate-100/70 transition border-b border-slate-100'
      : 'hover:bg-slate-50 transition border-b border-slate-100';

    const typeMeta = getTypeMeta(t.type);
    const statusClass = getStatusBadgeClass(t.status);
    const countdown = calculateCountdown(t.parsedDate, t.status);
    const formattedDate = formatThaiDateTime(t.parsedDate, t.due_date);
    const subjectBadge = t.subject
      ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">${t.subject}</span>`
      : `<span class="text-slate-400 text-xs">-</span>`;

    const titleHtml = cancelled
      ? `<span class="font-medium text-slate-400 line-through">${t.title}</span>`
      : `<span class="font-medium text-slate-800">${t.title}</span>`;

    tr.innerHTML = `
      <td class="px-4 py-3 font-medium text-slate-600">${t.term || '-'}</td>
      <td class="px-4 py-3">${subjectBadge}</td>
      <td class="px-4 py-3">${titleHtml}</td>
      <td class="px-4 py-3">
        <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${typeMeta.badgeClass}">${t.type || '-'}</span>
      </td>
      <td class="px-4 py-3 text-slate-600">${formattedDate}</td>
      <td class="px-4 py-3">${countdown}</td>
      <td class="px-4 py-3">
        <span class="px-2.5 py-0.5 rounded-full text-xs ${statusClass}">${t.status || '-'}</span>
      </td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end space-x-1">
          ${t.link ? `<a href="${t.link.startsWith('http') ? t.link : 'https://' + t.link}" target="_blank" rel="noopener noreferrer" title="เปิดเอกสาร" class="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"><i data-lucide="external-link" class="w-4 h-4"></i></a>` : ''}
          <button data-task-idx="${idx}" class="btn-edit-task p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="แก้ไขงาน">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-edit-task').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskIndex = parseInt(btn.getAttribute('data-task-idx'), 10);
      const targetTask = sorted[taskIndex];
      openEditModal(targetTask);
    });
  });

  lucide.createIcons();
}

// Populate Term and Subject Dropdowns for Calendar
function updateFilterDropdowns() {
  const termSelect = document.getElementById('filterTerm');
  const currentTerm = termSelect.value;
  const terms = Array.from(new Set(allTasks.map(t => t.term).filter(Boolean)));

  termSelect.innerHTML = `<option value="ALL">ทุกเทอม (All)</option>`;
  terms.forEach(term => {
    const opt = document.createElement('option');
    opt.value = term;
    opt.textContent = `เทอม ${term}`;
    termSelect.appendChild(opt);
  });
  if (terms.includes(currentTerm)) termSelect.value = currentTerm;

  const subjectSelect = document.getElementById('filterSubject');
  if (subjectSelect) {
    const currentSubject = subjectSelect.value;
    const subjects = Array.from(new Set(allTasks.map(t => t.subject).filter(Boolean)));

    subjectSelect.innerHTML = `<option value="ALL">ทุกวิชา (All)</option>`;
    subjects.forEach(subject => {
      const opt = document.createElement('option');
      opt.value = subject;
      opt.textContent = subject;
      subjectSelect.appendChild(opt);
    });
    if (subjects.includes(currentSubject)) subjectSelect.value = currentSubject;
  }
}

// Populate Term and Subject Dropdowns for Exam Vault
function updateExamGuideFilterDropdowns() {
  const termSelect = document.getElementById('filterGuideTerm');
  const currentTerm = termSelect.value;
  const terms = Array.from(new Set(allExamGuides.map(g => g.term).filter(Boolean)));

  termSelect.innerHTML = `<option value="ALL">ทุกเทอม (All Terms)</option>`;
  terms.forEach(term => {
    const opt = document.createElement('option');
    opt.value = term;
    opt.textContent = `เทอม ${term}`;
    termSelect.appendChild(opt);
  });
  if (terms.includes(currentTerm)) termSelect.value = currentTerm;

  const subjectSelect = document.getElementById('filterGuideSubject');
  const currentSubject = subjectSelect.value;
  const subjects = Array.from(new Set(allExamGuides.map(g => g.subject).filter(Boolean)));

  subjectSelect.innerHTML = `<option value="ALL">ทุกวิชา (All Subjects)</option>`;
  subjects.forEach(subj => {
    const opt = document.createElement('option');
    opt.value = subj;
    opt.textContent = subj;
    subjectSelect.appendChild(opt);
  });
  if (subjects.includes(currentSubject)) subjectSelect.value = currentSubject;
}

// Render Exam Guides Grid View
function renderExamGuides() {
  const grid = document.getElementById('examGuideGrid');
  const emptyState = document.getElementById('examGuideEmpty');
  const search = (document.getElementById('filterGuideSearch')?.value || '').toLowerCase().trim();
  const selectedTerm = document.getElementById('filterGuideTerm')?.value || 'ALL';
  const selectedSubject = document.getElementById('filterGuideSubject')?.value || 'ALL';

  grid.innerHTML = '';

  const filtered = allExamGuides.filter(g => {
    const matchTerm = (selectedTerm === 'ALL' || g.term === selectedTerm);
    const matchSubject = (selectedSubject === 'ALL' || g.subject === selectedSubject);

    // Format type filter
    const hasPdf = Boolean(g.pdf_link && g.pdf_link.trim() !== '');
    const hasText = Boolean(g.scope && g.scope.trim() !== '' || g.tips && g.tips.trim() !== '');

    let matchType = true;
    if (guideTypeFilter === 'HYBRID') matchType = hasPdf && hasText;
    else if (guideTypeFilter === 'TEXT_ONLY') matchType = hasText && !hasPdf;
    else if (guideTypeFilter === 'PDF_ONLY') matchType = hasPdf;

    // Search query
    const textPool = `${g.title} ${g.subject} ${g.term} ${g.format} ${g.scope} ${g.tips} ${g.contributor}`.toLowerCase();
    const matchSearch = !search || textPool.includes(search);

    return matchTerm && matchSubject && matchType && matchSearch;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  filtered.forEach(guide => {
    const hasPdf = Boolean(guide.pdf_link && guide.pdf_link.trim() !== '');
    const hasText = Boolean(guide.scope && guide.scope.trim() !== '');

    let badgeTypeHtml = '';
    if (hasPdf && hasText) {
      badgeTypeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">✨ สรุปย่อ + PDF</span>`;
    } else if (hasPdf) {
      badgeTypeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">📄 มีชีท PDF</span>`;
    } else {
      badgeTypeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">📝 เขียนสรุป</span>`;
    }

    const card = document.createElement('div');
    card.className = "bg-white rounded-2xl border border-slate-200/90 hover:border-purple-300 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group";

    card.innerHTML = `
      <div class="space-y-3">
        <!-- Badges Bar -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">${guide.subject || '-'}</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">${guide.term || '-'}</span>
          </div>
          ${badgeTypeHtml}
        </div>

        <!-- Title -->
        <div>
          <span class="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">${guide.exam_type}</span>
          <h3 class="text-base font-bold text-slate-900 group-hover:text-purple-700 transition line-clamp-2 mt-0.5">${guide.title}</h3>
        </div>

        <!-- Format Snippet -->
        ${guide.format ? `
          <div class="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs text-slate-700">
            <span class="font-bold text-slate-900">📋 กติกา:</span> ${guide.format}
          </div>
        ` : ''}

        <!-- Scope Snippet -->
        ${guide.scope ? `
          <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            <span class="font-semibold text-slate-800">🎯 ขอบเขต:</span> ${guide.scope.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
          </p>
        ` : ''}
      </div>

      <!-- Card Footer -->
      <div class="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
        <span class="text-[11px] text-slate-400 truncate">โดย: ${guide.contributor || 'เพื่อน'}</span>
        <div class="flex items-center gap-1.5">
          <button class="btn-delete-guide-card p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="ลบแนวข้อสอบนี้">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
          <button class="btn-open-read-guide inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white font-semibold rounded-xl text-xs transition shadow-2xs">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
            <span>เปิดอ่านแนวข้อสอบ</span>
          </button>
        </div>
      </div>
    `;

    card.querySelector('.btn-delete-guide-card')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteGuideById(guide.id, guide.title);
    });

    card.querySelector('.btn-open-read-guide').addEventListener('click', () => {
      openReadGuideModal(guide);
    });

    grid.appendChild(card);
  });

  lucide.createIcons();
}

// Switch between A4 Sheet view and PDF view inside Reader
function setA4ViewMode(mode) {
  const btnA4 = document.getElementById('btnViewModeA4');
  const btnPdf = document.getElementById('btnViewModePdf');
  const secA4 = document.getElementById('viewA4SheetContainer');
  const secPdf = document.getElementById('viewPdfContainer');

  if (mode === 'pdf') {
    btnPdf.className = "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 text-white shadow-xs transition";
    btnA4.className = "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition";
    secA4.classList.add('hidden');
    secPdf.classList.remove('hidden');
  } else {
    btnA4.className = "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 text-white shadow-xs transition";
    btnPdf.className = "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition";
    secA4.classList.remove('hidden');
    secPdf.classList.add('hidden');
  }
}

// Render the 25% Left Sidebar Guide List in Fullscreen Workspace
function renderSidebarGuideList() {
  const container = document.getElementById('sidebarGuideList');
  if (!container) return;

  const searchQuery = (document.getElementById('sidebarGuideSearch')?.value || '').toLowerCase().trim();
  const countBadge = document.getElementById('sidebarCountBadge');

  const filtered = allExamGuides.filter(g => {
    if (!searchQuery) return true;
    const pool = `${g.title} ${g.subject} ${g.term} ${g.exam_type}`.toLowerCase();
    return pool.includes(searchQuery);
  });

  if (countBadge) countBadge.textContent = `${filtered.length} ชุด`;
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500 text-xs">
        <p>ไม่พบวิชาที่ค้นหา</p>
      </div>
    `;
    return;
  }

  filtered.forEach(g => {
    const isActive = currentReadingGuide && currentReadingGuide.id === g.id;
    const btn = document.createElement('button');
    btn.className = `w-full text-left p-3 rounded-xl transition flex flex-col gap-1.5 border ${
      isActive 
        ? 'bg-purple-950/60 border-purple-500 text-white shadow-sm' 
        : 'bg-slate-800/40 hover:bg-slate-800 border-slate-800 text-slate-300'
    }`;

    const hasPdf = Boolean(g.pdf_link && g.pdf_link.trim() !== '');
    const hasText = Boolean(g.scope && g.scope.trim() !== '');
    let tag = '';
    if (hasPdf && hasText) tag = '<span class="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-medium">✨ A4+PDF</span>';
    else if (hasPdf) tag = '<span class="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-medium">📄 PDF</span>';
    else tag = '<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">📝 A4</span>';

    btn.innerHTML = `
      <div class="flex items-center justify-between gap-1 w-full">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          isActive ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'
        }">${g.subject || '-'}</span>
        ${tag}
      </div>
      <h4 class="text-xs font-bold leading-snug line-clamp-2 ${isActive ? 'text-white' : 'text-slate-200'}">${g.title}</h4>
      <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
        <span>${g.term || '-'}</span>
        <span>•</span>
        <span class="truncate">${g.exam_type}</span>
      </div>
    `;

    btn.addEventListener('click', () => {
      openReadGuideModal(g);
    });

    container.appendChild(btn);
  });
}

// Word Document State & Theme
let currentWordTheme = 'white';
let isWordSidebarVisible = true;

// Apply Paper Theme to all Word pages
function applyWordTheme(theme) {
  currentWordTheme = theme || 'white';
  const pages = document.querySelectorAll('.word-page');
  pages.forEach(p => {
    p.classList.remove('word-theme-white', 'word-theme-warm', 'word-theme-ruled', 'word-theme-dark');
    p.classList.add(`word-theme-${currentWordTheme}`);
  });
  const themeSelect = document.getElementById('selectWordTheme');
  if (themeSelect && themeSelect.value !== currentWordTheme) {
    themeSelect.value = currentWordTheme;
  }
}

// Toggle Distraction-free Sidebar
function toggleWordSidebar() {
  const sidebar = document.getElementById('wordSidebarAside');
  const icon = document.getElementById('iconWordSidebar');
  if (!sidebar) return;

  isWordSidebarVisible = !isWordSidebarVisible;
  if (isWordSidebarVisible) {
    sidebar.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'panel-left');
  } else {
    sidebar.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'panel-left-open');
  }
  lucide.createIcons();
}

// Live Word Document Statistics (Page, Word, Character, Read Time)
function updateWordStats() {
  const container = document.getElementById('wordPagesContainer');
  if (!container) return;
  const pages = container.querySelectorAll('.word-page');
  const pageBodies = container.querySelectorAll('.word-page-body');

  const totalPages = pages.length;
  let fullText = '';
  pageBodies.forEach(b => {
    fullText += ' ' + (b.innerText || '');
  });

  const trimmedText = fullText.trim();
  // English words count
  const englishWords = (trimmedText.match(/[a-zA-Z0-9_-]+/g) || []).length;
  // Thai characters count (roughly 4.5 chars per Thai word)
  const thaiChars = (trimmedText.match(/[\u0E00-\u0E7F]/g) || []).length;
  const thaiEstimatedWords = Math.round(thaiChars / 4.5);
  const totalWords = englishWords + thaiEstimatedWords;
  const totalChars = trimmedText.replace(/\s+/g, '').length;

  // Reading time (average 200 words per minute)
  const readTimeMinutes = Math.max(1, Math.ceil(totalWords / 200));

  const pageCountEl = document.getElementById('statusPageCount');
  const wordCountEl = document.getElementById('statusWordCount');
  const charCountEl = document.getElementById('statusCharCount');
  const readTimeEl = document.getElementById('statusReadTime');

  if (pageCountEl) pageCountEl.textContent = `${totalPages} หน้า`;
  if (wordCountEl) wordCountEl.textContent = `${totalWords.toLocaleString()} คำ`;
  if (charCountEl) charCountEl.textContent = `${totalChars.toLocaleString()} ตัวอักษร`;
  if (readTimeEl) readTimeEl.textContent = `อ่าน ~${readTimeMinutes} นาที`;
}

// Duplicate Current Document
async function duplicateCurrentDocument() {
  if (!currentReadingGuide) return;

  const newId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const duplicateTitle = `${currentReadingGuide.title || 'เอกสาร'} (สำเนา)`;

  const clonedPages = currentReadingGuide.pages && currentReadingGuide.pages.length > 0
    ? [...currentReadingGuide.pages]
    : (currentReadingGuide.content_html ? currentReadingGuide.content_html.split('<!-- PAGE_BREAK -->') : [currentReadingGuide.scope || '']);

  const duplicatedGuide = {
    ...currentReadingGuide,
    id: newId,
    title: duplicateTitle,
    pages: clonedPages,
    content_html: clonedPages.join('<!-- PAGE_BREAK -->'),
    scope: clonedPages.join('<!-- PAGE_BREAK -->'),
    created_at: new Date().toLocaleDateString('th-TH')
  };

  allExamGuides.unshift(duplicatedGuide);
  saveLocalExamGuides(allExamGuides);

  // Background sync to Supabase
  if (supabaseClient) {
    const payload = formatGuideForSupabase(duplicatedGuide);
    supabaseClient.from('exam_guides').upsert(payload).catch(err => console.warn('Supabase duplicate sync error:', err));
  }

  const badge = document.getElementById('badgeGuideCount');
  if (badge) badge.textContent = allExamGuides.length;

  updateExamGuideFilterDropdowns();
  renderSidebarGuideList();
  renderExamGuides();
  openReadGuideModal(duplicatedGuide);

  Swal.fire({
    icon: 'success',
    title: 'ทำซ้ำเอกสารสำเร็จ!',
    text: `สร้าง "${duplicateTitle}" เรียบร้อยแล้ว`,
    timer: 1800,
    showConfirmButton: false
  });
}

// Download Document as Plain Text File
function downloadDocumentText() {
  if (!currentReadingGuide) return;
  const pageBodies = document.querySelectorAll('.word-page-body');
  const texts = [];
  pageBodies.forEach((b, i) => {
    texts.push(`=== หน้าที่ ${i + 1} ===\n\n${b.innerText.trim()}`);
  });

  const fullText = [
    `เอกสาร: ${currentReadingGuide.title || 'ไม่มีชื่อ'}`,
    `วิชา: ${currentReadingGuide.subject || '-'} | เทอม: ${currentReadingGuide.term || '-'}`,
    `สร้างเมื่อ: ${currentReadingGuide.created_at || '-'}`,
    `========================================\n`,
    texts.join('\n\n----------------------------------------\n\n')
  ].join('\n');

  const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(currentReadingGuide.title || 'document').replace(/[/\\?%*:|"<>]/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Create Document From Pre-made Academic Templates
function createDocumentFromTemplate(templateType) {
  const modalTemplatePicker = document.getElementById('modalTemplatePicker');
  if (modalTemplatePicker) modalTemplatePicker.classList.add('hidden');

  const newId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const defaultTerm = allTasks[0]?.term || '2.1/9/2569';
  let title = 'เอกสารสรุปบทเรียน (หน้าใหม่)';
  let subject = 'วิชาใหม่';
  let examType = 'สรุปบทเรียน';
  let pages = [];

  if (templateType === 'cheat_sheet') {
    title = 'สรุปแนวข้อสอบ Final & จุดเน้นสำคัญ';
    examType = 'สอบปลายภาค (Final)';
    pages = [
      `
      <div class="my-3 p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 text-slate-800 shadow-xs">
        <div class="font-bold text-xs uppercase text-amber-900 flex items-center gap-1.5 mb-1.5">
          <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600"></i>
          <span>กติกาห้องสอบ & รูปแบบข้อสอบ (EXAM RULES)</span>
        </div>
        <p>• ปรนัย 40 ข้อ (40 คะแนน) • อัตนัย 2 ข้อ (20 คะแนน)<br>• อนุญาตเครื่องคิดเลข FX-991 • ห้ามนำกระดาษทดเข้า นั่งสอบตามเลขที่นั่ง</p>
      </div>

      <div class="my-4">
        <h3 class="font-black text-slate-900 text-base uppercase mb-2 border-b-2 border-purple-200 pb-1 flex items-center gap-2">
          <span>🎯 ขอบเขตเนื้อหาที่ออกสอบ (PART A - ทฤษฎี)</span>
        </h3>
        <ul class="list-disc pl-5 space-y-1.5 text-slate-700">
          <li><strong>บทที่ 1-3:</strong> พื้นฐานสถาปัตยกรรม & คอนเซ็ปต์สำคัญ (เน้นนิยามและข้อแตกต่าง)</li>
          <li><strong>บทที่ 4-6:</strong> กระบวนการทำงาน & วงจรการพัฒนา (Sprint, Lifecycle, CI/CD)</li>
        </ul>
      </div>

      <div class="my-4 p-4 rounded-xl bg-yellow-100/90 border border-yellow-300 text-amber-950 shadow-xs">
        <div class="font-bold text-xs uppercase text-amber-900 flex items-center gap-1.5 mb-1.5">
          <i data-lucide="sparkles" class="w-4 h-4 text-rose-500 fill-rose-500"></i>
          <span>จุดที่อาจารย์เน้นย้ำ & เก็งข้อสอบ (HIGH PRIORITY)</span>
        </div>
        <p>🔥 <strong>ข้อเขียนเน้นออก:</strong> ให้เปรียบเทียบข้อดี-ข้อเสีย พร้อมยกตัวอย่างสถานการณ์จริง<br>🔥 <strong>สูตรคำนวณ:</strong> ท่องสูตรและฝึกกดเครื่องคิดเลขให้คล่อง ได้คะแนนแน่นอน 15 คะแนน!</p>
      </div>
      `
    ];
  } else if (templateType === 'table_matrix') {
    title = 'ตารางเปรียบเทียบ & สรุปสาระสำคัญ';
    examType = 'สรุปเนื้อหา';
    pages = [
      `
      <p class="text-slate-600 mb-3">ตารางสรุปเปรียบเทียบหัวข้อสำคัญ เพื่อให้เห็นความแตกต่างและจุดเด่นจุดด้อยชัดเจน:</p>
      <table class="w-full my-4 border-collapse border border-slate-300 text-sm">
        <thead>
          <tr class="bg-indigo-50 text-indigo-950 font-bold">
            <th class="border border-slate-300 p-2.5 text-left">หัวข้อ / ประเด็น</th>
            <th class="border border-slate-300 p-2.5 text-left">คุณสมบัติ / คำอธิบาย</th>
            <th class="border border-slate-300 p-2.5 text-left">ข้อดี (Pros)</th>
            <th class="border border-slate-300 p-2.5 text-left">จุดควรจำ / เก็งสอบ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-300 p-2.5 font-semibold">เทคโนโลยี / โมเดล A</td>
            <td class="border border-slate-300 p-2.5">คำอธิบายหลักการทำงานเบื้องต้น...</td>
            <td class="border border-slate-300 p-2.5 text-emerald-700">เร็ว, ใช้ทรัพยากรน้อย</td>
            <td class="border border-slate-300 p-2.5 text-rose-600 font-medium">ออกสอบนิยาม 2 ข้อ</td>
          </tr>
          <tr>
            <td class="border border-slate-300 p-2.5 font-semibold">เทคโนโลยี / โมเดล B</td>
            <td class="border border-slate-300 p-2.5">คำอธิบายหลักการทำงานเบื้องต้น...</td>
            <td class="border border-slate-300 p-2.5 text-emerald-700">ปลอดภัยสูง, ขยายระบบง่าย</td>
            <td class="border border-slate-300 p-2.5 text-rose-600 font-medium">เปรียบเทียบในข้อเขียน</td>
          </tr>
        </tbody>
      </table>
      <div class="my-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
        💡 <em>สรุปภาพรวม: โมเดล A เหมาะกับงานขนาดเล็ก ส่วนโมเดล B เหมาะกับระดับ Enterprise</em>
      </div>
      `
    ];
  } else if (templateType === 'study_plan') {
    title = 'แผนอ่านหนังสือ & เช็คลิสต์ 7 วันก่อนสอบ';
    examType = 'แผนเตรียมสอบ';
    pages = [
      `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-emerald-950 flex items-center justify-between">
        <span class="font-bold text-xs uppercase">🎯 แผนอ่านหนังสือ 7 วันแบบเข้มข้น (Daily Sprint)</span>
        <span class="text-xs font-semibold text-emerald-700">เป้าหมาย: เกรด A</span>
      </div>

      <table class="w-full my-3 border-collapse border border-slate-300 text-sm">
        <thead>
          <tr class="bg-slate-100 font-bold">
            <th class="border border-slate-300 p-2 text-center w-16">วัน</th>
            <th class="border border-slate-300 p-2 text-left">หัวข้อบทเรียน</th>
            <th class="border border-slate-300 p-2 text-left">เป้าหมายงาน</th>
            <th class="border border-slate-300 p-2 text-center w-24">เช็คเสร็จ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-300 p-2 text-center font-bold text-indigo-600">Day 1</td>
            <td class="border border-slate-300 p-2">ทบทวนสไลด์ บทที่ 1 - 3</td>
            <td class="border border-slate-300 p-2">จดสรุปคีย์เวิร์ด + ทำความเข้าใจคอนเซ็ปต์</td>
            <td class="border border-slate-300 p-2 text-center"><input type="checkbox" class="w-4 h-4 text-purple-600"></td>
          </tr>
          <tr>
            <td class="border border-slate-300 p-2 text-center font-bold text-indigo-600">Day 2</td>
            <td class="border border-slate-300 p-2">ทบทวนสไลด์ บทที่ 4 - 6</td>
            <td class="border border-slate-300 p-2">สรุปผัง Diagram & ขั้นตอนการทำงาน</td>
            <td class="border border-slate-300 p-2 text-center"><input type="checkbox" class="w-4 h-4 text-purple-600"></td>
          </tr>
          <tr>
            <td class="border border-slate-300 p-2 text-center font-bold text-indigo-600">Day 3</td>
            <td class="border border-slate-300 p-2">ฝึกทำโจทย์ & ข้อสอบเก่าปีก่อน</td>
            <td class="border border-slate-300 p-2">จับเวลาทำข้อสอบจริง 60 นาที</td>
            <td class="border border-slate-300 p-2 text-center"><input type="checkbox" class="w-4 h-4 text-purple-600"></td>
          </tr>
          <tr>
            <td class="border border-slate-300 p-2 text-center font-bold text-indigo-600">Day 4</td>
            <td class="border border-slate-300 p-2">ทวนจุดที่ทำผิด & เก็งข้อเขียน</td>
            <td class="border border-slate-300 p-2">เขียนคำตอบข้อเขียนแบบบรรยายซ้ำ 3 รอบ</td>
            <td class="border border-slate-300 p-2 text-center"><input type="checkbox" class="w-4 h-4 text-purple-600"></td>
          </tr>
          <tr>
            <td class="border border-slate-300 p-2 text-center font-bold text-indigo-600">Day 5-7</td>
            <td class="border border-slate-300 p-2">ทบทวน Cheat Sheet หน้าเดียว</td>
            <td class="border border-slate-300 p-2">พักผ่อนให้เพียงพอ พร้อมลุยห้องสอบ!</td>
            <td class="border border-slate-300 p-2 text-center"><input type="checkbox" class="w-4 h-4 text-purple-600"></td>
          </tr>
        </tbody>
      </table>
      `
    ];
  } else if (templateType === 'cornell') {
    title = 'บันทึกสรุปแบบ Cornell Notes';
    examType = 'Cornell Notes';
    pages = [
      `
      <div class="border border-slate-300 rounded-xl overflow-hidden my-3">
        <!-- 2 Column Cornell Grid -->
        <div class="grid grid-cols-12 min-h-[500px]">
          <!-- Left: Cues / Questions Column (30%) -->
          <div class="col-span-4 bg-slate-50 p-4 border-r border-slate-300 space-y-4">
            <div class="text-xs font-bold uppercase text-purple-700 tracking-wider border-b border-purple-200 pb-1">
              🔑 คีย์เวิร์ด / คำถาม (CUES)
            </div>
            <div>
              <p class="font-bold text-slate-800 text-sm">• คำถามที่ 1:</p>
              <p class="text-xs text-slate-500">เหตุใดระบบถึงต้องใช้สถาปัตยกรรมนี้?</p>
            </div>
            <div>
              <p class="font-bold text-slate-800 text-sm">• ศัพท์เทคนิคสำคัญ:</p>
              <p class="text-xs text-slate-500">Idempotency, ACID, Scalability</p>
            </div>
            <div>
              <p class="font-bold text-slate-800 text-sm">• แนวโน้มข้อสอบ:</p>
              <p class="text-xs text-slate-500">มักถามความแตกต่างของ 2 ฝั่ง</p>
            </div>
          </div>

          <!-- Right: Note-taking Area (70%) -->
          <div class="col-span-8 p-5 space-y-4 bg-white">
            <div class="text-xs font-bold uppercase text-slate-500 tracking-wider border-b border-slate-200 pb-1">
              📝 เนื้อหาจดสรุป (NOTES)
            </div>
            <p class="text-slate-800 leading-relaxed text-sm">
              บันทึกเนื้อหาจากการฟังบรรยายในห้องหรือจากชีทเรียน โดยเน้นเขียนด้วยสำนวนตนเองเพื่อให้จำได้แม่นยำขึ้น
            </p>
            <ul class="list-disc pl-5 space-y-2 text-slate-700 text-sm">
              <li>หลักการที่ 1: การแบ่งภาระงานแบบกระจายศูนย์ (Distributed) ช่วยให้ระบบไม่ล่มพร้อมกัน</li>
              <li>หลักการที่ 2: ใช้ Cache เพื่อลดโหลดบน Database ทำให้ตอบสนองได้เร็วขึ้นในระดับมิลลิวินาที</li>
            </ul>
          </div>
        </div>

        <!-- Bottom: Summary Area -->
        <div class="p-4 bg-purple-50/70 border-t-2 border-purple-300">
          <div class="text-xs font-bold uppercase text-purple-900 tracking-wider mb-1 flex items-center gap-1.5">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-purple-600"></i>
            <span>สรุปสาระสำคัญใน 2-3 ประโยค (SUMMARY)</span>
          </div>
          <p class="text-sm text-slate-800 leading-relaxed">
            ภาพรวมเน้นการออกแบบระบบที่รองรับการขยายตัว (Scalable) โดยหัวใจหลักคือการแยกส่วนประกอบและมีจุดสำรองข้อมูลเสมอ
          </p>
        </div>
      </div>
      `
    ];
  } else {
    // Blank template
    pages = ['<p>เริ่มพิมพ์เนื้อหา สรุปบทเรียน หรือบันทึกข้อสอบได้ที่นี่...</p>'];
  }

  const initialBody = pages.join('<!-- PAGE_BREAK -->');
  const newGuide = {
    id: newId,
    term: defaultTerm,
    subject: subject,
    exam_type: examType,
    title: title,
    format: '',
    scope: initialBody,
    tips: '',
    pdf_link: '',
    contributor: 'ฉันเอง',
    created_at: new Date().toLocaleDateString('th-TH'),
    content_html: initialBody,
    pages: pages
  };

  allExamGuides.unshift(newGuide);
  saveLocalExamGuides(allExamGuides);

  // Background sync to Supabase
  if (supabaseClient) {
    const payload = formatGuideForSupabase(newGuide);
    supabaseClient.from('exam_guides').upsert(payload).catch(err => console.warn('Supabase template sync error:', err));
  }

  const badge = document.getElementById('badgeGuideCount');
  if (badge) badge.textContent = allExamGuides.length;

  updateExamGuideFilterDropdowns();
  renderSidebarGuideList();
  renderExamGuides();
  openReadGuideModal(newGuide);
}

// Word Document Auto-Save: Local (Fast 300ms) & Cloud (10s to conserve SheetDB quota)
let wordLocalSaveTimer = null;
let wordCloudSaveTimer = null;

function triggerWordAutoSave() {
  const saveStatus = document.getElementById('saveWordDocStatus');
  if (saveStatus) {
    saveStatus.innerHTML = `<i data-lucide="edit-2" class="w-3 h-3 text-amber-500 animate-pulse"></i><span class="text-amber-500">กำลังพิมพ์...</span>`;
    saveStatus.classList.remove('hidden');
    lucide.createIcons();
  }

  // 1. FAST Local Storage Save (Debounce 300ms) - GUARANTEES ZERO DATA LOSS
  clearTimeout(wordLocalSaveTimer);
  wordLocalSaveTimer = setTimeout(() => {
    saveWordDocumentLocalOnly();
  }, 300);

  // 2. CONSERVE CLOUD QUOTA (Debounce 10,000ms) - Prevents burning through SheetDB 500 req/month
  clearTimeout(wordCloudSaveTimer);
  wordCloudSaveTimer = setTimeout(() => {
    saveWordDocument(false);
  }, 10000);
}

// Create a New Blank Word Document
function createNewBlankWordDocument() {
  const newId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const defaultTerm = allTasks[0]?.term || '1.2/2569';
  const initialBody = '<p>เริ่มพิมพ์เนื้อหา สรุปบทเรียน หรือโน้ตข้อสอบได้ที่นี่...</p>';
  
  const newGuide = {
    id: newId,
    term: defaultTerm,
    subject: 'วิชาใหม่',
    exam_type: 'สรุปบทเรียน & แนวข้อสอบ',
    title: 'เอกสารสรุปบทเรียน (หน้าใหม่)',
    format: '',
    scope: initialBody,
    tips: '',
    pdf_link: '',
    contributor: 'ฉันเอง',
    created_at: new Date().toLocaleDateString('th-TH'),
    content_html: initialBody,
    pages: [initialBody]
  };

  allExamGuides.unshift(newGuide);
  saveLocalExamGuides(allExamGuides);

  // Background sync clean payload to Supabase
  if (supabaseClient) {
    const payload = formatGuideForSupabase(newGuide);
    supabaseClient.from('exam_guides').upsert(payload).catch(err => console.warn('Supabase new doc sync error:', err));
  }

  const badge = document.getElementById('badgeGuideCount');
  if (badge) badge.textContent = allExamGuides.length;

  updateExamGuideFilterDropdowns();
  renderSidebarGuideList();
  renderExamGuides();
  openReadGuideModal(newGuide);

  // Auto-focus on title input
  setTimeout(() => {
    const topTitle = document.getElementById('topWordDocTitleInput');
    if (topTitle) {
      topTitle.focus();
      topTitle.select();
    }
  }, 200);
}

// Build a Word Page Element (Multi-Page A4)
function createWordPageElement(pageIndex, totalPages, initialContent = '', isFirstPage = false, guide = null) {
  const pageDiv = document.createElement('div');
  pageDiv.className = `word-page word-theme-${currentWordTheme} bg-white shadow-2xl border border-slate-300 ${isWordPageWide ? 'max-w-7xl' : 'max-w-5xl'} w-full min-h-[1100px] p-8 sm:p-14 text-slate-900 rounded-xs relative transition-all flex flex-col mb-8`;
  pageDiv.dataset.pageIndex = pageIndex;

  const subject = guide?.subject || 'วิชาใหม่';
  const term = guide?.term || '2.1/9/2569';
  const examType = guide?.exam_type || 'สรุปบทเรียน';
  const docTitle = guide?.title || 'เอกสารไม่มีชื่อ';

  pageDiv.innerHTML = `
    <!-- Word Header Ruler / Meta Bar -->
    <div class="border-b-2 border-slate-900 pb-3 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-600 no-print">
      <div class="flex items-center gap-2 flex-wrap">
        <span contenteditable="true" class="page-subject-badge px-3 py-1 rounded bg-slate-900 text-white font-bold uppercase tracking-wider text-xs outline-none focus:ring-2 focus:ring-purple-400" title="คลิกเพื่อแก้ไขชื่อวิชา">${subject}</span>
        <span contenteditable="true" class="page-term font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-purple-400 px-1 rounded" title="คลิกเพื่อแก้ไขเทอม">เทอม ${term}</span>
        <span>•</span>
        <span contenteditable="true" class="page-exam-type font-semibold text-purple-700 outline-none focus:ring-1 focus:ring-purple-400 px-1 rounded" title="คลิกเพื่อแก้ไขประเภท">${examType.toUpperCase()}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-slate-400 text-xs font-sans">หน้า <span class="page-num-indicator">${pageIndex + 1}</span> จาก <span class="page-total-indicator">${totalPages}</span></span>
        ${pageIndex > 0 ? `
          <button type="button" class="btn-delete-this-page text-slate-400 hover:text-rose-600 transition p-1 rounded hover:bg-rose-50" title="ลบหน้ากระดาษนี้">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        ` : ''}
      </div>
    </div>

    ${isFirstPage ? `
      <!-- Editable Document Title on Page 1 -->
      <div contenteditable="true" class="word-doc-title outline-none focus:bg-purple-50/40 focus:ring-2 focus:ring-purple-300 rounded px-2 py-1 text-2xl sm:text-3xl font-black text-slate-900 leading-tight transition cursor-text mb-6" placeholder="พิมพ์ชื่อแนวข้อสอบ / เอกสารที่นี่...">
        ${docTitle}
      </div>
    ` : ''}

    <!-- Free-form Word Page Body Content -->
    <div contenteditable="true" class="word-page-body flex-1 outline-none text-slate-800 text-sm sm:text-base leading-relaxed space-y-4 focus:ring-0 min-h-[750px] cursor-text" placeholder="พิมพ์เนื้อหา สรุปบทเรียน หรือบันทึกข้อสอบในหน้านี้...">
      ${initialContent}
    </div>

    <!-- Word Page Footer -->
    <div class="border-t border-slate-200 mt-10 pt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono">
      <span>🎓 A4 EXAM CHEAT SHEET • SHARED ACADEMIC HUB</span>
      <span>หน้า ${pageIndex + 1}</span>
    </div>
  `;

  // Delete page handler
  pageDiv.querySelector('.btn-delete-this-page')?.addEventListener('click', () => {
    deleteWordPage(pageIndex);
  });

  // Sync title handler
  if (isFirstPage) {
    const titleEl = pageDiv.querySelector('.word-doc-title');
    titleEl?.addEventListener('input', () => {
      const topTitleInput = document.getElementById('topWordDocTitleInput');
      if (topTitleInput) topTitleInput.value = titleEl.innerText.trim();
    });
  }

  // Update badge in guide on input
  pageDiv.querySelector('.page-subject-badge')?.addEventListener('input', (e) => {
    if (currentReadingGuide) currentReadingGuide.subject = e.target.innerText.trim();
  });
  pageDiv.querySelector('.page-term')?.addEventListener('input', (e) => {
    if (currentReadingGuide) currentReadingGuide.term = e.target.innerText.replace('เทอม', '').trim();
  });
  pageDiv.querySelector('.page-exam-type')?.addEventListener('input', (e) => {
    if (currentReadingGuide) currentReadingGuide.exam_type = e.target.innerText.trim();
  });

  // Auto-save & stats on typing
  pageDiv.querySelectorAll('[contenteditable="true"]').forEach(el => {
    el.addEventListener('input', () => {
      triggerWordAutoSave();
      updateWordStats();
    });
  });

  // Callout Box Protection & Exit Navigation Helpers
  const bodyEl = pageDiv.querySelector('.word-page-body');
  if (bodyEl) {
    // Click outside handler: if clicking empty white area below the callout box
    bodyEl.addEventListener('click', (e) => {
      if (e.target === bodyEl) {
        let lastChild = bodyEl.lastElementChild;
        if (!lastChild || lastChild.classList.contains('exam-callout-box') || lastChild.tagName === 'DIV') {
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          bodyEl.appendChild(p);
          lastChild = p;
        }
        const r = document.createRange();
        r.setStart(lastChild, 0);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    });

    bodyEl.addEventListener('keydown', (e) => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const callout = range.startContainer.nodeType === 1
        ? range.startContainer.closest('.exam-callout-box, [data-callout], [class*="bg-yellow-"], [class*="bg-amber-"]')
        : range.startContainer.parentElement?.closest('.exam-callout-box, [data-callout], [class*="bg-yellow-"], [class*="bg-amber-"]');

      if (!callout) return;

      // 1. Escape: Instant exit to outside paragraph below
      if (e.key === 'Escape') {
        e.preventDefault();
        exitCalloutBox(callout);
        return;
      }

      // 2. ArrowDown at the end of callout box: move to line below
      if (e.key === 'ArrowDown') {
        const calloutRange = document.createRange();
        calloutRange.selectNodeContents(callout);
        if (range.compareBoundaryPoints(Range.END_TO_END, calloutRange) >= 0) {
          e.preventDefault();
          exitCalloutBox(callout);
          return;
        }
      }

      // 3. Enter key
      if (e.key === 'Enter') {
        // If Enter is pressed on an empty line at the end (Double Enter) -> Exit box!
        if (checkIsTrailingEmpty(range, callout)) {
          e.preventDefault();
          cleanTrailingBreak(callout);
          exitCalloutBox(callout);
          return;
        }

        // Normal Enter -> insert line break inside the box
        e.preventDefault();
        document.execCommand('insertLineBreak');
        triggerWordAutoSave();
        updateWordStats();
      }
    });

    bodyEl.addEventListener('paste', (e) => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const callout = range.startContainer.nodeType === 1
        ? range.startContainer.closest('.exam-callout-box, [data-callout], [class*="bg-yellow-"], [class*="bg-amber-"]')
        : range.startContainer.parentElement?.closest('.exam-callout-box, [data-callout], [class*="bg-yellow-"], [class*="bg-amber-"]');

      if (callout) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        if (!text) return;
        const lines = text.split(/\r\n|\r|\n/);
        const html = lines.map(line => {
          const span = document.createElement('span');
          span.textContent = line;
          return span.innerHTML;
        }).join('<br>');

        document.execCommand('insertHTML', false, html);
        triggerWordAutoSave();
        updateWordStats();
      }
    });
  }

  return pageDiv;
}

// Update Page Number Indicators
function updateWordPageIndicators() {
  const container = document.getElementById('wordPagesContainer');
  if (!container) return;
  const pages = container.querySelectorAll('.word-page');
  const total = pages.length;

  pages.forEach((p, idx) => {
    p.dataset.pageIndex = idx;
    const numEl = p.querySelector('.page-num-indicator');
    if (numEl) numEl.textContent = idx + 1;
    const totalEl = p.querySelector('.page-total-indicator');
    if (totalEl) totalEl.textContent = total;
  });

  const countStatus = document.getElementById('wordPageCountStatus');
  if (countStatus) countStatus.textContent = `${total} หน้ากระดาษ`;

  updateWordStats();
}

// Add a Blank Page to the Document
function addWordBlankPage() {
  const container = document.getElementById('wordPagesContainer');
  if (!container) return;

  const currentCount = container.children.length;
  const newPage = createWordPageElement(currentCount, currentCount + 1, '<p>เนื้อหาหน้า ' + (currentCount + 1) + '...</p>', false, currentReadingGuide);
  container.appendChild(newPage);
  
  updateWordPageIndicators();
  lucide.createIcons();
  
  newPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const bodyEl = newPage.querySelector('.word-page-body');
  if (bodyEl) bodyEl.focus();

  triggerWordAutoSave();
}

// Delete a Specific Page
function deleteWordPage(pageIndex) {
  const container = document.getElementById('wordPagesContainer');
  if (!container) return;
  const pages = container.querySelectorAll('.word-page');
  if (pages.length <= 1) return; // Keep at least one page

  pages[pageIndex]?.remove();
  updateWordPageIndicators();
  triggerWordAutoSave();
}

// Universal Delete Exam Guide / Document (Guarantees it never returns on refresh)
async function deleteGuideById(guideId, guideTitle) {
  if (!guideId) return;

  const confirmRes = await Swal.fire({
    title: 'ยืนยันการลบแนวข้อสอบ?',
    text: `ต้องการลบ "${guideTitle || 'แนวข้อสอบนี้'}" ออกจากระบบใช่หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ใช่, ลบเลย',
    cancelButtonText: 'ยกเลิก'
  });

  if (!confirmRes.isConfirmed) return;

  // 1. Mark in tombstone so it NEVER resurrects on reload or cloud merge
  markGuideAsDeleted(guideId);

  // 2. Delete from Supabase Cloud
  if (supabaseClient) {
    try {
      await supabaseClient.from('exam_guides').delete().eq('id', guideId);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  }

  // 3. Remove from in-memory array and update localStorage
  allExamGuides = allExamGuides.filter(g => g.id !== guideId);
  saveLocalExamGuides(allExamGuides);
  localStorage.setItem(STORAGE_GUIDES_INITIALIZED, 'true');

  // 4. CRITICAL: Clear currentReadingGuide so beforeunload never saves it back!
  if (currentReadingGuide && currentReadingGuide.id === guideId) {
    currentReadingGuide = null;
    localStorage.removeItem(STORAGE_ACTIVE_DOC_KEY);
  }

  const badge = document.getElementById('badgeGuideCount');
  if (badge) badge.textContent = allExamGuides.length;

  updateExamGuideFilterDropdowns();
  renderExamGuides();
  renderSidebarGuideList();

  const modalRead = document.getElementById('modalReadExamGuide');
  const modalEdit = document.getElementById('modalEditExamGuide');
  if (modalEdit) modalEdit.classList.add('hidden');

  if (modalRead && !modalRead.classList.contains('hidden')) {
    if (allExamGuides.length > 0) {
      openReadGuideModal(allExamGuides[0]);
    } else {
      modalRead.classList.add('hidden');
    }
  }

  Swal.fire({
    icon: 'success',
    title: 'ลบเรียบร้อย!',
    timer: 1500,
    showConfirmButton: false
  });
}

// Delete Current Document from Sidebar/Ribbon
async function deleteCurrentDocument() {
  if (!currentReadingGuide) return;
  await deleteGuideById(currentReadingGuide.id, currentReadingGuide.title);
}

// Insert Helper at Cursor or Active Page
function insertHtmlAtCursorOrActivePage(html) {
  const sel = window.getSelection();
  let inserted = false;
  if (sel.getRangeAt && sel.rangeCount) {
    let range = sel.getRangeAt(0);
    const pageBody = range.commonAncestorContainer.nodeType === 1 
      ? range.commonAncestorContainer.closest('.word-page-body')
      : range.commonAncestorContainer.parentElement?.closest('.word-page-body');
      
    if (pageBody) {
      range.deleteContents();
      const el = document.createElement('div');
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node, lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range = range.cloneRange();
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      inserted = true;
    }
  }

  if (!inserted) {
    const firstBody = document.querySelector('.word-page-body');
    if (firstBody) {
      firstBody.insertAdjacentHTML('beforeend', html);
    }
  }
  triggerWordAutoSave();
  lucide.createIcons();
}

// Callout Box Exit & Navigation Logic
function exitCalloutBox(callout) {
  if (!callout) return;

  // Find or create paragraph immediately after callout box
  let nextEl = callout.nextElementSibling;
  if (!nextEl || nextEl.classList.contains('exam-callout-box') || nextEl.tagName === 'DIV') {
    nextEl = document.createElement('p');
    nextEl.innerHTML = '<br>';
    callout.parentNode.insertBefore(nextEl, callout.nextSibling);
  }

  // Focus caret in nextEl
  const range = document.createRange();
  range.selectNodeContents(nextEl);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  nextEl.focus();
  triggerWordAutoSave();
  updateWordStats();
}

function checkIsTrailingEmpty(range, callout) {
  if (!range.collapsed) return false;

  const node = range.startContainer;
  const offset = range.startOffset;

  if (node.nodeType === 1) {
    const prev = node.childNodes[offset - 1];
    if (prev && prev.tagName === 'BR') return true;
    if (node.childNodes.length === 0) return true;
  } else if (node.nodeType === 3) {
    const textBefore = node.textContent.slice(0, offset);
    if (!textBefore || textBefore.trim() === '') {
      let prev = node.previousSibling;
      if (prev && prev.tagName === 'BR') return true;
    }
  }

  // Check if caret is at the very end of callout
  const calloutRange = document.createRange();
  calloutRange.selectNodeContents(callout);
  if (range.compareBoundaryPoints(Range.END_TO_END, calloutRange) >= 0) {
    const lastNode = callout.lastChild;
    if (lastNode && (lastNode.tagName === 'BR' || (lastNode.nodeType === 3 && !lastNode.textContent.trim()))) {
      return true;
    }
  }

  return false;
}

function cleanTrailingBreak(callout) {
  const brs = callout.querySelectorAll('br');
  if (brs.length > 0) {
    const lastBr = brs[brs.length - 1];
    lastBr.remove();
  }
}

// Enhance callout boxes: ensure header is uneditable, has hint, and has paragraph below
function enhanceCalloutBoxes(container) {
  if (!container) return;
  const callouts = container.querySelectorAll('.exam-callout-box, [data-callout], [class*="bg-yellow-100"], [class*="bg-amber-"]');
  callouts.forEach(box => {
    box.classList.add('exam-callout-box');
    const header = box.querySelector('.callout-header, div.font-bold');
    if (header) {
      header.classList.add('callout-header');
      header.setAttribute('contenteditable', 'false');
    }
    // Ensure there is an editable paragraph immediately below the callout box
    if (!box.nextElementSibling || box.nextElementSibling.classList.contains('exam-callout-box')) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      box.parentNode.insertBefore(p, box.nextSibling);
    }
  });
}

function insertStickyNote() {
  const noteHtml = `
    <div class="exam-callout-box my-4 p-4 rounded-xl bg-yellow-100/90 border border-yellow-300 text-amber-950 shadow-xs" data-callout="exam-tips">
      <div class="callout-header font-bold text-xs uppercase text-amber-900 flex items-center justify-between gap-1.5 mb-2 select-none" contenteditable="false">
        <div class="flex items-center gap-1.5">
          <i data-lucide="sparkles" class="w-4 h-4 text-rose-500 fill-rose-500"></i>
          <span>จุดที่อาจารย์เน้นย้ำ & เก็งข้อสอบ</span>
        </div>
        <span class="text-[10px] text-amber-700/60 font-normal lowercase">(กด enter ว่าง หรือ esc เพื่อออก)</span>
      </div>
      <div class="callout-content min-h-[30px] leading-relaxed">
        <p>พิมพ์จุดเน้นย้ำ หรือแนวข้อสอบที่อาจารย์บอกในห้องที่นี่...</p>
      </div>
    </div>
    <p><br></p>
  `;
  insertHtmlAtCursorOrActivePage(noteHtml);
}

function insertAlertBox() {
  const alertHtml = `
    <div class="exam-callout-box my-4 p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 text-slate-800 shadow-xs" data-callout="exam-rules">
      <div class="callout-header font-bold text-xs uppercase text-amber-900 flex items-center justify-between gap-1.5 mb-2 select-none" contenteditable="false">
        <div class="flex items-center gap-1.5">
          <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600"></i>
          <span>กติกาห้องสอบ & รูปแบบข้อสอบ (Exam Rules)</span>
        </div>
        <span class="text-[10px] text-amber-700/60 font-normal lowercase">(กด enter ว่าง หรือ esc เพื่อออก)</span>
      </div>
      <div class="callout-content min-h-[30px] leading-relaxed">
        <p>ปรนัย 40 ข้อ (40 คะแนน) • อัตนัย 2 ข้อ (20 คะแนน) • อนุญาตเครื่องคิดเลข FX-991</p>
      </div>
    </div>
    <p><br></p>
  `;
  insertHtmlAtCursorOrActivePage(alertHtml);
}

function insertTable() {
  const tableHtml = `
    <table class="w-full my-4 border-collapse border border-slate-300 text-sm">
      <thead>
        <tr class="bg-slate-100">
          <th class="border border-slate-300 p-2.5 text-left font-bold">หัวข้อ / ประเด็น</th>
          <th class="border border-slate-300 p-2.5 text-left font-bold">สรุปสาระสำคัญ</th>
          <th class="border border-slate-300 p-2.5 text-left font-bold">เก็งข้อสอบ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="border border-slate-300 p-2">บทที่ 1</td>
          <td class="border border-slate-300 p-2">สรุปเนื้อหาสำคัญ...</td>
          <td class="border border-slate-300 p-2 text-rose-600 font-medium">ข้อเขียน 5 คะแนน</td>
        </tr>
        <tr>
          <td class="border border-slate-300 p-2">บทที่ 2</td>
          <td class="border border-slate-300 p-2">สรุปเนื้อหาสำคัญ...</td>
          <td class="border border-slate-300 p-2 text-purple-600 font-medium">ปรนัย 10 ข้อ</td>
        </tr>
      </tbody>
    </table>
    <p></p>
  `;
  insertHtmlAtCursorOrActivePage(tableHtml);
}

function insertChecklist() {
  const checklistHtml = `
    <div class="my-3 space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded text-purple-600"> <span>อ่านทบทวนสรุปบทเรียน</span></div>
      <div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded text-purple-600"> <span>ฝึกทำโจทย์ & ข้อสอบเก่า</span></div>
      <div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded text-purple-600"> <span>จดสูตรคำนวณเข้าห้องสอบ</span></div>
    </div>
    <p></p>
  `;
  insertHtmlAtCursorOrActivePage(checklistHtml);
}

// Open Read Guide Modal (Fullscreen Split View 25% / 75% Word Document Workspace)
function openReadGuideModal(guide) {
  if (!guide) return;
  currentReadingGuide = guide;

  // 1. Top Bar Document Title Input
  const topTitleInput = document.getElementById('topWordDocTitleInput');
  if (topTitleInput) topTitleInput.value = guide.title || 'เอกสารไม่มีชื่อ';

  // 2. Render Pages into Container
  const container = document.getElementById('wordPagesContainer');
  if (container) {
    container.innerHTML = '';
    
    let pagesData = [];
    if (guide.pages && Array.isArray(guide.pages) && guide.pages.length > 0) {
      pagesData = guide.pages;
    } else if (guide.content_html && guide.content_html.trim() !== '') {
      pagesData = guide.content_html.split('<!-- PAGE_BREAK -->');
    } else if (guide.scope && guide.scope.includes('<!-- PAGE_BREAK -->')) {
      pagesData = guide.scope.split('<!-- PAGE_BREAK -->');
    } else if (guide.scope && (guide.scope.includes('<p>') || guide.scope.includes('<div') || guide.scope.includes('<table'))) {
      pagesData = [guide.scope];
    } else {
      // Build standard initial structured page from format, scope, tips
      let initialHtml = '';
      if (guide.format && guide.format.trim() !== '') {
        initialHtml += `
          <div class="my-3 p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 text-slate-800 shadow-xs">
            <div class="font-bold text-xs uppercase text-amber-900 flex items-center gap-1.5 mb-1">
              <span>⚠️ กติกาห้องสอบ & รูปแบบข้อสอบ (Exam Rules)</span>
            </div>
            <p>${guide.format.replace(/\n/g, '<br>')}</p>
          </div>
        `;
      }
      if (guide.scope && guide.scope.trim() !== '') {
        initialHtml += `
          <div class="my-3">
            <h3 class="font-black text-slate-900 text-sm uppercase mb-2 border-b border-purple-200 pb-1">🎯 1. ขอบเขตเนื้อหาที่ออกสอบ</h3>
            <p class="whitespace-pre-line leading-relaxed">${guide.scope}</p>
          </div>
        `;
      }
      if (guide.tips && guide.tips.trim() !== '') {
        initialHtml += `
          <div class="my-3 p-4 rounded-xl bg-yellow-100/90 border border-yellow-300 text-amber-950 shadow-xs">
            <div class="font-bold text-xs uppercase text-amber-900 flex items-center gap-1.5 mb-1">
              <span>🔥 จุดที่อาจารย์เน้นย้ำ & เก็งข้อสอบ (Tips)</span>
            </div>
            <p class="whitespace-pre-line leading-relaxed">${guide.tips}</p>
          </div>
        `;
      }
      if (!initialHtml) {
        initialHtml = `<p>เริ่มพิมพ์เนื้อหา สรุปบทเรียน หรือบันทึกข้อสอบได้ที่นี่...</p>`;
      }
      pagesData = [initialHtml];
    }

    pagesData.forEach((content, idx) => {
      const pageEl = createWordPageElement(idx, pagesData.length, content, idx === 0, guide);
      container.appendChild(pageEl);
    });

    enhanceCalloutBoxes(container);
    updateWordPageIndicators();
    applyWordTheme(currentWordTheme);
    updateWordStats();
  }

  // 3. In-App Embedded PDF Viewer Setup
  const btnViewPdf = document.getElementById('btnViewModePdf');
  const pdfIframe = document.getElementById('readGuidePdfIframe');
  const pdfExternalLink = document.getElementById('readGuidePdfExternalLink');

  if (guide.pdf_link && guide.pdf_link.trim() !== '') {
    const embedUrl = convertToEmbedUrl(guide.pdf_link);
    if (pdfIframe) pdfIframe.src = embedUrl;
    if (pdfExternalLink) pdfExternalLink.href = guide.pdf_link.startsWith('http') ? guide.pdf_link : `https://${guide.pdf_link}`;
    if (btnViewPdf) btnViewPdf.classList.remove('hidden');
  } else {
    if (pdfIframe) pdfIframe.src = '';
    if (btnViewPdf) btnViewPdf.classList.add('hidden');
  }

  // Reset to Word / A4 Document Mode
  setA4ViewMode('a4');

  // Render the left 25% sidebar so the active guide is highlighted
  renderSidebarGuideList();

  document.getElementById('modalReadExamGuide').classList.remove('hidden');
  lucide.createIcons();
}

// Save Word Document Locally (Immediate 300ms, NEVER LOSES TEXT)
function saveWordDocumentLocalOnly() {
  if (!currentReadingGuide || !currentReadingGuide.id) return;

  // Never resurrect deleted guides!
  const deletedIds = getDeletedGuideIds();
  if (deletedIds.includes(currentReadingGuide.id)) {
    currentReadingGuide = null;
    localStorage.removeItem(STORAGE_ACTIVE_DOC_KEY);
    return;
  }

  const topTitle = document.getElementById('topWordDocTitleInput')?.value.trim();
  const firstPageTitle = document.querySelector('.word-doc-title')?.innerText.trim();
  const newTitle = topTitle || firstPageTitle || currentReadingGuide.title || 'เอกสารไม่มีชื่อ';

  // Extract pages and sanitize HTML
  const pageBodies = document.querySelectorAll('.word-page-body');
  const pages = [];
  pageBodies.forEach(body => {
    pages.push(cleanHtmlForStorage(body.innerHTML));
  });

  const contentHtml = pages.join('<!-- PAGE_BREAK -->');
  const textSummary = Array.from(pageBodies).map(b => b.innerText.trim()).filter(Boolean).join('\n\n');

  // Update in-memory guide object
  currentReadingGuide.title = newTitle;
  currentReadingGuide.pages = pages;
  currentReadingGuide.content_html = contentHtml;
  currentReadingGuide.scope = contentHtml || textSummary || currentReadingGuide.scope;
  currentReadingGuide._unsaved = true;

  // Persist to allExamGuides array
  const idx = allExamGuides.findIndex(g => g.id === currentReadingGuide.id);
  if (idx !== -1) {
    allExamGuides[idx] = { ...currentReadingGuide };
  } else {
    allExamGuides.unshift({ ...currentReadingGuide });
  }

  // Save to browser LocalStorage (Immediate backup)
  saveLocalExamGuides(allExamGuides);
  try {
    localStorage.setItem(STORAGE_ACTIVE_DOC_KEY, JSON.stringify(currentReadingGuide));
  } catch (e) {
    console.warn('Active doc localStorage save failed:', e);
  }

  const saveStatus = document.getElementById('saveWordDocStatus');
  if (saveStatus) {
    saveStatus.innerHTML = `<i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-500"></i><span class="text-emerald-600 font-medium text-xs">บันทึกในเครื่องปลอดภัยแล้ว</span>`;
    saveStatus.classList.remove('hidden');
    lucide.createIcons();
  }

  updateWordStats();
}

// Save Word Document Changes (Cloud Sync to SheetDB + Local Storage)
async function saveWordDocument(showFeedback = true) {
  if (!currentReadingGuide) return;

  // Always ensure local storage is up-to-date FIRST
  saveWordDocumentLocalOnly();

  const btnSave = document.getElementById('btnSaveWordDoc');
  const saveText = document.getElementById('saveWordDocText');
  const saveStatus = document.getElementById('saveWordDocStatus');

  if (showFeedback && btnSave) btnSave.disabled = true;
  if (showFeedback && saveText) saveText.textContent = 'กำลังซิงค์...';

  // Clean and prepare sanitized payload
  const cleanPages = (currentReadingGuide.pages || []).map(cleanHtmlForStorage);
  const cleanContentHtml = cleanPages.join('<!-- PAGE_BREAK -->');
  let cleanScope = cleanContentHtml || currentReadingGuide.scope || '';

  // Ensure cell doesn't exceed Google Sheets 50,000 char limit (keep under 48,000)
  if (cleanScope.length > 48000) {
    cleanScope = cleanScope.slice(0, 48000);
  }

  const guidePayload = {
    "id": currentReadingGuide.id,
    "Term": currentReadingGuide.term || allTasks[0]?.term || '2.1/9/2569',
    "Subject": currentReadingGuide.subject || 'วิชาใหม่',
    "ExamType": currentReadingGuide.exam_type || 'สรุปบทเรียน',
    "Title": currentReadingGuide.title,
    "Format": currentReadingGuide.format || '',
    "Scope": cleanScope,
    "Tips": currentReadingGuide.tips || '',
    "PdfLink": currentReadingGuide.pdf_link || '',
    "Contributor": currentReadingGuide.contributor || 'เพื่อนร่วมชั้น',
    "CreatedAt": currentReadingGuide.created_at || new Date().toLocaleDateString('th-TH'),
    // Lowercase copies for broad compatibility
    "term": currentReadingGuide.term || allTasks[0]?.term || '2.1/9/2569',
    "subject": currentReadingGuide.subject || 'วิชาใหม่',
    "exam_type": currentReadingGuide.exam_type || 'สรุปบทเรียน',
    "title": currentReadingGuide.title,
    "format": currentReadingGuide.format || '',
    "scope": cleanScope,
    "tips": currentReadingGuide.tips || '',
    "pdf_link": currentReadingGuide.pdf_link || '',
    "contributor": currentReadingGuide.contributor || 'เพื่อนร่วมชั้น',
    "created_at": currentReadingGuide.created_at || new Date().toLocaleDateString('th-TH')
  };

  let syncSuccess = false;

  // Supabase Cloud Save (Unlimited size & requests, Realtime sync)
  if (supabaseClient && currentReadingGuide.id) {
    try {
      const supabaseDoc = {
        id: currentReadingGuide.id,
        term: currentReadingGuide.term || allTasks[0]?.term || '2.1/9/2569',
        subject: currentReadingGuide.subject || 'วิชาใหม่',
        exam_type: currentReadingGuide.exam_type || 'สรุปบทเรียน',
        title: currentReadingGuide.title,
        format: currentReadingGuide.format || '',
        scope: cleanContentHtml || currentReadingGuide.scope || '',
        tips: currentReadingGuide.tips || '',
        pdf_link: currentReadingGuide.pdf_link || '',
        contributor: currentReadingGuide.contributor || 'เพื่อนร่วมชั้น',
        content_html: cleanContentHtml,
        pages: cleanPages,
        created_at: currentReadingGuide.created_at || new Date().toLocaleDateString('th-TH')
      };

      const { error } = await supabaseClient.from('exam_guides').upsert(supabaseDoc);
      if (!error) {
        syncSuccess = true;
        currentReadingGuide._unsaved = false;
        saveLocalExamGuides(allExamGuides);
      } else {
        console.warn('Supabase save error:', error);
      }
    } catch (err) {
      console.warn('Supabase upsert error:', err);
    }
  }

  renderSidebarGuideList();
  renderExamGuides();

  if (showFeedback && btnSave) btnSave.disabled = false;
  if (showFeedback && saveText) saveText.textContent = 'บันทึก';

  if (saveStatus) {
    if (syncSuccess) {
      saveStatus.innerHTML = `<i data-lucide="cloud-check" class="w-3.5 h-3.5 text-emerald-600"></i> <span class="text-emerald-600 font-semibold">บันทึก & ซิงค์ Supabase แล้ว</span>`;
    } else {
      saveStatus.innerHTML = `<i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i> <span class="text-emerald-600 font-semibold">บันทึกในเครื่องปลอดภัย</span>`;
    }
    saveStatus.classList.remove('hidden');
    lucide.createIcons();
    setTimeout(() => {
      saveStatus.classList.add('hidden');
    }, 3000);
  }
}

// Backup All Exam Guides to JSON File
function exportAllGuidesJson() {
  const dataStr = JSON.stringify(allExamGuides, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `exam_vault_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  Swal.fire({
    icon: 'success',
    title: 'สำรองไฟล์เรียบร้อย!',
    text: `ดาวน์โหลดไฟล์สำรอง ${allExamGuides.length} เอกสารแล้ว`,
    timer: 2000,
    showConfirmButton: false
  });
}

// Backup Current Document to JSON File
function exportCurrentDocJson() {
  if (!currentReadingGuide) return;
  const dataStr = JSON.stringify(currentReadingGuide, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(currentReadingGuide.title || 'doc').replace(/[/\\?%*:|"<>]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Restore / Import Exam Guides from JSON File
function importGuidesJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      let incoming = Array.isArray(parsed) ? parsed : [parsed];
      if (incoming.length === 0) throw new Error('Empty JSON file');

      const normalized = incoming.map(normalizeExamGuide);
      allExamGuides = mergeLocalAndRemoteGuides(allExamGuides, normalized);
      saveLocalExamGuides(allExamGuides);

      renderExamGuides();
      renderSidebarGuideList();

      Swal.fire({
        icon: 'success',
        title: 'นำเข้าข้อมูลสำเร็จ!',
        text: `กู้คืนเอกสารเรียบร้อย ${normalized.length} รายการ`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'นำเข้าไฟล์ล้มเหลว',
        text: 'รูปแบบไฟล์ JSON ไม่ถูกต้อง โปรดเลือกไฟล์สำรองที่ถูกต้อง'
      });
    }
  };
  reader.readAsText(file);
}

// Toggle Page Width between Standard A4 and Fullscreen Wide
let isWordPageWide = false;
function togglePageWidth() {
  isWordPageWide = !isWordPageWide;
  const pages = document.querySelectorAll('.word-page');
  const label = document.getElementById('labelPageWidth');
  const icon = document.getElementById('iconPageWidth');

  pages.forEach(p => {
    if (isWordPageWide) {
      p.classList.remove('max-w-5xl');
      p.classList.add('max-w-7xl', 'w-full');
    } else {
      p.classList.remove('max-w-7xl');
      p.classList.add('max-w-5xl');
    }
  });

  if (label) label.textContent = isWordPageWide ? 'ย่อ A4' : 'เต็มจอ';
  if (icon) icon.setAttribute('data-lucide', isWordPageWide ? 'minimize-2' : 'maximize-2');
  lucide.createIcons();
}

// Copy Guide to Clipboard for LINE Group
function copyGuideToLine(guide) {
  if (!guide) return;

  const lines = [
    `📚 แนวข้อสอบ: [${guide.subject || ''}] ${guide.title}`,
    `เทอม: ${guide.term || '-'} | ประเภท: ${guide.exam_type || '-'}`,
    guide.format ? `\n📋 รูปแบบ & กติกา:\n${guide.format}` : '',
    guide.scope ? `\n🎯 ขอบเขตเนื้อหาที่ออกสอบ:\n${guide.scope}` : '',
    guide.tips ? `\n💡 จุดเน้น & ข้อควรระวัง:\n${guide.tips}` : '',
    guide.pdf_link ? `\n📄 ลิงก์ชีทสรุป PDF:\n${guide.pdf_link}` : '',
    `\nแชร์โดย: ${guide.contributor || 'เพื่อนร่วมชั้น'}`
  ].filter(Boolean).join('\n');

  navigator.clipboard.writeText(lines).then(() => {
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกลงคลิปบอร์ดแล้ว!',
      text: 'สามารถนำข้อความไปวางลงกลุ่ม LINE ของเพื่อนๆ ได้ทันที',
      timer: 2000,
      showConfirmButton: false
    });
  }).catch(() => {
    Swal.fire({
      icon: 'info',
      title: 'โปรดเลือกและคัดลอกด้วยตนเอง'
    });
  });
}

// Open Add / Edit Guide Modal
function openEditGuideModal(guide) {
  currentEditingGuide = guide;
  const isEdit = Boolean(guide);

  document.getElementById('formGuideHeaderTitle').innerHTML = `
    <i data-lucide="${isEdit ? 'edit-3' : 'file-plus-2'}" class="w-5 h-5 text-purple-600"></i>
    <span>${isEdit ? 'แก้ไขแนวข้อสอบ' : 'แชร์แนวข้อสอบใหม่'}</span>
  `;

  document.getElementById('inputGuideOriginalId').value = isEdit ? guide.id : '';
  document.getElementById('inputGuideTerm').value = isEdit ? (guide.term || '') : (allTasks[0]?.term || '2.1/9/2569');
  document.getElementById('inputGuideSubject').value = isEdit ? (guide.subject || '') : '';
  document.getElementById('selectGuideExamType').value = isEdit ? (guide.exam_type || 'สอบปลายภาค (Final)') : 'สอบปลายภาค (Final)';
  document.getElementById('inputGuideContributor').value = isEdit ? (guide.contributor || '') : '';
  document.getElementById('inputGuideTitle').value = isEdit ? (guide.title || '') : '';
  document.getElementById('inputGuideFormat').value = isEdit ? (guide.format || '') : '';
  document.getElementById('inputGuideScope').value = isEdit ? (guide.scope || '') : '';
  document.getElementById('inputGuideTips').value = isEdit ? (guide.tips || '') : '';
  document.getElementById('inputGuidePdfLink').value = isEdit ? (guide.pdf_link || '') : '';

  const btnDelete = document.getElementById('btnDeleteExamGuide');
  if (isEdit) {
    btnDelete.classList.remove('hidden');
  } else {
    btnDelete.classList.add('hidden');
  }

  document.getElementById('modalReadExamGuide').classList.add('hidden');
  document.getElementById('modalEditExamGuide').classList.remove('hidden');
  lucide.createIcons();
}

// Show Details Modal on Calendar Event Click
function showEventDetails(props) {
  currentDetailTask = props;
  document.getElementById('detailTitle').textContent = props.title;
  document.getElementById('detailSubject').textContent = props.subject || '-';
  document.getElementById('detailTerm').textContent = props.term || '-';
  document.getElementById('detailDate').textContent = formatThaiDateTime(props.parsedDate, props.due_date);
  document.getElementById('detailStatus').textContent = props.status || '-';

  const badge = document.getElementById('detailBadge');
  const typeMeta = getTypeMeta(props.type);
  badge.textContent = props.type || 'งาน';
  badge.className = `px-2.5 py-1 text-xs rounded-full font-semibold ${typeMeta.badgeClass}`;

  const linkBox = document.getElementById('detailLinkBox');
  const linkEl = document.getElementById('detailLink');
  if (props.link) {
    const targetUrl = props.link.startsWith('http') ? props.link : 'https://' + props.link;
    linkEl.href = targetUrl;
    linkBox.classList.remove('hidden');
  } else {
    linkBox.classList.add('hidden');
  }

  // Cross link to Exam Vault if it is an Exam or if exam guides exist for this subject
  const shortcutBox = document.getElementById('boxExamGuideShortcut');
  const hasExamGuide = allExamGuides.some(g => g.subject.toLowerCase() === (props.subject || '').toLowerCase());
  const isExam = (props.type || '').includes('สอบ');

  if (isExam || hasExamGuide) {
    shortcutBox.classList.remove('hidden');
  } else {
    shortcutBox.classList.add('hidden');
  }

  document.getElementById('detailModal').classList.remove('hidden');
}

// Open Task Edit Modal
function openEditModal(task) {
  if (!task) return;
  currentEditingTask = task;

  document.getElementById('editOriginalTitle').value = task.title || '';
  document.getElementById('inputEditTerm').value = task.term || '';
  document.getElementById('inputEditSubject').value = task.subject || '';
  document.getElementById('inputEditTitle').value = task.title || '';
  document.getElementById('inputEditType').value = task.type || 'การบ้าน';
  document.getElementById('inputEditStatus').value = task.status || 'รอดำเนินการ';
  document.getElementById('inputEditLink').value = task.link || '';

  const dtLocal = formatForDateTimeLocal(task.parsedDate, task.due_date);
  document.getElementById('inputEditDueDate').value = dtLocal;

  document.getElementById('detailModal').classList.add('hidden');
  document.getElementById('editModal').classList.remove('hidden');
  lucide.createIcons();
}

// Event Listeners
function initEventListeners() {
  // Navigation Tabs
  document.getElementById('navTabCalendar')?.addEventListener('click', () => switchTab('calendar'));
  document.getElementById('navTabExamVault')?.addEventListener('click', () => switchTab('exam-vault'));

  // Calendar Filters
  document.getElementById('filterTerm')?.addEventListener('change', renderFiltered);
  document.getElementById('filterSubject')?.addEventListener('change', renderFiltered);
  document.getElementById('filterType')?.addEventListener('change', renderFiltered);
  document.getElementById('hideCancelled')?.addEventListener('change', renderFiltered);

  // Exam Vault Filters
  document.getElementById('filterGuideSearch')?.addEventListener('input', renderExamGuides);
  document.getElementById('filterGuideTerm')?.addEventListener('change', renderExamGuides);
  document.getElementById('filterGuideSubject')?.addEventListener('change', renderExamGuides);

  // Format Filter Pills
  document.querySelectorAll('.btn-guide-type-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-guide-type-pill').forEach(b => {
        b.className = "btn-guide-type-pill px-3 py-1 rounded-full font-medium transition bg-slate-100 hover:bg-slate-200 text-slate-700";
      });
      btn.className = "btn-guide-type-pill px-3 py-1 rounded-full font-medium transition bg-purple-600 text-white shadow-xs";
      guideTypeFilter = btn.getAttribute('data-type');
      renderExamGuides();
    });
  });

  // Refresh Button
  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    await loadData();
    await loadExamGuides();
  });

  // Calendar Add Modal Open/Close
  const addModal = document.getElementById('addModal');
  document.getElementById('btnOpenAddModal')?.addEventListener('click', () => {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(23, 59, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    const y = tomorrow.getFullYear();
    const m = pad(tomorrow.getMonth() + 1);
    const d = pad(tomorrow.getDate());
    document.getElementById('inputDueDate').value = `${y}-${m}-${d}T23:59`;
    addModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseAddModal')?.addEventListener('click', () => addModal.classList.add('hidden'));
  document.getElementById('btnCancelAdd')?.addEventListener('click', () => addModal.classList.add('hidden'));

  // Exam Guide Add Modal Open
  const openGuideModalHandler = () => openEditGuideModal(null);
  document.getElementById('btnOpenAddGuideModal')?.addEventListener('click', openGuideModalHandler);
  document.getElementById('btnOpenAddGuideModalInView')?.addEventListener('click', openGuideModalHandler);
  document.getElementById('btnEmptyAddGuide')?.addEventListener('click', openGuideModalHandler);

  // Exam Guide Read Modal Actions
  document.getElementById('btnCloseReadGuide')?.addEventListener('click', () => {
    document.getElementById('modalReadExamGuide').classList.add('hidden');
    document.getElementById('readGuidePdfIframe').src = '';
  });
  document.getElementById('sidebarGuideSearch')?.addEventListener('input', renderSidebarGuideList);
  document.getElementById('btnSidebarAddGuide')?.addEventListener('click', () => {
    openEditGuideModal(null);
  });
  document.getElementById('btnViewModeA4')?.addEventListener('click', () => setA4ViewMode('a4'));
  document.getElementById('btnViewModePdf')?.addEventListener('click', () => setA4ViewMode('pdf'));
  document.getElementById('btnSwitchToPdfFromA4')?.addEventListener('click', () => setA4ViewMode('pdf'));
  document.getElementById('btnPrintA4Sheet')?.addEventListener('click', () => {
    window.print();
  });
  document.getElementById('btnCopyGuideToLine')?.addEventListener('click', () => {
    copyGuideToLine(currentReadingGuide);
  });
  document.getElementById('btnEditCurrentGuide')?.addEventListener('click', () => {
    openEditGuideModal(currentReadingGuide);
  });

  // Word Document Ribbon Formatting Tools (Rich Text)
  // Undo / Redo
  document.getElementById('btnWordUndo')?.addEventListener('click', () => {
    document.execCommand('undo', false, null);
    updateWordStats();
    triggerWordAutoSave();
  });
  document.getElementById('btnWordRedo')?.addEventListener('click', () => {
    document.execCommand('redo', false, null);
    updateWordStats();
    triggerWordAutoSave();
  });

  // Font Size selector
  document.getElementById('selectWordFontSize')?.addEventListener('change', (e) => {
    const size = e.target.value;
    document.execCommand('fontSize', false, size);
    triggerWordAutoSave();
  });

  // Style Headings
  document.getElementById('btnWordHeading1')?.addEventListener('click', () => {
    document.execCommand('formatBlock', false, '<h1>');
    triggerWordAutoSave();
  });
  document.getElementById('btnWordHeading2')?.addEventListener('click', () => {
    document.execCommand('formatBlock', false, '<h2>');
    triggerWordAutoSave();
  });
  document.getElementById('btnWordNormal')?.addEventListener('click', () => {
    document.execCommand('formatBlock', false, '<p>');
    triggerWordAutoSave();
  });
  document.getElementById('btnWordBold')?.addEventListener('click', () => {
    document.execCommand('bold', false, null);
    triggerWordAutoSave();
  });
  document.getElementById('btnWordItalic')?.addEventListener('click', () => {
    document.execCommand('italic', false, null);
    triggerWordAutoSave();
  });
  document.getElementById('btnWordUnderline')?.addEventListener('click', () => {
    document.execCommand('underline', false, null);
    triggerWordAutoSave();
  });
  document.getElementById('btnWordStrike')?.addEventListener('click', () => {
    document.execCommand('strikeThrough', false, null);
    triggerWordAutoSave();
  });

  // Text Alignment
  document.getElementById('btnWordAlignLeft')?.addEventListener('click', () => {
    document.execCommand('justifyLeft', false, null);
    triggerWordAutoSave();
  });
  document.getElementById('btnWordAlignCenter')?.addEventListener('click', () => {
    document.execCommand('justifyCenter', false, null);
    triggerWordAutoSave();
  });
  document.getElementById('btnWordAlignRight')?.addEventListener('click', () => {
    document.execCommand('justifyRight', false, null);
    triggerWordAutoSave();
  });

  // Highlighter Color palette
  document.querySelectorAll('.btn-word-hl').forEach(btn => {
    btn.addEventListener('click', () => {
      document.execCommand('hiliteColor', false, btn.dataset.color || '#fef08a');
      triggerWordAutoSave();
    });
  });

  document.getElementById('btnWordBullet')?.addEventListener('click', () => {
    document.execCommand('insertUnorderedList', false, null);
    triggerWordAutoSave();
  });
  document.getElementById('btnWordNumbered')?.addEventListener('click', () => {
    document.execCommand('insertOrderedList', false, null);
    triggerWordAutoSave();
  });
  document.getElementById('btnWordChecklist')?.addEventListener('click', insertChecklist);

  // Insert tools
  document.getElementById('btnInsertPage')?.addEventListener('click', addWordBlankPage);
  document.getElementById('btnAddPageBottom')?.addEventListener('click', addWordBlankPage);
  document.getElementById('btnInsertSticky')?.addEventListener('click', insertStickyNote);
  document.getElementById('btnQuickStickyBottom')?.addEventListener('click', insertStickyNote);
  document.getElementById('btnInsertTable')?.addEventListener('click', insertTable);
  document.getElementById('btnQuickTableBottom')?.addEventListener('click', insertTable);
  document.getElementById('btnInsertDivider')?.addEventListener('click', () => {
    document.execCommand('insertHorizontalRule', false, null);
    triggerWordAutoSave();
  });

  // Paper Theme Selector
  document.getElementById('selectWordTheme')?.addEventListener('change', (e) => {
    applyWordTheme(e.target.value);
  });

  // Sidebar Toggle (Distraction Free View)
  document.getElementById('btnToggleWordSidebar')?.addEventListener('click', toggleWordSidebar);

  // Template Library Modal open/close & selection
  const modalTemplatePicker = document.getElementById('modalTemplatePicker');
  const openTemplateModal = () => {
    modalTemplatePicker?.classList.remove('hidden');
    lucide.createIcons();
  };
  const closeTemplateModal = () => {
    modalTemplatePicker?.classList.add('hidden');
  };
  document.getElementById('btnOpenTemplatesModal')?.addEventListener('click', openTemplateModal);
  document.getElementById('btnSidebarOpenTemplates')?.addEventListener('click', openTemplateModal);
  document.getElementById('btnCloseTemplatePicker')?.addEventListener('click', closeTemplateModal);

  document.querySelectorAll('.btn-select-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const template = btn.getAttribute('data-template');
      createDocumentFromTemplate(template);
    });
  });

  // Document management actions
  document.getElementById('btnSidebarNewDoc')?.addEventListener('click', createNewBlankWordDocument);
  document.getElementById('btnNavbarCreateWordDoc')?.addEventListener('click', createNewBlankWordDocument);
  document.getElementById('btnCreateBlankWordDocInVault')?.addEventListener('click', createNewBlankWordDocument);
  document.getElementById('btnSidebarDeleteCurrentDoc')?.addEventListener('click', deleteCurrentDocument);

  // Status Bar Actions
  document.getElementById('btnDuplicateDoc')?.addEventListener('click', duplicateCurrentDocument);
  document.getElementById('btnBackupDocJson')?.addEventListener('click', exportCurrentDocJson);
  document.getElementById('btnDownloadDocText')?.addEventListener('click', downloadDocumentText);

  // Exam Vault Backup & Restore Buttons
  document.getElementById('btnExportAllGuidesJson')?.addEventListener('click', exportAllGuidesJson);
  document.getElementById('inputRestoreGuidesFile')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importGuidesJson(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Guarantee Zero Data Loss when leaving or refreshing page
  window.addEventListener('beforeunload', () => {
    saveWordDocumentLocalOnly();
  });

  // Sync title bar with document
  document.getElementById('topWordDocTitleInput')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (currentReadingGuide) currentReadingGuide.title = val;
    const docTitle = document.querySelector('.word-doc-title');
    if (docTitle) docTitle.innerText = val;
    triggerWordAutoSave();
  });

  document.getElementById('btnSaveWordDoc')?.addEventListener('click', () => saveWordDocument(true));
  document.getElementById('btnTogglePageWidth')?.addEventListener('click', togglePageWidth);

  // Shortcut Ctrl+S / Cmd+S to save Word document, Ctrl+\ to toggle sidebar
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modalReadExamGuide');
    if (!modal || modal.classList.contains('hidden')) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveWordDocument();
    } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
      e.preventDefault();
      toggleWordSidebar();
    }
  });

  // Exam Guide Edit Modal Close
  const modalEditExamGuide = document.getElementById('modalEditExamGuide');
  document.getElementById('btnCloseEditGuideModal')?.addEventListener('click', () => modalEditExamGuide?.classList.add('hidden'));
  document.getElementById('btnCancelEditGuide')?.addEventListener('click', () => modalEditExamGuide?.classList.add('hidden'));

  // Shortcut from Calendar Detail to Exam Vault
  document.getElementById('btnViewExamGuideFromCalendar')?.addEventListener('click', () => {
    document.getElementById('detailModal')?.classList.add('hidden');
    switchTab('exam-vault');
    if (currentDetailTask && currentDetailTask.subject) {
      const subjectSelect = document.getElementById('filterGuideSubject');
      if (subjectSelect) {
        subjectSelect.value = currentDetailTask.subject;
        renderExamGuides();
      }
      const match = allExamGuides.find(g => g.subject.toLowerCase() === currentDetailTask.subject.toLowerCase());
      if (match) {
        setTimeout(() => openReadGuideModal(match), 100);
      }
    }
  });

  // Task Details Modal Close & Edit button inside Details
  document.getElementById('btnCloseDetailModal')?.addEventListener('click', () => {
    document.getElementById('detailModal')?.classList.add('hidden');
  });
  document.getElementById('btnEditFromDetail')?.addEventListener('click', () => {
    if (currentDetailTask) {
      openEditModal(currentDetailTask);
    }
  });

  // Task Edit Modal Close
  const editModal = document.getElementById('editModal');
  document.getElementById('btnCloseEditModal')?.addEventListener('click', () => editModal?.classList.add('hidden'));
  document.getElementById('btnCancelEdit')?.addEventListener('click', () => editModal?.classList.add('hidden'));

  // Add Task Submit Form
  document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitAdd');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `กำลังบันทึก...`;

    const term = document.getElementById('inputTerm').value.trim();
    const subject = document.getElementById('inputSubject').value.trim();
    const title = document.getElementById('inputTitle').value.trim();
    const type = document.getElementById('inputType').value;
    const due_date_val = document.getElementById('inputDueDate').value;
    const status = document.getElementById('inputStatus').value;
    const link = document.getElementById('inputLink').value.trim();

    const formattedDate = formatDateTimeForSheet(due_date_val) || due_date_val;

    const rowPayload = formatTaskForSupabase({
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      term: term,
      subject: subject,
      title: title,
      type: type,
      due_date: formattedDate,
      status: status,
      link: link
    });

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tasks').insert([rowPayload]);
        if (error) console.warn('Supabase task insert error:', error);
      } catch (err) {
        console.error('Error posting task to Supabase:', err);
      }
    }

    allTasks.push(normalizeTask(rowPayload));
    saveLocalTasks(allTasks);
    renderAllViews();
    addModal.classList.add('hidden');
    document.getElementById('addTaskForm').reset();

    Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: supabaseClient ? 'ข้อมูลถูกส่งเข้า Supabase เรียบร้อยแล้ว' : 'บันทึกข้อมูลเรียบร้อยแล้ว',
      timer: 1800,
      showConfirmButton: false
    });

    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกงาน</span>`;
    lucide.createIcons();
  });

  // Edit Task Submit Form
  document.getElementById('editTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitEdit');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `กำลังบันทึก...`;

    const originalTitle = document.getElementById('editOriginalTitle').value.trim();
    const term = document.getElementById('inputEditTerm').value.trim();
    const subject = document.getElementById('inputEditSubject').value.trim();
    const title = document.getElementById('inputEditTitle').value.trim();
    const type = document.getElementById('inputEditType').value;
    const status = document.getElementById('inputEditStatus').value;
    const due_date_val = document.getElementById('inputEditDueDate').value;
    const link = document.getElementById('inputEditLink').value.trim();

    const formattedDate = formatDateTimeForSheet(due_date_val) || due_date_val;

    const updatedPayload = formatTaskForSupabase({
      id: currentEditingTask?.id || `task_${Date.now()}`,
      term: term,
      subject: subject,
      title: title,
      type: type,
      due_date: formattedDate,
      status: status,
      link: link
    });

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('tasks').update(updatedPayload).eq('title', originalTitle);
        if (error) console.warn('Supabase update error:', error);
      } catch (err) {
        console.error('Error updating task in Supabase:', err);
      }
    }

    const idx = allTasks.findIndex(t => t.title === originalTitle);
    if (idx !== -1) {
      allTasks[idx] = normalizeTask(updatedPayload);
    }
    saveLocalTasks(allTasks);
    renderAllViews();
    editModal.classList.add('hidden');

    Swal.fire({
      icon: 'success',
      title: 'แก้ไขสำเร็จ!',
      text: supabaseClient ? 'ข้อมูลถูกอัปเดตลง Supabase เรียบร้อยแล้ว' : 'แก้ไขข้อมูลเรียบร้อยแล้ว',
      timer: 1800,
      showConfirmButton: false
    });

    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกการแก้ไข</span>`;
    lucide.createIcons();
  });

  // Delete Task Button
  document.getElementById('btnDeleteTask')?.addEventListener('click', async () => {
    const originalTitle = document.getElementById('editOriginalTitle').value.trim();
    if (!originalTitle) return;

    const confirmRes = await Swal.fire({
      title: 'ยืนยันการลบงาน?',
      text: `คุณต้องการลบ "${originalTitle}" ออกจากระบบใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ลบงานนี้',
      cancelButtonText: 'ยกเลิก'
    });

    if (!confirmRes.isConfirmed) return;

    if (supabaseClient) {
      try {
        await supabaseClient.from('tasks').delete().eq('title', originalTitle);
      } catch (e) {
        console.warn('Supabase delete error:', e);
      }
    }

    allTasks = allTasks.filter(t => t.title !== originalTitle);
    saveLocalTasks(allTasks);
    renderAllViews();
    editModal.classList.add('hidden');
    Swal.fire({
      icon: 'success',
      title: 'ลบสำเร็จ!',
      timer: 1500,
      showConfirmButton: false
    });
  });

  // Exam Guide Submit Form (Add or Edit)
  document.getElementById('examGuideForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitExamGuide');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `กำลังบันทึก...`;

    const originalId = document.getElementById('inputGuideOriginalId').value.trim();
    const isEdit = Boolean(originalId);
    const newId = isEdit ? originalId : `guide_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const guidePayload = formatGuideForSupabase({
      id: newId,
      term: document.getElementById('inputGuideTerm').value.trim(),
      subject: document.getElementById('inputGuideSubject').value.trim(),
      exam_type: document.getElementById('selectGuideExamType').value,
      title: document.getElementById('inputGuideTitle').value.trim(),
      format: document.getElementById('inputGuideFormat').value.trim(),
      scope: document.getElementById('inputGuideScope').value.trim(),
      tips: document.getElementById('inputGuideTips').value.trim(),
      pdf_link: document.getElementById('inputGuidePdfLink').value.trim(),
      contributor: document.getElementById('inputGuideContributor').value.trim() || 'ฉันเอง',
      created_at: new Date().toLocaleDateString('th-TH')
    });

    let saveSuccess = false;

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('exam_guides').upsert(guidePayload);
        if (!error) saveSuccess = true;
        else console.warn('Supabase ExamGuides sync failed:', error);
      } catch (err) {
        console.warn('Supabase ExamGuides sync failed:', err);
      }
    }

    // Update local memory & storage
    if (isEdit) {
      const idx = allExamGuides.findIndex(g => g.id === originalId);
      if (idx !== -1) {
        allExamGuides[idx] = normalizeExamGuide(guidePayload);
      }
    } else {
      allExamGuides.unshift(normalizeExamGuide(guidePayload));
    }
    saveLocalExamGuides(allExamGuides);

    const badge = document.getElementById('badgeGuideCount');
    if (badge) badge.textContent = allExamGuides.length;

    updateExamGuideFilterDropdowns();
    renderExamGuides();

    document.getElementById('modalEditExamGuide').classList.add('hidden');
    document.getElementById('examGuideForm').reset();

    Swal.fire({
      icon: 'success',
      title: isEdit ? 'แก้ไขแนวข้อสอบสำเร็จ!' : 'แชร์แนวข้อสอบสำเร็จ!',
      text: saveSuccess ? 'ข้อมูลถูกบันทึกขึ้น Supabase Cloud เรียบร้อยแล้ว' : 'บันทึกข้อมูลเรียบร้อยแล้ว',
      timer: 2000,
      showConfirmButton: false
    });

    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกแนวข้อสอบ</span>`;
    lucide.createIcons();
  });

  // Exam Guide Delete Button
  document.getElementById('btnDeleteExamGuide')?.addEventListener('click', async () => {
    const originalId = document.getElementById('inputGuideOriginalId').value.trim();
    if (!originalId) return;
    const guide = allExamGuides.find(g => g.id === originalId);
    await deleteGuideById(originalId, guide?.title);
  });

  // Database Settings Modal Event Handlers
  const modalDbSettings = document.getElementById('modalDbSettings');
  document.getElementById('btnOpenDbSettings')?.addEventListener('click', () => {
    const { url, key } = getSupabaseConfig();
    const inputUrl = document.getElementById('inputSupabaseUrl');
    const inputKey = document.getElementById('inputSupabaseKey');
    if (inputUrl) inputUrl.value = url;
    if (inputKey) inputKey.value = key;
    modalDbSettings?.classList.remove('hidden');
    lucide.createIcons();
  });

  document.getElementById('btnCloseDbSettings')?.addEventListener('click', () => {
    modalDbSettings?.classList.add('hidden');
  });

  // Save Supabase Settings & Test Connection
  document.getElementById('formDbSettings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('inputSupabaseUrl').value.trim();
    const key = document.getElementById('inputSupabaseKey').value.trim();
    const btnSave = document.getElementById('btnSaveDbSettings');

    if (!url || !key) {
      Swal.fire({ icon: 'warning', title: 'โปรดกรอก Project URL และ Anon Key' });
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'กำลังทดสอบการเชื่อมต่อ...';

    try {
      if (!window.supabase?.createClient) {
        throw new Error('Supabase library ยังไม่พร้อมใช้งาน กรุณารีเฟรชหน้าเว็บ');
      }
      const testClient = window.supabase.createClient(url, key);
      const { data, error } = await testClient.from('tasks').select('*').limit(1);
      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message || 'การเชื่อมต่อล้มเหลว');
      }

      // Save to localStorage
      localStorage.setItem('supabase_project_url', url);
      localStorage.setItem('supabase_anon_key', key);

      initSupabase();
      await loadData();
      await loadExamGuides();

      modalDbSettings?.classList.add('hidden');
      Swal.fire({
        icon: 'success',
        title: 'เชื่อมต่อ Supabase สำเร็จ!',
        text: 'ระบบเริ่มใช้งานฐานข้อมูล PostgreSQL และ Realtime Sync เรียบร้อยแล้ว',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      const isMissingTable = err.message.includes('relation "public.tasks" does not exist') || err.message.includes('tasks');
      Swal.fire({
        icon: 'error',
        title: 'เชื่อมต่อไม่สำเร็จ',
        text: isMissingTable
          ? 'เชื่อมต่อได้ แต่ยังไม่ได้สร้างตาราง! กรุณาก๊อปปี้โค้ดใน supabase_schema.sql ไปกด Run ใน Supabase SQL Editor ก่อนนะครับ'
          : `เกิดข้อผิดพลาด: ${err.message}`
      });
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'บันทึก & เชื่อมต่อ';
    }
  });

  // Disconnect Supabase
  document.getElementById('btnDisconnectSupabase')?.addEventListener('click', () => {
    localStorage.removeItem('supabase_project_url');
    localStorage.removeItem('supabase_anon_key');
    initSupabase();
    modalDbSettings?.classList.add('hidden');
    Swal.fire({
      icon: 'info',
      title: 'ยกเลิกการเชื่อมต่อ Supabase แล้ว',
      text: 'ระบบเปลี่ยนกลับมาใช้ LocalStorage และ SheetDB ชั่วคราว',
      timer: 1800,
      showConfirmButton: false
    });
  });

  // Migrate Data to Supabase in 1 click
  document.getElementById('btnMigrateToSupabase')?.addEventListener('click', async () => {
    if (!supabaseClient) {
      Swal.fire({ icon: 'warning', title: 'ยังไม่ได้เชื่อมต่อ Supabase', text: 'กรุณากรอก URL และ Key แล้วกดบันทึกก่อนโอนข้อมูล' });
      return;
    }

    const confirmRes = await Swal.fire({
      title: 'โอนข้อมูลขึ้น Supabase?',
      text: `จะทำการส่งงาน ${allTasks.length} รายการ และเอกสารข้อสอบ ${allExamGuides.length} ชุด ขึ้นสู่ Supabase Cloud`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, โอนข้อมูลเลย',
      cancelButtonText: 'ยกเลิก'
    });

    if (!confirmRes.isConfirmed) return;

    Swal.fire({
      title: 'กำลังโอนย้ายข้อมูล...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // 1. Migrate tasks
      if (allTasks.length > 0) {
        const tasksPayload = allTasks.map(t => ({
          id: t.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          term: t.term || '',
          subject: t.subject || '',
          title: t.title || '',
          type: t.type || 'การบ้าน',
          due_date: t.due_date || '',
          status: t.status || 'รอดำเนินการ',
          link: t.link || ''
        }));
        const { error: tErr } = await supabaseClient.from('tasks').upsert(tasksPayload);
        if (tErr) throw tErr;
      }

      // 2. Migrate exam guides
      if (allExamGuides.length > 0) {
        const guidesPayload = allExamGuides.map(g => ({
          id: g.id || `guide_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          term: g.term || '',
          subject: g.subject || '',
          exam_type: g.exam_type || 'สรุปบทเรียน',
          title: g.title || '',
          format: g.format || '',
          scope: g.scope || g.content_html || '',
          tips: g.tips || '',
          pdf_link: g.pdf_link || '',
          contributor: g.contributor || 'เพื่อนร่วมชั้น',
          content_html: g.content_html || g.scope || '',
          pages: g.pages || [],
          created_at: g.created_at || new Date().toLocaleDateString('th-TH')
        }));
        const { error: gErr } = await supabaseClient.from('exam_guides').upsert(guidesPayload);
        if (gErr) throw gErr;
      }

      await loadData();
      await loadExamGuides();

      modalDbSettings?.classList.add('hidden');
      Swal.fire({
        icon: 'success',
        title: 'โอนย้ายข้อมูลสำเร็จ!',
        text: 'ข้อมูลทั้งหมดถูกเก็บไว้บน Supabase Cloud เรียบร้อยแล้ว',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'โอนย้ายล้มเหลว',
        text: `เกิดข้อผิดพลาด: ${e.message}`
      });
    }
  });
}
