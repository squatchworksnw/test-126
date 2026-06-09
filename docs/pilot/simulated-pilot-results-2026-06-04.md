# Simulated Pilot Results - 2026-06-04

Purpose: apply the SquatchWorks Pilot Validation Script before live human sessions.

This was a simulated observer pass, not a real user pilot. It validates that the app has paths and confirmations for the pilot tasks, identifies likely hesitation points, and marks what still requires real people, credentials, and live workspace data.

## Session Info

Tester name: Simulated QA

Role: Submitter / Field Worker / Reviewer-Admin

Device: Desktop code/browser inspection

Date: 2026-06-04

Observer: Codex

## Summary

The app appears ready for controlled human pilot testing after required Supabase migrations/configuration are run. The main product risk remains cognitive load in Upload, Assigned Work filters, and admin review/detail forms. The main deployment risk is that timeline persistence now requires the new SQL migration before structured history can be verified live.

## Task Results

| Task | Result | Confidence | Notes |
| --- | --- | --- | --- |
| Submit a Maintenance Request | Assisted pass | 4 | Guided intake exists and clear confirmation exists. Human pilot should verify whether users find "Submit New Request" without coaching. |
| Check Request Status | Assisted pass | 3 | "View My Submissions" exists. Needs real submitted data to verify whether status wording is clear to nontechnical users. |
| Upload a Photo | Assisted pass | 3 | Upload path exists with type/size validation and confirmation. Likely hesitation point: "What is this connected to?" choices. |
| Find Assigned Work | Assisted pass | 3 | Assigned Work/My Work exists with structured assignment support. Likely hesitation point: filters and "Attention/Updated/Scheduled" labels. |
| Complete a Task | Assisted pass | 4 | Complete action and confirmation exist. Vehicle update / proof upload next steps are present. Needs live write QA. |
| Find Vehicle Repair History | Assisted pass | 3 | Vehicle story/history exists and timeline support was added. Needs populated fleet data to verify discoverability. |
| Locate a Warranty | Assisted pass | 3 | Search and document linking exist. Human pilot should test terms: warranty, manual, title, registration, file, document. |
| Review and Approve a Request | Assisted pass | 4 | Needs Review -> detail -> approve work order path exists with assignment field and confirmation. Needs Owner/Admin live QA. |

## Observation Form

| Task | Screen | What tester did | What tester expected | What happened | Help asked? | Severity | Improvement idea |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Submit request | Field Portal / Submit | Expected a clear start point | "Submit New Request" is visible | Guided intake opens | No | P2 | Human-test whether "Maintenance Request" or "Submit New Request" is clearer. |
| Check status | Field Portal / Needs Review | Expected "my requests" | "View My Submissions" exists | Same underlying review screen is used | Unknown | P1 | Consider making status-only view calmer for Submitters. |
| Upload photo | Upload | Expected one simple upload path | User must choose file type and connection | Powerful but decision-heavy | Likely | P1 | Default to "Not sure" and make connection optional/obvious. |
| Assigned work | My Work | Expected list of own work | Work appears by assigned person | Several filters compete | Likely | P1 | Default to Today/Overdue; hide advanced filters until needed. |
| Complete task | Assigned Work / Work detail | Expected clear "done" action | Complete buttons and confirmation exist | Confirmation preserves history | No | P2 | Human-test whether proof upload feels optional or required. |
| Vehicle history | Fleet | Expected prior service story | Vehicle story panels exist | Labels include history/documents/timeline | Unknown | P1 | Human-test which label people choose first. |
| Warranty | Search / Upload / Fleet / Assets | Expected findable document | Search and linked documents exist | Terminology may vary | Likely | P1 | Add common synonym support if users search "manual," "warranty," "title." |
| Review approval | Needs Review | Expected approve path | Review detail has assignment and approve | Creates Work Order | No | P1 | Reduce visible fields after pilot if admin hesitates. |

## Confusing Screens To Watch In Human Pilot

- Upload Something: many equal choices can slow nontechnical users.
- Assigned Work: filters may look like extra tasks instead of sorting tools.
- Review Detail: many operational fields are useful but dense.
- Work Orders: create form has many linked-record fields.
- Fleet story: "History," "Documents," "Timeline," and "Service" may compete.

## Unclear Labels To Test

- Work vs Work Orders vs My Work.
- Assigned Work vs Scheduled Work.
- Upload vs Files vs Documents.
- Needs Review vs My Submissions.
- Warranty vs Manual vs Title / Registration.

## Places Users May Stop

- Deciding what an upload is connected to.
- Looking for request status after submission.
- Choosing whether Assigned Work filters matter.
- Understanding whether completion saved.
- Finding repair history under Fleet.

## Help Questions To Listen For

- "Where do I send this?"
- "Did it save?"
- "Where did the photo go?"
- "Is this mine?"
- "How do I know it is done?"
- "Where is the old repair?"
- "Is warranty under Upload, Files, or Vehicle?"

## Severity Findings

### P0

- None found in static/simulated pass.
- Live P0 risk: timeline persistence requires `sql/operational_memory_timeline.sql` before structured history can be verified.

### P1

- Upload connection choices may require help.
- Submitter status view may not feel separate enough from Needs Review.
- Assigned Work filters may slow field workers.
- Vehicle/document history labels need real user validation.
- Admin review form may feel dense.

### P2

- Some wording can be softened after observing real phrases users use.
- Role-specific one-page guides should be prepared before pilot.

## Manual Pilot Still Required

Run with real users and real workspace data:

- 2 submitters.
- 2 field workers.
- 1 reviewer/admin.
- 1 older or low-technical-confidence user if available.

Do not group-test; individual sessions are needed to observe hesitation.

## Pre-Pilot Deployment Gates

- Run `sql/operational_memory_timeline.sql`.
- Verify timeline table policies with Owner/Admin.
- Confirm password reset with a real email.
- Confirm Supabase Auth redirects.
- Confirm Supabase Storage file type and 10MB enforcement.
- Replace placeholder support contact.

## Recommendation

Status: ready for controlled human pilot after the migration/configuration gates above.

Do not start a new feature sprint before observing at least one real Submitter, one Field Worker, and one Reviewer/Admin.
