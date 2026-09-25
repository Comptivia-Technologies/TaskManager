# UI upgrade brief

Context for whoever redesigns this frontend. Read this before changing screens — it
records what the design system already provides, what the screens actually do, and
which behaviour must survive a visual overhaul.

App: `frontend/workflow` — React 18 + TypeScript + Tailwind + CRA.

---

## 1. There is already a design system. Nothing uses it.

`tailwind.config.js` defines a full Azure-inspired theme, and `src/index.css` defines
button classes. Adoption across the components:

| Token | Defined | Used in components |
|---|---|---|
| `primary` colour scale (`#434E78`, 50–900, `dark`, `light`) | ✅ | **0 times** |
| `text` colour scale (`DEFAULT`, `dark`, `light`, `muted`) | ✅ | **0 times** |
| `.btn-primary` / `.btn-secondary` | ✅ | **0 times** |
| `shadow-azure-{sm,md,lg,xl}` | ✅ | 133 times |
| `rounded-azure` / `rounded-azure-sm` | ✅ | widely |

Instead, **`#434E78` is hard-coded 588 times** as `bg-[#434E78]`, `text-[#434E78]`,
`border-[#434E78]/30`, `focus:ring-[#434E78]` and so on. The primary button is
hand-written **45 times** as `bg-[#434E78] text-white px-4 py-2 rounded-azure-sm …`.

**This is the single highest-value change available.** Replacing the literal with the
`primary` token is mechanical, and it is what makes a later palette change a one-line
edit instead of a 588-occurrence search. Do this before any restyling.

### Existing tokens worth keeping

- **Font:** Segoe UI stack. Base 14px/20px, `h1` 32/40, `h2` 24/32, `h3` 20/28, all 600 weight, `-0.01em` tracking.
- **Radius:** 2px (`rounded-azure`) and 4px (`rounded-azure-sm`). Deliberately square — this is a Fluent/Azure look, not a rounded-card look.
- **Shadows:** four Azure elevation levels, already used consistently.
- **Motion:** a global 150ms `cubic-bezier(0.4, 0, 0.2, 1)` transition on `*`, plus `fade-in` / `slide-in` keyframes. The global transition on `*` is heavy-handed and worth narrowing.
- **Focus:** 2px `#434E78` outline with 2px offset on `:focus-visible`. Keep this — it's the only accessibility affordance in the app.

---

## 2. Shared pieces that already exist

Use these rather than writing new copies. They were extracted in a cleanup pass and
are currently the only shared UI primitives.

| Module | What it gives you |
|---|---|
| `utils/formStyles.ts` | `inputClass`, `readOnlyInputClass` — the canonical field styling |
| `components/Modal.tsx` | Dialog shell with title + close. Used by `TeamMemberModal`; **`Members`, `Teams` and `WorkloadConfiguration` still hand-roll their own** and should adopt it |
| `components/LoadingSpinner.tsx` | Used in 14 places |
| `components/StageForm.tsx` | Renders a stage's form from a JSON schema — text, textarea, select, checkbox, date, `assignee`, `table` |
| `components/StageValues.tsx` | Read-only rendering of submitted stage data, including tables |
| `utils/apiError.ts` | `apiErrorMessage(error, fallback)` |

**Still missing and worth creating during the redesign:** a `Button`, a `Table`, an
`EmptyState`, a `PageHeader` and a `Badge`. Each is currently written out per screen.

---

## 3. Screen inventory

14 routes, no lazy loading (every route is in the initial bundle).

### The screens that matter — the actual product

| Route | File | Lines | State |
|---|---|---|---|
| `/enquiry` | `pages/MyEnquiries.tsx` | 504 | **Newest, most important.** Tab-per-stage UI. Never click-tested. |
| `/tasks/:id` | `pages/TaskDetail.tsx` | 625 | **Newest.** Stage form, attachments, history, send-back. Never click-tested. |
| `/` | `pages/Dashboard.tsx` | 234 | Older, light |
| `/login` | `pages/Login.tsx` | 319 | Older |

### Configuration screens — used by admins, not daily

`Teams` (739), `PriorityRules` (602), `Members` (575), `Users` (539),
`RolesPermissions` (445), `MemberDetail` (422), `WorkloadConfiguration` (384),
`Workflows` (262), `SLAConfiguration` (243), `WorkflowDetail` (175).

These are older and visually less consistent than the two enquiry screens. They are
also where most of the 588 hard-coded colours live.

### The wizard

`components/WorkflowWizard.tsx` (1,111 lines) is a 6-step workflow builder. Step 4 has
been extracted to `components/workflowWizard/WorkflowStagesStep.tsx`; **steps 1, 2, 3, 5
and 6 are still inline** in a `renderStepContent()` switch. Extract them the same way
before restyling them.

---

## 4. Behaviour a redesign must not break

These are business rules expressed in the UI. Changing the visuals is fine; changing
these is not.

**The Enquiry screen is team-gated, not permission-gated.** A member sees one tab per
stage **their team owns**, derived client-side from the workflows call. Someone on no
team sees an explicit empty state, not a blank list.

- The **first-stage tab** is the creator's own register: it carries *New Enquiry* and
  lists what that person raised, at any stage, with **no stage column**.
- **Queue tabs** list only enquiries at that stage **assigned to the viewer**, with a
  count badge.
- **"All enquiries"** appears only for the **Management** and **Senior Management**
  teams (`utils/roleUtils.ts` → `isOversightTeam`). Not a permission check.

**Everything outside Enquiry is permission-gated** via `hasPermission(permissions, code)`.
`permissions === null` means "unresolved" and grants access — that is deliberate, so an
unconfigured login isn't locked out of the screens needed to configure it. Don't
"simplify" it to a falsy check.

**Rework must stay visible in lists.** `needsRework` + `reworkReason` on a row. A
returned enquiry has to be distinguishable at a glance.

**Some stages show no assignee picker.** `utils/stageRouting.ts` decides this; the
backend independently reaches the same answer. If routing is already decided, the UI
explains it in a sentence instead of offering a choice. Do not "restore" the dropdown.

**Stage forms are data, not markup.** `utils/stageFormRegistry.ts` maps a **stage name**
to a schema. A typo means a silent fallback to a generic notes form. If you rename
anything user-visible, check that registry.

---

## 5. Known UI problems

- **No responsive design.** Fixed `p-8`, `grid-cols-2`, wide tables. Untested below desktop width.
- **No empty/error/loading consistency.** Each screen invents its own.
- **Tables are bespoke per screen** — no shared sorting, filtering or pagination.
- **`MyEnquiries` fetches 200 rows and filters client-side.** Breaks silently past 200.
- **No accessibility work** beyond the focus outline: few `aria-label`s, no landmarks, no keyboard handling in modals (no focus trap, no Escape).
- **Icons** are `react-icons/fi` (Feather) throughout — consistent, worth keeping.
- **`react-select`** is used on 2 screens and looks different from every other dropdown. Either adopt it everywhere or drop it.

---

## 6. Suggested order

1. **Tokenise.** Replace the 588 `#434E78` literals with `primary`. Mechanical, no visual change, unlocks everything else.
2. **Build the missing primitives** — `Button`, `Table`, `EmptyState`, `PageHeader`, `Badge` — and adopt `Modal` in the three screens still hand-rolling it.
3. **Redesign the two enquiry screens first.** They're the product; the config screens are scaffolding.
4. **Extract the wizard's remaining five steps**, then restyle them.
5. **Responsive and accessibility** passes last, across the new primitives rather than per screen.

## 7. Verification

`npx tsc --noEmit` and `npx react-scripts test --watchAll=false` — currently **51 suites /
248 tests green**. Several tests query by visible text and label, so renaming a label
or button will fail a test; that's the suite doing its job, not a flake.
