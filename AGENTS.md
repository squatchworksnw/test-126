# Facilities Command Center V3 — Agent Instructions

This repository contains the Facilities Command Center V3 prototype.

The app is a calm, capable operations workspace for facilities management in nonprofit, arts, community, camp, church, school, and low-resource operational environments.

The purpose of the app is to reduce operational chaos by connecting facilities, maintenance, projects, vendors, fleet, files, requests, approvals, and institutional history into one coherent system.

Do not treat this as generic maintenance software.

The product philosophy is:

> I can handle this.

The interface and workflows should reduce overwhelm, preserve clarity, and protect operational history.

---

## Product Identity

The visual and behavioral direction is **Atomic Civic Modernism**.

The app should feel like:

- a calm civic operations desk
- a warm archival workspace
- an organized institutional command center
- a trustworthy operational system

The app should NOT feel like:

- cold enterprise maintenance software
- a loud task manager
- a panic dashboard
- a dense spreadsheet replacement
- retro kitsch
- Fallout-style nostalgia

The goal is:

> Calm institutional competence.

Visual inspiration may include:

- NASA-era operational graphics
- mid-century transit systems
- civic architecture
- library systems
- municipal planning materials
- archival engineering offices
- institutional editorial layouts

---

## Design Rules

Use a calm, warm, spacious visual system.

Preferred palette direction:

- deep navy
- petroleum blue
- dusty teal
- muted sage
- eucalyptus green
- warm cream
- soft brass / muted gold
- charcoal text
- muted rust for urgency only

Avoid:

- harsh white as the dominant background
- neon colors
- bright red everywhere
- dense table-first layouts
- excessive alerts
- cluttered dashboards

UI should prioritize:

- large workspace cards
- clear hierarchy
- focused detail views
- contained urgency
- subtle motion
- readable spacing
- mobile-friendly interactions

Motion should be subtle, smooth, and architectural. Avoid bouncy, gamified, or flashy effects.

---

## Operational Architecture

The app uses a layered operational model:

1. **Intake Layer** — incoming requests, photos, staff reports, volunteer submissions, unusual incidents.
2. **Review Layer** — Tier 1 leadership reviews submissions before they become operational work.
3. **Operations Layer** — approved records become work items, maintenance tasks, projects, fleet issues, or vendor actions.
4. **Historical Memory Layer** — completed work, files, vendors, costs, notes, and recurring issues remain connected for institutional memory.

Do not bypass the Review Queue for staff/volunteer submissions.

Submissions should not automatically become live work orders unless explicitly approved or converted by Tier 1 users.

---

## Three-Tier Access Model

### Tier 1 — Leadership / Operations Admin

Includes:

- Executive Director
- Facilities Manager

Tier 1 has full operational visibility.

Tier 1 can:

- review submissions
- approve work
- manage projects
- manage vendors and bids
- oversee budgets
- access reports
- preserve operational history
- convert submissions into operational records

### Tier 2 — Internal Staff

Tier 2 users may:

- view assigned work
- update assigned tasks
- upload notes/photos/files
- submit concerns
- participate in limited workflows

Tier 2 should not have unrestricted access to budgets, vendor comparisons, board reports, unrelated projects, or archived operational history.

### Tier 3 — Submission / Intake Users

Tier 3 users are request submitters.

Examples:

- volunteers
- office staff
- event leads
- program coordinators
- community users

Tier 3 should not browse the operational system.

Tier 3 should only have a guided, friendly request-submission experience with optional file/photo upload and limited status visibility when appropriate.

---

## Primary User

Optimize first for the **Facilities Manager**.

The Facilities Manager needs to:

- review intake requests
- manage daily operational rhythm
- track maintenance
- oversee projects
- coordinate vendors
- manage fleet items
- connect files to work
- preserve history
- prepare reports for leadership or the board

All other roles are secondary.

---

## Core Workspaces

Primary app workspaces:

1. Home
2. Review Queue
3. Projects
4. Maintenance
5. Fleet
6. Vendors & Bids
7. Files
8. Calendar
9. Reports
10. Settings

Navigation should feel workspace-based, not like a pile of tiny links.

Each workspace should feel like a calm operational desk.

---

## Home Workspace

Home is a daily rhythm space.

It should answer:

> What deserves my attention today?

Home should include:

- daily rhythm summary
- workspace cards
- contained alerts
- pending approvals
- upcoming deadlines
- operational health indicators

Avoid making Home a panic wall.

Example tone:

```text
Good morning, Bee.

2 approvals waiting.
Kitchen walkthrough due today.
No urgent facility failures.
Fleet registration due Friday.
```

---

## Review Queue

The Review Queue is a protected intake and triage space.

Submissions may include:

- maintenance concerns
- safety issues
- event setup requests
- vehicle concerns
- office requests
- uploaded files
- unusual incidents

Submission records should include:

- submitter
- type/category
- urgency
- location
- notes/description
- files/photos
- date submitted
- source
- status

Review actions should include:

- approve as Work Item
- convert to Project
- assign to Maintenance
- assign to Fleet
- attach to Vendor/Bid
- request more information
- merge duplicate
- archive/reject
- mark urgent

Urgent items should be visible but contained.

---

## Staff Submission Portal

The staff/volunteer portal should be separate from the main admin workspace.

It should feel guided, friendly, and unintimidating.

Opening prompt:

```text
What do you need help with?
```

Guided options:

- Building
- Kitchen / Equipment
- Vehicle
- Cleaning
- Safety
- Event Setup
- Vendor / Delivery
- Something unusual happened

The “Something unusual happened” option is required because facilities work is unpredictable.

Submission confirmation should feel human:

```text
Saved — we’ll take a look at it.
```

Avoid sterile language like:

```text
Ticket submitted successfully.
```

---

## Core Records

### Work Item

Primary operational record.

Fields may include:

- id
- title
- type
- status
- priority
- location
- due date
- assigned person
- submitted by
- source
- related project id
- related vehicle id
- related vendor id
- related file ids
- notes
- history
- created at
- updated at

### Project

Fields may include:

- id
- title
- status
- priority
- location
- target date
- estimated cost
- approved budget
- summary
- notes
- related work item ids
- related bid ids
- related file ids
- created at
- updated at

### Vendor / Bid

Fields may include:

- id
- vendor name
- related project id
- amount
- status
- date received
- scope summary
- recommendation notes
- file ids
- created at
- updated at

### Vehicle

Fields may include:

- id
- name
- plate/id
- mileage
- status
- next service date
- registration due date
- notes
- related work item ids
- file ids
- created at
- updated at

### File Record

Fields may include:

- id
- file name
- file type
- storage path/url
- extracted preview text
- related record ids
- notes
- created at
- updated at

### Submission

Fields may include:

- id
- submitter name
- submitter contact
- category
- urgency
- location
- description
- file ids
- status
- reviewed by
- converted record id
- created at
- updated at

---

## UI Behavior Rules

### Cards

Cards are the primary UI language.

Cards should be:

- readable
- spacious
- touch-friendly
- grouped by operational meaning
- calm and structured

Cards should not become mini spreadsheets.

Click/tap should open a focused detail view.

Hover should be subtle on desktop only.

### Detail Views

Detail views are focused operational workspaces, not giant edit forms.

Detail views should show:

Top:

- title
- status
- priority
- due date
- assigned person
- quick actions

Middle:

- related files
- related project
- related vendor
- related work items
- calendar dates

Bottom:

- notes
- activity
- history
- timeline

### Editing

Editing should feel deliberate and trustworthy.

Prefer editing inside detail views or focused forms.

Avoid inline editing everywhere.

Avoid destructive actions without confirmation.

### Save / Sync Feedback

The user should always understand whether work is:

- saved locally
- syncing
- synced
- failed and retrying

Use calm messages such as:

```text
Saved locally — syncing…
```

Avoid loud or gamified messages.

---

## Sync and Offline Philosophy

The app should feel trustworthy during unstable internet conditions.

Core principles:

- local-first interaction
- visible sync status
- no silent data loss
- queued retry behavior
- recoverable failed uploads
- preserve local work until confirmed synced

Operational users should never wonder whether important information disappeared.

---

## Calendar Rule

Calendar is a view of dated operational records.

Calendar should display dates from:

- Work Items
- Projects
- Maintenance
- Fleet
- Vendors & Bids
- Reports

Do not create a disconnected calendar-only data pile unless explicitly required.

---

## Files Rule

Files support work.

Files should attach to:

- Work Items
- Projects
- Vendors/Bids
- Fleet Vehicles
- Reports

Files should not become the workflow themselves.

File imports should go through review before becoming live records.

---

## Notifications

Notification philosophy:

> Mostly quiet. Actionable when necessary.

Passive notifications:

- new submissions
- upcoming deadlines
- reminders
- file uploads

Interactive urgent alerts only for major issues such as:

- freezer failure
- water leak
- safety hazard
- blocked access
- urgent equipment failure
- vehicle breakdown

Urgent alerts should include clear actions:

- Review
- Assign
- Call Vendor
- Mark In Progress
- Add Note

---

## MVP Scope

Build/stabilize these V3 systems first:

- Home workspace
- Review Queue
- Work Items
- Projects
- Maintenance
- Fleet
- Vendors & Bids
- Files
- Calendar views
- Reports
- Guided submission portal

Do NOT prioritize early:

- advanced AI analysis
- predictive forecasting
- public portals
- advanced analytics
- deep accounting integrations
- facility mapping systems
- inventory commerce systems
- automation-heavy workflows
- overly complex auth/permissions

The focus is:

- operational clarity
- workflow stability
- connected records
- trustworthy history
- calm UX

---

## Recommended File Structure

Current target structure:

```text
index.html
portal.html
styles.css
app.js
supabase.js
import.js
reports.js
calendar.js
```

Use existing project structure where applicable. Do not restructure the repo unnecessarily unless requested.

---

## Build Phases

### Phase 1 — App Shell

- visual system
- navigation
- workspace cards
- responsive layout
- Supabase connection
- shared data load/save

### Phase 2 — Core Records

- work items
- projects
- maintenance
- fleet
- vendors/bids
- files
- calendar views

### Phase 3 — Review Queue

- submissions table
- intake workflow
- approve/edit/archive
- urgent alerts
- operational conversion

### Phase 4 — Staff Portal

- guided submissions
- lightweight UX
- file uploads
- Review Queue integration

### Phase 5 — Files & Imports

- file library
- PDF preview/extraction
- spreadsheet preview
- import review flow

### Phase 6 — Reports

- board summaries
- bid comparison packets
- maintenance reporting
- fleet reporting
- needs reports

### Phase 7 — Roles & Auth

Add later, after workflows stabilize:

- admin
- staff
- viewer
- operational permissions

Do not overbuild auth before operational workflows stabilize.

---

## Development Guardrails

When modifying the app:

1. Preserve existing working functionality unless explicitly replacing it.
2. Avoid large rewrites when a targeted patch is safer.
3. Keep UI calm, readable, and mobile-friendly.
4. Do not introduce heavy frameworks unless requested.
5. Keep data relationships visible and preserved.
6. Do not bypass the Review Queue for submissions/imports.
7. Maintain local-first and sync-confidence patterns.
8. Avoid table-first UX unless the table is genuinely the clearest view.
9. Prefer focused detail views over giant modals or editable tables.
10. Keep code understandable for a non-engineer project owner working with AI assistance.

---

## Testing Expectations

After changes, verify:

- desktop layout still works
- mobile layout is usable
- navigation still works
- existing records still load
- new records can be created
- files/submissions do not bypass review unintentionally
- sync status is visible where relevant
- no console errors are introduced
- no existing app state is silently wiped

When reporting back, explain:

- what changed
- what files changed
- what was tested
- what still needs attention
- whether any manual Supabase/table/policy step is required

---

## Current Decision Log

- Home focuses on operational rhythm, not panic.
- Navigation should feel workspace-based.
- Review Queue protects operational quality.
- Staff/volunteer submissions are intake records first.
- Calendar is a view of dated operational records.
- Files support operational work rather than becoming the workflow.
- Staff portal should feel guided and friendly.
- Urgent alerts should remain contained and actionable.
- Editing should primarily happen inside focused detail views.
- The app should preserve institutional operational memory.
- The interface should embody Atomic Civic Modernism.
- Operational reassurance matters more than operational intensity.
- Local-first behavior and sync confidence are foundational.
- Operational clarity is more important than automation complexity.
