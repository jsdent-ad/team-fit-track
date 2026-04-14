# Team Fit-Track (오운완 팀 챌린저)

팀이 함께 목표를 향해 달리고, 서로의 기록을 격려하며 자유롭게 수정·관리할 수 있는 오픈형 운동 팀 앱.

## 주요 기능

- 팀 공유 비밀번호 로그인 (기본: `fittrack2026`)
- 멤버별 목표 설정 (체중 / 체지방량 / 골격근량 선택)
- 사진 인증 업로드 + 자동 WebP 변환
- 실시간 랭킹: Top 3 시상대 🥇🥈🥉 + 전체 순위
- 주간 인증 추이 차트 (팀 전체 vs 내 기록)
- 팀 챌린지/테마 목표 (월간 공통 목표 + 진행률 바)
- 목표 달성 축하 애니메이션 (canvas-confetti)
- localStorage 기반 영속화

## 기술 스택

- React 19 + Vite + TypeScript
- TailwindCSS 3
- Zustand (persist, migrate v1→v2)
- React Router v6
- Recharts, canvas-confetti
- Pretendard 폰트 / 일렉트릭 블루(#0066FF) 단일 강조

## 개발

```bash
cd app
npm install
npm run dev    # http://localhost:5173
npm run build
```

## 프로젝트 구조

```
.
├── app/                    # React 앱
│   ├── src/
│   │   ├── store/          # useTeamStore, score, image
│   │   ├── components/     # BottomTabs, MemberCard, CertificationCard,
│   │   │                   # ConfirmDialog, CelebrationModal, WeeklyChart,
│   │   │                   # TeamChallengeSection
│   │   └── pages/          # Login, Ranking, Certify, Records, Goals, NotFound
│   └── package.json
├── docs/
│   ├── planning/01-prd.md
│   └── harness/            # spec, features, rubric, feedbacks, screenshots
└── eval-round{1,2}.mjs     # Playwright 회귀 테스트
```

## 검증

Harness 파이프라인으로 2 사이클 Build-Eval:

| Round | Design | Functionality | Craft | Data Integrity | 종합 |
|:-----:|:------:|:-------------:|:-----:|:--------------:|:----:|
| 1 | 8 | 9 | 7 | 9 | 8.15 |
| 2 | 9 | 9 | 8 | 9 | 8.80 |

Playwright 58개 assertion 전원 통과, 콘솔 에러 0개.

자세한 내용: [docs/harness/final-report.md](docs/harness/final-report.md)
