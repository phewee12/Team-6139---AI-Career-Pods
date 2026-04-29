**Audience:** This document is intended for developers and future maintainers
who need to implement the resume feedback visibility fix. End users do not
need to read this document.

## Plan: Resume Feedback Visibility + Formatting

Fix the requester feedback visibility bug by correcting selected-request precedence in the resume panel, then standardize feedback card formatting to show labeled fields and score out of 5 while removing redundant instructional text.

**Steps**
1. Confirm root cause and lock behavior expectations.
- Root cause: selected request currently prefers the list payload over detail payload, so requester/admin sees a list object with feedbackCount but no feedback array.
- Expected behavior: when a card is selected and detail fetch completes, the detail payload must be the source of truth for feedback rendering.

2. Phase 1: Data-source precedence fix (blocks UI formatting validation).
- Update selected-request resolution in frontend/src/components/ResumeReviewPanel.jsx to prefer activeRequest when activeRequest.id matches activeRequestId.
- Keep list payload only as fallback before detail is loaded.
- Ensure requester/admin branch receives detail feedback array and no longer shows false “No feedback yet” when feedbackCount > 0.

3. Phase 2: Remove unwanted helper copy (parallel with Phase 3).
- Delete the line: “Requester and pod admins can see the full feedback thread here.” from frontend/src/components/ResumeReviewPanel.jsx.

4. Phase 3: Feedback presentation formatting (depends on Phase 1 for requester/admin; can be implemented in same PR).
- In requester/admin feedback cards, render labeled rows:
: Score: X/5 (use overallScore, fallback “Not provided”).
: Strengths: <text>
: Weaknesses: <text> (map current improvements field to this label).
: Comments: <text> (map finalComments, fallback “None”).
- Apply the same labeled structure in “Your feedback” section for reviewers.
- Keep existing backend schema fields unchanged; this is display-level labeling only.

5. Phase 4: Optional styling polish for readability (depends on Phase 3).
- Add lightweight CSS in frontend/src/App.css for labeled feedback rows (spacing/weight), reusing reflection-card styles.
- Avoid broad style changes outside resume feedback blocks.

6. Phase 5: Verification (depends on all phases).
- Manual requester flow:
: Create request, submit reviewer feedback from a second user, reopen as requester, verify feedback details render immediately.
- Manual reviewer flow:
: Submit feedback, verify “Your feedback” section shows Score/Strengths/Weaknesses/Comments.
- Regression checks:
: feedbackCount badge still updates in list.
: “No feedback yet” appears only when no feedback exists.
- Run npm run build --workspace frontend.
- Run npm run test --workspace backend to confirm no backend regressions.

**Relevant files**
- frontend/src/components/ResumeReviewPanel.jsx — selected request precedence, helper text removal, labeled feedback rendering.
- frontend/src/App.css — optional formatting helpers for labeled feedback rows.
- backend/src/routes/podRoutes.js — no functional change required for this bug; detail route already includes feedback for requester/admin.

**Verification**
1. Run npm run build --workspace frontend.
2. Run npm run test --workspace backend.
3. Manual QA with two users in one pod:
- requester sees full feedback in detail panel
- reviewer sees their own feedback confirmation with labels
- list badge count matches detail content

**Decisions**
- Included: frontend data-flow + display fixes only.
- Excluded: backend schema/endpoint changes (current API already provides required data).
- Terminology: UI label “Weaknesses” maps to existing improvements field to avoid migration/API churn.
