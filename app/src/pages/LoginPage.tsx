import { useState, useMemo } from 'react';
import { useTeamStore, type GoalType, GOAL_TYPE_LABEL, GOAL_TYPE_DEFAULT_UNIT } from '../store/useTeamStore';

type Mode = 'login' | 'signup';

const GOAL_TYPE_OPTIONS: GoalType[] = ['weight', 'bodyFat', 'skeletalMuscle'];

export default function LoginPage() {
  const members = useTeamStore((s) => s.members);
  const teamName = useTeamStore((s) => s.currentTeamName);
  const teamCode = useTeamStore((s) => s.currentTeamCode);
  const login = useTeamStore((s) => s.login);
  const signup = useTeamStore((s) => s.signup);
  const leaveTeam = useTeamStore((s) => s.leaveTeam);

  const [mode, setMode] = useState<Mode>(members.length === 0 ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('weight');
  const [goalStart, setGoalStart] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existingNames = useMemo(() => members.map((m) => m.name), [members]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!password) {
      setError('비밀번호를 입력해주세요');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (password !== passwordConfirm) {
          setError('비밀번호 확인이 일치하지 않습니다');
          return;
        }
        if (password.length < 4) {
          setError('비밀번호는 4자 이상이어야 합니다');
          return;
        }
        const r = await signup({
          name: trimmed,
          password,
          goalType,
          goalStart: goalStart.trim() === '' ? undefined : Number(goalStart),
          goalTarget: goalTarget.trim() === '' ? undefined : Number(goalTarget),
          goalCurrent: goalCurrent.trim() === '' ? undefined : Number(goalCurrent),
          goalUnit: GOAL_TYPE_DEFAULT_UNIT[goalType],
        });
        if (!r.ok) {
          if (r.reason === 'name-exists') {
            setError('이미 사용 중인 이름이에요. 로그인 탭을 이용해주세요.');
          } else if (r.reason === 'network') {
            setError('서버 연결 실패');
          } else {
            setError('회원가입 실패');
          }
        }
      } else {
        const r = await login(trimmed, password);
        if (!r.ok) {
          if (r.reason === 'not-found') {
            setError('해당 이름의 계정이 없어요. 회원가입 탭을 이용해주세요.');
          } else if (r.reason === 'wrong-password') {
            setError('비밀번호가 올바르지 않습니다');
          } else if (r.reason === 'network') {
            setError('서버 연결 실패');
          } else {
            setError('로그인 실패');
          }
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-white text-2xl font-bold mb-3">
            FT
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Team Fit-Track</h1>
          <p className="text-xs text-neutral-500 mt-1">
            팀: <span className="font-semibold text-neutral-800">{teamName}</span>
            <span className="mx-1">·</span>
            <span className="font-mono">{teamCode}</span>
          </p>
          <button
            type="button"
            onClick={leaveTeam}
            className="text-[11px] text-neutral-400 underline mt-1"
          >
            다른 팀 선택
          </button>
        </div>

        <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 mb-5" role="tablist">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={[
                'flex-1 h-10 rounded-lg text-sm font-semibold transition',
                mode === m ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500',
              ].join(' ')}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="login-name">
              이름
            </label>
            <input
              id="login-name"
              type="text"
              autoComplete="username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full h-12 rounded-xl border border-neutral-200 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="login-password">
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="4자 이상"
              className="w-full h-12 rounded-xl border border-neutral-200 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>

          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="login-password-confirm">
                  비밀번호 확인
                </label>
                <input
                  id="login-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full h-12 rounded-xl border border-neutral-200 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </div>

              <details className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-neutral-700 list-none flex justify-between items-center">
                  <span>목표 미리 설정 (선택)</span>
                  <span className="text-xs text-neutral-400">펼치기</span>
                </summary>
                <div className="pt-3 space-y-3">
                  <div>
                    <span className="text-xs text-neutral-500">측정 유형</span>
                    <div className="flex gap-2 mt-1" role="radiogroup">
                      {GOAL_TYPE_OPTIONS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={goalType === t}
                          onClick={() => setGoalType(t)}
                          className={[
                            'flex-1 h-9 rounded-lg text-xs font-semibold border',
                            goalType === t
                              ? 'bg-accent text-white border-accent'
                              : 'bg-white text-neutral-700 border-neutral-200',
                          ].join(' ')}
                        >
                          {GOAL_TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-xs text-neutral-500">시작치</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={goalStart}
                        onChange={(e) => setGoalStart(e.target.value)}
                        className="w-full h-10 rounded-lg border border-neutral-200 px-3 mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-neutral-500">현재치</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={goalCurrent}
                        onChange={(e) => setGoalCurrent(e.target.value)}
                        className="w-full h-10 rounded-lg border border-neutral-200 px-3 mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-neutral-500">목표치</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(e.target.value)}
                        className="w-full h-10 rounded-lg border border-neutral-200 px-3 mt-1"
                      />
                    </label>
                  </div>
                </div>
              </details>
            </>
          )}

          {mode === 'login' && existingNames.length > 0 && (
            <div className="text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
              팀원: {existingNames.join(', ')}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold active:scale-95 transition disabled:opacity-60"
          >
            {busy ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </main>
  );
}
