import type { RankingRow } from '../store/score';
import { GOAL_TYPE_LABEL } from '../store/useTeamStore';

type Props = {
  row: RankingRow;
  rank: number;
  highlight?: boolean;
};

const medals: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function MemberCard({ row, rank, highlight = false }: Props) {
  const medal = medals[rank];
  const typeLabel = GOAL_TYPE_LABEL[row.member.goalType ?? 'weight'];
  return (
    <div
      className={[
        'flex items-center gap-3 p-4 bg-white rounded-2xl border shadow-sm',
        highlight ? 'border-accent ring-1 ring-accent/30' : 'border-neutral-200',
      ].join(' ')}
    >
      <div className="w-10 text-center text-xl font-bold text-neutral-700">
        {medal ?? `${rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate text-neutral-900">{row.member.name}</span>
          {row.member.isLeader && (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800" title="팀 리더">
              👑 리더
            </span>
          )}
          <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
            {typeLabel}
          </span>
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          목표 {row.goal} · 인증 {row.cert}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold text-accent tabular-nums">{row.total}</div>
        <div className="text-xs text-neutral-500">점</div>
      </div>
    </div>
  );
}
