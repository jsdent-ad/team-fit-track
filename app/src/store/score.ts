import type { Certification, Member } from './useTeamStore';

const SCORE_START = new Date('2026-05-01T00:00:00+09:00');

export function goalScore(m: Member): number {
  const target = Number.isFinite(m.goalTarget) ? m.goalTarget : 0;
  const current = Number.isFinite(m.goalCurrent) ? m.goalCurrent : 0;
  const start = Number.isFinite(m.goalStart) ? m.goalStart : current;
  if (target <= 0 || start <= 0) return 0;
  const diff = target - start;
  if (!Number.isFinite(diff) || Math.abs(diff) < 1e-9) return 0;
  const pct = ((current - start) / diff) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct))) >= 100 ? 100 : 0;
}

export function certScore(certs: Certification[], memberId: string): number {
  let count = 0;
  for (const c of certs) {
    if (c.memberId !== memberId) continue;
    const d = new Date(c.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    if (d < SCORE_START) continue;
    count++;
  }
  return count * 10;
}

export function totalScore(m: Member, certs: Certification[]): number {
  return goalScore(m) + certScore(certs, m.id);
}

export type RankingRow = {
  member: Member;
  goal: number;
  cert: number;
  total: number;
};

export function ranking(members: Member[], certs: Certification[]): RankingRow[] {
  return [...members]
    .map((m) => ({
      member: m,
      goal: goalScore(m),
      cert: certScore(certs, m.id),
      total: totalScore(m, certs),
    }))
    .sort((a, b) => b.total - a.total);
}
