import { useState } from 'react';
import {
  useTeamStore,
  type Member,
  type GoalType,
  GOAL_TYPE_LABEL,
  GOAL_TYPE_DEFAULT_UNIT,
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

function OtherMemberRow({ member }: { member: Member }) {
  const cert = useTeamStore((s) => certScore(s.certifications, member.id));
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
        <span className="text-[10px] text-neutral-400 whitespace-nowrap">팀원</span>
      </div>
    </article>
  );
}

export default function GoalsPage() {
  const members = useTeamStore((s) => s.members);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const me = members.find((m) => m.id === currentMemberId);
  const others = members.filter((m) => m.id !== currentMemberId);

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
          <h2 className="text-sm font-semibold text-neutral-500 mb-2">팀원 목표</h2>
          <ul className="space-y-3">
            {others.map((m) => (
              <li key={m.id}>
                <OtherMemberRow member={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
