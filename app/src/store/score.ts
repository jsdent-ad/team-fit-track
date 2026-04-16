import type { Certification, Member } from './useTeamStore';

export function goalScore(m: Member): number {
  const target = Number.isFinite(m.goalTarget) ? m.goalTarget : 0;
  const current = Number.isFinite(m.goalCurrent) ? m.goalCurrent : 0;
  const start = Number.isFinite(m.goalStart) ? m.goalStart : current;
  const diff = target - start;
  if (!Number.isFinite(diff) || Math.abs(diff) < 1e-9) return 0;
  const pct = ((current - start) / diff) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function certScore(certs: Certification[], memberId: string): number {
  const days = new Set<string>();
  for (const c of certs) {
    if (c.memberId !== memberId) continue;
    const d = new Date(c.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size * 10;
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
