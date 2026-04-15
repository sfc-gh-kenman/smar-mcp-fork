---
name: smartsheet-mcp-setup
description: "Guide users through setting up the Smartsheet MCP server for AI coding assistants (Cortex Code, Cursor, Claude Desktop). Use when: user wants to set up Smartsheet integration, connect to Smartsheet API, or troubleshoot Smartsheet MCP issues."
---

# Smartsheet MCP Setup Skill

Interactive guide for setting up the Smartsheet MCP server with MCP-compatible AI coding assistants.

## Supported Clients

| Client | Config Location |
|--------|-----------------|
| Cortex Code | `~/.snowflake/cortex/mcp.json` |
| Cursor | `~/.cursor/mcp.json` |
| Claude Desktop | `~/.claude/claude_desktop_config.json` |

The MCP config format is identical across clients.

## Prerequisites Check

Before starting, verify:

1. **Node.js installed:**
   ```bash
   node --version  # Should be v18+
   ```

2. **MCP-compatible client installed** (Cortex Code, Cursor, or Claude Desktop)

3. **Smartsheet account** with API access

## Setup Workflow

### Step 1: Clone Repository

Ask user which source to use:

| Option | Source | Notes |
|--------|--------|-------|
| A | `sfc-gh-kenman/smar-mcp` | Fork with `get_report` tools |
| B | `smartsheet-platform/smar-mcp` | Upstream (no report tools) |

**Clone command:**
```bash
# Option A (recommended)
git clone git@github.com:sfc-gh-kenman/smar-mcp.git

# Option B
git clone git@github.com:smartsheet-platform/smar-mcp.git
```

### Step 2: Build

```bash
cd smar-mcp
npm install
npm run build
```

✋ **STOP** - Verify build succeeded (no TypeScript errors)

### Step 3: Get API Token

Guide user to get their Smartsheet API token:

1. Log into [app.smartsheet.com](https://app.smartsheet.com)
2. Click **Account** (top right) → **Personal Settings**
3. Select **API Access** from left menu
4. Click **Generate new access token**
5. Copy the token (~37 characters)

⚠️ This is a **Bearer token** - treat it like a password.

✋ **STOP** - Confirm user has their token before proceeding

### Step 4: Identify Client & Config Location

Ask which client user is using:

| Client | Config File |
|--------|-------------|
| Cortex Code | `~/.snowflake/cortex/mcp.json` |
| Cursor | `~/.cursor/mcp.json` |
| Claude Desktop | `~/.claude/claude_desktop_config.json` |

### Step 5: Get Node Path

```bash
which node
```

Common paths:
- `/opt/homebrew/bin/node` (macOS ARM)
- `/usr/local/bin/node` (macOS Intel)
- `/usr/bin/node` (Linux)

### Step 6: Configure MCP

Add to the client's config file:

```json
"smartsheet": {
  "type": "stdio",
  "command": "<NODE_PATH>",
  "args": [
    "<REPO_PATH>/build/index.js"
  ],
  "env": {
    "SMARTSHEET_API_KEY": "<USER_TOKEN>",
    "SMARTSHEET_ENDPOINT": "https://api.smartsheet.com/2.0"
  }
}
```

**Template values:**
| Placeholder | Example Value |
|-------------|---------------|
| `<NODE_PATH>` | `/opt/homebrew/bin/node` |
| `<REPO_PATH>` | Full path to cloned repo |
| `<USER_TOKEN>` | User's API token from Step 3 |

### Step 7: Restart & Verify

1. User restarts their AI coding assistant
2. Check MCP status:
   - Cortex Code: `/mcp`
   - Cursor: MCP panel
   - Claude Desktop: Settings → MCP
3. Expected: `✓ smartsheet (stdio) - Connected`

### Step 8: Test Connection

Run a simple test:
```
get_current_user
```

Should return user's Smartsheet profile (email, name, account).

## Troubleshooting

### "Connection closed" Error

**Cause:** Missing environment variable(s)

**Fix:** Ensure BOTH are set in config:
- `SMARTSHEET_API_KEY`
- `SMARTSHEET_ENDPOINT`

Test manually:
```bash
SMARTSHEET_API_KEY="token" SMARTSHEET_ENDPOINT="https://api.smartsheet.com/2.0" node /path/to/build/index.js
```

### "ENOENT... node" Error

**Cause:** Wrong path to node binary

**Fix:** Find correct path with `which node` and update `command` in config.

### Config Structure Wrong

**Cause:** `command` and `args` not split properly

**Wrong:**
```json
"command": "node /path/to/index.js"
```

**Right:**
```json
"command": "/opt/homebrew/bin/node",
"args": ["/path/to/index.js"]
```

## Available Tools After Setup

| Tool | Description |
|------|-------------|
| `get_current_user` | Your Smartsheet profile |
| `get_sheet` / `get_sheet_by_url` | Read sheet data |
| `get_report` / `get_report_by_url` | Read report data (fork only) |
| `search_sheets` / `search_reports` | Find sheets/reports by name |
| `get_workspaces` | List workspaces |
| `add_rows` | Insert new rows |
| `update_rows` | Modify existing rows |

## Stopping Points

| Step | Stop? | Reason |
|------|-------|--------|
| After clone | No | Continue to build |
| After build | ⚠️ Yes | Verify no errors |
| After token | ⚠️ Yes | Confirm user has token |
| After config | No | Continue to restart |
| After verify | ⚠️ Yes | Confirm connected before testing |
