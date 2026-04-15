---
name: smartsheet-mcp-dev
description: "Develop, maintain, and enhance the Smartsheet MCP server. Use when: adding new Smartsheet API features, fixing MCP bugs, implementing feature gaps, or extending tool coverage. Triggers: smartsheet mcp, add smartsheet tool, implement dashboard, mcp feature gap."
---

# Smartsheet MCP Development

Guide for adding features, fixing bugs, and maintaining the Smartsheet MCP server.

## Repository Location

```
~/Documents/Projects/Github/ThirdParty/smartsheet-platform/smar-mcp-fork/
```

> **Note:** Always use the fork (`smar-mcp-fork`), not `smar-mcp`. The MCP config in `~/.snowflake/cortex/mcp.json` points to the fork's build output.

## Architecture Overview

```
src/
├── index.ts                    # Entry point - registers all tools
├── apis/                       # Smartsheet API wrappers
│   ├── smartsheet-api.ts       # Main client + sub-API registry
│   ├── smartsheet-sheet-api.ts
│   ├── smartsheet-report-api.ts
│   └── ...
└── tools/                      # MCP tool definitions
    ├── smartsheet-sheet-tools.ts
    ├── smartsheet-report-tools.ts
    └── ...
```

## Intent Detection

| Intent | Triggers | Action |
|--------|----------|--------|
| **ADD FEATURE** | "add tool", "implement", "feature gap" | Follow Add Feature workflow |
| **DEBUG** | "fix", "broken", "error", "not working" | Follow Debug workflow |
| **UNDERSTAND** | "how does", "explain", "where is" | Read relevant source files |

---

## Workflow: Add Feature

### Step 1: Identify the Gap

**Read** `docs/FEATURE_GAPS.md` to check if already documented.

**If new gap:** Document it first with:
- API endpoints needed
- Value proposition
- Effort estimate

### Step 2: Create API Method

**File:** `src/apis/smartsheet-{domain}-api.ts`

**Pattern:**
```typescript
import { SmartsheetAPI } from "./smartsheet-api.js";

export class Smartsheet{Domain}API {
  private api: SmartsheetAPI;

  constructor(api: SmartsheetAPI) {
    this.api = api;
  }

  async get{Resource}(id: string, ...params): Promise<any> {
    return this.api.request('GET', `/{resource}/${id}`, undefined, { ...params });
  }
}
```

**Key points:**
- Constructor takes `SmartsheetAPI` instance
- Use `this.api.request()` for all HTTP calls
- Method signature: `(method, endpoint, body?, queryParams?)`

### Step 3: Register API in Main Client

**File:** `src/apis/smartsheet-api.ts`

**Add import:**
```typescript
import { Smartsheet{Domain}API } from './smartsheet-{domain}-api.js';
```

**Add property:**
```typescript
public {domain}: Smartsheet{Domain}API;
```

**Initialize in constructor:**
```typescript
this.{domain} = new Smartsheet{Domain}API(this);
```

### Step 4: Create Tool

**File:** `src/tools/smartsheet-{domain}-tools.ts`

**Pattern:**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SmartsheetAPI } from "../apis/smartsheet-api.js";
import { z } from "zod";

export function get{Domain}Tools(server: McpServer, api: SmartsheetAPI) {
  server.tool(
    "tool_name",
    "Description of what it does",
    {
      param1: z.string().describe("Parameter description"),
      param2: z.number().optional().describe("Optional param"),
    },
    async ({ param1, param2 }) => {
      try {
        console.info(`Doing something with: ${param1}`);
        const result = await api.{domain}.method(param1, param2);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        console.error(`Failed: ${error.message}`, { error });
        return {
          content: [{ type: "text", text: `Failed: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
```

### Step 5: Register Tools in Index

**File:** `src/index.ts`

**Add import:**
```typescript
import { get{Domain}Tools } from "./tools/smartsheet-{domain}-tools.js";
```

**Register tools:**
```typescript
// Tool: {Domain} tools
get{Domain}Tools(server, api);
```

### Step 6: Build and Test

```bash
cd ~/Documents/Projects/Github/ThirdParty/smartsheet-platform/smar-mcp
npm run build
```

✋ **STOP** - Verify build succeeds before testing

**Test manually:**
```bash
SMARTSHEET_API_KEY="token" SMARTSHEET_ENDPOINT="https://api.smartsheet.com/2.0" \
  node build/index.js
```

**Test in client:** Restart MCP client, verify tool appears, test with real data.

### Step 7: Update Documentation

**Update** `docs/FEATURE_GAPS.md`:
- Change status from ❌ to 🔧 (fork) or ✅ (upstream)

**Update** `docs/SETUP_MCP_CLIENTS.md`:
- Add new tool to Available Tools table

### Step 8: Commit

```bash
git add src/ docs/
git commit -m "feat: add {feature} tools ({tool_names})"
git push
```

---

## Workflow: Debug

### Step 1: Reproduce

Get exact error message from user or logs.

### Step 2: Test Manually

```bash
SMARTSHEET_API_KEY="token" SMARTSHEET_ENDPOINT="https://api.smartsheet.com/2.0" \
  node build/index.js
```

Watch for startup errors.

### Step 3: Check Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| "Connection closed" | Missing env var | Add both `SMARTSHEET_API_KEY` and `SMARTSHEET_ENDPOINT` |
| "ENOENT node" | Wrong node path | Use `which node` to find correct path |
| TypeScript error | Bad import/syntax | Check `.js` extensions on imports |
| 401 Unauthorized | Invalid token | Regenerate API token |
| 404 Not Found | Wrong endpoint | Check Smartsheet API docs |

### Step 4: Fix and Rebuild

```bash
npm run build
```

---

## API Reference

### Smartsheet API Endpoints

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Sheets | `/sheets/{id}` | Core resource |
| Reports | `/reports/{id}` | Read-only aggregations |
| Dashboards | `/sights/{id}` | Called "sights" in API |
| Workspaces | `/workspaces/{id}` | Container for sheets |
| Folders | `/folders/{id}` | Nested containers |
| Users | `/users/{id}` | User management |
| Search | `/search?query=...&scopes=...` | Multi-scope search |

### Request Method

```typescript
api.request<T>(method, endpoint, body?, queryParams?): Promise<T>
```

- Handles auth header automatically
- Includes retry logic for rate limits
- Returns parsed JSON response

---

## Stopping Points

| Step | Stop? | Reason |
|------|-------|--------|
| After identifying gap | No | Continue to implementation |
| After build | ⚠️ Yes | Verify no TypeScript errors |
| After manual test | ⚠️ Yes | Verify API works before client test |
| After client test | ⚠️ Yes | Confirm with user before commit |

## Output

- New/fixed MCP tools
- Updated documentation
- Committed and pushed changes
