import { useState } from 'react';
import {
  useTeamStore,
  type Member,
  type GoalType,
  GOAL_TYPE_LABEL,
  GOAL_TYPE_DEFAULT_UNIT,
} from '../store/useTeamStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { goalScore } from '../store/score';
import TeamChallengeSection from '../components/TeamChallengeSection';

type Draft = {
  name: string;
  goalType: GoalType;
  goalStart: string;
  goalTarget: string;
  goalCurrent: string;
  goalUnit: string;
};

const emptyDraft: Draft = {
  name: '',
  goalType: 'weight',
  goalStart: '',
  goalTarget: '',
  goalCurrent: '',
  goalUnit: 'kg',
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

function MemberRow({ member }: { member: Member }) {
  const updateMember = useTeamStore((s) => s.updateMember);
  const removeMember = useTeamStore((s) => s.removeMember);
  const certsCount = useTeamStore(
    (s) => s.certifications.filter((c) => c.memberId === member.id).length
  );

  const [draft, setDraft] = useState<Draft>({
    name: member.name,
    goalType: member.goalType ?? 'weight',
    goalStart: String(member.goalStart ?? member.goalCurrent ?? ''),
    goalTarget: String(member.goalTarget || ''),
    goalCurrent: String(member.goalCurrent || ''),
    goalUnit: member.goalUnit || '',
  });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onSave = () => {
    const err = validate(draft);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const currentNum = Number(draft.goalCurrent);
    const startNum =
      draft.goalStart.trim() === '' ? currentNum : Number(draft.goalStart);
    updateMember(member.id, {
      name: draft.name.trim(),
      goalType: draft.goalType,
      goalStart: startNum,
      goalTarget: Number(draft.goalTarget),
      goalCurrent: currentNum,
      goalUnit: draft.goalUnit.trim(),
    });
    setEditing(false);
  };

  return (
    <article className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-neutral-900 truncate">{member.name}</p>
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
              {GOAL_TYPE_LABEL[member.goalType ?? 'weight']}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            시작 {member.goalStart ?? member.goalCurrent} → 현재 {member.goalCurrent} / 목표 {member.goalTarget} {member.goalUnit} · 목표 {goalScore(member)}점 · 인증 {certsCount * 10}점
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
          >
            삭제
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
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">현재치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalCurrent}
                onChange={(e) => setDraft({ ...draft, goalCurrent: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">목표치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalTarget}
                onChange={(e) => setDraft({ ...draft, goalTarget: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">단위</span>
              <input
                value={draft.goalUnit}
                onChange={(e) => setDraft({ ...draft, goalUnit: e.target.value })}
                placeholder="kg"
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
          </div>
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
        title="팀원 삭제"
        message={`정말 삭제하시겠습니까?\n'${member.name}' 님의 인증 기록도 모두 삭제됩니다.`}
        confirmLabel="삭제"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          removeMember(member.id);
          setConfirmDelete(false);
        }}
      />
    </article>
  );
}

export default function GoalsPage() {
  const members = useTeamStore((s) => s.members);
  const addMember = useTeamStore((s) => s.addMember);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = () => {
    const err = validate(draft);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const currentNum = Number(draft.goalCurrent);
    const startNum =
      draft.goalStart.trim() === '' ? currentNum : Number(draft.goalStart);
    addMember({
      name: draft.name.trim(),
      goalType: draft.goalType,
      goalStart: startNum,
      goalTarget: Number(draft.goalTarget),
      goalCurrent: currentNum,
      goalUnit: draft.goalUnit.trim() || GOAL_TYPE_DEFAULT_UNIT[draft.goalType],
    });
    setDraft(emptyDraft);
    setAdding(false);
  };

  return (
    <main className="px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="mb-5 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">목표 설정</h1>
          <p className="text-sm text-neutral-500 mt-0.5">팀원 {members.length}명</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
          className="h-10 px-4 rounded-lg bg-accent text-white text-sm font-semibold active:scale-95"
        >
          {adding ? '닫기' : '+ 추가'}
        </button>
      </header>

      {/* Team Challenge */}
      <TeamChallengeSection />

      {adding && (
        <div className="mb-4 bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
          <label className="block">
            <span className="text-xs text-neutral-500">이름</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              placeholder="홍길동"
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
                    goalUnit: GOAL_TYPE_DEFAULT_UNIT[v],
                  }))
                }
              />
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            시작치는 생략하면 현재치가 자동 기준이 돼요. 진행률 = (현재 − 시작) / (목표 − 시작).
          </p>
          <div className="grid grid-cols-4 gap-2">
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">시작치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalStart}
                onChange={(e) => setDraft({ ...draft, goalStart: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="선택"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">현재치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalCurrent}
                onChange={(e) => setDraft({ ...draft, goalCurrent: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="0"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">목표치</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.goalTarget}
                onChange={(e) => setDraft({ ...draft, goalTarget: e.target.value })}
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="100"
              />
            </label>
            <label className="block col-span-1">
              <span className="text-xs text-neutral-500">단위</span>
              <input
                value={draft.goalUnit}
                onChange={(e) => setDraft({ ...draft, goalUnit: e.target.value })}
                placeholder="kg"
                className="w-full h-11 rounded-lg border border-neutral-200 px-3 mt-1 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onAdd}
            className="w-full h-11 rounded-lg bg-accent text-white font-semibold active:scale-95"
          >
            팀원 추가
          </button>
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-neutral-600">아직 팀원이 없어요</p>
          <p className="text-sm text-neutral-400 mt-1">+ 추가 버튼으로 팀원을 등록하세요</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id}>
              <MemberRow member={m} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
