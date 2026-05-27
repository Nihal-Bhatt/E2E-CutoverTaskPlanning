// =============================================================================
// Cutover Run Sheet — SharePoint (full query)
// Paste: Power Query → Home → Advanced editor → replace all → Done
// Credentials: Organizational account (ResMed M365)
// =============================================================================

let
    // --- Connection: parent folder (avoids site-root / SolutionGallery 500) ---
    FolderUrl =
        "https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation/Shared Documents/2. Phase 1/5. Technical Solutions Capabilities/Cutover",
    FileName = "Cutover RunSheet_GTS.xlsx",

    FilesInFolder =
        SharePoint.Files(FolderUrl, [ApiVersion = 15, ShowHiddenFiles = false]),
    FileBinary = FilesInFolder{[Name = FileName]}[Content],

    Workbook = Excel.Workbook(FileBinary, null, true),
    SheetRaw = Workbook{[Item = "Cutover Run Sheet", Kind = "Sheet"]}[Data],

    // Excel row 5 = headers; skip 4 title rows
    SheetData =
        Table.PromoteHeaders(
            Table.Skip(SheetRaw, 4),
            [PromoteAllScalars = true]
        ),

    ReportableOnly =
        Table.SelectRows(SheetData, each [#"Rpt Flag Auto"] = "Y"),

    Typed =
        Table.TransformColumnTypes(
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

    AddStatusDisplay =
        Table.AddColumn(
            Typed,
            "Status Display",
            each if [Status] = "Complete" then "Completed" else [Status],
            type text
        ),

    AddIsLate =
        Table.AddColumn(
            AddStatusDisplay,
            "Is Late",
            each [Late] = "Y",
            type logical
        )
in
    AddIsLate

// =============================================================================
// ALTERNATIVE — if folder connector still errors, use direct file URL below.
// Comment out FolderUrl block above and use this Source instead:
// =============================================================================
//
// let
//     FileUrl =
//         "https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation/Shared Documents/2. Phase 1/5. Technical Solutions Capabilities/Cutover/Cutover RunSheet_GTS.xlsx",
//     FileBinary = Web.Contents(FileUrl, [ApiVersion = 15]),
//     Workbook = Excel.Workbook(FileBinary, null, true),
//     ... same SheetRaw through AddIsLate ...
// in AddIsLate
