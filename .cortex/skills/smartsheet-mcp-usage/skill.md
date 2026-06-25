---
name: smartsheet-mcp-usage
description: "Guide for using Smartsheet MCP tools effectively. Use when: querying sheets, searching Smartsheet, updating rows, creating sheets, working with reports, managing workspaces. Triggers: smartsheet, find sheet, update row, get sheet, smartsheet report, workspace, search smartsheet."
---

# Smartsheet MCP Usage

Effective patterns for querying, updating, and managing Smartsheet data via MCP tools.

## Available Tools

### Read
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get_sheet` | Get sheet with rows/columns | `sheetId`, `pageSize`, `page` |
| `get_sheet_by_url` | Get sheet from URL | `url`, `pageSize`, `page` |
| `get_row` | Get single row details | `sheetId`, `rowId` |
| `get_columns` | Get all columns in a sheet | `sheetId` |
| `get_sheet_summary` | Get sheet summary fields | `sheetId` |
| `get_report` | Get report data | `reportId`, `pageSize`, `page` |
| `get_report_by_url` | Get report from URL | `url`, `pageSize`, `page` |
| `get_workspace` / `browse_workspace` | Get workspace contents | `workspaceId` |
| `get_workspaces` / `list_workspaces` | List all workspaces | — |
| `get_folder` / `browse_folder` | Get folder contents | `folderId` |
| `get_dashboard` / `get_dashboard_by_url` | Get dashboard | `dashboardId` / `url` |
| `get_discussion` | Get a specific discussion | `sheetId`, `discussionId` |
| `get_discussions_by_sheet_id` | List sheet discussions | `sheetId` |
| `get_discussions_by_row_id` / `list_row_discussions` | List row discussions | `sheetId`, `rowId` |
| `get_cell_history` | Cell value history | `sheetId`, `rowId`, `columnId` |
| `get_current_user` | Authenticated user info | — |
| `get_resource_guide` | List all available tools | — |

### Search
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `search` | Unified search across all types | `query`, `scopes` (optional) |
| `search_sheets` | ⚠️ Hard-errors in practice — use workspace→folder navigation instead | `query` |
| `search_in_sheet` | Search within a sheet | `sheetId`, `query` |
| `search_workspaces` | Find workspaces | `query` |
| `search_folders` | Find folders | `query` |
| `search_reports` | Find reports | `query` |
| `search_dashboards` | Find dashboards | `query` |

### Write
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `add_rows` | Add new rows | `sheetId`, `rows[]` |
| `update_rows` | Modify existing rows | `sheetId`, `rows[]` |
| `delete_rows` | Delete rows (requires `ALLOW_DELETE_TOOLS=true`) | `sheetId`, `rowIds[]` |
| `add_columns` | Add columns to a sheet | `sheetId`, `columns[]` |
| `delete_column` | Delete a column (requires `ALLOW_DELETE_TOOLS=true`) | `sheetId`, `columnId` |
| `create_sheet` | Create new sheet (top-level) | `name`, `columns[]` |
| `create_sheet_in_folder` | Create sheet in a folder | `folderId`, `name`, `columns[]` |
| `create_sheet_in_workspace` | Create sheet in a workspace | `workspaceId`, `name`, `columns[]` |
| `copy_sheet` | Duplicate a sheet | `sheetId`, `destinationName` |
| `create_folder` | Create folder in folder | `folderId`, `folderName` |
| `create_workspace` | Create new workspace | `name` |
| `create_workspace_folder` | Create folder in workspace | `workspaceId`, `folderName` |
| `create_row_discussion` / `create_discussion_on_row` | Start a discussion on a row | `sheetId`, `rowId`, `commentText` |
| `create_sheet_discussion` | Start a discussion on a sheet | `sheetId`, `commentText` |
| `add_comment` | Add comment to existing discussion | `sheetId`, `discussionId`, `text` |
| `delete_discussion` | Delete discussion (requires `ALLOW_DELETE_TOOLS=true`) | `sheetId`, `discussionId` |
| `create_update_request` | Send update request to collaborators | `sheetId`, options |

## Workflow Patterns

### Pattern 1: Find Sheet for a Project (reliable)

**⚠️ Do NOT use `search_sheets` — it hard-errors. Use workspace → folder navigation.**

```python
# 1. Get workspace (ID from prior session or user-provided URL)
workspace = get_workspace(workspaceId)

# 2. Find project folder by prefix
folder = next(f for f in workspace['folders'] if f['name'].startswith(project_id))
folder_detail = get_folder(folderId=folder['id'])

# 3. Match sheet by keyword
status_sheet = next(s for s in folder_detail['sheets'] if 'Status Tracker' in s['name'])
schedule_sheet = next(s for s in folder_detail['sheets'] if 'Schedule' in s['name'])
```

### Pattern 2: URL-Based Access

```
get_sheet_by_url(url: "https://app.smartsheet.com/sheets/abc123...")
get_report_by_url(url: "https://app.smartsheet.com/reports/xyz789...")
```

### Pattern 3: Update Rows

```
1. get_sheet(sheetId: "123456")
   → Note column IDs from response

2. update_rows(sheetId: "123456", rows: [
     {"id": "row_id", "cells": [{"columnId": 456, "value": "new value"}]}
   ])
```

### Pattern 4: Add New Rows

```
1. get_sheet(sheetId: "123456")
   → Note column IDs from response

2. add_rows(sheetId: "123456", rows: [
     {"toBottom": true, "cells": [{"columnId": 456, "value": "cell value"}]}
   ])
```

### Pattern 5: Weekly Status Tracker — Insert New Entry

```python
# Find insertion point by content, NOT row number
for row in sheet['rows']:
    primary = get_primary_cell(row)
    if "Latest Key Accomplishments" in primary:
        parent_row_id = row['id']
    if "Linked from Certinia" in primary:
        sibling_row_id = row['id']

add_rows(sheetId=sheet_id, rows=[{
    "parentId": parent_row_id,
    "siblingId": sibling_row_id,
    "cells": [...]
}])
```

### Pattern 6: Create Sheet in Workspace

```python
# Requires OWNER access on the workspace
# Must include primary: true on at least one column
create_sheet_in_workspace(
    workspaceId="111222",
    name="My Sheet",
    columns=[{"title": "Task", "type": "TEXT_NUMBER", "primary": True}]
)
# Note: "My Smartsheet" (personal default workspace) blocks API creation
```

## Common Tasks

| Task | Tools to Use |
|------|--------------|
| "Find sheet for project PR-XXXXX" | `get_workspace` → `get_folder` → match by name keyword |
| "Show me this URL" | `get_sheet_by_url` or `get_report_by_url` |
| "Update status to Done" | `get_sheet` → `update_rows` |
| "Add a new task" | `get_sheet` → `add_rows` |
| "Add weekly status" | `get_sheet` → find parent/sibling rows → `add_rows` with `parentId`/`siblingId` |
| "What reports exist for X" | `search_reports` |
| "List workspace contents" | `get_workspaces` → `browse_workspace` |
| "What tools are available?" | `get_resource_guide` |
| "Search everything for X" | `search(query="X")` |

## Tips

1. **Always get column IDs first** — Before updating/adding rows, call `get_sheet` to get current column IDs

2. **Use pagination for large sheets** — Pass `pageSize` and `page` for sheets with many rows

3. **Reports are read-only** — Cannot update rows via report; find source sheet instead

4. **URL parsing** — `get_*_by_url` tools extract IDs automatically from Smartsheet URLs

5. **`search_sheets` unreliable** — Use `get_workspace` → `get_folder` navigation instead

6. **Delete tools are gated** — `delete_rows`, `delete_column`, `delete_discussion` require `ALLOW_DELETE_TOOLS=true` env var on the MCP server

7. **Sheet creation requires `primary: true`** — When creating sheets via API, at least one column must have `primary: true`

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Sheet not found" | Wrong ID or no access | Use workspace→folder navigation to find correct ID |
| `search_sheets` errors | Tool unreliable | Use workspace→folder navigation pattern instead |
| "Column not found" | Column ID changed | Re-fetch sheet to get current IDs |
| "Invalid row" | Row ID doesn't exist | Verify row exists in sheet |
| `create_sheet_in_workspace` fails | Personal "My Smartsheet" workspace restricts API creation | Use a named workspace you own |
| Empty search results | Query too specific | Try broader terms or use `search` (unified) |
