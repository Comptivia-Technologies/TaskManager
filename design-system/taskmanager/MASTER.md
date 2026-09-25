# TaskManager — Design System (MASTER)

Global source of truth for the `frontend/workflow` UI. Page-specific overrides live in
`design-system/taskmanager/pages/<page>.md` and win over this file.

**Stack:** React 18 + CRA + Tailwind **3.4** + `react-icons/fi` + framer-motion (`m`, LazyMotion strict).
**Product:** internal B2B workflow tool — an enquiry moves through ~11 stages owned by ~7 teams
(receive → site visit → BOQ → approvals → quotation issued). Dense, read all day, mostly on Windows desktops.

Tags: **[verified]** matched the UI/UX Pro Max database · **[override]** database result rejected for a
stated reason · **[measured]** computed from this codebase.

---

## 1. Identity — process is the visual metaphor

The product's job is to show *where work is, who has it, and what happens next*. So the recurring
visual element is the **stage flow**, used at four zoom levels:

| Where | Component | Shows |
|---|---|---|
| Queue rows | `flow/StageProgress` | one segment per stage, filled to the current one, `4/11` beside it |
| Enquiry page | `flow/StageRail` | every stage in order: done ✓ / now (navy, halo) / next (hollow), team + person under each |
| Workflow page | `flow/WorkflowMap` | swimlanes — one lane per team, one column per stage, a connector per hand-off |
| Workflow list | `flow/FlowStrip` | the workflow's fingerprint: a dot per stage coloured by team |

The loader (`FlowLoader` in `LoadingSpinner.tsx`) is the same motif: five nodes on a rail with a pulse
travelling along it. The brand mark (`BrandMark`) is three nodes with a hand-off between lanes.

**Style:** Minimalism & Swiss **[verified]** ("enterprise apps, dashboards, professional tools"), with the
**Document Pipeline** palette focus **[verified]** — "trust navy + signature green + pending amber + neutral grey".
Rejected: the generic ops result (dark OLED terminal) **[override]** — this is a daytime office tool.

## 2. Colour (tokens in `tailwind.config.js`; JS copies in `utils/theme.ts`)

- **Brand** `primary` `#434E78` (8.08:1 on white). Used for the primary action, current stage, focus.
- **Shell** `shell` `#161A2E` — the navigation. Deep ink so the brand navy reads as an accent in content.
- **Canvas** `#F4F5F8` page plane; **surface** white cards; `surface-muted` headers; `surface-sunken` tracks.
- **Ink** `#11152A` / muted `#474F6B` / subtle `#646B89` (5.2:1 white, 4.8:1 canvas). Nothing lighter carries text.
- **Status** (reserved, always with icon or label): success `#067647` = stage done · warning `#B54708` = sent back /
  due soon · danger `#C9372C` = overdue · info `#1D4ED8`.
- **Team identity** `TEAM_PALETTE` — dataviz reference categorical order, validated with its CVD checker
  (worst adjacent ΔE 9.1). Assigned in order of each team's first stage via `teamColors()`, never cycled; a 9th
  team is grey. Only ever a 3px bar or a dot — **the team name is always printed beside it**.

No raw hex in components except SVG/art that cannot take a class.

## 3. Typography

**IBM Plex Sans / IBM Plex Mono** via Google Fonts, `display=swap`, Segoe UI fallback.
**[verified]** Plex from the "Developer Mono" pairing; **[override]** Plex Mono instead of JetBrains Mono to keep
one family. The earlier "stay on Segoe" decision was reversed: the type change is the largest single lever on
identity, and swap means it never blocks text.

| Token | Size / line | Use |
|---|---|---|
| `text-display` | 28/34 | sign-in heading |
| `text-heading` | 22/28, −0.015em | page title (`PageHeader`) |
| `text-title` | 16/24 | section and dialog titles |
| `text-body` | 14/20 | everything read |
| `text-meta` | 12/16 | metadata, helper text |
| `.eyebrow` | 11/16 caps, +0.06em | table headers, group labels |

Mono (`font-mono tabular`) for values scanned vertically: stage numbers, quantities, rates, scores, IDs.

## 4. Shape, depth, spacing

- **Radius:** `rounded-control` 6px (inputs, buttons) · `rounded-card` 10px · `rounded-dialog` 14px · pills full.
- **Elevation:** cards are border + `shadow-azure-sm` (barely lifted); menus `azure-lg`; dialogs `azure-xl`.
- **Controls:** 40px default (`h-10`), 32px `sm` in toolbars and rows. Focus: 2px brand outline, or a 3px
  `shadow-focus` ring on fields.
- **Page:** `max-w-page` 1360px, 24–40px gutters; set once in `AppLayout`, not per page.

## 5. Components — use these, don't re-roll

`Button` / `IconButton` (label required) · `Badge` (dot variant) · `PageHeader` (breadcrumbs, badges, meta, actions) ·
`Section` · `Field` (label → control → help/error) · `SearchInput` · `DataTable` (toolbar slot, `rowTone` edge stripe,
`mobileCard` layout below `md`) · `Tabs` (counts, icons) · `Modal` (`footer`, `icon`, sizes sm–xl) · `ConfirmDialog` ·
`EmptyState` · `FlowLoader` · `Avatar` · `SkillMeter` · `WizardStepper` · the four `flow/*` visuals.

Every destructive action goes through `ConfirmDialog`. Every icon-only action is an `IconButton`.

## 6. Motion — subtle

150ms state, 200ms panels, 250ms dialogs in / 150ms out. Allowed loops: the loader pulse and the current
stage's halo (both say "live"). Map connectors draw in once. All of it sits under the global
`prefers-reduced-motion` block.

## 7. Copy rules

- Say what the system does, verified against the backend. Examples checked in code: a workflow with **no**
  SLA configuration never assigns its enquiries; a priority left at 0 minutes is due immediately; inactive
  priority rules are not evaluated; an unresolvable role falls back to full access (so don't promise that
  deleting a role removes access).
- Dates are relative where it helps ("Due in 3 days", "4h ago") with the absolute value beside or in a tooltip.
- Status enums are humanised (`InProgress` → "In progress") via `utils/status.ts`.

## 8. Verification

`npx tsc --noEmit` · `npx react-scripts test --watchAll=false` (55 suites) · `npx eslint "src/**/*.tsx"`.
Several tests query by visible text or label; a renamed label failing a test is the suite working.
