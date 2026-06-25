import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SmartsheetAPI } from "../apis/smartsheet-api.js";
import { z } from "zod";

export function getDiscussionTools(server: McpServer, api: SmartsheetAPI, allowDeleteTools: boolean = false) {

    // @ts-ignore TS2589 — inference depth limit with MCP SDK overloads
    // Tool: Get discussions by sheet ID
    server.tool(
        "get_discussions_by_sheet_id",
        "Gets discussions by sheet ID",
        {
            sheetId: z.string().describe("The ID of the sheet"),
            include: z.string().optional().describe("Optional parameter to include additional information (e.g., 'attachments')"),
            pageSize: z.number().optional().describe("Number of discussions to return per page"),
            page: z.number().optional().describe("Page number to return"),
            includeAll: z.boolean().optional().describe("Whether to include all results"),
        },
        async ({ sheetId, include, pageSize, page, includeAll }) => {
            try {
                console.info(`Getting discussions for sheet with ID: ${sheetId}`);
                const discussions = await api.discussions.getDiscussionsBySheetId(sheetId, include, pageSize, page, includeAll);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(discussions, null, 2)
                        }
                    ]
                };
            } catch (error: any) {
                console.error(`Failed to get discussions for sheet ID: ${sheetId}`, { error });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to get discussions: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );

    // Get discussions by row ID
    server.tool(
        "get_discussions_by_row_id",
        "Gets discussions by row ID",
        {
            sheetId: z.string().describe("ID of the sheet to get discussions for"),
            rowId: z.string().describe("ID of the row to get discussions for"),
            include: z.string().optional().describe("Optional parameter to include additional information (e.g., 'attachments')"),
            pageSize: z.number().optional().describe("Number of discussions to return per page"),
            page: z.number().optional().describe("Page number to return"),
            includeAll: z.boolean().optional().describe("Whether to include all results"),
        },
        async ({ sheetId, rowId, include, pageSize, page, includeAll }) => {
            try {
                console.info(`Getting discussions for row with ID: ${rowId} in sheet with ID: ${sheetId}`);
                const discussions = await api.discussions.getDiscussionsByRowId(sheetId, rowId, include, pageSize, page, includeAll);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(discussions, null, 2)
                        }
                    ]
                };
            } catch (error: any) {
                console.error(`Failed to get discussions for row ID: ${rowId} in sheet ID: ${sheetId}`, { error });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to get discussions: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );

    // Create sheet discussion
    server.tool(
        "create_sheet_discussion",
        "Creates a new discussion on a sheet",
        {
            sheetId: z.string().describe("ID of the sheet to create a discussion for"),
            commentText: z.string().describe("Text of the comment to add")
        },
        async ({ sheetId, commentText }) => {
            try {
                console.info(`Creating discussion on sheet with ID: ${sheetId}`);
                const discussion = await api.discussions.createSheetDiscussion(sheetId, commentText);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(discussion, null, 2)
                        }
                    ]
                };
            } catch (error: any) {
                console.error(`Failed to create discussion on sheet ID: ${sheetId}`, { error });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to create discussion: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );

    // Create row discussion
    server.tool(
        "create_row_discussion",
        "Creates a new discussion on a row",
        {
            sheetId: z.string().describe("ID of the sheet to create a discussion for"),
            rowId: z.string().describe("ID of the row to create a discussion for"),
            commentText: z.string().describe("Text of the comment to add")
        },
        async ({ sheetId, rowId, commentText }) => {
            try {
                console.info(`Creating discussion on row with ID: ${rowId} in sheet with ID: ${sheetId}`);
                const discussion = await api.discussions.createRowDiscussion(sheetId, rowId, commentText);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(discussion, null, 2)
                        }
                    ]
                };
            } catch (error: any) {
                console.error(`Failed to create discussion on row ID: ${rowId} in sheet ID: ${sheetId}`, { error });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to create discussion: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );

    // Alias: create_discussion_on_row (official MCP name)
    // @ts-ignore TS2589 — inference depth limit with MCP SDK overloads
    server.tool(
        "create_discussion_on_row",
        "Creates a new discussion on a row (alias for create_row_discussion)",
        {
            sheetId: z.string().describe("ID of the sheet"),
            rowId: z.string().describe("ID of the row"),
            commentText: z.string().describe("Text of the comment to add")
        },
        async ({ sheetId, rowId, commentText }) => {
            try {
                const discussion = await api.discussions.createRowDiscussion(sheetId, rowId, commentText);
                return { content: [{ type: "text", text: JSON.stringify(discussion, null, 2) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Failed to create discussion: ${error.message}` }], isError: true };
            }
        }
    );

    // Alias: list_row_discussions (official MCP name)
    server.tool(
        "list_row_discussions",
        "Lists discussions on a row (alias for get_discussions_by_row_id)",
        {
            sheetId: z.string().describe("ID of the sheet"),
            rowId: z.string().describe("ID of the row"),
            includeAll: z.boolean().optional().describe("Whether to include all results"),
        },
        async ({ sheetId, rowId, includeAll }) => {
            try {
                const discussions = await api.discussions.getDiscussionsByRowId(sheetId, rowId, undefined, undefined, undefined, includeAll);
                return { content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Failed to list discussions: ${error.message}` }], isError: true };
            }
        }
    );

    // Tool: get_discussion
    server.tool(
        "get_discussion",
        "Retrieves a specific discussion by ID",
        {
            sheetId: z.string().describe("ID of the sheet"),
            discussionId: z.string().describe("ID of the discussion"),
        },
        async ({ sheetId, discussionId }) => {
            try {
                const discussion = await api.discussions.getDiscussion(sheetId, discussionId);
                return { content: [{ type: "text", text: JSON.stringify(discussion, null, 2) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Failed to get discussion: ${error.message}` }], isError: true };
            }
        }
    );

    // Tool: add_comment
    server.tool(
        "add_comment",
        "Adds a comment to an existing discussion",
        {
            sheetId: z.string().describe("ID of the sheet"),
            discussionId: z.string().describe("ID of the discussion to comment on"),
            text: z.string().describe("Text of the comment"),
        },
        async ({ sheetId, discussionId, text }) => {
            try {
                const comment = await api.discussions.addComment(sheetId, discussionId, text);
                return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Failed to add comment: ${error.message}` }], isError: true };
            }
        }
    );

    // Tool: delete_discussion (gated by allowDeleteTools)
    if (allowDeleteTools) {
        server.tool(
            "delete_discussion",
            "Deletes a discussion and all its comments. Requires ALLOW_DELETE_TOOLS=true.",
            {
                sheetId: z.string().describe("ID of the sheet"),
                discussionId: z.string().describe("ID of the discussion to delete"),
            },
            async ({ sheetId, discussionId }) => {
                try {
                    const result = await api.discussions.deleteDiscussion(sheetId, discussionId);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                } catch (error: any) {
                    return { content: [{ type: "text", text: `Failed to delete discussion: ${error.message}` }], isError: true };
                }
            }
        );
    }

}
