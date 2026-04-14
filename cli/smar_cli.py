#!/usr/bin/env python3
"""
smar-cli: Read-only Smartsheet project status CLI

Reads SMARTSHEET_API_KEY and SMARTSHEET_ENDPOINT from environment or a .env
file in the same directory as this script (cli/.env).

Usage:
    smar-cli whoami
    smar-cli projects
    smar-cli status   <sheetId|url>
    smar-cli assigned <sheetId|url>
    smar-cli overdue  <sheetId|url>
    smar-cli upcoming <sheetId|url> [--days 14]
    smar-cli milestones <sheetId|url>
"""

import argparse
import getpass
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

# Load .env from the cli/ directory (next to this script), not from CWD.
# This avoids picking up .env files in parent directories that may use
# non-standard formats (e.g. JSON-style key: value syntax).
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

_KEYRING_SERVICE = "smar-cli"
_KEYRING_USERNAME = "api_key"

# ─── ANSI Color ───────────────────────────────────────────────────────────────

USE_COLOR = sys.stdout.isatty()


def _c(code: str, text: str) -> str:
    if not USE_COLOR:
        return text
    return f"\033[{code}m{text}\033[0m"


def red(t: str) -> str:    return _c("31", t)
def yellow(t: str) -> str: return _c("33", t)
def green(t: str) -> str:  return _c("32", t)
def bold(t: str) -> str:   return _c("1", t)
def dim(t: str) -> str:    return _c("2", t)


# ─── API Key Resolution ───────────────────────────────────────────────────────

def _get_api_key() -> tuple[str, str]:
    """
    Resolve the API key using this priority order:
      1. SMARTSHEET_API_KEY environment variable (explicit / CI-safe)
      2. OS keyring  (macOS Keychain, Windows Credential Manager, Linux Secret Service)

    Returns (key, source_label) so callers can show where the key came from.
    """
    # 1 — environment variable (also picks up anything loaded from .env above)
    key = os.environ.get("SMARTSHEET_API_KEY", "")
    if key:
        return key, "env"

    # 2 — OS keyring (optional dependency; gracefully absent)
    try:
        import keyring  # type: ignore[import]
        key = keyring.get_password(_KEYRING_SERVICE, _KEYRING_USERNAME) or ""
        if key:
            return key, "keyring"
    except Exception:
        pass

    _die(
        "SMARTSHEET_API_KEY is not set.\n\n"
        "Option 1 — store securely in the OS keychain (recommended):\n"
        "    smar-cli login\n\n"
        "Option 2 — set an environment variable:\n"
        "    export SMARTSHEET_API_KEY=your_token     # Mac/Linux\n"
        "    $env:SMARTSHEET_API_KEY = 'your_token'  # Windows PowerShell\n\n"
        "Get a token: Smartsheet > Account > Personal Settings > API Access"
    )


# ─── Smartsheet Client ────────────────────────────────────────────────────────

class SmartsheetClient:
    def __init__(self) -> None:
        self.api_key, self._key_source = _get_api_key()
        self.endpoint = os.environ.get(
            "SMARTSHEET_ENDPOINT", "https://api.smartsheet.com/2.0"
        ).rstrip("/")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def request(self, endpoint: str, params: Optional[dict] = None) -> dict:
        url = f"{self.endpoint}{endpoint}"
        for attempt in range(3):
            resp = requests.get(
                url, headers=self._headers(), params=params, timeout=30
            )
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 2 ** (attempt + 1)))
                print(f"Rate limited — retrying in {wait}s...", file=sys.stderr)
                time.sleep(wait)
                continue
            if not resp.ok:
                body = {}
                try:
                    body = resp.json()
                except Exception:
                    pass
                _die(f"API error {resp.status_code}: {body.get('message', resp.reason)}")
            return resp.json()
        _die("Max retries exceeded (rate limited).")

    def get_current_user(self) -> dict:
        return self.request("/users/me")

    def get_workspaces(self) -> list:
        result = self.request("/workspaces", {"includeAll": "true"})
        return result.get("data", [])

    def get_workspace(self, workspace_id: str) -> dict:
        return self.request(f"/workspaces/{workspace_id}", {"includeAll": "true"})

    def get_sheet(self, sheet_id: str) -> dict:
        return self.request(f"/sheets/{sheet_id}", {"includeAll": "true"})


# ─── Sheet Analysis ───────────────────────────────────────────────────────────

# Column title patterns for semantic role detection (order matters — first match wins)
_COL_PATTERNS: dict[str, list[str]] = {
    "status":   ["status", "state", "stage"],
    "due_date": ["due date", "due", "finish date", "end date", "deadline", "target date", "target"],
    "assigned": ["assigned to", "assigned", "owner", "resource", "responsible"],
    "pct":      ["% complete", "percent complete", "% done", "progress"],
}

# Status bucket keyword sets (lower-case; substring match)
_COMPLETE_KW    = {"complete", "done", "closed", "finished", "100%", "100"}
_IN_PROGRESS_KW = {"in progress", "progress", "active", "started", "in flight", "working"}
_AT_RISK_KW     = {"at risk", "risk", "blocked", "delayed", "on hold", "hold", "issue"}


def detect_columns(columns: list) -> dict:
    """Return a mapping of semantic role → column ID for the given column list."""
    col_map: dict[str, int] = {}
    for col in columns:
        title_lower = col["title"].lower()
        if col.get("primary") and "primary" not in col_map:
            col_map["primary"] = col["id"]
        for role, patterns in _COL_PATTERNS.items():
            if role not in col_map and any(p in title_lower for p in patterns):
                col_map[role] = col["id"]
    return col_map


def get_cell_value(row: dict, col_id: Optional[int]) -> Optional[str]:
    """Return the display value (or stringified value) for a cell by column ID."""
    if col_id is None:
        return None
    for cell in row.get("cells", []):
        if cell.get("columnId") == col_id:
            dv = cell.get("displayValue")
            if dv is not None:
                return str(dv)
            v = cell.get("value")
            return str(v) if v is not None else None
    return None


def bucket_status(value: Optional[str]) -> str:
    """Categorize a status string into Complete / In Progress / At Risk / Not Started."""
    if not value or not value.strip():
        return "Not Started"
    v = value.lower().strip()
    if any(k in v for k in _COMPLETE_KW):
        return "Complete"
    if any(k in v for k in _AT_RISK_KW):
        return "At Risk"
    if any(k in v for k in _IN_PROGRESS_KW):
        return "In Progress"
    return "Not Started"


def parse_date(value: Optional[str]) -> Optional[date]:
    """Parse a Smartsheet date string (ISO 8601 or YYYY-MM-DD) to a date object."""
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value[: len(fmt)], fmt).date()
        except ValueError:
            continue
    return None


def resolve_sheet_ref(ref: str) -> str:
    """Accept a sheet ID (numeric string) or a Smartsheet URL; return the ID token."""
    if ref.startswith("http"):
        match = re.search(r"/sheets/([^?/]+)", ref)
        if match:
            return match.group(1)
        _die(f"Cannot parse a sheet ID from URL: {ref}")
    return ref


def is_milestone_row(row: dict) -> bool:
    """Top-level rows (no parentId) are treated as milestones/phases."""
    return row.get("parentId") is None


# ─── Formatting Helpers ───────────────────────────────────────────────────────

def progress_bar(done: int, total: int, width: int = 20) -> str:
    if total == 0:
        return "[" + "░" * width + "]"
    filled = round(width * done / total)
    return "[" + "█" * filled + "░" * (width - filled) + "]"


def render_table(rows: list, headers: list) -> str:
    if not rows:
        return ""
    all_rows = [headers] + [[str(c) for c in r] for r in rows]
    col_widths = [max(len(r[i]) for r in all_rows) for i in range(len(headers))]
    sep = "  ".join("-" * w for w in col_widths)

    def fmt(r: list) -> str:
        return "  ".join(str(r[i]).ljust(col_widths[i]) for i in range(len(headers)))

    lines = [fmt(headers), sep] + [fmt(r) for r in all_rows[1:]]
    return "\n".join(lines)


def overdue_flag(due: Optional[date], status_bucket: str) -> str:
    if due and due < date.today() and status_bucket != "Complete":
        return red("OVERDUE")
    return ""


def _die(msg: str) -> None:
    print(f"Error: {msg}", file=sys.stderr)
    sys.exit(1)


# ─── Commands ─────────────────────────────────────────────────────────────────

def cmd_whoami(client: SmartsheetClient) -> None:
    user = client.get_current_user()
    name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    print(bold("Current User"))
    print(f"  Name:      {name}")
    print(f"  Email:     {user.get('email', '')}")
    print(f"  Admin:     {user.get('admin', False)}")
    print(f"  Key from:  {client._key_source}")


def cmd_login() -> None:
    """Store the API token in the OS keychain (never written to disk as plaintext)."""
    try:
        import keyring  # type: ignore[import]
    except ImportError:
        _die(
            "The 'keyring' package is required for secure storage.\n"
            "Install it with:  pip install keyring\n"
            "Or for the full optional bundle:  pip install \"smar-cli[keyring]\""
        )
    token = getpass.getpass("Smartsheet API token (input hidden): ").strip()
    if not token:
        _die("No token entered — nothing saved.")
    import keyring as kr  # type: ignore[import]
    kr.set_password(_KEYRING_SERVICE, _KEYRING_USERNAME, token)
    print(green("Token saved to OS keychain."))
    print(dim("  macOS: Keychain Access  |  Windows: Credential Manager  |  Linux: Secret Service"))
    print(dim("  Run 'smar-cli whoami' to verify."))


def cmd_logout() -> None:
    """Remove the stored API token from the OS keychain."""
    try:
        import keyring  # type: ignore[import]
    except ImportError:
        _die("The 'keyring' package is not installed — nothing to remove.")
    import keyring as kr  # type: ignore[import]
    existing = kr.get_password(_KEYRING_SERVICE, _KEYRING_USERNAME)
    if not existing:
        print(dim("No token found in keychain — nothing to remove."))
        return
    kr.delete_password(_KEYRING_SERVICE, _KEYRING_USERNAME)
    print(green("Token removed from OS keychain."))


def cmd_projects(client: SmartsheetClient) -> None:
    workspaces = client.get_workspaces()
    if not workspaces:
        print("No workspaces found.")
        return
    print(bold(f"Projects  ({len(workspaces)} workspace(s))"))
    print()
    for ws in workspaces:
        ws_detail = client.get_workspace(str(ws["id"]))
        sheets = ws_detail.get("sheets", [])
        print(bold(f"  {ws['name']}") + dim(f"  [{ws['id']}]"))
        if not sheets:
            print(dim("    (no sheets)"))
        for s in sheets:
            print(f"    {s['name']}  " + dim(str(s["id"])))
        print()


def cmd_status(client: SmartsheetClient, sheet_ref: str) -> None:
    sheet = client.get_sheet(resolve_sheet_ref(sheet_ref))
    col_map = detect_columns(sheet.get("columns", []))
    rows = sheet.get("rows", [])
    today = date.today()

    buckets: dict[str, int] = {
        "Complete": 0, "In Progress": 0, "At Risk": 0, "Not Started": 0
    }
    overdue_count = 0
    pct_sum, pct_count = 0.0, 0

    for row in rows:
        status_val = get_cell_value(row, col_map.get("status"))
        bucket = bucket_status(status_val)
        buckets[bucket] += 1

        due = parse_date(get_cell_value(row, col_map.get("due_date")))
        if due and due < today and bucket != "Complete":
            overdue_count += 1

        pct_raw = get_cell_value(row, col_map.get("pct"))
        if pct_raw:
            try:
                pct_sum += float(pct_raw.rstrip("%"))
                pct_count += 1
            except ValueError:
                pass

    total = len(rows)
    complete = buckets["Complete"]
    pct_complete = (complete / total * 100) if total else 0.0
    modified = sheet.get("modifiedAt", "")[:10]

    print(bold(f"STATUS: {sheet['name']}"))
    print("═" * 56)
    print(f"  Total Rows:    {total}")
    print(
        f"  Complete:      {green(str(complete))}  ({pct_complete:.0f}%)  "
        f"{progress_bar(complete, total)}"
    )
    print(f"  In Progress:   {buckets['In Progress']}")
    if buckets["At Risk"]:
        print(f"  At Risk:       {yellow(str(buckets['At Risk']))}  ⚠")
    print(f"  Not Started:   {buckets['Not Started']}")
    if overdue_count:
        print(f"  Overdue:       {red(str(overdue_count))}  ●")
    if pct_count:
        print(f"  Avg % Done:    {pct_sum / pct_count:.0f}%")
    print()
    print(dim(f"  Sheet ID: {sheet['id']}  |  Modified: {modified}"))

    if not col_map.get("status"):
        print(
            dim(
                "\n  Note: No 'Status' column detected — counts reflect all rows as "
                "'Not Started'. Columns found: "
                + ", ".join(c["title"] for c in sheet.get("columns", []))
            )
        )


def cmd_assigned(client: SmartsheetClient, sheet_ref: str) -> None:
    sheet = client.get_sheet(resolve_sheet_ref(sheet_ref))
    col_map = detect_columns(sheet.get("columns", []))

    if not col_map.get("assigned"):
        print(f"No 'Assigned To' column detected in '{sheet['name']}'.")
        print(
            dim("Columns: " + ", ".join(c["title"] for c in sheet.get("columns", [])))
        )
        return

    user = client.get_current_user()
    my_email = user.get("email", "").lower()
    my_name = (
        f"{user.get('firstName', '')} {user.get('lastName', '')}".strip().lower()
    )

    matched = []
    for row in sheet.get("rows", []):
        assigned_val = (get_cell_value(row, col_map["assigned"]) or "").lower()
        if my_email not in assigned_val and (not my_name or my_name not in assigned_val):
            continue
        task = (
            get_cell_value(row, col_map.get("primary")) or f"Row {row['rowNumber']}"
        )
        status_val = get_cell_value(row, col_map.get("status"))
        bucket = bucket_status(status_val)
        due_val = get_cell_value(row, col_map.get("due_date"))
        due = parse_date(due_val)
        matched.append(
            [task[:50], status_val or "-", due_val[:10] if due_val else "-",
             overdue_flag(due, bucket)]
        )

    print(bold(f"ASSIGNED TO ME: {sheet['name']}"))
    print(f"  {user.get('email')}  —  {len(matched)} row(s)")
    print()
    if matched:
        print(render_table(matched, ["Task", "Status", "Due Date", ""]))
    else:
        print(dim("  No rows assigned to you."))


def cmd_overdue(client: SmartsheetClient, sheet_ref: str) -> None:
    sheet = client.get_sheet(resolve_sheet_ref(sheet_ref))
    col_map = detect_columns(sheet.get("columns", []))

    if not col_map.get("due_date"):
        print(f"No due-date column detected in '{sheet['name']}'.")
        print(
            dim("Columns: " + ", ".join(c["title"] for c in sheet.get("columns", [])))
        )
        return

    today = date.today()
    overdue = []
    for row in sheet.get("rows", []):
        due = parse_date(get_cell_value(row, col_map.get("due_date")))
        if not due or due >= today:
            continue
        status_val = get_cell_value(row, col_map.get("status"))
        if bucket_status(status_val) == "Complete":
            continue
        task = (
            get_cell_value(row, col_map.get("primary")) or f"Row {row['rowNumber']}"
        )
        assigned = get_cell_value(row, col_map.get("assigned")) or "-"
        days_over = (today - due).days
        overdue.append(
            [task[:50], assigned[:20], str(due), status_val or "-", f"+{days_over}d"]
        )

    print(bold(f"OVERDUE: {sheet['name']}"))
    print(f"  {red(str(len(overdue)))} overdue item(s) as of {today}")
    print()
    if overdue:
        print(render_table(overdue, ["Task", "Assigned To", "Due Date", "Status", "Days Over"]))
    else:
        print(green("  No overdue items. ✓"))


def cmd_upcoming(client: SmartsheetClient, sheet_ref: str, days: int) -> None:
    sheet = client.get_sheet(resolve_sheet_ref(sheet_ref))
    col_map = detect_columns(sheet.get("columns", []))

    if not col_map.get("due_date"):
        print(f"No due-date column detected in '{sheet['name']}'.")
        print(
            dim("Columns: " + ", ".join(c["title"] for c in sheet.get("columns", [])))
        )
        return

    today = date.today()
    cutoff = today + timedelta(days=days)
    upcoming = []
    for row in sheet.get("rows", []):
        due = parse_date(get_cell_value(row, col_map.get("due_date")))
        if not due or not (today <= due <= cutoff):
            continue
        status_val = get_cell_value(row, col_map.get("status"))
        if bucket_status(status_val) == "Complete":
            continue
        task = (
            get_cell_value(row, col_map.get("primary")) or f"Row {row['rowNumber']}"
        )
        assigned = get_cell_value(row, col_map.get("assigned")) or "-"
        upcoming.append([task[:50], assigned[:20], str(due), status_val or "-"])

    upcoming.sort(key=lambda r: r[2])

    print(bold(f"UPCOMING ({days} DAYS): {sheet['name']}"))
    print(f"  {today} → {cutoff}  —  {len(upcoming)} item(s)")
    print()
    if upcoming:
        print(render_table(upcoming, ["Task", "Assigned To", "Due Date", "Status"]))
    else:
        print(dim(f"  No incomplete items due in the next {days} days."))


def cmd_milestones(client: SmartsheetClient, sheet_ref: str) -> None:
    sheet = client.get_sheet(resolve_sheet_ref(sheet_ref))
    col_map = detect_columns(sheet.get("columns", []))
    milestones = [r for r in sheet.get("rows", []) if is_milestone_row(r)]

    rows_out = []
    for row in milestones:
        task = (
            get_cell_value(row, col_map.get("primary")) or f"Row {row['rowNumber']}"
        )
        status_val = get_cell_value(row, col_map.get("status"))
        bucket = bucket_status(status_val)
        due_val = get_cell_value(row, col_map.get("due_date"))
        due = parse_date(due_val)
        assigned = get_cell_value(row, col_map.get("assigned")) or "-"
        rows_out.append(
            [task[:55], assigned[:20], due_val[:10] if due_val else "-",
             status_val or "-", overdue_flag(due, bucket)]
        )

    print(bold(f"MILESTONES: {sheet['name']}"))
    print(f"  {len(milestones)} top-level row(s)")
    print()
    if rows_out:
        print(render_table(rows_out, ["Milestone", "Owner", "Due Date", "Status", ""]))
    else:
        print(dim("  No milestone rows found."))


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="smar-cli",
        description="Read-only Smartsheet project status CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
commands:
  login                     save API token to OS keychain (recommended — never stored as plaintext)
  logout                    remove API token from OS keychain
  whoami                    show current authenticated user and key source
  projects                  list workspaces and their sheets
  status    <sheetId|url>   project status summary (counts, % complete, overdue)
  assigned  <sheetId|url>   rows assigned to the current user
  overdue   <sheetId|url>   rows with past due dates and non-complete status
  upcoming  <sheetId|url>   rows due within N days  [--days N, default 14]
  milestones <sheetId|url>  top-level (parent) rows

api key resolution order:
  1. SMARTSHEET_API_KEY environment variable
  2. OS keychain  (set with: smar-cli login)

  The keychain option uses macOS Keychain, Windows Credential Manager, or Linux
  Secret Service — the token is never written to disk as plaintext.
  Install keyring support: pip install keyring  (or: pip install "smar-cli[keyring]")

  To get a token: Smartsheet > Account > Personal Settings > API Access

examples:
  smar-cli login
  smar-cli whoami
  smar-cli projects
  smar-cli status 1234567890123456
  smar-cli status "https://app.smartsheet.com/sheets/abc123..."
  smar-cli overdue 1234567890123456
  smar-cli upcoming 1234567890123456 --days 7
  smar-cli milestones 1234567890123456
""",
    )
    parser.add_argument("command", nargs="?", default="help", help="command to run")
    parser.add_argument("sheet_ref", nargs="?", help="sheet ID or Smartsheet URL")
    parser.add_argument(
        "--days", type=int, default=14, help="look-ahead window for 'upcoming' (default: 14)"
    )
    args = parser.parse_args()

    if args.command == "help":
        parser.print_help()
        return

    # login / logout don't need an authenticated client
    if args.command == "login":
        cmd_login()
        return

    if args.command == "logout":
        cmd_logout()
        return

    client = SmartsheetClient()

    if args.command == "whoami":
        cmd_whoami(client)

    elif args.command == "projects":
        cmd_projects(client)

    elif args.command == "status":
        if not args.sheet_ref:
            _die("'status' requires a sheet ID or URL.")
        cmd_status(client, args.sheet_ref)

    elif args.command == "assigned":
        if not args.sheet_ref:
            _die("'assigned' requires a sheet ID or URL.")
        cmd_assigned(client, args.sheet_ref)

    elif args.command == "overdue":
        if not args.sheet_ref:
            _die("'overdue' requires a sheet ID or URL.")
        cmd_overdue(client, args.sheet_ref)

    elif args.command == "upcoming":
        if not args.sheet_ref:
            _die("'upcoming' requires a sheet ID or URL.")
        cmd_upcoming(client, args.sheet_ref, args.days)

    elif args.command == "milestones":
        if not args.sheet_ref:
            _die("'milestones' requires a sheet ID or URL.")
        cmd_milestones(client, args.sheet_ref)

    else:
        _die(f"Unknown command '{args.command}'. Run 'smar-cli help' for usage.")


if __name__ == "__main__":
    main()
