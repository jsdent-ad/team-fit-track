import type { Certification, Member } from './useTeamStore';

export function goalScore(m: Member): number {
  if (!m.goalTarget || m.goalTarget <= 0 || !Number.isFinite(m.goalTarget)) return 0;
  const current = Number.isFinite(m.goalCurrent) ? m.goalCurrent : 0;
  const pct = (current / m.goalTarget) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function certScore(certs: Certification[], memberId: string): number {
  return certs.filter((c) => c.memberId === memberId).length * 10;
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
