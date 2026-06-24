import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SmartsheetAPI } from "../apis/smartsheet-api.js";
import { z } from "zod";

export function getSheetTools(server: McpServer, api: SmartsheetAPI, allowDeleteTools: boolean) {

    // @ts-ignore TS2589 — inference depth limit with MCP SDK overloads
    server.tool(
      "get_sheet",
      "Retrieves the current state of a sheet, including rows, columns, and cells",
      {
        sheetId: z.string().describe("The ID of the sheet to retrieve"),
        include: z.string().optional().describe("Comma-separated list of elements to include (e.g., 'format,formulas')"),
        pageSize: z.number().optional().describe("Number of rows to return per page"),
        page: z.number().optional().describe("Page number to return"),
      },
      async ({ sheetId, include, pageSize, page }) => {
        try {
          console.info(`Getting sheet with ID: ${sheetId}`);
          const sheet = await api.sheets.getSheet(sheetId, include, undefined, pageSize, page);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(sheet, null, 2)
              }
            ]
          };
        } catch (error: any) {
          console.error(`Failed to get sheet with ID: ${sheetId}`, { error });
          return {
            content: [
              {
                type: "text",
                text: `Failed to get sheet: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }
    );

    server.tool(
      "get_sheet_by_url",
      "Retrieves the current state of a sheet, including rows, columns, and cells",
      {
        url: z.string().describe("The URL of the sheet to retrieve"),
        include: z.string().optional().describe("Comma-separated list of elements to include (e.g., 'format,formulas')"),
        pageSize: z.number().optional().describe("Number of rows to return per page"),
        page: z.number().optional().describe("Page number to return"),
      },
      async ({ url, include, pageSize, page }) => {
        try {
          console.info(`Getting sheet with URL: ${url}`);
          const match = url.match(/\/sheets\/([^?\/]+)/);
          const directIdToken = match ? match[1] : null;
          if (!directIdToken) {
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to get sheet: Invalid URL format`
                }
              ],
              isError: true
            };
          }
          const sheet = await api.sheets.getSheetByDirectIdToken(directIdToken, include, undefined, pageSize, page);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(sheet, null, 2)
              }
            ]
          };
        } catch (error: any) {
          console.error(`Failed to get sheet with URL: ${url}`, { error });
          return {
            content: [
              {
                type: "text",
                text: `Failed to get sheet: ${error.message}`
              }
            ],
            isError: true
          };
        }
      }
    );

    server.tool(
        "get_sheet_version",
        "Gets the current version number of a sheet",
        {
          sheetId: z.string().describe("The ID of the sheet"),
        },
        async ({ sheetId }) => {
          try {
            console.info(`Getting version for sheet with ID: ${sheetId}`);
            const version = await api.sheets.getSheetVersion(sheetId);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(version, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to get sheet version for sheet ID: ${sheetId}`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to get sheet version: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );
      
      // Tool: Get Cell History
      server.tool(
        "get_cell_history",
        "Retrieves the history of changes for a specific cell",
        {
          sheetId: z.string().describe("The ID of the sheet"),
          rowId: z.string().describe("The ID of the row"),
          columnId: z.string().describe("The ID of the column"),
          include: z.string().optional().describe("Optional parameter to include additional information"),
          pageSize: z.number().optional().describe("Number of history entries to return per page"),
          page: z.number().optional().describe("Page number to return"),
        },
        async ({ sheetId, rowId, columnId, include, pageSize, page }) => {
          try {
            console.info(`Getting history for cell at row ${rowId}, column ${columnId} in sheet ${sheetId}`);
            const history = await api.sheets.getCellHistory(sheetId, rowId, columnId, include, pageSize, page);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(history, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to get cell history for row ${rowId}, column ${columnId} in sheet ${sheetId}`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to get cell history: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );

      // Tool: Get Row
      server.tool(
        "get_row",
        "Retrieves a specific row from a sheet",
        {
          sheetId: z.string().describe("The ID of the sheet"),
          rowId: z.string().describe("The ID of the row"),
          include: z.string().optional().describe("Comma-separated list of elements to include (e.g., 'format,formulas')"),
        },
        async ({ sheetId, rowId, include }) => {
          try {
            console.info(`Getting row ${rowId} in sheet ${sheetId}`);
            const row = await api.sheets.getRow(sheetId, rowId, include);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(row, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to get row ${rowId} in sheet ${sheetId}`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to get row: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );
      
      // Tool: Update Rows
      server.tool(
        "update_rows",
        "Updates rows in a sheet, including cell values, formatting, and formulae",
        {
          sheetId: z.string().describe("The ID of the sheet"),
          rows: z.array(
            z.object({
              id: z.string().describe("Row ID"),
              cells: z.array(
                z.object({
                  columnId: z.number().or(z.string()).describe("Column ID"),
                  value: z.any().optional().describe("Cell value"),
                  formula: z.string().optional().describe("Cell formula"),
                  format: z.string().optional().describe("Cell format"),
                })
              ).describe("Array of cell objects"),
            })
          ).describe("Array of row objects to update"),
        },
        async ({ sheetId, rows }) => {
          try {
            console.info(`Updating ${rows.length} rows in sheet ${sheetId}`);
            const result = await api.sheets.updateRows(sheetId, rows);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to update ${rows.length} rows in sheet ${sheetId}`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to update rows: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );
      
      // Tool: Add Rows
      server.tool(
        "add_rows",
        "Adds new rows to a sheet. Use parentId to nest rows inside a parent row (required for hierarchical sheets). Use siblingId + above to place rows relative to a specific sibling.",
        {
          sheetId: z.string().describe("The ID of the sheet"),
          rows: z.array(
            z.object({
              toTop: z.boolean().optional().describe("Add row to the top of the sheet"),
              toBottom: z.boolean().optional().describe("Add row to the bottom of the sheet"),
              parentId: z.number().optional().describe("ID of the parent row — inserts as a child (required for correct nesting in hierarchical sheets)"),
              siblingId: z.number().optional().describe("ID of the sibling row to insert adjacent to. Combined with 'above' to control placement. Without parentId, uses the sibling's indentation level."),
              above: z.boolean().optional().describe("When true, inserts above the siblingId row instead of below"),
              cells: z.array(
                z.object({
                  columnId: z.number().or(z.string()).describe("Column ID"),
                  value: z.any().optional().describe("Cell value"),
                  formula: z.string().optional().describe("Cell formula"),
                  format: z.string().optional().describe("Cell format"),
                })
              ).describe("Array of cell objects"),
            })
          ).describe("Array of row objects to add"),
        },
        async ({ sheetId, rows }) => {
          try {
            console.info(`Adding ${rows.length} rows to sheet ${sheetId}`);
            const result = await api.sheets.addRows(sheetId, rows);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to add ${rows.length} rows to sheet ${sheetId}`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to add rows: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );
      
      // Tool: Delete Rows (conditionally registered)
      if (allowDeleteTools) {
        server.tool(
          "delete_rows",
          "Deletes rows from a sheet",
          {
            sheetId: z.string().describe("The ID of the sheet"),
            rowIds: z.array(z.string()).describe("Array of row IDs to delete"),
            ignoreRowsNotFound: z.boolean().optional().describe("If true, don't throw an error if rows are not found"),
          },
          async ({ sheetId, rowIds, ignoreRowsNotFound }) => {
            try {
              console.info(`Deleting ${rowIds.length} rows from sheet ${sheetId}`);
              const result = await api.sheets.deleteRows(sheetId, rowIds, ignoreRowsNotFound);
              
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                  }
                ]
              };
            } catch (error: any) {
              console.error(`Failed to delete ${rowIds.length} rows from sheet ${sheetId}`, { error });
              return {
                content: [
                  {
                    type: "text",
                    text: `Failed to delete rows: ${error.message}`
                  }
                ],
                isError: true
              };
            }
          }
        );
      } else {
        console.warn("Delete operations are disabled. Set ALLOW_DELETE_TOOLS=true to enable them.");
      }
      
      // Tool: Get Sheet Location
      server.tool(
        "get_sheet_location",
        "Gets the folder ID where a sheet is located",
        {
          sheetId: z.string().describe("The ID of the sheet"),
        },
        async ({ sheetId }) => {
          try {
            console.info(`Getting location for sheet ${sheetId}`);
            const location = await api.sheets.getSheetLocation(sheetId);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(location, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to get location for sheet ${sheetId}`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to get sheet location: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );
      
      // Tool: Copy Sheet
      server.tool(
        "copy_sheet",
        "Creates a copy of the specified sheet in the same folder",
        {
          sheetId: z.string().describe("The ID of the sheet to copy"),
          destinationName: z.string().describe("Name for the sheet copy"),
          destinationFolderId: z.string().optional().describe("ID of the destination folder (same as source if not specified)"),
        },
        async ({ sheetId, destinationName, destinationFolderId }) => {
          try {
            console.info(`Copying sheet ${sheetId} to "${destinationName}"`);
            
            // If no destination folder is specified, get the current folder
            if (!destinationFolderId) {
              try {
                const location = await api.sheets.getSheetLocation(sheetId);
                destinationFolderId = location.folderId;
              } catch (error) {
                console.warn("Failed to get sheet location, using default folder", { error });
              }
            }
            
            const result = await api.sheets.copySheet(sheetId, destinationName, destinationFolderId);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to copy sheet ${sheetId} to "${destinationName}"`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to copy sheet: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );
      
      // Tool: Create Sheet
      server.tool(
        "create_sheet",
        "Creates a new sheet",
        {
          name: z.string().describe("Name for the new sheet"),
          columns: z.array(
            z.object({
              title: z.string().describe("Column title"),
              type: z.string().describe("Column type"),
              primary: z.boolean().optional().describe("Whether this is the primary column"),
            })
          ).describe("Array of column objects"),
          folderId: z.string().optional().describe("ID of the folder where the sheet should be created"),
        },
        async ({ name, columns, folderId }) => {
          try {
            console.info(`Creating new sheet "${name}"`);
            const result = await api.sheets.createSheet(name, columns, folderId);
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          } catch (error: any) {
            console.error(`Failed to create sheet "${name}"`, { error });
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to create sheet: ${error.message}`
                }
              ],
              isError: true
            };
          }
        }
      );

    // Tool: get_columns
    server.tool(
      "get_columns",
      "Retrieves all columns in a sheet",
      { sheetId: z.string().describe("ID of the sheet"), includeAll: z.boolean().optional().describe("Return all columns without pagination") },
      async ({ sheetId, includeAll }) => {
        try {
          const result = await api.sheets.getColumns(sheetId, includeAll);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Failed to get columns: ${error.message}` }], isError: true };
        }
      }
    );

    // Tool: add_columns
    server.tool(
      "add_columns",
      "Adds one or more columns to a sheet",
      {
        sheetId: z.string().describe("ID of the sheet"),
        columns: z.array(z.object({
          title: z.string().describe("Column title"),
          type: z.string().optional().describe("Column type (e.g., TEXT_NUMBER, DATE, PICKLIST)"),
          index: z.number().optional().describe("Position to insert the column (0-based)"),
        })).describe("Array of column definitions to add"),
      },
      async ({ sheetId, columns }) => {
        try {
          const result = await api.sheets.addColumns(sheetId, columns);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Failed to add columns: ${error.message}` }], isError: true };
        }
      }
    );

    // Tool: get_sheet_summary
    server.tool(
      "get_sheet_summary",
      "Retrieves the summary fields of a sheet",
      { sheetId: z.string().describe("ID of the sheet"), include: z.string().optional().describe("Comma-separated list of elements to include (e.g., 'writerInfo')") },
      async ({ sheetId, include }) => {
        try {
          const result = await api.sheets.getSheetSummary(sheetId, include);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Failed to get sheet summary: ${error.message}` }], isError: true };
        }
      }
    );

    // Tool: create_sheet_in_folder
    server.tool(
      "create_sheet_in_folder",
      "Creates a new sheet inside a specific folder",
      {
        folderId: z.string().describe("ID of the folder to create the sheet in"),
        name: z.string().describe("Name of the new sheet"),
        columns: z.array(z.object({ title: z.string(), type: z.string().optional() })).optional().describe("Optional initial columns"),
      },
      async ({ folderId, name, columns }) => {
        try {
          const result = await api.folders.createSheetInFolder(folderId, name, columns);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Failed to create sheet in folder: ${error.message}` }], isError: true };
        }
      }
    );

    // Tool: create_sheet_in_workspace
    server.tool(
      "create_sheet_in_workspace",
      "Creates a new sheet inside a specific workspace",
      {
        workspaceId: z.string().describe("ID of the workspace to create the sheet in"),
        name: z.string().describe("Name of the new sheet"),
        columns: z.array(z.object({ title: z.string(), type: z.string().optional() })).optional().describe("Optional initial columns"),
      },
      async ({ workspaceId, name, columns }) => {
        try {
          const result = await api.workspaces.createSheetInWorkspace(workspaceId, name, columns);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Failed to create sheet in workspace: ${error.message}` }], isError: true };
        }
      }
    );

    // Tool: get_resource_guide
    server.tool(
      "get_resource_guide",
      "Returns guidance on available Smartsheet MCP tools and common usage patterns",
      {},
      async () => {
        const guide = {
          description: "Smartsheet MCP Server — available tool categories",
          read: ["get_sheet", "get_sheet_by_url", "get_row", "get_columns", "get_sheet_summary", "get_folder", "browse_folder", "get_workspace", "browse_workspace", "get_workspaces", "list_workspaces", "get_report", "get_report_by_url", "get_dashboard", "get_dashboard_by_url", "get_discussion", "get_discussions_by_sheet_id", "get_discussions_by_row_id", "list_row_discussions", "get_cell_history", "get_current_user", "get_user"],
          write: ["add_rows", "update_rows", "delete_rows", "add_columns", "create_sheet_in_folder", "create_sheet_in_workspace", "create_sheet", "create_folder", "create_workspace", "create_row_discussion", "create_discussion_on_row", "create_sheet_discussion", "add_comment", "create_update_request"],
          search: ["search", "search_sheets", "search_in_sheet", "search_workspaces", "search_folders", "search_reports", "search_dashboards"],
          tip: "Use get_workspaces or list_workspaces to discover sheet IDs, then get_sheet to read content.",
        };
        return { content: [{ type: "text", text: JSON.stringify(guide, null, 2) }] };
      }
    );

}
