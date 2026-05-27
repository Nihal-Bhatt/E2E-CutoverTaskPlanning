// =============================================================================
// CUTOWER RUN SHEET — Full Power Query (M)
// =============================================================================
// HOW TO PASTE:
// 1. Get Data → your Excel file → select sheet "Cutover Run Sheet" → Transform Data
// 2. Home → Advanced editor
// 3. If you already have Source + Sheet steps working, use ONLY the block from
//    "SheetData" through "in Final" and wire SheetData to your last sheet step.
// 4. Otherwise replace ALL code below, and fix the Source line to match your file.
// =============================================================================

let
    // --- OPTION: SharePoint / local file — change Source to match your connection ---
    // SharePoint example (folder connector):
    // Source = SharePoint.Files("https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation"){[Name="Cutover RunSheet_GTS.xlsx"]}[Content],

    // Local file example:
    // Source = Excel.Workbook(File.Contents("C:\path\Cutover RunSheet_GTS.xlsx"), null, true),

    // After Get Data wizard, your editor often already has Source + Sheet — keep those
    // and only paste from SheetData onward. Template assumes Excel.Workbook on Source:

    Source = Excel.Workbook(
        Web.Contents(
            "PASTE_YOUR_SHAREPOINT_OR_FILE_URL_HERE"
        ),
        null,
        true
    ),
    SheetRaw = Source{[Item = "Cutover Run Sheet", Kind = "Sheet"]}[Data],

    // Row 5 in Excel = headers; skip 4 title/instruction rows
    SheetData = Table.PromoteHeaders(
        Table.Skip(SheetRaw, 4),
        [PromoteAllScalars = true]
    ),

    // Dashboard scope: reportable tasks only (~206 rows)
    ReportableOnly = Table.SelectRows(
        SheetData,
        each [#"Rpt Flag Auto"] = "Y"
    ),

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

  // Match reference dashboard legend: "Completed" not "Complete"
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

    Final = AddIsLate
in
    Final
