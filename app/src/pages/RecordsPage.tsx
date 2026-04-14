import { useMemo, useState } from 'react';
import { useTeamStore } from '../store/useTeamStore';
import CertificationCard from '../components/CertificationCard';
import ConfirmDialog from '../components/ConfirmDialog';

export default function RecordsPage() {
  const members = useTeamStore((s) => s.members);
  const certifications = useTeamStore((s) => s.certifications);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const updateCertification = useTeamStore((s) => s.updateCertification);
  const removeCertification = useTeamStore((s) => s.removeCertification);

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) m.set(mem.id, mem.name);
    return m;
  }, [members]);

  const sorted = useMemo(
    () => [...certifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [certifications]
  );

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <main className="px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-neutral-900">팀 기록</h1>
        <p className="text-sm text-neutral-500 mt-0.5">총 {sorted.length}개의 인증</p>
      </header>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-neutral-600">아직 인증 기록이 없어요</p>
          <p className="text-sm text-neutral-400 mt-1">인증 탭에서 첫 사진을 올려보세요</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {sorted.map((c) => (
            <li key={c.id}>
              <CertificationCard
                cert={c}
                memberName={memberName.get(c.memberId) ?? '알 수 없음'}
                canEdit={c.memberId === currentMemberId}
                onUpdateCaption={(id, caption) => updateCertification(id, { caption: caption || undefined })}
                onRequestDelete={(id) => setPendingDeleteId(id)}
              />
            </li>
          ))}
        </ul>
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
          if (pendingDeleteId) removeCertification(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </main>
  );
}
