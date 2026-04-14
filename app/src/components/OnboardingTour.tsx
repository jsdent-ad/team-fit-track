import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Step = {
  tabPath: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    tabPath: '/',
    title: '1. 랭킹 탭',
    body: '팀 TOP 3 시상대와 내 점수, 전체 순위를 한눈에 확인할 수 있어요.',
  },
  {
    tabPath: '/certify',
    title: '2. 인증 탭',
    body: '운동/식단 사진을 올리면 WebP로 자동 변환되고 +10점이 쌓여요.',
  },
  {
    tabPath: '/records',
    title: '3. 기록 탭',
    body: '팀원 전체의 인증 기록을 볼 수 있어요. 내 기록만 수정/삭제 가능합니다.',
  },
  {
    tabPath: '/goals',
    title: '4. 목표 탭',
    body: '시작치·현재치·목표치를 설정해 진행률을 관리해요. 목표 달성하면 🎉',
  },
];

type Rect = { left: number; top: number; width: number; height: number };

export default function OnboardingTour({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = STEPS[index];

  useEffect(() => {
    if (location.pathname !== step.tabPath) {
      navigate(step.tabPath, { replace: false });
    }
  }, [step.tabPath, location.pathname, navigate]);

  useLayoutEffect(() => {
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tab="${step.tabPath}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const t = setInterval(update, 300); // catch tab-bar animations / safe-area changes
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      clearInterval(t);
    };
  }, [step.tabPath]);

  const isLast = index === STEPS.length - 1;
  const next = () => (isLast ? onDone() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Card placed above the bottom tab bar. Arrow points down to the tab.
  const arrowLeft = rect ? rect.left + rect.width / 2 : 0;

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog" aria-labelledby="tour-title">
      {/* Dim overlay with cutout around target tab */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" onClick={next} />
      {rect && (
        <div
          className="absolute rounded-xl ring-4 ring-accent animate-pulse pointer-events-none"
          style={{
            left: rect.left + 4,
            top: rect.top + 4,
            width: rect.width - 8,
            height: rect.height - 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
          aria-hidden
        />
      )}

      {/* Arrow pointing down to the tab */}
      {rect && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: arrowLeft - 14,
            top: rect.top - 40,
          }}
          aria-hidden
        >
          <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
            <path
              d="M14 2 L14 28 M14 32 L4 22 M14 32 L24 22"
              stroke="#0066FF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Instruction card */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm"
        style={{ bottom: (rect?.height ?? 64) + 80 }}
      >
        <div className="bg-white rounded-2xl shadow-xl p-5 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-accent">
              {index + 1} / {STEPS.length}
            </span>
            <button
              type="button"
              onClick={onDone}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              건너뛰기
            </button>
          </div>
          <h3 id="tour-title" className="text-base font-bold text-neutral-900">
            {step.title}
          </h3>
          <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{step.body}</p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="flex-1 h-10 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 active:scale-95 disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              onClick={next}
              className="flex-[1.2] h-10 rounded-lg bg-accent text-white text-sm font-semibold active:scale-95"
            >
              {isLast ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
