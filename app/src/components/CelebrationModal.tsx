import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { GOAL_TYPE_LABEL, type Member } from '../store/useTeamStore';

type Props = {
  member: Member | null;
  onClose: () => void;
};

/**
 * Celebration modal for goal achievement (goalScore === 100).
 *
 * Behavior decision:
 *  - On achievement, we add the member id to celebratedMemberIds (persisted).
 *  - On updateMember, if the member drops below 100 (e.g., target increased),
 *    we REMOVE them from celebratedMemberIds so a re-achievement re-triggers
 *    the celebration. This is intentional and documented here.
 */
export default function CelebrationModal({ member, onClose }: Props) {
  useEffect(() => {
    if (!member) return;
    let rafId: number | null = null;
    const end = Date.now() + 2500;
    const colors = ['#0066FF', '#66A3FF', '#FFFFFF', '#FFC857'];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) {
        rafId = requestAnimationFrame(frame);
      }
    };
    frame();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
    };
  }, [member, onClose]);

  if (!member) return null;

  const typeLabel = GOAL_TYPE_LABEL[member.goalType ?? 'weight'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-[fadeIn_160ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-2" aria-hidden>
          🎉
        </div>
        <h2 id="celebration-title" className="text-xl font-bold text-neutral-900">
          목표 달성!
        </h2>
        <p className="text-base text-neutral-800 mt-2">
          <span className="font-semibold">{member.name}</span> 님
        </p>
        <p className="text-sm text-neutral-500 mt-1">
          {typeLabel} · {member.goalCurrent} / {member.goalTarget} {member.goalUnit}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full h-12 rounded-xl bg-accent text-white font-semibold active:scale-95 transition"
        >
          확인
        </button>
      </div>
    </div>
  );
}
