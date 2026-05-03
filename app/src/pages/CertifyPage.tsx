import { useMemo, useRef, useState } from 'react';
import { useTeamStore } from '../store/useTeamStore';
import { convertToWebP } from '../store/image';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CertifyPage() {
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const members = useTeamStore((s) => s.members);
  const certifications = useTeamStore((s) => s.certifications);
  const addCertification = useTeamStore((s) => s.addCertification);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [certDate, setCertDate] = useState<string>(todayStr);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const myMember = useMemo(
    () => members.find((m) => m.id === currentMemberId),
    [currentMemberId, members]
  );

  const selectedDateCerts = useMemo(() => {
    if (!myMember) return [];
    const [year, month, day] = certDate.split('-').map(Number);
    return certifications
      .filter((c) => c.memberId === myMember.id)
      .filter((c) => {
        const d = new Date(c.createdAt);
        return (
          d.getFullYear() === year &&
          d.getMonth() + 1 === month &&
          d.getDate() === day
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [certifications, myMember, certDate]);

  const isToday = certDate === todayStr();

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await convertToWebP(file, 0.8);
      setPreview(dataUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '이미지 변환 실패';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!preview || !myMember) return;
    setBusy(true);
    try {
      await addCertification({
        imageDataUrl: preview,
        caption: caption.trim() || undefined,
        certDate,
      });
      setPreview(null);
      setCaption('');
      setToast('인증이 등록되었습니다! +10점');
      setTimeout(() => setToast(null), 2000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      const msg = e instanceof Error ? e.message : '등록 실패';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onCancel = () => {
    setPreview(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dateLabel = (() => {
    if (isToday) return '오늘';
    const [, m, d] = certDate.split('-').map(Number);
    return `${m}월 ${d}일`;
  })();

  return (
    <main className="px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-neutral-900">오운완 인증</h1>
        <p className="text-sm text-neutral-500 mt-0.5">사진 한 장이면 +10점</p>
      </header>

      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
          인증 날짜
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={certDate}
            onChange={(e) => {
              if (e.target.value) setCertDate(e.target.value);
            }}
            className="flex-1 h-12 rounded-xl border border-neutral-200 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent text-sm"
          />
          {!isToday && (
            <button
              type="button"
              onClick={() => setCertDate(todayStr())}
              className="h-12 px-3 rounded-xl border border-neutral-200 text-xs text-neutral-500 whitespace-nowrap active:scale-95 transition"
            >
              오늘로
            </button>
          )}
        </div>
      </div>

      {!preview ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="w-full h-40 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 text-accent font-semibold flex flex-col items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h3l2-2h6l2 2h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>{busy ? '변환 중…' : '사진 찍기 / 선택하기'}</span>
            <span className="text-xs text-neutral-500 font-normal">JPG/PNG → WebP 자동 변환</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50">
            <img src={preview} alt="선택한 사진 미리보기" className="w-full max-h-96 object-contain" />
          </div>
          <div>
            <label htmlFor="caption" className="block text-sm font-medium text-neutral-700 mb-1.5">
              캡션 (선택)
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              placeholder="오늘의 한 줄 기록"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 h-12 rounded-xl border border-neutral-200 text-neutral-700 font-medium active:scale-95 transition disabled:opacity-60"
            >
              다시 선택
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              className="flex-1 h-12 rounded-xl bg-accent text-white font-semibold active:scale-95 transition disabled:opacity-60"
            >
              {busy ? '등록 중…' : '인증 등록'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2"
        >
          {error}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-neutral-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-30"
        >
          {toast}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-500 mb-2">{dateLabel} 내 인증</h2>
        {selectedDateCerts.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center rounded-xl border border-dashed border-neutral-200">
            {dateLabel} 인증이 없어요
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {selectedDateCerts.map((c) => {
              const d = new Date(c.createdAt);
              const pad = (n: number) => n.toString().padStart(2, '0');
              const label = Number.isNaN(d.getTime())
                ? ''
                : `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
              return (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="aspect-square rounded-xl overflow-hidden border border-neutral-200">
                    <img
                      src={c.imageDataUrl}
                      alt={c.caption ?? '인증'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 text-center tabular-nums">
                    {label}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
