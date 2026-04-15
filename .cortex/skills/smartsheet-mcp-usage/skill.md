---
name: smartsheet-mcp-usage
description: "Guide for using Smartsheet MCP tools effectively. Use when: querying sheets, searching Smartsheet, updating rows, creating sheets, working with reports, managing workspaces. Triggers: smartsheet, find sheet, update row, get sheet, smartsheet report, workspace, search smartsheet."
---

# Smartsheet MCP Usage

Effective patterns for querying, updating, and managing Smartsheet data via MCP tools.

## Available Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `search_sheets` | Find sheets by name/content | `query` |
| `search_reports` | Find reports by name | `query` |
| `search_workspaces` | Find workspaces by name | `query` |
| `search_folders` | Find folders by name | `query` |
| `get_sheet` | Get sheet with rows/columns | `sheetId`, `pageSize`, `page` |
| `get_sheet_by_url` | Get sheet from URL | `url`, `pageSize`, `page` |
| `get_report` | Get report data | `reportId`, `pageSize`, `page` |
| `get_report_by_url` | Get report from URL | `url`, `pageSize`, `page` |
| `get_row` | Get single row details | `sheetId`, `rowId` |
| `add_rows` | Add new rows | `sheetId`, `rows[]` |
| `update_rows` | Modify existing rows | `sheetId`, `rows[]` |
| `get_workspace` | Get workspace contents | `workspaceId` |
| `get_folder` | Get folder contents | `folderId` |
| `create_sheet` | Create new sheet | `name`, `columns[]`, `folderId?` |
| `copy_sheet` | Duplicate a sheet | `sheetId`, `destinationName` |
| `get_current_user` | Get authenticated user info | — |

## Workflow Patterns

### Pattern 1: Find and Read Sheet

```
1. search_sheets(query: "project name")
   → Returns list with sheet IDs

2. get_sheet(sheetId: "123456", pageSize: 100)
   → Returns columns + rows with cell data
```

### Pattern 2: Find and Read Report

```
1. search_reports(query: "report name")
   → Returns list with report IDs

2. get_report(reportId: "789012", pageSize: 100)
   → Returns aggregated data from source sheets
```

### Pattern 3: URL-Based Access

When user provides a Smartsheet URL:

```
# Sheet URL
get_sheet_by_url(url: "https://app.smartsheet.com/sheets/abc123...")

# Report URL  
get_report_by_url(url: "https://app.smartsheet.com/reports/xyz789...")
```

### Pattern 4: Update Rows

```
1. get_sheet(sheetId: "123456")
   → Note column IDs from response

2. update_rows(sheetId: "123456", rows: [
     {
       "id": "row_id",
       "cells": [
         {"columnId": 456, "value": "new value"}
       ]
     }
   ])
```

### Pattern 5: Add New Rows

```
1. get_sheet(sheetId: "123456")
   → Note column IDs from response

2. add_rows(sheetId: "123456", rows: [
     {
       "toBottom": true,
       "cells": [
         {"columnId": 456, "value": "cell value"},
         {"columnId": 789, "value": "another value"}
       ]
     }
   ])
```

### Pattern 6: Navigate Workspace Hierarchy

```
1. search_workspaces(query: "workspace name")
   → Returns workspace ID

2. get_workspace(workspaceId: "111222")
   → Returns folders and sheets within

3. get_folder(folderId: "333444")
   → Returns nested contents
```

## Data Structure Reference

### Sheet Response

```json
{
  "id": 123456,
  "name": "Sheet Name",
  "columns": [
    {"id": 456, "title": "Column A", "type": "TEXT_NUMBER", "primary": true},
    {"id": 789, "title": "Status", "type": "PICKLIST"}
  ],
  "rows": [
    {
      "id": 111,
      "rowNumber": 1,
      "cells": [
        {"columnId": 456, "value": "Task 1"},
        {"columnId": 789, "value": "Complete"}
      ]
    }
  ]
}
```

### Report Response

Reports aggregate data from multiple source sheets:

```json
{
  "id": 789012,
  "name": "Report Name",
  "sourceSheets": [
    {"id": 123, "name": "Source Sheet 1"},
    {"id": 456, "name": "Source Sheet 2"}
  ],
  "columns": [...],
  "rows": [...]
}
```

### Row Update Format

```json
{
  "sheetId": "123456",
  "rows": [
    {
      "id": "existing_row_id",
      "cells": [
        {"columnId": 456, "value": "updated value"},
        {"columnId": 789, "formula": "=SUM([Column A]1:[Column A]10)"}
      ]
    }
  ]
}
```

### Row Add Format

```json
{
  "sheetId": "123456",
  "rows": [
    {
      "toBottom": true,
      "cells": [
        {"columnId": 456, "value": "new row value"}
      ]
    }
  ]
}
```

## Common Tasks

| Task | Tools to Use |
|------|--------------|
| "Find sheet about X" | `search_sheets` → `get_sheet` |
| "Show me this URL" | `get_sheet_by_url` or `get_report_by_url` |
| "Update status to Done" | `get_sheet` → `update_rows` |
| "Add a new task" | `get_sheet` → `add_rows` |
| "What reports exist for X" | `search_reports` |
| "List workspace contents" | `search_workspaces` → `get_workspace` |
| "Copy this sheet" | `copy_sheet` |

## Tips

1. **Always get column IDs first** — Before updating/adding rows, call `get_sheet` to get current column IDs

2. **Use pagination for large sheets** — Pass `pageSize` and `page` for sheets with many rows

3. **Reports are read-only** — Cannot update rows via report; find source sheet instead

4. **URL parsing** — `get_*_by_url` tools extract IDs automatically from Smartsheet URLs

5. **Wildcard search** — Use `*` in search queries for broad matches

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Sheet not found" | Wrong ID or no access | Verify ID via `search_sheets` |
| "Column not found" | Column ID changed | Re-fetch sheet to get current IDs |
| "Invalid row" | Row ID doesn't exist | Verify row exists in sheet |
| Empty search results | Query too specific | Try broader terms or `*` wildcard |
