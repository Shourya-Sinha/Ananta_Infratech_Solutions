# Ananta Infratech — Admin Web Design Notes

## Subject / audience / job
Internal enterprise software used daily by office-based admin/HR/finance
staff managing real construction sites and workers in Bihar. Not
public-facing, not a marketing surface — the job is dense, fast, trustworthy
data work: scan a table, approve a request, read a number correctly the
first time. Information density and legibility outrank "hero" moments here.

## Token system

**Color** (light-mode primary — long work sessions favor light over dark for
dense tabular data; avoids the AI-cliché dark+neon default):
- `--paper: #F3F5F7` — app background
- `--surface: #FFFFFF` — cards/panels
- `--graphite-900: #14181D` — primary text
- `--graphite-500: #5B6572` — secondary text
- `--steel-200: #D8DEE4` — borders/dividers
- `--signal-amber: #C97A1F` — primary accent (safety-vest amber; deliberately
  more yellow/muted than Claude's terracotta #D97757 to avoid the "AI tell")
- `--rebar-teal: #1F7A72` — positive/financial-growth indicator
- `--rust-600: #B84A3E` — negative/expense/overdue indicator

## Type
- Display/headings/nav labels: **Space Grotesk** — geometric, technical,
  reads like drafting-table lettering. Used with restraint (headings, KPI
  labels, nav only).
- Body/table copy: **Inter** — standard, highly legible at small sizes for
  dense tables and forms.
- Numeric/currency/IDs: **JetBrains Mono** — tabular figures align in
  columns; gives money and employee IDs a ledger/blueprint feel that ties
  back to the construction-accounting subject without being literal about it.

## Layout
Standard fixed left sidebar (nav per architecture §55) + top bar + card-grid
main content. For enterprise software, inventing a new navigation paradigm
would cost admins muscle memory for no benefit — the opportunity for a
distinct point of view here is in the token system and the signature
element below, not the IA.

## Signature element
A thin amber **ledger-rule** tick mark along the left edge of active nav
items and section headers — like the printed tick marks on a measuring
tape/blueprint ruler. Reinforces "precision + construction" without being a
literal hard-hat icon anywhere. One quiet, consistent detail rather than
scattered decoration.

## Restraint checklist
- No border-radius above 8px anywhere (structural, not bubbly-SaaS)
- No gradients
- Motion limited to: 150ms ease-out on hover/focus states, a single
  slide-in on modal/drawer open. Nothing ambient.
- Every interactive element has a visible focus ring (`--signal-amber` at 2px)
