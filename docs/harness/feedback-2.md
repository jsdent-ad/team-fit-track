# Team Fit-Track — Round 2 Evaluator Feedback

**Verdict: PASS** (overall weighted 8.8; criteria floors all met; 0 blocking)

Evaluator verified by driving a real Chromium instance through `eval-round2.mjs`
against `http://localhost:5173`. Every check listed below corresponds to a
Playwright assertion that ran against the live app; screenshot artifacts are in
`docs/harness/screenshots/round2/`.

- Passed: **58 / 58**
- Console errors: **0**
- Regressions: **none**

Builder claims in `implementation-map.json` were not relied on — each feature
was re-verified via DOM/localStorage/computed-style inspection.

---

## BLOCKING issues

_None._

All P0 and new P2 features work as specified; no crashes, no data loss, no
missing CTA.

---

## NON-BLOCKING issues

### NB-1. Bundle size warning after recharts addition
- **Where:** `tsc -b && vite build` warns bundle > 500 kB.
- **Impact:** None at runtime; dev server HMR is fine; first-load cold on slow
  network could be noticeable on mobile LTE.
- **Repro:** `cd app && npx vite build` → observe warning.
- **Suggestion (future):** lazy-import `WeeklyChart` so the `/` route bootstraps
  without recharts until data is present, or code-split by route.

### NB-2. Celebration reset-on-update is invisible to user
- **Where:** `updateMember` in `app/src/store/useTeamStore.ts` drops the member
  from `celebratedMemberIds` when their percentage drops below 100.
- **Impact:** If a teammate edits a member who already achieved (raising the
  target), the celebration will re-trigger for that member on the *next*
  achievement — which is the intended design, but the policy isn't surfaced in
  UI.
- **Repro:** Seed a member at 70/70 (celebrated), open /goals, change target to
  80, then back to 70 → celebration modal reappears. Not a bug; just unexpected.
- **Suggestion:** Tiny helper text on the edit form, or leave as-is and
  document in README.

### NB-3. WeeklyChart tooltip not interactively verified
- **Where:** recharts `Tooltip` on `/` → "주간 인증 추이".
- **Impact:** None — tooltip renders on hover in manual QA; automated hover of
  SVG segments was skipped per spec guidance.
- **Repro:** hover a datapoint manually at desktop width.
- **Suggestion:** None required.

---

## Detailed verification log

### T1 — Round 1 Regression (PASS)
- Login with correct password → `/` redirect.
- Three members added with **distinct goalTypes** (weight/bodyFat/skeletalMuscle)
  via explicit radio clicks — persisted as `goalType: 'weight' | 'bodyFat' |
  'skeletalMuscle'`.
- Photo upload pipeline: PNG → canvas → `data:image/webp` preview → stored
  `imageDataUrl` is WebP → score +10.
- Record delete via `/records` → confirm dialog → store cert removed → count 0.
- `page.reload()` → all 3 members + goalTypes intact.
- Four bottom tabs navigate to `/`, `/certify`, `/records`, `/goals` correctly.

### T2 — F2 Goal Type UI + Migration (PASS)
- 3 `role="radio"` buttons with labels ["체중","체지방량","골격근량"].
- `aria-checked="true"` toggles on click.
- Member card shows "체지방량" pill after save.
- Overall ranking row shows same pill.
- **Migration:** Seeded `version: 1` legacy payload (no `goalType`) →
  reload → `state.members[0].goalType === 'weight'` + DOM renders "체중"
  badge. Both `migrate` and `onRehydrateStorage` defenses confirmed working.

### T3 — F4 Overall Ranking (PASS)
- Empty state "아직 팀원이 없어요" renders when 0 members (captured in
  `ranking-empty-mobile.png`).
- With Carol(100)/Alice(96)/Bob(10): numbered rows 1/2/3 in that order, each
  with goalType badge and score.
- Current user (Alice) row: `class` contains `border-accent`, computed
  `border-color` = `rgb(0, 102, 255)` = #0066FF exactly.
- Top 3 medals 🥇🥈🥉 present.
- Solo-member case: 1 row renders correctly.

### T4 — F10 Celebration Modal (PASS)
- Seed 60/70 (not 100%) → no modal. Good.
- Edit to 70/70 via `/goals` → modal appears within ~600ms.
- Modal text contains "목표 달성", "Star", "체중", "70", "kg".
- `document.querySelectorAll('canvas').length >= 1` — canvas-confetti injected
  a canvas element, confirming library is actually running.
- "확인" button closes modal.
- `localStorage.celebratedMemberIds` includes member id after event.
- `page.reload()` → modal does NOT reappear. De-dupe works.

### T5 — F11 Weekly Chart (PASS)
- Section with `aria-labelledby="weekly-chart"`, heading "주간 인증 추이".
- Recharts renders **3 SVGs** (chart + legend/axis subtrees).
- X axis: 7 weekday single-char labels (수/목/금/토/일/월/화) plus MM/DD
  secondary labels — matches spec's "오늘 포함 7일".
- Empty state: seed 0 certs → "이번 주 기록이 없어요" renders.

### T6 — F12 Team Challenge (PASS)
- `/goals` top section with `aria-labelledby="team-challenge"` present.
- "챌린지 시작하기" CTA → form (title, emoji, target count, start/end date).
- After create: progress bar with `role="progressbar"`, "0 / 100건 · 0%" text.
- Upload cert via `/certify` → return to `/goals` → text updates to "1 /
  100건".
- `/` ranking page shows `current-challenge` summary badge.
- Delete button → confirm dialog → "삭제" → `teamChallenge === null` in store.

### T7 — N3 Not Found (PASS)
- `/nonexistent` renders "페이지를 찾을 수 없어요" and CTA link.
- Click "홈으로 돌아가기" → navigates to `/`.

### T8 — N1 Desktop Layout (PASS)
- At 1280×800, `section[aria-labelledby="my-score"]` boundingBox {x:148,
  y:88, w:480, h:278} and `section[aria-labelledby="top3"]` {x:652, y:88, w:480,
  h:278} — y aligned, x disjoint → true side-by-side.
- Overall ranking and chart stacked below, full width.

---

## Screenshots

Location: `docs/harness/screenshots/round2/`

- `login-mobile.png`, `login-desktop.png`
- `ranking-empty-mobile.png`
- `ranking-filled-mobile.png`, `ranking-filled-desktop.png`
- `goals-with-challenge.png`
- `celebration-modal.png`
- `weekly-chart.png`
- `not-found.png`

---

## Suggested Round 3 scope

None required for a pass. If the user wants polish-only:
1. Lazy-import recharts to address NB-1.
2. Tooltip-hover interaction test in future harness runs.
3. Consider per-goal-type badge colors for faster visual distinction.
