import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  GOAL_TYPE_LABEL,
  useTeamStore,
  type Certification,
} from '../store/useTeamStore';
import { goalScore, certScore } from '../store/score';
import ConfirmDialog from '../components/ConfirmDialog';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const members = useTeamStore((s) => s.members);
  const certifications = useTeamStore((s) => s.certifications);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const updateMyCertification = useTeamStore((s) => s.updateMyCertification);
  const removeMyCertification = useTeamStore((s) => s.removeMyCertification);

  const member = useMemo(
    () => members.find((m) => m.id === id),
    [members, id]
  );

  const memberCerts = useMemo(() => {
    if (!member) return [];
    return certifications
      .filter((c) => c.memberId === member.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [certifications, member]);

  const [viewer, setViewer] = useState<Certification | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (!member) {
    return (
      <main className="px-5 pt-6 pb-24 max-w-xl mx-auto">
        <header className="mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-neutral-500 mb-2"
          >
            ← 뒤로
          </button>
          <h1 className="text-xl font-bold text-neutral-900">존재하지 않는 멤버</h1>
        </header>
        <p className="text-sm text-neutral-500 mb-4">
          요청한 멤버 정보를 찾을 수 없어요. 삭제되었거나 잘못된 링크일 수 있습니다.
        </p>
        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center px-4 rounded-xl bg-accent text-white font-semibold"
        >
          홈으로
        </Link>
      </main>
    );
  }

  const goal = goalScore(member);
  const cert = certScore(certifications, member.id);
  const total = goal + cert;
  const typeLabel = GOAL_TYPE_LABEL[member.goalType ?? 'weight'];
  const isMe = member.id === currentMemberId;
  const canEdit = isMe;

  return (
    <main className="px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="mb-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-neutral-500 mb-2 inline-flex items-center gap-1 active:scale-95"
          aria-label="뒤로 가기"
        >
          ← 뒤로
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-neutral-900 truncate">{member.name}</h1>
          {member.isLeader && (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
              👑 리더
            </span>
          )}
          {isMe && (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-accent text-white">
              나
            </span>
          )}
        </div>
      </header>

      {/* Breakdown */}
      <section className="rounded-2xl bg-accent text-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-sm opacity-80">종합 점수</p>
          <p className="text-4xl font-bold tabular-nums">{total}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[11px] opacity-80">목표 점수</p>
            <p className="text-xl font-semibold tabular-nums">{goal}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[11px] opacity-80">인증 점수</p>
            <p className="text-xl font-semibold tabular-nums">{cert}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-white/10 p-3">
          <p className="text-[11px] opacity-80">{typeLabel} 진행 상황</p>
          <p className="text-sm font-medium mt-0.5 tabular-nums">
            시작 {member.goalStart} → 현재 {member.goalCurrent} / 목표 {member.goalTarget} {member.goalUnit || ''}
          </p>
        </div>
      </section>

      {/* Certifications */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-500 mb-2">
          인증 기록 ({memberCerts.length})
        </h2>
        {memberCerts.length === 0 ? (
          <p className="text-sm text-neutral-400 py-8 text-center rounded-xl border border-dashed border-neutral-200">
            아직 인증이 없어요
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {memberCerts.map((c) => (
              <li key={c.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setViewer(c)}
                  className="aspect-square rounded-xl overflow-hidden border border-neutral-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent/40"
                  aria-label="인증 사진 크게 보기"
                >
                  <img
                    src={c.imageDataUrl}
                    alt={c.caption ?? '인증 사진'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
                <p className="text-[10px] text-neutral-500 text-center tabular-nums">
                  {formatDateTime(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Viewer modal */}
      {viewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="인증 사진 자세히 보기"
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => {
            setViewer(null);
            setEditingId(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewer.imageDataUrl}
              alt={viewer.caption ?? '인증 사진'}
              className="w-full max-h-[60vh] object-contain bg-neutral-100"
            />
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{member.name}</div>
                  <div className="text-xs text-neutral-500 tabular-nums">
                    {formatDateTime(viewer.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && editingId !== viewer.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(viewer.id);
                          setEditDraft(viewer.caption ?? '');
                        }}
                        className="h-9 px-3 rounded-lg text-sm text-neutral-700 border border-neutral-200 active:scale-95"
                      >
                        캡션 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(viewer.id)}
                        className="h-9 px-3 rounded-lg text-sm text-red-600 border border-red-200 active:scale-95"
                      >
                        삭제
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setViewer(null);
                      setEditingId(null);
                    }}
                    className="h-9 w-9 rounded-lg text-neutral-500 hover:bg-neutral-100"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {canEdit && editingId === viewer.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={2}
                    placeholder="캡션을 입력하세요"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex-1 h-10 rounded-lg border border-neutral-200 text-sm text-neutral-700 active:scale-95"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateMyCertification(viewer.id, {
                          caption: editDraft.trim() || null,
                        });
                        setEditingId(null);
                      }}
                      className="flex-1 h-10 rounded-lg bg-accent text-white text-sm font-semibold active:scale-95"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                viewer.caption && (
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                    {viewer.caption}
                  </p>
                )
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
        onConfirm={async () => {
          if (pendingDeleteId) {
            await removeMyCertification(pendingDeleteId);
            if (viewer && viewer.id === pendingDeleteId) setViewer(null);
          }
          setPendingDeleteId(null);
        }}
      />
    </main>
  );
}
