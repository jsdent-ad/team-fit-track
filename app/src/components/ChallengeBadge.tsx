import { useMemo } from 'react';
import { useTeamStore } from '../store/useTeamStore';
import { computeChallengeProgress } from './TeamChallengeSection';

export default function ChallengeBadge() {
  const challenge = useTeamStore((s) => s.teamChallenge);
  const certifications = useTeamStore((s) => s.certifications);

  const progress = useMemo(() => {
    if (!challenge) return null;
    return computeChallengeProgress(
      challenge,
      certifications.map((c) => c.createdAt)
    );
  }, [challenge, certifications]);

  if (!challenge || !progress) return null;

  return (
    <section aria-labelledby="current-challenge" className="mb-4">
      <h2 id="current-challenge" className="text-sm font-semibold text-neutral-500 mb-2">
        이번 챌린지
      </h2>
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 flex items-center gap-3">
        <div className="text-2xl" aria-hidden>
          {challenge.themeEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-neutral-900 truncate">{challenge.title}</p>
          <div className="mt-2 h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress.percent}%` }}
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1 tabular-nums">
            {progress.count} / {challenge.targetCount}건 · {progress.percent}%
          </p>
        </div>
      </div>
    </section>
  );
}
