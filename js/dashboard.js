const STATUS_LABELS = {
  notStarted: "Not Started",
  inProgress: "In Progress",
  completed: "Completed",
};

function pct(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

function renderBarRow(row, { emphasizeOverall = false } = {}) {
  const { name, notStarted, inProgress, completed, total, delayed } = row;
  const el = document.createElement("div");
  el.className = "bar-row" + (emphasizeOverall && name === "Overall" ? " overall" : "");

  const segments = [
    { key: "notStarted", value: notStarted, className: "not-started" },
    { key: "inProgress", value: inProgress, className: "in-progress" },
    { key: "completed", value: completed, className: "completed" },
  ];

  const track = segments
    .filter((s) => s.value > 0)
    .map(
      (s) =>
        `<div class="seg ${s.className}" style="width:${pct(s.value, total)}%" title="${STATUS_LABELS[s.key]}: ${s.value}"><span>${s.value}</span></div>`
    )
    .join("");

  const badge =
    delayed > 0
      ? `<span class="delayed-badge visible" title="Delayed tasks">${delayed}</span>`
      : `<span class="delayed-badge"></span>`;

  el.innerHTML = `
    <span class="label" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
    <div class="bar-track">${track || '<div class="seg not-started" style="width:100%"><span>0</span></div>'}</div>
    <span class="total">${total}</span>
    ${badge}
  `;
  return el;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderChart(containerId, rows, emphasizeOverall) {
  const root = document.getElementById(containerId);
  root.innerHTML = "";
  const chart = document.createElement("div");
  chart.className = "bar-chart";
  rows.forEach((row) => chart.appendChild(renderBarRow(row, { emphasizeOverall })));
  root.appendChild(chart);
}

function renderLateTable(tasks) {
  const tbody = document.querySelector("#late-table tbody");
  tbody.innerHTML = "";
  if (!tasks.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No delayed tasks</td></tr>';
    return;
  }
  tasks.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(String(t["Task Id"] || ""))}</td>
      <td>${escapeHtml(String(t["Task Name"] || ""))}</td>
      <td>${escapeHtml(String(t.Category || ""))}</td>
      <td>${escapeHtml(String(t.Team || ""))}</td>
      <td>${escapeHtml(String(t.Status || ""))}</td>
      <td>${escapeHtml(String(t.Assignee || ""))}</td>
    `;
    tbody.appendChild(tr);
  });
}

function applyMeta(meta) {
  document.getElementById("page-title").textContent = meta.title;
  document.title = meta.title;
  document.getElementById("subtitle").textContent = `Status as of ${meta.statusAsOf}`;
  document.getElementById("kpi-total").textContent = meta.totalTasks;
  document.getElementById("kpi-complete").textContent = `${meta.pctComplete}%`;
  document.getElementById("kpi-delayed").textContent = meta.delayedTasks;
  document.getElementById("footer-source").textContent = `Data: ${meta.source} · Generated ${meta.generatedAt}`;
}

async function init() {
  const loading = document.getElementById("loading");
  try {
    const res = await fetch("data/dashboard.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    loading.style.display = "none";
    document.getElementById("app").hidden = false;

    const meta = { ...data.meta, summaryNotStarted: data.summary?.notStarted };
    document.getElementById("kpi-progress").textContent = data.summary.inProgress;
    applyMeta(meta);

    renderChart("chart-category", data.byCategory, true);
    renderChart("chart-team", data.byTeam, false);
    renderLateTable(data.lateTasks || []);
  } catch (e) {
    loading.className = "error";
    loading.textContent =
      "Could not load dashboard data. Run: python scripts/build_dashboard.py";
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", init);
