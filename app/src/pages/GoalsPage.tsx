import { useState } from 'react';
import {
  useTeamStore,
  type Member,
  type GoalType,
  GOAL_TYPE_LABEL,
  GOAL_TYPE_DEFAULT_UNIT,
  type AuthResult,
} from '../store/useTeamStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { goalScore, certScore } from '../store/score';
import TeamChallengeSection from '../components/TeamChallengeSection';

type Draft = {
  name: string;
  goalType: GoalType;
  goalStart: string;
  goalTarget: string;
  goalCurrent: string;
  goalUnit: string;
};

function validate(draft: Draft): string | null {
  if (!draft.name.trim()) return '이름을 입력해주세요';
  const target = Number(draft.goalTarget);
  const current = Number(draft.goalCurrent);
  if (!Number.isFinite(target) || target <= 0) return '목표치는 0보다 커야 합니다';
  if (!Number.isFinite(current) || current < 0) return '현재치는 0 이상이어야 합니다';
  if (draft.goalStart.trim() !== '') {
    const start = Number(draft.goalStart);
    if (!Number.isFinite(start) || start < 0) return '시작치는 0 이상이어야 합니다';
    if (Math.abs(start - target) < 1e-9) return '시작치와 목표치가 같으면 진행률을 계산할 수 없어요';
  }
  return null;
}

const GOAL_TYPE_OPTIONS: GoalType[] = ['weight', 'bodyFat', 'skeletalMuscle'];

function GoalTypeSelect({
  value,
  onChange,
}: {
  value: GoalType;
  onChange: (v: GoalType) => void;
}) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="측정 유형">
      {GOAL_TYPE_OPTIONS.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={[
            'flex-1 h-10 rounded-lg text-xs font-semibold border transition active:scale-95',
            value === t
              ? 'bg-accent text-white border-accent'
              : 'bg-white text-neutral-700 border-neutral-200',
          ].join(' ')}
        >
          {GOAL_TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

function MyMemberRow({ member }: { member: Member }) {
  const updateMyProfile = useTeamStore((s) => s.updateMyProfile);
  const removeMyself = useTeamStore((s) => s.removeMyself);
  const cert = useTeamStore((s) => certScore(s.certifications, member.id));

  // Treat goalStart=0 the same as unset: weight / body-fat / muscle are
  // never legitimately 0, and a stale zero there is what produced the
  // fake 100% score bug.
  const startUnset = !member.goalStart || member.goalStart <= 0;
  const isBrandNew =
    startUnset && !member.goalCurrent && !member.goalTarget;
  const [draft, setDraft] = useState<Draft>({
    name: member.name,
    goalType: member.goalType ?? 'weight',
    goalStart: startUnset ? '' : String(member.goalStart),
    goalTarget: isBrandNew ? '' : String(member.goalTarget || ''),
    goalCurrent: isBrandNew ? '' : String(member.goalCurrent || ''),
    goalUnit: member.goalUnit || '',
  });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onSave = async () => {
    const err = validate(draft);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const currentNum = Number(draft.goalCurrent);
    const startNum = draft.goalStart.trim() === '' ? currentNum : Number(draft.goalStart);
    await updateMyProfile({
      name: draft.name.trim(),
      goalType: draft.goalType,
      goalStart: startNum,
      goalTarget: Number(draft.goalTarget),
      goalCurrent: currentNum,
      goalUnit: draft.goalUnit.trim() || GOAL_TYPE_DEFAULT_UNIT[draft.goalType],
    });
    setEditing(false);
  };

  return (
    <article className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-neutral-900 truncate">{member.name}</p>
            {member.isLeader && (
              <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                👑 리더
              </span>
            )}
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
              {GOAL_TYPE_LABEL[member.goalType ?? 'weight']}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            시작 {member.goalStart ?? member.goalCurrent} → 현재 {member.goalCurrent} / 목표{' '}
            {member.goalTarget} {member.goalUnit} · 목표 {goalScore(member)}점 · 인증{' '}
            {cert}점
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setError(null);
            }}
            className="h-10 px-3 rounded-lg text-sm text-accent border border-accent/30 active:scale-95"
          >
            {editing ? '접기' : '수정'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-10 px-3 rounded-lg text-sm text-red-600 border border-red-200 active:scale-95"
            title="내 계정 삭제"
          >
            탈퇴
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-2">
          <label className="block">
            <span className="text-xs text-neutral-500">이름</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </label>
          <div className="block">
            <span className="text-xs text-neutral-500">측정 유형</span>
            <div className="mt-1">
              <GoalTypeSelect
                value={draft.goalType}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    goalType: v,
                    goalUnit: d.goalUnit || GOAL_TYPE_DEFAULT_UNIT[v],
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">시작치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalStart}
                onChange={(e) => setDraft({ ...draft, goalStart: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">현재치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalCurrent}
                onChange={(e) => setDraft({ ...draft, goalCurrent: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">목표치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalTarget}
                onChange={(e) => setDraft({ ...draft, goalTarget: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">단위</span>
              <input
                value={draft.goalUnit}
                onChange={(e) => setDraft({ ...draft, goalUnit: e.target.value })}
                placeholder="kg"
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1"
              />
            </label>
          </div>
          <p className="text-[11px] text-neutral-400">
            진행률 = (현재 − 시작) / (목표 − 시작). 시작치와 목표치가 같으면 진행률을 계산할 수 없어요.
          </p>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onSave}
            className="w-full h-11 rounded-lg bg-accent text-white font-semibold active:scale-95"
          >
            저장
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="탈퇴"
        message={`정말 탈퇴하시겠습니까?\n'${member.name}' 님의 모든 인증 기록도 삭제됩니다.`}
        confirmLabel="탈퇴"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await removeMyself();
          setConfirmDelete(false);
        }}
      />
    </article>
  );
}

function OtherMemberRow({ member, isLeader }: { member: Member; isLeader: boolean }) {
  const cert = useTeamStore((s) => certScore(s.certifications, member.id));
  const deleteMember = useTeamStore((s) => s.deleteMember);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteMember(member.id);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <article className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-neutral-900 truncate">{member.name}</p>
            {member.isLeader && (
              <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                👑 리더
              </span>
            )}
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
              {GOAL_TYPE_LABEL[member.goalType ?? 'weight']}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            시작 {member.goalStart ?? member.goalCurrent} → 현재 {member.goalCurrent} / 목표{' '}
            {member.goalTarget} {member.goalUnit} · 목표 {goalScore(member)}점 · 인증{' '}
            {cert}점
          </p>
        </div>
        {isLeader ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="h-8 px-3 rounded-lg text-xs text-red-600 border border-red-200 active:scale-95 transition disabled:opacity-60 shrink-0"
          >
            삭제
          </button>
        ) : (
          <span className="text-[10px] text-neutral-400 whitespace-nowrap">팀원</span>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="팀원 삭제"
        message={`${member.name} 님을 삭제하면 해당 팀원의 인증 기록도 모두 삭제됩니다. 계속할까요?`}
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}

function AddMemberForm({ onClose }: { onClose: () => void }) {
  const createMember = useTeamStore((s) => s.createMember);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r: AuthResult = await createMember({ name, password });
    setBusy(false);
    if (!r.ok) {
      if (r.reason === 'name-empty') setError('이름을 입력해주세요');
      else if (r.reason === 'password-empty') setError('비밀번호를 입력해주세요');
      else if (r.reason === 'name-exists') setError('이미 같은 이름의 팀원이 있어요');
      else setError('추가에 실패했어요. 다시 시도해주세요.');
      return;
    }
    onClose();
  };

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-sm text-neutral-800">팀원 추가</p>
      <div>
        <label className="block text-xs text-neutral-500 mb-1">이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          autoFocus
          className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 mb-1">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="팀원이 로그인할 비밀번호"
          className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-11 rounded-xl border border-neutral-200 text-sm text-neutral-600 active:scale-95 transition"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 h-11 rounded-xl bg-accent text-white text-sm font-semibold active:scale-95 transition disabled:opacity-60"
        >
          {busy ? '추가 중…' : '추가'}
        </button>
      </div>
    </form>
  );
}

export default function GoalsPage() {
  const members = useTeamStore((s) => s.members);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const me = members.find((m) => m.id === currentMemberId);
  const others = members.filter((m) => m.id !== currentMemberId);
  const amLeader = me?.isLeader ?? false;

  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <main className="px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-neutral-900">목표 설정</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          팀원 {members.length}명 · 내 목표만 수정 가능
        </p>
      </header>

      <TeamChallengeSection />

      {me && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-neutral-500 mb-2">내 목표</h2>
          <MyMemberRow member={me} />
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-500">팀원 목표</h2>
            {amLeader && !showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="text-xs text-accent font-medium active:scale-95 transition"
              >
                + 팀원 추가
              </button>
            )}
          </div>
          {showAddForm && (
            <div className="mb-3">
              <AddMemberForm onClose={() => setShowAddForm(false)} />
            </div>
          )}
          <ul className="space-y-3">
            {others.map((m) => (
              <li key={m.id}>
                <OtherMemberRow member={m} isLeader={amLeader} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length === 0 && amLeader && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-500">팀원</h2>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="text-xs text-accent font-medium active:scale-95 transition"
              >
                + 팀원 추가
              </button>
            )}
          </div>
          {showAddForm ? (
            <AddMemberForm onClose={() => setShowAddForm(false)} />
          ) : (
            <p className="text-sm text-neutral-400 py-6 text-center rounded-xl border border-dashed border-neutral-200">
              아직 다른 팀원이 없어요
            </p>
          )}
        </section>
      )}
    </main>
  );
}
