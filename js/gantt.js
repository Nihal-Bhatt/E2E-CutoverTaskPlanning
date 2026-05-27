let GANTT_DATA = null;
let expandedCategory = null;

const DAY_MS = 86400000;

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s + "T12:00:00");
  return isNaN(d) ? null : d;
}

function getScheduleBounds(tasks) {
  let min = null;
  let max = null;
  for (const t of tasks) {
    const a = parseDate(t.plannedStart);
    const b = parseDate(t.plannedEnd);
    for (const d of [a, b]) {
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
  }
  if (!min || !max) {
    min = new Date("2026-04-01T12:00:00");
    max = new Date("2026-06-30T12:00:00");
  }
  min = new Date(min.getTime() - 3 * DAY_MS);
  max = new Date(max.getTime() + 7 * DAY_MS);
  return { min, max, span: max - min };
}

function dateToPct(d, bounds) {
  return ((d - bounds.min) / bounds.span) * 100;
}

function barStyle(start, end, bounds) {
  const s = parseDate(start);
  const e = parseDate(end) || s;
  if (!s) return null;
  const left = dateToPct(s, bounds);
  const right = dateToPct(e, bounds);
  const width = Math.max(0.8, right - left);
  return { left: `${left}%`, width: `${width}%` };
}

function tasksByCategory(tasks) {
  const map = new Map();
  tasks.forEach((t) => {
    const cat = t.category || "—";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(t);
  });
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

function renderTimelineHeader(bounds, container) {
  const header = document.createElement("div");
  header.className = "gantt-timeline-header";
  header.innerHTML = `<div></div><div class="gantt-months" id="gantt-months"></div>`;
  container.appendChild(header);

  const months = document.getElementById("gantt-months");
  const cursor = new Date(bounds.min);
  cursor.setDate(1);
  while (cursor <= bounds.max) {
    const label = document.createElement("span");
    label.className = "gantt-month-label";
    label.textContent = cursor.toLocaleString("en", { month: "short", year: "2-digit" });
    label.style.left = `${dateToPct(cursor, bounds)}%`;
    months.appendChild(label);
    cursor.setMonth(cursor.getMonth() + 1);
  }
}

function createTrack(bounds, withToday = true) {
  const track = document.createElement("div");
  track.className = "gantt-track";
  if (withToday) {
    const today = new Date();
    if (today >= bounds.min && today <= bounds.max) {
      const line = document.createElement("div");
      line.className = "gantt-today";
      line.style.left = `${dateToPct(today, bounds)}%`;
      track.appendChild(line);
    }
  }
  return track;
}

function addBar(track, style, className, title) {
  if (!style) return;
  const bar = document.createElement("div");
  bar.className = `gantt-bar ${className}`;
  bar.style.left = style.left;
  bar.style.width = style.width;
  bar.title = title;
  track.appendChild(bar);
  return bar;
}

function categorySpan(tasks) {
  let min = null;
  let max = null;
  tasks.forEach((t) => {
    const a = parseDate(t.plannedStart);
    const b = parseDate(t.plannedEnd);
    if (a && (!min || a < min)) min = a;
    if (b && (!max || b > max)) max = b;
    if (a && !b && (!max || a > max)) max = a;
  });
  return { min, max };
}

function renderGantt(tasks) {
  const chart = document.getElementById("gantt-chart");
  chart.innerHTML = "";

  const withDates = tasks.filter(
    (t) => parseDate(t.plannedStart) || parseDate(t.plannedEnd)
  );
  const bounds = getScheduleBounds(withDates.length ? withDates : tasks);

  renderTimelineHeader(bounds, chart);

  const groups = tasksByCategory(tasks);

  groups.forEach(([category, catTasks]) => {
    const delayed = catTasks.filter((t) => t.late).length;
    const row = document.createElement("div");
    row.className = "gantt-category-row";
    if (expandedCategory === category) row.classList.add("expanded");

    const label = document.createElement("div");
    label.className = "gantt-category-label";
    label.innerHTML = `<span class="chev">${expandedCategory === category ? "▼" : "▶"}</span> ${escapeHtml(category)}${
      delayed ? ` <span class="late-pill">${delayed} late</span>` : ""
    }`;

    const track = createTrack(bounds);
    const span = categorySpan(catTasks);
    if (span.min) {
      const st = barStyle(
        span.min.toISOString().slice(0, 10),
        span.max.toISOString().slice(0, 10),
        bounds
      );
      const bar = addBar(track, st, "category", `${category} (${catTasks.length} tasks)`);
      if (delayed) bar?.classList.add("delayed");
    }

    row.append(label, track);

    row.addEventListener("click", () => {
      expandedCategory = expandedCategory === category ? null : category;
      renderGantt(tasks);
      if (expandedCategory === category) {
        showCategoryDetail(category, catTasks, bounds);
      } else {
        document.getElementById("gantt-detail").hidden = true;
      }
    });

    chart.appendChild(row);

    if (expandedCategory === category) {
      const wrap = document.createElement("div");
      wrap.className = "gantt-task-rows";
      catTasks
        .sort((a, b) => (a.plannedStart || "").localeCompare(b.plannedStart || ""))
        .forEach((t) => {
          const tRow = document.createElement("div");
          tRow.className = "gantt-task-row";
          const tLabel = document.createElement("div");
          tLabel.className = "gantt-task-label";
          tLabel.textContent = `${t.id} · ${t.name}`;
          const tTrack = createTrack(bounds, false);
          const st = barStyle(t.plannedStart, t.plannedEnd, bounds);
          const cls = `task ${t.statusKey}${t.late ? " delayed" : ""}`;
          addBar(tTrack, st, cls, `${t.name} (${t.status})`);
          tRow.append(tLabel, tTrack);
          wrap.appendChild(tRow);
        });
      chart.appendChild(wrap);
    }
  });
}

function showCategoryDetail(category, tasks, bounds) {
  const panel = document.getElementById("gantt-detail");
  panel.hidden = false;
  document.getElementById("gantt-detail-title").textContent = category;
  const inner = document.getElementById("gantt-detail-chart");
  inner.innerHTML = "";
  renderTimelineHeader(bounds, inner);
  const groups = [[category, tasks]];
  groups.forEach(([cat, catTasks]) => {
    catTasks.forEach((t) => {
      const tRow = document.createElement("div");
      tRow.className = "gantt-task-row";
      const tLabel = document.createElement("div");
      tLabel.className = "gantt-task-label";
      tLabel.textContent = `${t.id} · ${t.name}`;
      const tTrack = createTrack(bounds);
      const st = barStyle(t.plannedStart, t.plannedEnd, bounds);
      const cls = `task ${t.statusKey}${t.late ? " delayed" : ""}`;
      addBar(tTrack, st, cls, `${t.name}`);
      tRow.append(tLabel, tTrack);
      inner.appendChild(tRow);
    });
  });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function initGantt() {
  const loading = document.getElementById("loading");
  try {
    GANTT_DATA = await loadDashboardData();
    const tasks = GANTT_DATA.tasks || [];
    document.getElementById("gantt-subtitle").textContent =
      `${tasks.length} tasks · click category to expand · red dot = delayed`;
    renderGantt(tasks);
    loading.style.display = "none";
    document.getElementById("gantt-app").hidden = false;

    document.getElementById("btn-refresh").addEventListener("click", async () => {
      const btn = document.getElementById("btn-refresh");
      btn.disabled = true;
      btn.classList.add("loading");
      try {
        GANTT_DATA = await refreshDashboardData();
        expandedCategory = null;
        renderGantt(GANTT_DATA.tasks || []);
      } catch (e) {
        alert(e.message);
      } finally {
        btn.disabled = false;
        btn.classList.remove("loading");
      }
    });

    document.getElementById("gantt-detail-close").addEventListener("click", () => {
      document.getElementById("gantt-detail").hidden = true;
    });
  } catch (e) {
    loading.className = "error";
    loading.textContent = "Could not load gantt data.";
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", initGantt);
