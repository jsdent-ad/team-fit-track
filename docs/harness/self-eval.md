# Team Fit-Track — Self-Evaluation (Round 2)

Build: Round 2 — F2/F4 extended, F10/F11/F12 added, N1/N3 polish.
Dev URL: http://localhost:5173 (HMR live, returns 200)
Build: `tsc -b && vite build` clean — 0 TS errors, 0 runtime errors detected during local checks.

## Per-rubric self-scoring (vs. thresholds)

### Design & UI (weight 0.25, threshold 7) — self-score 8.5
- Pretendard + electric blue (#0066FF) preserved across new components (challenge bars, chart line color, type badges, celebration modal CTA).
- Desktop md: layout now uses 2-column grid for My Score + Top 3, full-width for ranking list + chart. Resolves N1.
- Type badge consistent rounded pill style (bg-accent/10, accent text).
- Bottom tab spacing untouched, still 48px+ touch areas.
- Mobile 375px: stacked layout intact, padding preserved.

### Functionality (weight 0.30, threshold 7) — self-score 8.5
- F2: goalType radio with three options renders, persists, and round-trips through migrate. Existing localStorage data without goalType auto-fills to 'weight' on rehydrate.
- F4: '전체 순위' section renders 1, 2, 3, ... numeric badges; current user row outlined with accent border; Top 3 medals untouched.
- F5/F6/F7: Untouched, no regression.
- F10: CelebrationWatcher subscribes to members; on first transition to goalScore===100, fires modal + 2.5s confetti, then writes id to celebratedMemberIds. Re-mount won't re-trigger thanks to persisted set.
- F11: 7-day series with team + me lines; empty state when sum is 0.
- F12: Create/delete (with confirm) working; progress = certs in window / target · % capped at 100.
- Console: no errors expected (no console.* in new code; one pre-existing console.warn on rehydrate failure path).

### Craft (weight 0.20, threshold 6) — self-score 8
- 404 page added (N3): centered card + CTA.
- Confirm dialog reused for both team-member and challenge deletion.
- Disabled/active states preserved on all buttons.
- Progress bar uses transition-all for smooth fill.
- Celebration modal: ESC key + backdrop click close.

### Data Integrity (weight 0.25, threshold 7) — self-score 8.5
- persist version bumped 1 → 2; migrate runs idempotently.
- partialize includes new fields (celebratedMemberIds, teamChallenge).
- onRehydrateStorage defensively normalizes goalType for any legacy member missing it (belt + suspenders alongside migrate).
- removeMember now also prunes celebratedMemberIds for that member.
- Date filtering for challenge progress uses [startDate 00:00, endDate 23:59], inclusive, local time.
- WeeklyChart bucketizes by local startOfDay; out-of-range certifications are silently ignored.

## Estimated overall: 8.4 (above pass threshold 7)

## Known limitations
- Bundle > 500kB after adding recharts (warning only).
- Confetti uses requestAnimationFrame; tab in background may pause animation but modal still works.
- Type badge label is generic ('체중'); future: badge color per type.
