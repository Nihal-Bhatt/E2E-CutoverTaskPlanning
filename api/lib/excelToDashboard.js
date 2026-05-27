const XLSX = require("xlsx");

function fmtDate(val) {
  if (val == null || val === "") return "";
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString().slice(0, 10);
  }
  return String(val);
}

function aggregateBy(tasks, field) {
  const map = new Map();
  for (const t of tasks) {
    const key = t[field] || "—";
    if (!map.has(key)) {
      map.set(key, { notStarted: 0, inProgress: 0, completed: 0, delayed: 0 });
    }
    const row = map.get(key);
    if (t.statusKey === "notStarted") row.notStarted++;
    else if (t.statusKey === "inProgress") row.inProgress++;
    else if (t.statusKey === "completed") row.completed++;
    if (t.late) row.delayed++;
  }
  return [...map.entries()]
    .map(([name, c]) => ({
      name,
      notStarted: c.notStarted,
      inProgress: c.inProgress,
      completed: c.completed,
      total: c.notStarted + c.inProgress + c.completed,
      delayed: c.delayed,
    }))
    .sort((a, b) => b.total - a.total);
}

function overallRow(tasks) {
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

function buildPayloadFromBuffer(buffer, metaExtra = {}) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets["Cutover Run Sheet"];
  if (!sheet) throw new Error('Sheet "Cutover Run Sheet" not found');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRow = rows[4];
  if (!headerRow) throw new Error("Invalid sheet layout (missing header row 5)");

  const dataRows = rows.slice(5);
  const headers = headerRow.map((h) => (h != null ? String(h).trim() : ""));
  const col = (name) => headers.indexOf(name);

  const tasks = [];
  for (const row of dataRows) {
    if (!row || row.every((c) => c == null || c === "")) continue;
    const rpt = row[col("Rpt Flag Auto")];
    if (rpt !== "Y") continue;

    const status = row[col("Status")] != null ? String(row[col("Status")]) : "";
    let statusKey = "notStarted";
    if (status === "Complete") statusKey = "completed";
    else if (status === "In Progress") statusKey = "inProgress";

    const teamRaw = row[col("Team")];
    const team =
      teamRaw != null && String(teamRaw).trim() && String(teamRaw).toLowerCase() !== "nan"
        ? String(teamRaw).trim()
        : "";

    const lateVal = row[col("Late")];
    const isLate = lateVal === "Y" || lateVal === true;

    tasks.push({
      id: String(row[col("Task Id")] ?? ""),
      name: String(row[col("Task Name")] ?? ""),
      category: String(row[col("Category")] ?? ""),
      team,
      status,
      statusKey,
      late: isLate,
      assignee: String(row[col("Assignee")] ?? ""),
      phase: String(row[col("Cutover Phase")] ?? "") || "Unspecified",
      rag: String(row[col("RAG")] ?? "") || "—",
      mandGoLive: String(row[col("Mand for GoLive")] ?? ""),
      criticalPath: String(row[col("Critical Path")] ?? ""),
      plannedEnd: fmtDate(row[col("Planned End Date")]),
      plannedStart: fmtDate(row[col("Planned Start Date")]),
    });
  }

  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000 - now.getTimezoneOffset() * 60000);
  const hour = sgt.getUTCHours() % 12 || 12;
  const ampm = sgt.getUTCHours() >= 12 ? "pm" : "am";
  const min = String(sgt.getUTCMinutes()).padStart(2, "0");
  const statusAsOf = `${hour}:${min}${ampm} SGT`;

  const completed = tasks.filter((t) => t.statusKey === "completed").length;
  const delayed = tasks.filter((t) => t.late).length;
  const total = tasks.length;
  const pctComplete = total ? Math.round((100 * completed) / total) : 0;

  const sharepointUrl =
    metaExtra.sharepointUrl ||
    "https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation/Shared%20Documents/2.%20Phase%201/5.%20Technical%20Solutions%20Capabilities/Cutover/Cutover%20RunSheet_GTS.xlsx";

  return {
    meta: {
      title: "Cutover Tracking",
      subtitle: `${delayed} tasks are delayed, ${pctComplete}% tasks completed`,
      statusAsOf,
      generatedAt: new Date().toISOString(),
      source: "SharePoint (live)",
      sharepointUrl,
      githubRepo: metaExtra.githubRepo || "Nihal-Bhatt/E2E-CutoverTaskPlanning",
      workflowFile: "pages.yml",
      totalTasks: total,
      completedTasks: completed,
      delayedTasks: delayed,
      pctComplete,
      mandGoLive: tasks.filter((t) => t.mandGoLive === "Yes").length,
      criticalPath: tasks.filter((t) => t.criticalPath === "Yes").length,
    },
    tasks,
    byCategory: [overallRow(tasks), ...aggregateBy(tasks, "category")],
    byTeam: aggregateBy(tasks, "team"),
    byPhase: aggregateBy(
      tasks.map((t) => ({
        ...t,
        phase: t.phase === "nan" ? "Unspecified" : t.phase,
      })),
      "phase"
    ),
    byRag: aggregateBy(tasks, "rag"),
    lateTasks: tasks.filter((t) => t.late),
    summary: {
      notStarted: tasks.filter((t) => t.statusKey === "notStarted").length,
      inProgress: tasks.filter((t) => t.statusKey === "inProgress").length,
      completed,
    },
  };
}

module.exports = { buildPayloadFromBuffer };
