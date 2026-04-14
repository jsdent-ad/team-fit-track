# Team Fit-Track — Round 1 Feedback

**Verdict**: PASS (overall 8.15, all 4 criteria ≥ threshold, 0 blocking issues, 0 console errors)

**Test evidence**: 31/31 Playwright tests passed. Full scoring in `eval-scores-1.json`.

---

## BLOCKING issues

None. All P0 acceptance criteria verified end-to-end.

---

## NON-BLOCKING issues (nice-to-have for Round 2)

### N1 — Desktop viewport underutilized (Design, low)
- **Repro**: Open `/`, `/records`, or `/goals` at 1280×800.
- **Expected**: Either a multi-column dashboard on wide screens (e.g., side-by-side My Score + Top 3 + Records preview), or an explicit mobile-frame mock on desktop to signal "mobile-first app".
- **Observed**: A narrow `max-w-xl` centered column with ~70% empty horizontal space on desktop. The app renders and is usable, but the wide viewport feels wasted.
- **Fix idea**: Add a `md:grid md:grid-cols-2 md:gap-6` layout on the Ranking page above 768px, putting My Score on the left and Top 3 on the right. Or render a stylized phone-frame outline on `md+` so the centered mobile column reads as intentional.

### N2 — No ranking re-order animation (Craft, low)
- **Repro**: With three members ranked Bob > Alice > Carol, add two certifications to Carol to push her above Alice.
- **Expected**: A short (~200ms) translate/fade transition so the rank change feels rewarding.
- **Observed**: List swaps instantly; easy to miss.
- **Fix idea**: Use `framer-motion`'s `AnimatePresence` with `layout` prop on the `<li>` elements, or a simple CSS `transition-transform` with position tracking.

### N3 — No dedicated 404 screen (Craft, low)
- **Repro**: Navigate to `/nonexistent-path`.
- **Expected**: A 404 card with a "홈으로 돌아가기" button, or at minimum a transient toast.
- **Observed**: Silent redirect to `/` (if logged in) or `/login` — works but provides no user feedback about the typo.
- **Fix idea**: Replace the catch-all `<Route path="*" element={<Navigate ... />}>` with a `NotFoundPage` component that shows a clear "페이지를 찾을 수 없어요" + CTA.

### N4 — Login has a brief re-render before navigate (Functionality, low)
- **Repro**: Submit correct credentials on `/login`.
- **Expected**: Immediate imperative navigation on successful auth.
- **Observed**: `LoginPage` relies on `useEffect(() => { if (currentUser) navigate('/') }, [currentUser])` after `login(name)` flips state — works but introduces a one-render delay. Button shows "로그인 중…" only if `submitting` state is set, which is set synchronously but overridden by the navigation.
- **Fix idea**: Call `navigate('/', { replace: true })` imperatively right after `login(trimmedName)` in the submit handler, eliminating the effect-based hop.

### N5 — currentUser casing cosmetic mismatch (Data Integrity, low)
- **Repro**: Log in as `alice` (lowercase). Create a Member named `Alice` (capitalized) via `/goals`. Return to `/`.
- **Expected**: Display matches between the header and the ranking card.
- **Observed**: Ranking highlights correctly (case-insensitive match works), but the header shows "alice 님" while the Top 3 card shows "Alice" — slightly jarring.
- **Fix idea**: On member creation, if `currentUser` matches case-insensitively, display the currentUser's input verbatim in the header, or normalize both to the Member's canonical name on first save.

---

## Strengths worth preserving

- **F3 WebP pipeline is genuinely correct.** `canvas.toBlob(..., 'image/webp', 0.8)` → FileReader → dataURL verified to produce `data:image/webp;base64,...` both in the preview img and in the persisted store. Also caps to 1280px longest side (good call for localStorage limits).
- **Custom ConfirmDialog** instead of `window.confirm` — supports ESC, backdrop click, destructive styling. Much better UX than the native primitive.
- **Cascade delete** on `removeMember` filters the certifications array in the same set() call. Verified clean.
- **Zustand `partialize`** prevents accidental persistence of derived state; `onRehydrateStorage` handles corrupted localStorage safely.
- **Zero console errors** across login, goals, certify, records, ranking, persistence, and tabs flows.
- **Pretendard actually applied** (`getComputedStyle(body).fontFamily === 'Pretendard, system-ui, -apple-system, sans-serif'`).
- **Score math is precise**: `min(100, round(current/target * 100))` with guards for target≤0 and non-finite — verified Alice=86, Bob=100, Carol=10 matching the formula.

---

## Recommended Round 2 priorities

None of these are required for PASS. In order of bang-for-buck:

1. **N1** — desktop multi-column layout (biggest visible polish win).
2. **N3** — 404 screen (tiny code change, high perceived quality).
3. **N2** — rank-change animation (rewards user engagement).
4. **N4 / N5** — micro-polish; skip unless time permits.

## Test artifacts

- Playwright script: `C:\myunji\sd_gym\eval-round1.mjs`
- Raw results JSON: `C:\myunji\sd_gym\eval-round1-results.json`
- Screenshots: `C:\myunji\sd_gym\docs\harness\screenshots\round1\`
  - `01-login-mobile.png`, `01-login-desktop.png`
  - `02-ranking-mobile.png`, `02-ranking-desktop.png`
  - `03-certify-mobile.png`, `03-certify-desktop.png`
  - `04-records-mobile.png`, `04-records-desktop.png`
  - `05-goals-empty-mobile.png`, `05-goals-desktop.png`
  - `06-goals-filled-mobile.png`
