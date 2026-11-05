// Shared Calendar Web App with SheetDB Integration

// Helper to get SheetDB API URL from .env
function getApiUrl() {
  const envUrl = import.meta.env?.VITE_SHEETDB_API_URL;
  return envUrl ? envUrl.trim() : '';
}

// Demo initial sample data if user hasn't set SheetDB yet
const defaultDemoData = [
  {
    term: "1/2569",
    subject: "CS101",
    title: "สอบกลางภาค (Midterm Exam)",
    type: "สอบ",
    due_date: "09/11/2026 09:30",
    status: "รอดำเนินการ",
    link: "https://drive.google.com"
  },
  {
    term: "1/2569",
    subject: "CS102",
    title: "การบ้านเขียนโปรแกรม Lab 3",
    type: "การบ้าน",
    due_date: "07/11/2026 23:59",
    status: "กำลังทำ",
    link: "https://classroom.google.com"
  },
  {
    term: "1/2569",
    subject: "GEN201",
    title: "รายงานกลุ่มวิชาศึกษาทั่วไป",
    type: "โปรเจกต์",
    due_date: "15/11/2026 18:00",
    status: "รอดำเนินการ",
    link: ""
  },
  {
    term: "2/2569",
    subject: "CS201",
    title: "สอบ Final Data Structures",
    type: "สอบ",
    due_date: "26/11/2026 13:30",
    status: "รอดำเนินการ",
    link: ""
  }
];

let allTasks = [];
let calendar = null;

// Parse date string handling DD/MM/YYYY, YYYY-MM-DD, Buddhist Era (พ.ศ.), and optional time
function parseThaiDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  // 1. Check DD/MM/YYYY or D/M/YYYY (e.g. 7/11/2026, 07/11/2569, 13/11/2026 23:59)
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[T\s](\d{1,2})[:\.](\d{2})(?:[:\.](\d{2}))?)?$/);
  if (dmy) {
    let day = parseInt(dmy[1], 10);
    let month = parseInt(dmy[2], 10) - 1; // 0-indexed
    let year = parseInt(dmy[3], 10);
    if (year > 2400) year -= 543; // พ.ศ. -> ค.ศ.

    const hasTime = dmy[4] !== undefined;
    let hours = hasTime ? parseInt(dmy[4], 10) : 23;
    let minutes = hasTime ? parseInt(dmy[5], 10) : 59;
    let seconds = dmy[6] !== undefined ? parseInt(dmy[6], 10) : 0;

    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : { date: d, hasTime: hasTime };
  }

  // 2. Check YYYY-MM-DD (ISO format e.g. 2026-11-07 or 2026-11-07T23:59)
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2})[:\.](\d{2})(?:[:\.](\d{2}))?)?$/);
  if (ymd) {
    let year = parseInt(ymd[1], 10);
    if (year > 2400) year -= 543;
    let month = parseInt(ymd[2], 10) - 1;
    let day = parseInt(ymd[3], 10);

    const hasTime = ymd[4] !== undefined;
    let hours = hasTime ? parseInt(ymd[4], 10) : 23;
    let minutes = hasTime ? parseInt(ymd[5], 10) : 59;
    let seconds = ymd[6] !== undefined ? parseInt(ymd[6], 10) : 0;

    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : { date: d, hasTime: hasTime };
  }

  // 3. Fallback
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return {
      date: fallback,
      hasTime: str.includes(':') || str.includes('T')
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

  if (parsed.hasTime) {
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${mins}:00`;
  }
  return `${year}-${month}-${day}`;
}

// Normalize task object to handle both lowercase and capitalized keys (e.g. Due Date, Term, Subject)
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

  const rawDate = getProp(['due_date', 'dueDate', 'Due Date', 'DueDate', 'Date', 'date']);
  const parsedDate = parseThaiDate(rawDate);

  return {
    term: getProp(['term', 'Term']),
    subject: getProp(['subject', 'Subject', 'วิชา', 'ชื่อวิชา', 'course', 'Course']),
    title: getProp(['title', 'Title', 'name', 'Name']),
    type: getProp(['type', 'Type', 'category']),
    due_date: rawDate,
    parsedDate: parsedDate,
    eventStart: getEventStartString(parsedDate),
    status: getProp(['status', 'Status']),
    link: getProp(['link', 'Link', 'URL', 'Url'])
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

function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (isCompleted(s)) return 'bg-emerald-100 text-emerald-700 font-semibold';
  if (s.includes('กำลัง') || s.includes('in progress')) return 'bg-sky-100 text-sky-700';
  return 'bg-amber-100 text-amber-700';
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initCalendar();
  initEventListeners();
  loadData();
});

// FullCalendar Setup
function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth',
    eventDisplay: 'block',
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
      meridiem: false,
      hour12: false
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

// Fetch Tasks (From SheetDB or Local Demo)
async function loadData() {
  const apiUrl = getApiUrl();
  const refreshIcon = document.getElementById('refreshIcon');

  refreshIcon.classList.add('animate-spin');

  if (!apiUrl) {
    allTasks = defaultDemoData.map(normalizeTask);
    renderAllViews();
    refreshIcon.classList.remove('animate-spin');
    return;
  }

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allTasks = Array.isArray(data) ? data.map(normalizeTask) : [];
    renderAllViews();
  } catch (err) {
    console.error('Error fetching data:', err);
    Swal.fire({
      icon: 'error',
      title: 'ไม่สามารถโหลดข้อมูลได้',
      text: 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ URL ในไฟล์ .env',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#4f46e5'
    });
  } finally {
    refreshIcon.classList.remove('animate-spin');
  }
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

  const filtered = allTasks.filter(item => {
    const matchTerm = (selectedTerm === 'ALL' || item.term === selectedTerm);
    const matchSubject = (selectedSubject === 'ALL' || item.subject === selectedSubject);
    const matchType = (selectedType === 'ALL' || item.type === selectedType);
    return matchTerm && matchSubject && matchType;
  });

  // 1. Update Calendar Events
  calendar.removeAllEvents();
  const events = filtered.map(item => {
    let color = isCompleted(item.status) ? '#10b981' : getTypeMeta(item.type).color;
    const titleSubject = item.subject ? `[${item.subject}] ` : '';

    return {
      title: `${titleSubject}${item.title}`,
      start: item.eventStart || item.due_date,
      allDay: !item.parsedDate?.hasTime,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
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

  sorted.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const typeMeta = getTypeMeta(t.type);
    const statusClass = getStatusBadgeClass(t.status);
    const countdown = calculateCountdown(t.parsedDate, t.status);
    const formattedDate = formatThaiDateTime(t.parsedDate, t.due_date);
    const subjectBadge = t.subject
      ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">${t.subject}</span>`
      : `<span class="text-slate-400 text-xs">-</span>`;

    tr.innerHTML = `
      <td class="px-4 py-3 font-medium text-slate-600">${t.term || '-'}</td>
      <td class="px-4 py-3">${subjectBadge}</td>
      <td class="px-4 py-3">
        <span class="font-medium text-slate-800">${t.title}</span>
      </td>
      <td class="px-4 py-3">
        <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${typeMeta.badgeClass}">${t.type || '-'}</span>
      </td>
      <td class="px-4 py-3 text-slate-600">${formattedDate}</td>
      <td class="px-4 py-3">${countdown}</td>
      <td class="px-4 py-3">
        <span class="px-2.5 py-0.5 rounded-full text-xs ${statusClass}">${t.status || '-'}</span>
      </td>
      <td class="px-4 py-3 text-right space-x-1">
        ${t.link ? `<a href="${t.link.startsWith('http') ? t.link : 'https://' + t.link}" target="_blank" rel="noopener noreferrer" title="เปิดเอกสาร" class="inline-block p-1 text-indigo-600 hover:text-indigo-800"><i data-lucide="external-link" class="w-4 h-4"></i></a>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// Calculate D-Day Countdown
function calculateCountdown(dueDateInfo, status) {
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

  if (!dueDateInfo.hasTime) {
    return datePart;
  }

  const timePart = d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${datePart} ${timePart} น.`;
}

// Populate Term, Subject and Type Dropdowns dynamically
function updateFilterDropdowns() {
  // 1. Term Filter
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

  // 2. Subject Filter
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

  // 3. Type Filter
  const typeSelect = document.getElementById('filterType');
  const currentType = typeSelect.value;
  const types = Array.from(new Set(allTasks.map(t => t.type).filter(Boolean)));

  typeSelect.innerHTML = `<option value="ALL">ทุกประเภท (All)</option>`;
  types.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    typeSelect.appendChild(opt);
  });
  if (types.includes(currentType)) typeSelect.value = currentType;
}

// Show Details Modal on Calendar Event Click
function showEventDetails(props) {
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

  document.getElementById('detailModal').classList.remove('hidden');
}

// Event Listeners
function initEventListeners() {
  // Filters
  document.getElementById('filterTerm').addEventListener('change', renderFiltered);
  document.getElementById('filterSubject')?.addEventListener('change', renderFiltered);
  document.getElementById('filterType').addEventListener('change', renderFiltered);

  // Refresh Button
  document.getElementById('btnRefresh').addEventListener('click', loadData);

  // Add Modal Open/Close
  const addModal = document.getElementById('addModal');
  document.getElementById('btnOpenAddModal').addEventListener('click', () => {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(23, 59, 0, 0);
    document.getElementById('inputDueDate').value = tomorrow.toISOString().slice(0, 16);
    addModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseAddModal').addEventListener('click', () => addModal.classList.add('hidden'));
  document.getElementById('btnCancelAdd').addEventListener('click', () => addModal.classList.add('hidden'));

  // Details Modal Close
  document.getElementById('btnCloseDetailModal').addEventListener('click', () => {
    document.getElementById('detailModal').classList.add('hidden');
  });

  // Add Task Submit Form
  document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitAdd');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `กำลังบันทึก...`;

    const term = document.getElementById('inputTerm').value.trim();
    const subject = document.getElementById('inputSubject').value.trim();
    const title = document.getElementById('inputTitle').value.trim();
    const type = document.getElementById('inputType').value;
    const due_date = document.getElementById('inputDueDate').value;
    const status = document.getElementById('inputStatus').value;
    const link = document.getElementById('inputLink').value.trim();

    // Payload supporting both English capitalized headers & lowercase
    const rowPayload = {
      "Term": term,
      "Subject": subject,
      "Title": title,
      "Type": type,
      "Due Date": due_date,
      "Status": status,
      "Link": link,
      "term": term,
      "subject": subject,
      "title": title,
      "type": type,
      "due_date": due_date,
      "status": status,
      "link": link
    };

    const apiUrl = getApiUrl();

    if (apiUrl) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ data: [rowPayload] })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          text: 'ข้อมูลถูกส่งเข้า Google Sheet เรียบร้อยแล้ว',
          timer: 1800,
          showConfirmButton: false
        });

        addModal.classList.add('hidden');
        document.getElementById('addTaskForm').reset();
        await loadData();
      } catch (err) {
        console.error('Error posting task:', err);
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถบันทึกลง Google Sheet ได้ โปรดลองใหม่อีกครั้ง'
        });
      }
    }

    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกลง Google Sheet</span>`;
    lucide.createIcons();
  });
}
