import { useState } from 'react';
import type { Certification } from '../store/useTeamStore';

type Props = {
  cert: Certification;
  memberName: string;
  canEdit: boolean;
  onUpdateCaption: (id: string, caption: string) => void;
  onRequestDelete: (id: string) => void;
  onImageClick?: (cert: Certification) => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) return `오늘 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export default function CertificationCard({
  cert,
  memberName,
  canEdit,
  onUpdateCaption,
  onRequestDelete,
  onImageClick,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cert.caption ?? '');

  const imageInteractive = typeof onImageClick === 'function';

  return (
    <article className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      {imageInteractive ? (
        <button
          type="button"
          onClick={() => onImageClick?.(cert)}
          className="block w-full focus:outline-none focus:ring-2 focus:ring-accent/40"
          aria-label={`${memberName} 인증 사진 크게 보기`}
        >
          <img
            src={cert.imageDataUrl}
            alt={`${memberName} 인증 사진`}
            className="w-full h-56 object-cover bg-neutral-100"
            loading="lazy"
          />
        </button>
      ) : (
        <img
          src={cert.imageDataUrl}
          alt={`${memberName} 인증 사진`}
          className="w-full h-56 object-cover bg-neutral-100"
          loading="lazy"
        />
      )}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-neutral-900 truncate">{memberName}</div>
            <div className="text-xs text-neutral-500">{formatTime(cert.createdAt)}</div>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="캡션 수정"
                onClick={() => setEditing((v) => !v)}
                className="w-10 h-10 rounded-lg hover:bg-neutral-100 active:scale-95 flex items-center justify-center text-neutral-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 20h4l10-10-4-4L4 16v4z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                aria-label="인증 삭제"
                onClick={() => onRequestDelete(cert.id)}
                className="w-10 h-10 rounded-lg hover:bg-red-50 active:scale-95 flex items-center justify-center text-red-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 7h14M10 7V5a1 1 0 011-1h2a1 1 0 011 1v2M7 7l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-neutral-400">팀원 기록</span>
          )}
        </div>

        {editing && canEdit ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="캡션을 입력하세요"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(cert.caption ?? '');
                  setEditing(false);
                }}
                className="flex-1 h-10 rounded-lg border border-neutral-200 text-sm text-neutral-700 active:scale-95"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateCaption(cert.id, draft.trim());
                  setEditing(false);
                }}
                className="flex-1 h-10 rounded-lg bg-accent text-white text-sm font-semibold active:scale-95"
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          cert.caption && (
            <p className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{cert.caption}</p>
          )
        )}
      </div>
    </article>
  );
}
