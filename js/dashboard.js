const STATUS_LABELS = {
  notStarted: "Not Started",
  inProgress: "In Progress",
  completed: "Completed",
};

let RAW_DATA = null;
let DATA = null;
let selectedTeams = [];
let lastGeneratedAt = null;

function hasTaskDetails() {
  return Array.isArray(RAW_DATA?.tasks) && RAW_DATA.tasks.length > 0;
}

function normalizeTeam(name) {
  if (!name || name === "nan" || name === "NaN") return null;
  return String(name);
}

function pct(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showToast(message, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.remove("show"), 5000);
}

function showTooltip(text, x, y) {
  const el = document.getElementById("tooltip");
  el.textContent = text;
  el.hidden = false;
  el.style.left = `${x + 12}px`;
  el.style.top = `${y + 12}px`;
}

function hideTooltip() {
  document.getElementById("tooltip").hidden = true;
}

function getTeamsList() {
  if (hasTaskDetails()) {
    return [
      ...new Set(
        RAW_DATA.tasks.map((t) => normalizeTeam(t.team)).filter(Boolean)
      ),
    ].sort();
  }
  if (RAW_DATA?.byTeam?.length) {
    return RAW_DATA.byTeam
      .map((r) => r.name)
      .filter((n) => n && n !== "Overall")
      .sort();
  }
  return [];
}

function getActiveTasks() {
  if (!hasTaskDetails()) return [];
  if (!selectedTeams.length) return RAW_DATA.tasks;
  return RAW_DATA.tasks.filter((t) => selectedTeams.includes(t.team));
}

function aggregateBy(tasks, field) {
  const map = new Map();
  tasks.forEach((t) => {
    const key = t[field] || "—";
    if (!map.has(key)) {
      map.set(key, { notStarted: 0, inProgress: 0, completed: 0, delayed: 0 });
    }
    const row = map.get(key);
    if (t.statusKey === "notStarted") row.notStarted++;
    else if (t.statusKey === "inProgress") row.inProgress++;
    else if (t.statusKey === "completed") row.completed++;
    if (t.late) row.delayed++;
  });
  const rows = [...map.entries()].map(([name, c]) => ({
    name,
    notStarted: c.notStarted,
    inProgress: c.inProgress,
    completed: c.completed,
    total: c.notStarted + c.inProgress + c.completed,
    delayed: c.delayed,
  }));
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

function overallFromTasks(tasks) {
  const ns = tasks.filter((t) => t.statusKey === "notStarted").length;
  const ip = tasks.filter((t) => t.statusKey === "inProgress").length;
  const co = tasks.filter((t) => t.statusKey === "completed").length;
  const late = tasks.filter((t) => t.late).length;
  return {
    name: "Overall",
    notStarted: ns,
    inProgress: ip,
    completed: co,
    total: tasks.length,
    delayed: late,
  };
}

function buildView(raw, tasks) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.statusKey === "completed").length;
  const delayed = tasks.filter((t) => t.late).length;
  const pctComplete = total ? Math.round((100 * completed) / total) : 0;
  const teamLabel = selectedTeams.length
    ? ` · ${selectedTeams.join(", ")}`
    : "";

  return {
    meta: {
      ...raw.meta,
      title: raw.meta.title,
      subtitle: `${delayed} tasks are delayed, ${pctComplete}% tasks completed${teamLabel}`,
      totalTasks: total,
      completedTasks: completed,
      delayedTasks: delayed,
      pctComplete,
      mandGoLive: tasks.filter((t) => t.mandGoLive === "Yes").length,
      criticalPath: tasks.filter((t) => t.criticalPath === "Yes").length,
    },
    tasks,
    byCategory: [overallFromTasks(tasks), ...aggregateBy(tasks, "category")],
    byTeam: aggregateBy(tasks, "team"),
    lateTasks: tasks.filter((t) => t.late),
    summary: {
      notStarted: tasks.filter((t) => t.statusKey === "notStarted").length,
      inProgress: tasks.filter((t) => t.statusKey === "inProgress").length,
      completed,
    },
  };
}

function applyTeamFilter() {
  if (!hasTaskDetails()) {
    DATA = {
      ...RAW_DATA,
      lateTasks: RAW_DATA.lateTasks || [],
    };
    renderAll();
    return;
  }
  DATA = buildView(RAW_DATA, getActiveTasks());
  renderAll();
}

function filterTasks(filters) {
  const base = hasTaskDetails() ? getActiveTasks() : RAW_DATA?.lateTasks || [];
  return base.filter((t) => {
    if (filters.late && !t.late) return false;
    if (filters.statusKey && t.statusKey !== filters.statusKey) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.team && t.team !== filters.team) return false;
    if (filters.mand && t.mandGoLive !== "Yes") return false;
    if (filters.critical && t.criticalPath !== "Yes") return false;
    return true;
  });
}

function openDetailPane(title, subtitle, tasks) {
  document.getElementById("detail-title").textContent = title;
  document.getElementById("detail-subtitle").textContent =
    subtitle || `${tasks.length} task(s)`;

  const tbody = document.getElementById("detail-tbody");
  tbody.innerHTML = "";
  if (!tasks.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No tasks match</td></tr>';
  } else {
    tasks.forEach((t) => {
      const tr = document.createElement("tr");
      tr.className = "interactive";
      tr.innerHTML = `
        <td>${escapeHtml(t.id)}</td>
        <td>${escapeHtml(t.name)}</td>
        <td><span class="status-pill ${t.late ? "late" : ""}">${escapeHtml(t.status)}</span></td>
        <td>${escapeHtml(t.team)}</td>
        <td>${escapeHtml(t.assignee)}</td>
        <td>${escapeHtml(t.plannedEnd)}</td>
      `;
      tr.addEventListener("click", () =>
        openDetailPane(t.name || t.id, `Task ${t.id}`, [t])
      );
      tbody.appendChild(tr);
    });
  }

  document.getElementById("detail-pane").classList.add("open");
  document.getElementById("detail-pane").setAttribute("aria-hidden", "false");
  document.getElementById("detail-backdrop").hidden = false;
  document.body.classList.add("pane-open");
}

function closeDetailPane() {
  document.getElementById("detail-pane").classList.remove("open");
  document.getElementById("detail-pane").setAttribute("aria-hidden", "true");
  document.getElementById("detail-backdrop").hidden = true;
  document.body.classList.remove("pane-open");
}

function onBarActivate(dimension, rowName, statusKey, label) {
  if (rowName === "Overall" && !statusKey) {
    openDetailPane("Overall", `${getActiveTasks().length} tasks`, getActiveTasks());
    return;
  }
  const filters = {};
  if (dimension === "category") filters.category = rowName;
  if (dimension === "team") filters.team = rowName;
  if (statusKey) filters.statusKey = statusKey;
  const tasks = filterTasks(filters);
  const statusLabel = statusKey ? STATUS_LABELS[statusKey] : "All statuses";
  openDetailPane(
    label || rowName,
    `${statusLabel} · ${rowName} · ${tasks.length} task(s)`,
    tasks
  );
}

function renderBarRow(row, dimension, { emphasizeOverall = false } = {}) {
  const { name, notStarted, inProgress, completed, total, delayed } = row;
  const el = document.createElement("div");
  el.className =
    "bar-row" + (emphasizeOverall && name === "Overall" ? " overall" : "");
  el.tabIndex = 0;
  el.setAttribute("role", "button");

  const segments = [
    { key: "notStarted", value: notStarted, className: "not-started" },
    { key: "inProgress", value: inProgress, className: "in-progress" },
    { key: "completed", value: completed, className: "completed" },
  ];

  const track = document.createElement("div");
  track.className = "bar-track";

  segments.forEach((s) => {
    if (s.value <= 0) return;
    const seg = document.createElement("div");
    seg.className = `seg ${s.className} interactive`;
    seg.style.width = `${pct(s.value, total)}%`;
    seg.innerHTML = `<span>${s.value}</span>`;
    seg.addEventListener("mouseenter", (e) =>
      showTooltip(
        `${name} · ${STATUS_LABELS[s.key]}: ${s.value} (click for list)`,
        e.clientX,
        e.clientY
      )
    );
    seg.addEventListener("mousemove", (e) =>
      showTooltip(`${name} · ${STATUS_LABELS[s.key]}: ${s.value}`, e.clientX, e.clientY)
    );
    seg.addEventListener("mouseleave", hideTooltip);
    seg.addEventListener("click", (e) => {
      e.stopPropagation();
      onBarActivate(dimension, name, s.key, name);
    });
    track.appendChild(seg);
  });

  if (!track.children.length) {
    track.innerHTML =
      '<div class="seg not-started" style="width:100%"><span>0</span></div>';
  }

  const label = document.createElement("span");
  label.className = "label";
  label.title = name;
  label.textContent = name;

  const totalEl = document.createElement("span");
  totalEl.className = "total";
  totalEl.textContent = total;

  const badge = document.createElement("span");
  badge.className =
    "delayed-badge" + (delayed > 0 ? " visible interactive" : "");
  if (delayed > 0) {
    badge.textContent = delayed;
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const filters = { late: true };
      if (dimension === "category") filters.category = name;
      if (dimension === "team") filters.team = name;
      openDetailPane(`Delayed · ${name}`, `${delayed} delayed`, filterTasks(filters));
    });
  }

  el.append(label, track, totalEl, badge);
  el.addEventListener("mouseenter", (e) =>
    showTooltip(`${name}: ${total} tasks`, e.clientX, e.clientY)
  );
  el.addEventListener("mouseleave", hideTooltip);
  el.addEventListener("click", () => onBarActivate(dimension, name, null, name));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onBarActivate(dimension, name, null, name);
    }
  });

  return el;
}

function renderChart(containerId, rows, dimension, emphasizeOverall) {
  const root = document.getElementById(containerId);
  if (!root) return;
  root.innerHTML = "";
  const chart = document.createElement("div");
  chart.className = "bar-chart";
  rows.forEach((row) =>
    chart.appendChild(renderBarRow(row, dimension, { emphasizeOverall }))
  );
  root.appendChild(chart);
}

function renderStatusDonut(summary) {
  const total =
    summary.notStarted + summary.inProgress + summary.completed || 1;
  const donut = document.getElementById("status-donut");
  const p1 = pct(summary.notStarted, total);
  const p2 = pct(summary.inProgress, total);
  donut.style.background = `conic-gradient(
    var(--not-started) 0% ${p1}%,
    var(--in-progress) ${p1}% ${p1 + p2}%,
    var(--completed) ${p1 + p2}% 100%
  )`;

  const list = document.getElementById("status-legend-list");
  list.innerHTML = "";
  [
    ["Not Started", summary.notStarted, "not-started", "notStarted"],
    ["In Progress", summary.inProgress, "in-progress", "inProgress"],
    ["Completed", summary.completed, "completed", "completed"],
  ].forEach(([label, count, cls, key]) => {
    const li = document.createElement("li");
    li.className = "interactive";
    li.innerHTML = `<span class="legend-swatch ${cls}"></span> ${label}: <strong>${count}</strong>`;
    li.addEventListener("click", () =>
      openDetailPane(label, `${count} tasks`, filterTasks({ statusKey: key }))
    );
    list.appendChild(li);
  });
}

function renderLateTable(tasks) {
  const tbody = document.querySelector("#late-table tbody");
  tbody.innerHTML = "";
  if (!tasks.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No delayed tasks</td></tr>';
    return;
  }
  tasks.forEach((t) => {
    const tr = document.createElement("tr");
    tr.className = "interactive";
    tr.innerHTML = `
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.name)}</td>
      <td>${escapeHtml(t.category)}</td>
      <td>${escapeHtml(t.team)}</td>
      <td>${escapeHtml(t.status)}</td>
      <td>${escapeHtml(t.assignee)}</td>
      <td>${escapeHtml(t.plannedEnd)}</td>
    `;
    tr.addEventListener("click", () =>
      openDetailPane(t.name || t.id, "Delayed task", [t])
    );
    tbody.appendChild(tr);
  });
}

function applyMeta(meta) {
  document.getElementById("page-title").textContent = meta.title;
  document.title = meta.title;
  document.getElementById("subtitle").textContent = meta.subtitle;
  document.getElementById("status-as-of").textContent = `Status as of ${meta.statusAsOf}`;
  document.getElementById("kpi-total").textContent = meta.totalTasks;
  document.getElementById("kpi-complete").textContent = `${meta.pctComplete}%`;
  document.getElementById("kpi-progress").textContent = DATA.summary.inProgress;
  document.getElementById("kpi-delayed").textContent = meta.delayedTasks;
  document.getElementById("kpi-mand").textContent = meta.mandGoLive ?? "—";
  document.getElementById("kpi-critical").textContent = meta.criticalPath ?? "—";

  const link = document.getElementById("sharepoint-link");
  if (meta.sharepointUrl) link.href = meta.sharepointUrl;

  document.getElementById("footer-source").textContent =
    `Source: ${meta.source} · Updated ${meta.generatedAt}`;
}

function updateTeamTriggerLabel() {
  const label = document.getElementById("team-trigger-label");
  if (!selectedTeams.length) {
    label.textContent = "All teams";
  } else if (selectedTeams.length === 1) {
    label.textContent = selectedTeams[0];
  } else {
    label.textContent = `${selectedTeams.length} teams`;
  }
}

function populateTeamMultiselect() {
  const panel = document.getElementById("team-panel");
  const teams = getTeamsList();
  panel.innerHTML = "";

  const allLabel = document.createElement("label");
  allLabel.className = "team-option";
  const allInput = document.createElement("input");
  allInput.type = "checkbox";
  allInput.value = "__all__";
  allInput.checked = !selectedTeams.length;
  const allSpan = document.createElement("span");
  allSpan.textContent = "All teams";
  allLabel.append(allInput, allSpan);
  panel.appendChild(allLabel);

  teams.forEach((team) => {
    const label = document.createElement("label");
    label.className = "team-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = team;
    input.checked = selectedTeams.includes(team);
    const span = document.createElement("span");
    span.textContent = team;
    label.append(input, span);
    panel.appendChild(label);
  });

  panel.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", onTeamCheckboxChange);
  });
  updateTeamTriggerLabel();
}

function onTeamCheckboxChange(e) {
  const panel = document.getElementById("team-panel");
  const allBox = panel.querySelector('input[value="__all__"]');
  const teamBoxes = [...panel.querySelectorAll('input[type="checkbox"]')].filter(
    (el) => el.value !== "__all__"
  );

  if (e.target.value === "__all__" && e.target.checked) {
    selectedTeams = [];
    teamBoxes.forEach((b) => {
      b.checked = false;
    });
  } else {
    allBox.checked = false;
    selectedTeams = teamBoxes.filter((b) => b.checked).map((b) => b.value);
    if (!selectedTeams.length) allBox.checked = true;
  }

  closeDetailPane();
  updateTeamTriggerLabel();
  applyTeamFilter();
}

function bindTeamMultiselect() {
  const trigger = document.getElementById("team-trigger");
  const panel = document.getElementById("team-panel");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !panel.hidden;
    panel.hidden = open;
    trigger.setAttribute("aria-expanded", String(!open));
  });

  document.addEventListener("click", (e) => {
    if (!document.getElementById("team-multiselect").contains(e.target)) {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}

function renderAll() {
  if (!DATA) return;
  applyMeta(DATA.meta);
  renderStatusDonut(DATA.summary);
  renderChart("chart-category", DATA.byCategory, "category", true);
  const teamPanel = document.getElementById("panel-team");
  if (selectedTeams.length) {
    teamPanel.hidden = true;
  } else {
    teamPanel.hidden = false;
    renderChart("chart-team", DATA.byTeam, "team", false);
  }

  const late = DATA.lateTasks || [];
  document.getElementById("late-count").textContent =
    late.length > 0 ? `(${late.length})` : "";
  renderLateTable(late);

  const lateSection = document.getElementById("late-section");
  lateSection.hidden = false;
}

function bindKpiButtons() {
  document.querySelectorAll(".kpi-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter;
      if (f === "all") {
        openDetailPane("All tasks", "", getActiveTasks());
      } else if (f === "late") {
        openDetailPane("Delayed tasks", "", DATA.lateTasks);
      } else if (f === "mand") {
        openDetailPane("Mand for GoLive", "", filterTasks({ mand: true }));
      } else if (f === "critical") {
        openDetailPane("Critical path", "", filterTasks({ critical: true }));
      } else if (f.startsWith("status:")) {
        openDetailPane(
          STATUS_LABELS[f.split(":")[1]],
          "",
          filterTasks({ statusKey: f.split(":")[1] })
        );
      }
    });
  });
}

async function fetchDashboardJson() {
  const res = await fetch(`data/dashboard.json?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not load data (${res.status})`);
  return res.json();
}

async function loadData() {
  RAW_DATA = await fetchDashboardJson();
  lastGeneratedAt = RAW_DATA.meta.generatedAt;
  populateTeamMultiselect();
  applyTeamFilter();
  bindKpiButtons();

  if (!hasTaskDetails()) {
    showToast(
      "Dashboard data is outdated — push latest build from GitHub (needs tasks in JSON)",
      true
    );
  }
}

async function init() {
  const loading = document.getElementById("loading");
  try {
    await loadData();
    loading.style.display = "none";
    document.getElementById("app").hidden = false;

    bindTeamMultiselect();
    document.getElementById("detail-close").addEventListener("click", closeDetailPane);
    document.getElementById("detail-backdrop").addEventListener("click", closeDetailPane);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDetailPane();
    });
  } catch (e) {
    loading.className = "error";
    loading.textContent = "Could not load dashboard data.";
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", init);
