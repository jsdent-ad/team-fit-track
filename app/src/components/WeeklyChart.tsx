import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTeamStore } from '../store/useTeamStore';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type Row = {
  label: string;
  mmdd: string;
  team: number;
  me: number;
};

export default function WeeklyChart() {
  const certifications = useTeamStore((s) => s.certifications);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);

  const myMemberId = currentMemberId;

  const data: Row[] = useMemo(() => {
    const today = startOfDay(new Date());
    const days: Row[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        label: WEEKDAYS[d.getDay()],
        mmdd,
        team: 0,
        me: 0,
      });
    }
    const firstDay = new Date(today);
    firstDay.setDate(firstDay.getDate() - 6);
    for (const c of certifications) {
      const d = startOfDay(new Date(c.createdAt));
      if (d < firstDay || d > today) continue;
      const diff = Math.floor((d.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0 || diff > 6) continue;
      days[diff].team += 1;
      if (myMemberId && c.memberId === myMemberId) {
        days[diff].me += 1;
      }
    }
    return days;
  }, [certifications, myMemberId]);

  const totalCount = data.reduce((acc, r) => acc + r.team, 0);

  if (totalCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
        <p className="text-sm text-neutral-500">이번 주 기록이 없어요</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="label"
              tick={(props) => {
                const { x, y, payload, index } = props;
                const row = data[index];
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#6B7280">
                      {payload.value}
                    </text>
                    <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10} fill="#9CA3AF">
                      {row?.mmdd}
                    </text>
                  </g>
                );
              }}
              height={40}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              width={32}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as Row | undefined;
                return p ? `${p.mmdd} (${label})` : String(label);
              }}
              formatter={(value, name) => [
                value as number,
                name === 'team' ? '팀 전체' : '내 기록',
              ]}
            />
            <Legend
              verticalAlign="top"
              height={24}
              formatter={(v) => (v === 'team' ? '팀 전체' : '내 기록')}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="team"
              stroke="#0066FF"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="me"
              stroke="#9CA3AF"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
