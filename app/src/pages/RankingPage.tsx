import { Link } from 'react-router-dom';
import { useTeamStore, GOAL_TYPE_LABEL } from '../store/useTeamStore';
import { ranking } from '../store/score';
import MemberCard from '../components/MemberCard';
import WeeklyChart from '../components/WeeklyChart';
import ChallengeBadge from '../components/ChallengeBadge';

export default function RankingPage() {
  const members = useTeamStore((s) => s.members);
  const certifications = useTeamStore((s) => s.certifications);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const teamName = useTeamStore((s) => s.currentTeamName);
  const teamCode = useTeamStore((s) => s.currentTeamCode);
  const logout = useTeamStore((s) => s.logout);

  const rows = ranking(members, certifications);
  const myRow = rows.find((r) => r.member.id === currentMemberId);
  const myName = myRow?.member.name ?? '';

  const top3 = rows.slice(0, 3);
  const isMe = (memberId: string) => memberId === currentMemberId;

  return (
    <main className="px-5 pt-6 pb-24 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500 truncate">
            {teamName ?? '팀'} · <span className="font-mono">{teamCode}</span>
          </p>
          <h1 className="text-xl font-bold text-neutral-900 truncate">{myName} 님</h1>
        </div>
        <button
          type="button"
          onClick={logout}
          className="h-10 px-3 rounded-lg text-sm text-neutral-500 border border-neutral-200 active:scale-95 shrink-0"
        >
          로그아웃
        </button>
      </header>

      {/* Challenge summary */}
      <ChallengeBadge />

      {/* Desktop: My Score + Top 3 side-by-side; mobile: stacked */}
      <div className="md:grid md:grid-cols-2 md:gap-6">
        {/* My Score */}
        <section aria-labelledby="my-score" className="mb-6 md:mb-0">
          <h2 id="my-score" className="sr-only">
            내 점수
          </h2>
          <div className="rounded-2xl bg-accent text-white p-5 shadow-sm h-full">
            <div className="flex items-baseline justify-between">
              <p className="text-sm/none opacity-80">내 종합 점수</p>
              <p className="text-3xl font-bold tabular-nums">{myRow ? myRow.total : 0}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] opacity-80">목표 점수</p>
                <p className="text-xl font-semibold tabular-nums">{myRow ? myRow.goal : 0}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] opacity-80">인증 점수</p>
                <p className="text-xl font-semibold tabular-nums">{myRow ? myRow.cert : 0}</p>
              </div>
            </div>
            {!myRow && (
              <p className="mt-3 text-xs text-white/80">
                아직 팀에 등록되지 않았어요.{' '}
                <Link to="/goals" className="underline underline-offset-2 font-semibold">
                  목표 설정하기
                </Link>
              </p>
            )}
          </div>
        </section>

        {/* Top 3 */}
        <section aria-labelledby="top3" className="mb-6 md:mb-0">
          <h2 id="top3" className="text-sm font-semibold text-neutral-500 mb-2">
            TOP 3
          </h2>
          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
              <p className="text-neutral-600 mb-4">아직 팀원이 없어요</p>
              <Link
                to="/goals"
                className="inline-flex h-11 items-center justify-center px-4 rounded-xl bg-accent text-white font-semibold active:scale-95"
              >
                팀원 추가하기
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {top3.map((row, idx) => (
                <li key={row.member.id}>
                  <MemberCard
                    row={row}
                    rank={idx + 1}
                    highlight={isMe(row.member.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Full ranking list */}
      {members.length > 0 && (
        <section aria-labelledby="overall-ranking" className="mt-6">
          <h2 id="overall-ranking" className="text-sm font-semibold text-neutral-500 mb-2">
            전체 순위
          </h2>
          <ul className="space-y-2">
            {rows.map((row, idx) => {
              const highlight = isMe(row.member.id);
              const typeLabel = GOAL_TYPE_LABEL[row.member.goalType ?? 'weight'];
              return (
                <li key={row.member.id}>
                  <div
                    className={[
                      'flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm',
                      highlight ? 'border-accent ring-1 ring-accent/30' : 'border-neutral-200',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tabular-nums',
                        idx === 0
                          ? 'bg-accent text-white'
                          : 'bg-neutral-100 text-neutral-700',
                      ].join(' ')}
                      aria-label={`${idx + 1}위`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-neutral-900 truncate">
                        {row.member.name}
                      </span>
                      {row.member.isLeader && (
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                          👑 리더
                        </span>
                      )}
                      <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
                        {typeLabel}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-accent tabular-nums">
                        {row.total}
                      </div>
                      <div className="text-[10px] text-neutral-500">점</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Weekly chart */}
      <section aria-labelledby="weekly-chart" className="mt-6">
        <h2 id="weekly-chart" className="text-sm font-semibold text-neutral-500 mb-2">
          주간 인증 추이
        </h2>
        <WeeklyChart />
      </section>
    </main>
  );
}
