import { useMemo, useState } from 'react';
import { useTeamStore, type TeamChallenge } from '../store/useTeamStore';
import ConfirmDialog from './ConfirmDialog';

function formatMD(d: string): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[1]}/${parts[2]}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function computeChallengeProgress(
  challenge: TeamChallenge,
  certCreatedAts: string[]
): { count: number; percent: number } {
  const start = new Date(challenge.startDate + 'T00:00:00');
  const end = new Date(challenge.endDate + 'T23:59:59');
  const count = certCreatedAts.filter((iso) => {
    const d = new Date(iso);
    return d >= start && d <= end;
  }).length;
  const percent = challenge.targetCount > 0
    ? Math.min(100, Math.round((count / challenge.targetCount) * 100))
    : 0;
  return { count, percent };
}

export default function TeamChallengeSection() {
  const challenge = useTeamStore((s) => s.teamChallenge);
  const setChallenge = useTeamStore((s) => s.setTeamChallenge);
  const deleteChallenge = useTeamStore((s) => s.deleteTeamChallenge);
  const certifications = useTeamStore((s) => s.certifications);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState('');
  const [themeEmoji, setThemeEmoji] = useState('🔥');
  const [targetCount, setTargetCount] = useState('100');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 30));
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    if (!challenge) return null;
    return computeChallengeProgress(
      challenge,
      certifications.map((c) => c.createdAt)
    );
  }, [challenge, certifications]);

  const resetForm = () => {
    setTitle('');
    setThemeEmoji('🔥');
    setTargetCount('100');
    setStartDate(todayISO());
    setEndDate(addDaysISO(todayISO(), 30));
    setError(null);
  };

  const onCreate = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    const target = Number(targetCount);
    if (!Number.isFinite(target) || target <= 0) {
      setError('목표 인증 수는 0보다 커야 합니다');
      return;
    }
    if (!startDate || !endDate) {
      setError('기간을 입력해주세요');
      return;
    }
    if (startDate > endDate) {
      setError('종료일은 시작일 이후여야 합니다');
      return;
    }
    await setChallenge({
      title: title.trim(),
      themeEmoji: themeEmoji.trim() || '🔥',
      targetCount: target,
      startDate,
      endDate,
    });
    setEditing(false);
    resetForm();
  };

  return (
    <section aria-labelledby="team-challenge" className="mb-4">
      <h2 id="team-challenge" className="text-sm font-semibold text-neutral-500 mb-2">
        팀 챌린지
      </h2>

      {challenge ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>
              {challenge.themeEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-neutral-900 truncate">{challenge.title}</p>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="h-8 px-2 rounded-lg text-xs text-red-600 border border-red-200 active:scale-95"
                >
                  삭제
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {formatMD(challenge.startDate)} ~ {formatMD(challenge.endDate)}
              </p>
              {progress && (
                <>
                  <div className="mt-3 h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${progress.percent}%` }}
                      role="progressbar"
                      aria-valuenow={progress.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <p className="text-xs text-neutral-600 mt-1.5 tabular-nums">
                    {progress.count} / {challenge.targetCount}건 · {progress.percent}%
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : editing ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 space-y-3">
          <label className="block">
            <span className="text-xs text-neutral-500">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="4월 오운완 300건 도전"
              className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-neutral-500">이모지</span>
              <input
                value={themeEmoji}
                onChange={(e) => setThemeEmoji(e.target.value)}
                maxLength={4}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">목표 인증 수</span>
              <input
                type="number"
                inputMode="numeric"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-neutral-500">시작일</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">종료일</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                resetForm();
              }}
              className="flex-1 h-11 rounded-lg border border-neutral-200 text-neutral-700 font-medium active:scale-95"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="flex-1 h-11 rounded-lg bg-accent text-white font-semibold active:scale-95"
            >
              챌린지 시작
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-2xl border border-dashed border-accent/40 bg-accent/5 py-6 text-accent font-semibold active:scale-[0.99] transition"
        >
          + 챌린지 시작하기
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="챌린지 삭제"
        message="정말 삭제하시겠습니까?"
        confirmLabel="삭제"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteChallenge();
          setConfirmDelete(false);
        }}
      />
    </section>
  );
}
