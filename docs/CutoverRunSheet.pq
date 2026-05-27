// Power Query M — Cutover Run Sheet
// Paste into Power BI: after connecting to SharePoint Excel, duplicate query → Advanced Editor
// Assumes first step is something like: Source = SharePoint.Files(...){[Name="Cutover RunSheet_GTS.xlsx"]}[Content]

let
    // If your first step is Excel.Workbook(Source), keep it; otherwise replace Source below.
    Workbook = Excel.Workbook(Source, null, true),
    Sheet = Workbook{[Item="Cutover Run Sheet", Kind="Sheet"]}[Data],

    // Header is Excel row 5 (first 4 rows are titles / instructions)
    Promoted = Table.PromoteHeaders(
        Table.Skip(Sheet, 4),
        [PromoteAllScalars = true]
    ),

    // Reportable tasks only (matches existing slide / pivot logic)
    ReportableOnly = Table.SelectRows(Promoted, each [#"Rpt Flag Auto"] = "Y"),

  // Strong types for refresh stability
    Typed = Table.TransformColumnTypes(
        ReportableOnly,
        {
            {"Task Id", type text},
            {"Task Name", type text},
            {"Category", type text},
            {"Team", type text},
            {"Status", type text},
            {"Late", type text},
            {"RAG", type text},
            {"Assignee", type text},
            {"Cutover Phase", type text},
            {"Mand for GoLive", type text},
            {"Critical Path", type text},
            {"Planned Start Date", type datetime},
            {"Planned End Date", type datetime},
            {"Actual Start Date", type datetime},
            {"Actual End Date", type datetime}
        },
        "en-AU"
    ),

    // Display label for charts (Complete → Completed)
    AddStatusDisplay = Table.AddColumn(
        Typed,
        "Status Display",
        each if [Status] = "Complete" then "Completed" else [Status],
        type text
    ),

    AddIsLate = Table.AddColumn(
        AddStatusDisplay,
        "Is Late",
        each [Late] = "Y",
        type logical
    ),

    // Optional: flag incomplete tasks past planned end (for extra visuals; sheet already has Late)
    AddIsOverdueCalc = Table.AddColumn(
        AddIsLate,
        "Is Overdue (calc)",
        each
            [Status] <> "Complete"
            and [Planned End Date] <> null
            and Date.From([Planned End Date]) < Date.From(DateTime.LocalNow()),
        type logical
    )
in
    AddIsOverdueCalc
