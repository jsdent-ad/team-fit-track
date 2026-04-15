import { useMemo, useState } from 'react';
import { useTeamStore, type Certification } from '../store/useTeamStore';
import CertificationCard from '../components/CertificationCard';
import ConfirmDialog from '../components/ConfirmDialog';

type ViewMode = 'calendar' | 'list';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RecordsPage() {
  const members = useTeamStore((s) => s.members);
  const certifications = useTeamStore((s) => s.certifications);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const updateMyCertification = useTeamStore((s) => s.updateMyCertification);
  const removeMyCertification = useTeamStore((s) => s.removeMyCertification);

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) m.set(mem.id, mem.name);
    return m;
  }, [members]);

  const sorted = useMemo(
    () => [...certifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [certifications]
  );

  // Bucket certs by day key (YYYY-MM-DD based on local time)
  const byDay = useMemo(() => {
    const map = new Map<string, Certification[]>();
    for (const c of sorted) {
      const d = new Date(c.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    return map;
  }, [sorted]);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('calendar');
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth(); // 0-based
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const firstWeekday = firstDay.getDay(); // 0=Sun
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  // Build 6-row grid cells: leading (prev month), current, trailing (next month)
  type Cell = {
    date: Date;
    inMonth: boolean;
    key: string;
  };
  const cells: Cell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDate - i);
    cells.push({ date: d, inMonth: false, key: dayKey(d) });
  }
  for (let i = 1; i <= lastDate; i++) {
    const d = new Date(year, month, i);
    cells.push({ date: d, inMonth: true, key: dayKey(d) });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: d, inMonth: false, key: dayKey(d) });
  }
  // If fewer than 6 weeks, keep compact (no need to force 42 cells)

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));

  const selectedCerts = selectedDayKey ? byDay.get(selectedDayKey) ?? [] : [];

  return (
    <main className="px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-neutral-900">팀 기록</h1>
        <p className="text-sm text-neutral-500 mt-0.5">총 {sorted.length}개의 인증</p>
      </header>

      {/* View toggle */}
      <div
        role="tablist"
        aria-label="보기 전환"
        className="inline-flex rounded-xl bg-neutral-100 p-1 mb-4"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === 'calendar'}
          onClick={() => setView('calendar')}
          className={[
            'h-9 px-4 rounded-lg text-sm font-medium transition',
            view === 'calendar' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500',
          ].join(' ')}
        >
          달력
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          onClick={() => setView('list')}
          className={[
            'h-9 px-4 rounded-lg text-sm font-medium transition',
            view === 'list' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500',
          ].join(' ')}
        >
          리스트
        </button>
      </div>

      {view === 'calendar' ? (
        <section aria-label="달력 뷰">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goPrev}
              className="h-10 w-10 rounded-lg border border-neutral-200 text-neutral-700 active:scale-95 flex items-center justify-center"
              aria-label="이전 달"
            >
              ◀
            </button>
            <div className="text-base font-semibold tabular-nums">
              {year}년 {month + 1}월
            </div>
            <button
              type="button"
              onClick={goNext}
              className="h-10 w-10 rounded-lg border border-neutral-200 text-neutral-700 active:scale-95 flex items-center justify-center"
              aria-label="다음 달"
            >
              ▶
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={[
                  'text-center text-[11px] font-medium py-1',
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-neutral-500',
                ].join(' ')}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const certsOn = byDay.get(cell.key) ?? [];
              const isToday = sameDay(cell.date, today);
              const has = certsOn.length > 0;
              const latest = has ? certsOn[0] : null; // sorted desc
              return (
                <button
                  key={cell.key + (cell.inMonth ? '' : '-out')}
                  type="button"
                  onClick={() => setSelectedDayKey(cell.key)}
                  disabled={!cell.inMonth && !has}
                  className={[
                    'relative aspect-square rounded-lg overflow-hidden border text-left',
                    isToday ? 'border-accent ring-2 ring-accent/40' : 'border-neutral-200',
                    cell.inMonth ? 'bg-white' : 'bg-neutral-50',
                    has ? 'active:scale-[0.97]' : '',
                  ].join(' ')}
                  aria-label={`${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일${has ? ` 인증 ${certsOn.length}개` : ''}`}
                >
                  {latest && (
                    <img
                      src={latest.imageDataUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-90"
                      loading="lazy"
                      aria-hidden
                    />
                  )}
                  {latest && <div className="absolute inset-0 bg-black/15" aria-hidden />}
                  <span
                    className={[
                      'absolute top-1 left-1.5 text-[11px] font-semibold tabular-nums',
                      latest ? 'text-white drop-shadow' : cell.inMonth ? 'text-neutral-700' : 'text-neutral-400',
                    ].join(' ')}
                  >
                    {cell.date.getDate()}
                  </span>
                  {certsOn.length > 1 && (
                    <span className="absolute bottom-1 right-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/60 text-white tabular-nums">
                      +{certsOn.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {sorted.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
              <p className="text-neutral-600">아직 인증 기록이 없어요</p>
              <p className="text-sm text-neutral-400 mt-1">
                인증 탭에서 첫 사진을 올려보세요
              </p>
            </div>
          )}
        </section>
      ) : (
        <section aria-label="리스트 뷰">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
              <p className="text-neutral-600">아직 인증 기록이 없어요</p>
              <p className="text-sm text-neutral-400 mt-1">
                인증 탭에서 첫 사진을 올려보세요
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {sorted.map((c) => (
                <li key={c.id}>
                  <CertificationCard
                    cert={c}
                    memberName={memberName.get(c.memberId) ?? '알 수 없음'}
                    canEdit={c.memberId === currentMemberId}
                    onUpdateCaption={(id, caption) =>
                      updateMyCertification(id, { caption: caption || null })
                    }
                    onRequestDelete={(id) => setPendingDeleteId(id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Daily modal */}
      {selectedDayKey && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedDayKey} 인증 목록`}
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedDayKey(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <div>
                <div className="text-base font-semibold">{selectedDayKey}</div>
                <div className="text-xs text-neutral-500">
                  인증 {selectedCerts.length}개
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {selectedCerts.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">
                  이 날에는 인증이 없어요
                </p>
              ) : (
                selectedCerts.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-xl border border-neutral-200 overflow-hidden"
                  >
                    <img
                      src={c.imageDataUrl}
                      alt={c.caption ?? '인증 사진'}
                      className="w-full max-h-72 object-cover bg-neutral-100"
                      loading="lazy"
                    />
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {memberName.get(c.memberId) ?? '알 수 없음'}
                          </div>
                          <div className="text-[11px] text-neutral-500 tabular-nums">
                            {formatHM(c.createdAt)}
                          </div>
                        </div>
                        {c.memberId === currentMemberId && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(c.id)}
                            className="h-8 px-3 rounded-lg text-xs text-red-600 border border-red-200 active:scale-95"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      {c.caption && (
                        <p className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">
                          {c.caption}
                        </p>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="인증 삭제"
        message={'정말 삭제하시겠습니까?\n삭제 시 해당 멤버의 인증 점수에서 10점이 차감됩니다.'}
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) removeMyCertification(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </main>
  );
}
