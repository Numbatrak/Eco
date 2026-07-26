# Numbatrak Audit Prompt

Paste the block below into **Cursor Agent mode** with the repo open and indexed.
Run it once to get a ground-truth inventory, then run the Phase 2 follow-ups as needed.

---

## Master audit prompt

You are auditing an inherited codebase (Numbatrak / Mall9ja). Do **not** assume or infer
that a feature exists from naming alone — read the actual files and cite them (file path +
symbol/line). If something does not exist, write **NOT FOUND** explicitly.

Produce a single Markdown report with these sections:

### 1. Route map
List every route from the React Router configuration. For each: the path, the component
file it renders, and whether it is a real screen or a placeholder/TBD stub.

### 2. Roles & permissions
Locate the RBAC / permission definition. Output a table of resource × role ×
{view, create, update, delete}, quoting the source file. Then answer directly:
**is there an explicit "Agent" role, or is an agent only a foreign-key assignment on
orders/customers?** Show the schema, type, or enum that proves it.

### 3. Organization scoping
Show how the "current organization" is resolved and persisted, and how it is applied to
queries. Pick 3 data-fetching functions and quote the lines that scope them to the org.
Flag any query you find that is NOT org-scoped.

### 4. Feature ground-truth
For each item, answer **EXISTS / PARTIAL / NOT FOUND** with file evidence:
- Agent clock-in / attendance
- IP address capture or logging
- Email notifications / transactional email (and any provider integration)
- SMS integration
- PDF export
- Excel / .xlsx export (SheetJS usage)
- Agent-specific dashboard view
- Agent performance metric (completed ÷ assigned success rate)
- Assign an order to a specific agent (a real UI flow, not just a DB column)
- Remittance module (real vs placeholder)
- Automation logs (real vs placeholder)

### 5. Backend inventory
- List the Supabase Edge Functions (folder names) with a one-line purpose each.
- List the database tables referenced by the client (infer from queries) and note any
  that clearly lack a corresponding UI.
- Confirm whether **Firebase** is actually called anywhere (imports + real usage), or only
  present in package.json. Quote the evidence.

### 6. Dependencies
From package.json, list the notable libraries and what each is used for in THIS repo
(confirm by finding an import). Flag any installed-but-unused.

End with **"Open questions for the client"** — anything the code alone cannot answer.
Output only what you can verify from the code.

---

## Phase 2 follow-ups (run after the master prompt)

**RLS / security audit:**
> For every table that has a corresponding RLS migration, summarize the select/insert/update/delete
> policy and state which role(s) each allows. Flag any table that is queried by the client but has
> NO RLS policy, and any policy that does not scope to organization. List these as security risks.

**Clock-in build readiness:**
> I need to add an agent daily clock-in with server-side timestamp and IP capture. Show me where
> agent sessions/auth are handled, where IP could be captured (client can't read it reliably — find
> the Edge Function or request context that can), and propose the table schema + RLS so agents see
> only their own records and Owner/Admin/Manager see all. Do not write the migration yet — propose first.

**Email alert wiring:**
> Show me the exact point in the code where an order is assigned to an agent. I want to trigger a
> transactional email there. Identify whether to do it via a Postgres trigger + Edge Function or a
> direct call in the assignment handler, and which is more consistent with the existing patterns.

**Export readiness:**
> Find every place reports/summaries are generated. SheetJS is already a dependency — show where it's
> used (if at all) and what an .xlsx export of the summary view would hook into. Separately, identify
> the cleanest place to add PDF export and whether it should be client-side (jsPDF) or an Edge Function.
