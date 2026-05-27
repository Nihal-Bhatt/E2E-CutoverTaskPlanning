const STATUS_LABELS = {
  notStarted: "Not Started",
  inProgress: "In Progress",
  completed: "Completed",
};

let DATA = null;

function pct(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
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

function filterTasks(filters) {
  if (!DATA?.tasks) return [];
  return DATA.tasks.filter((t) => {
    if (filters.late && !t.late) return false;
    if (filters.statusKey && t.statusKey !== filters.statusKey) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.team && t.team !== filters.team) return false;
    if (filters.phase && t.phase !== filters.phase) return false;
    if (filters.rag && t.rag !== filters.rag) return false;
    if (filters.mand && t.mandGoLive !== "Yes") return false;
    if (filters.critical && t.criticalPath !== "Yes") return false;
    return true;
  });
}

function openDetailPane(title, subtitle, tasks) {
  const pane = document.getElementById("detail-pane");
  const backdrop = document.getElementById("detail-backdrop");
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

  pane.classList.add("open");
  pane.setAttribute("aria-hidden", "false");
  backdrop.hidden = false;
  document.body.classList.add("pane-open");
}

function closeDetailPane() {
  document.getElementById("detail-pane").classList.remove("open");
  document.getElementById("detail-pane").setAttribute("aria-hidden", "true");
  document.getElementById("detail-backdrop").hidden = true;
  document.body.classList.remove("pane-open");
}

function onBarActivate(dimension, rowName, statusKey, label) {
  const filters = {};
  if (dimension === "category") filters.category = rowName;
  if (dimension === "team") filters.team = rowName;
  if (dimension === "phase") filters.phase = rowName;
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
  el.dataset.dimension = dimension;
  el.dataset.name = name;

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
    seg.title = `${STATUS_LABELS[s.key]}: ${s.value}`;
    seg.addEventListener("mouseenter", (e) =>
      showTooltip(
        `${name} · ${STATUS_LABELS[s.key]}: ${s.value} (click for list)`,
        e.clientX,
        e.clientY
      )
    );
    seg.addEventListener("mousemove", (e) =>
      showTooltip(
        `${name} · ${STATUS_LABELS[s.key]}: ${s.value}`,
        e.clientX,
        e.clientY
      )
    );
    seg.addEventListener("mouseleave", hideTooltip);
    seg.addEventListener("click", (e) => {
      e.stopPropagation();
      onBarActivate(dimension, name, s.key, name);
    });
    track.appendChild(seg);
  });

  if (!track.children.length) {
    track.innerHTML = '<div class="seg not-started" style="width:100%"><span>0</span></div>';
  }

  const label = document.createElement("span");
  label.className = "label";
  label.title = name;
  label.textContent = name;

  const totalEl = document.createElement("span");
  totalEl.className = "total";
  totalEl.textContent = total;

  const badge = document.createElement("span");
  badge.className = "delayed-badge" + (delayed > 0 ? " visible interactive" : "");
  if (delayed > 0) {
    badge.textContent = delayed;
    badge.title = `${delayed} delayed — click`;
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const filters = { late: true };
      if (dimension === "category") filters.category = name;
      if (dimension === "team") filters.team = name;
      if (dimension === "phase") filters.phase = name;
      openDetailPane(`Delayed · ${name}`, `${delayed} delayed task(s)`, filterTasks(filters));
    });
  }

  el.append(label, track, totalEl, badge);

  el.addEventListener("mouseenter", (e) =>
    showTooltip(`${name}: ${total} tasks (click row for all)`, e.clientX, e.clientY)
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

function renderRagList(items) {
  const root = document.getElementById("chart-rag");
  root.innerHTML = "";
  const max = Math.max(...items.map((i) => i.total), 1);
  items.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "rag-row interactive";
    const w = pct(item.total, max);
    row.innerHTML = `
      <span class="rag-label">${escapeHtml(item.name)}</span>
      <span class="rag-bar-wrap"><span class="rag-bar" style="width:${w}%"></span></span>
      <span class="rag-count">${item.total}${item.delayed ? ` · <em>${item.delayed} late</em>` : ""}</span>
    `;
    row.addEventListener("click", () => {
      openDetailPane(
        `RAG: ${item.name}`,
        `${item.total} tasks`,
        filterTasks({ rag: item.name })
      );
    });
    row.addEventListener("mouseenter", (e) =>
      showTooltip(`${item.name}: ${item.total} tasks`, e.clientX, e.clientY)
    );
    row.addEventListener("mouseleave", hideTooltip);
    root.appendChild(row);
  });
}

function renderStatusDonut(summary) {
  const total =
    summary.notStarted + summary.inProgress + summary.completed || 1;
  const donut = document.getElementById("status-donut");
  const p1 = pct(summary.notStarted, total);
  const p2 = pct(summary.inProgress, total);
  const p3 = pct(summary.completed, total);
  donut.style.background = `conic-gradient(
    var(--not-started) 0% ${p1}%,
    var(--in-progress) ${p1}% ${p1 + p2}%,
    var(--completed) ${p1 + p2}% 100%
  )`;

  const list = document.getElementById("status-legend-list");
  list.innerHTML = "";
  [
    ["Not Started", summary.notStarted, "not-started"],
    ["In Progress", summary.inProgress, "in-progress"],
    ["Completed", summary.completed, "completed"],
  ].forEach(([label, count, cls]) => {
    const li = document.createElement("li");
    li.className = "interactive";
    li.innerHTML = `<span class="legend-swatch ${cls}"></span> ${label}: <strong>${count}</strong>`;
    const key =
      label === "Not Started"
        ? "notStarted"
        : label === "In Progress"
          ? "inProgress"
          : "completed";
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
  if (meta.sharepointUrl) {
    link.href = meta.sharepointUrl;
  }

  document.getElementById("footer-source").textContent =
    `Source: ${meta.source} · Updated ${meta.generatedAt}`;
}

function bindKpiButtons() {
  document.querySelectorAll(".kpi-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter;
      if (f === "all") {
        openDetailPane("All tasks", `${DATA.tasks.length} tasks`, DATA.tasks);
      } else if (f === "late") {
        openDetailPane("Delayed tasks", "", DATA.lateTasks);
      } else if (f === "mand") {
        openDetailPane("Mand for GoLive", "", filterTasks({ mand: true }));
      } else if (f === "critical") {
        openDetailPane("Critical path", "", filterTasks({ critical: true }));
      } else if (f.startsWith("status:")) {
        const key = f.split(":")[1];
        openDetailPane(
          STATUS_LABELS[key],
          "",
          filterTasks({ statusKey: key })
        );
      }
    });
  });
}

async function init() {
  const loading = document.getElementById("loading");
  try {
    const res = await fetch("data/dashboard.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
    loading.style.display = "none";
    document.getElementById("app").hidden = false;

    applyMeta(DATA.meta);
    renderStatusDonut(DATA.summary);
    renderChart("chart-category", DATA.byCategory, "category", true);
    renderChart("chart-team", DATA.byTeam, "team", false);
    renderChart("chart-phase", DATA.byPhase, "phase", false);
    renderRagList(DATA.byRag || []);
    renderLateTable(DATA.lateTasks || []);
    bindKpiButtons();

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
