# Team Fit-Track — Harness Spec

## 프로젝트 정보
- **이름**: 오운완 팀 챌린저 (Team Fit-Track)
- **유형**: webapp (팀 피트니스 인증 & 랭킹)
- **기술 스택**: React 19 + Vite + TypeScript + TailwindCSS + Zustand
- **데이터**: localStorage (MVP 단계, 백엔드 없음)
- **배포 URL**: http://localhost:5173

## 핵심 가치
팀원들이 매일 운동/식단 사진으로 인증하고, 자동 계산된 점수로 경쟁하며, 서로의 기록을 자유롭게 확인/수정할 수 있는 오픈형 팀 챌린지 앱.

## 라우트 구조
| 경로 | 화면 | 설명 |
|------|------|------|
| `/login` | 팀 로그인 | 팀 비밀번호 + 사용자명 입력 |
| `/` | 메인 (랭킹) | Top 3 랭킹 + 내 점수 카드 |
| `/certify` | 인증 탭 | 사진 촬영/업로드 + WebP 변환 + 오늘 인증 미리보기 |
| `/records` | 기록 탭 | 팀원 전체 기록 리스트 + 수정/삭제 |
| `/goals` | 목표 설정 | 숫자 목표/현재치 입력 및 수정 |

## 데이터 모델
```ts
type TeamMember = {
  id: string;           // uuid
  name: string;
  goalTarget: number;   // 목표치 (예: 체중 65kg)
  goalCurrent: number;  // 현재치 (예: 체중 70kg)
  goalUnit: string;     // 단위 (kg, km 등)
  certifications: Certification[];
};

type Certification = {
  id: string;
  memberId: string;
  imageDataUrl: string; // WebP dataURL
  caption?: string;
  createdAt: string;    // ISO
};

type Score = {
  memberId: string;
  goalScore: number;    // min(100, (current/target)*100)
  certScore: number;    // certifications.length * 10
  total: number;        // goalScore + certScore
};
```

## 점수 계산 로직
- **목표 점수**: `min(100, (goalCurrent / goalTarget) * 100)` — 소수점 반올림
- **인증 점수**: `certifications.length * 10`
- **종합**: `goalScore + certScore`
- **랭킹**: total 내림차순 정렬

## 이미지 처리 파이프라인
1. 사용자 파일 선택 (`<input type="file" accept="image/*" capture="environment">`)
2. `<canvas>`에 draw → `canvas.toBlob(callback, 'image/webp', 0.8)`
3. Blob → FileReader → dataURL
4. Certification 객체에 저장 → localStorage persist

## 인증/권한
- 팀 비밀번호 1개 (환경변수 `VITE_TEAM_PASSWORD` 또는 하드코딩 "fittrack2026")
- 로그인 후 사용자명만 입력 → localStorage에 currentUser 저장
- 팀원 전원 모든 데이터 수정/삭제 가능 (오픈 DB)

## 디자인 원칙
- **폰트**: Pretendard (CDN @font-face)
- **색상**: bg #FFFFFF, 강조 일렉트릭 블루 #0066FF, 텍스트 #111
- **레이아웃**: 모바일 우선, 하단 탭 네비게이션 (메인/인증/기록/목표)
- **버튼**: 최소 높이 48px, 큰 아이콘
- **삭제**: 반드시 confirm 팝업

## 수락 기준 (High-level)
1. 팀 비밀번호 로그인 → 메인 화면 표시
2. 목표 설정: 목표치/현재치 입력 후 저장 → 점수 자동 재계산
3. 사진 업로드: 선택 → WebP 변환 → 미리보기 → 저장 → 인증 점수 +10
4. 랭킹: Top 3 + 전체 랭킹이 점수 기준 올바른 순서로 표시
5. 기록 수정/삭제: 수정 저장 시 점수 재계산, 삭제 시 confirm 후 제거
6. 새로고침 후 데이터 유지 (localStorage)
7. 콘솔 에러 0개
