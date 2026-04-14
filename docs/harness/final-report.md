# Harness Final Report — Team Fit-Track (Round 2)

## 프로젝트: 오운완 팀 챌린저 (Team Fit-Track)
## 원본 요청: 팀 운동/식단 챌린지 랭킹 앱 (PRD 제공)
## 기획: auto-planner 기반 + 사용자 추가 요구사항 반영
## 생성일: 2026-04-14 (Round 2 resume 완료)

---

## 결과 요약

| 항목 | 값 |
|------|-----|
| 최종 상태 | ✅ **PASS** |
| 총 사이클 | 2 / 3 (max) |
| 최종 가중 점수 | **8.8 / 10.0** (이전 8.15 → +0.65) |
| BLOCKING 이슈 | 0 |
| 콘솔 에러 | 0 |

## 사이클별 점수 추이

| 사이클 | Design | Functionality | Craft | Data Integrity | 종합 | 결과 |
|:------:|:------:|:-------------:|:-----:|:--------------:|:----:|:----:|
| 1 | 8 | 9 | 7 | 9 | 8.15 | ✅ PASS |
| 2 | **9** | 9 | **8** | 9 | **8.80** | ✅ PASS |

---

## Round 2 변경사항

### 사용자 추가 요구사항 반영
- **측정 유형 선택 (goalType)** — `/goals` 폼에 체중/체지방량/골격근량 3-way 라디오, 멤버/랭킹 카드에 한글 뱃지 표시. 기존 localStorage 데이터는 persist `version:1→2 migrate`로 `goalType='weight'` 자동 주입.
- **전체 순위 섹션 (1/2/3…)** — 메인 `/` 진입 시 Top 3 시상대 + 내 점수 카드 아래에 모든 멤버를 순위 숫자 뱃지와 함께 내림차순 표시. 본인 행은 일렉트릭 블루 테두리로 하이라이트.

### 신규 기능 (P2 → 구현 완료)
- **F10 목표 달성 축하 애니메이션** — `canvas-confetti` 2.5초 버스트 + 중앙 모달. `celebratedMemberIds` persist로 1회 1인 1달성.
- **F11 주간 인증 추이 차트** — `recharts` LineChart, 최근 7일, '팀 전체' + '내 기록' 이중 시리즈, 툴팁/레전드, 빈 상태 안내.
- **F12 팀 챌린지 / 테마 목표** — `/goals` 상단 섹션. 제목/이모지/목표 개수/기간 설정, 진행률 바, confirm 삭제. 메인에도 요약 뱃지.

### 보너스
- **404 페이지** — '페이지를 찾을 수 없어요' + 홈 복귀 버튼
- **데스크톱 레이아웃** — `md:grid md:grid-cols-2`로 내 점수/Top 3 좌우 배치, 전체 순위/차트는 full-width

---

## 검증 (Playwright 실측)
- **총 58개 assertion 전원 통과** (기존 Round 1 regression 포함)
- **콘솔 에러 0개** (8개 플로우 전수)
- WebP 변환 파이프라인, 점수 공식, cascade 삭제, localStorage 영속화 모두 이상 없음
- 마이그레이션: `version:1` 시드를 삽입 후 새로고침 → `goalType:'weight'`가 store와 DOM에 정상 복원됨

## 비차단 이슈 (향후 선택)
| ID | 설명 |
|----|------|
| N6 | recharts로 번들 크기 > 500KB 경고 (코드 스플리팅 또는 lighter chart 라이브러리 고려) |
| N7 | 축하 재발동 정책(`updateMember`이 100% 밑으로 떨어지면 id 제거)이 UI에 노출되지 않음 |
| N8 | 차트 tooltip hover가 자동 테스트로는 검증되지 않음 (수동 확인 기준) |

---

## 개발 서버
- **Frontend**: http://localhost:5173 (HMR 실행 중)
- `cd app && npm run build` → 0 TS 에러

## 구현 총괄
| Feature | Priority | Round | Status |
|---------|:--------:|:-----:|:------:|
| F1 로그인 | P0 | 1 | ✅ |
| F2 팀원·목표(+goalType) | P0 | 1→2 확장 | ✅ |
| F3 WebP 업로드 | P0 | 1 | ✅ |
| F4 랭킹(+전체 순위) | P0 | 1→2 확장 | ✅ |
| F5 기록 수정/삭제 | P0 | 1 | ✅ |
| F6 localStorage 영속 | P0 | 1 | ✅ |
| F7 하단 탭 | P0 | 1 | ✅ |
| F8 빈상태/에러 | P1 | 1 | ✅ |
| F9 디자인 | P1 | 1 | ✅ |
| F10 축하 애니메이션 | P2 | 2 | ✅ |
| F11 주간 차트 | P2 | 2 | ✅ |
| F12 팀 챌린지 | P2 | 2 | ✅ |
| N1 데스크톱 레이아웃 | Bonus | 2 | ✅ |
| N3 404 페이지 | Bonus | 2 | ✅ |

---

## 실행 방법

```bash
cd C:\myunji\sd_gym\app
npm install       # 최초 1회
npm run dev       # http://localhost:5173
# 팀 비밀번호: fittrack2026
```

## 산출물
- `docs/harness/spec.md`, `features.json`, `rubric.json`
- `docs/harness/feedback-1.md`, `feedback-2.md`
- `docs/harness/eval-scores-1.json`, `eval-scores-2.json`
- `docs/harness/screenshots/round1/` (11장), `screenshots/round2/` (8+장)
- `eval-round1.mjs`, `eval-round2.mjs` (Playwright 재실행 가능)
