import { useState } from 'react';
import { useTeamStore } from '../store/useTeamStore';

type Mode = 'choose' | 'create' | 'join' | 'created';

export default function TeamOnboardingPage() {
  const createTeam = useTeamStore((s) => s.createTeam);
  const joinTeam = useTeamStore((s) => s.joinTeam);

  const [mode, setMode] = useState<Mode>('choose');
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuedTeamName, setIssuedTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const r = await createTeam(teamName, teamCode);
    setBusy(false);
    if (!r.ok) {
      if (r.reason === 'team-name-empty') setError('팀 이름을 입력해주세요');
      else if (r.reason === 'code-invalid') setError(r.message ?? '팀 코드가 올바르지 않아요');
      else if (r.reason === 'code-taken') setError('이미 사용 중인 팀 코드예요. 다른 코드로 시도해주세요.');
      else setError('팀 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setIssuedCode(r.code);
    setIssuedTeamName(teamName.trim());
    setMode('created');
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const r = await joinTeam(joinCode);
    setBusy(false);
    if (!r.ok) {
      setError(
        r.reason === 'team-not-found'
          ? '해당 코드의 팀을 찾을 수 없어요'
          : '팀 참여에 실패했어요.'
      );
    }
  };

  const copyCode = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
    } catch {
      // ignore
    }
  };

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-white text-2xl font-bold mb-4">
            FT
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Team Fit-Track</h1>
          <p className="text-sm text-neutral-500 mt-1">팀을 만들거나 참여해주세요</p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMode('create')}
              className="w-full h-14 rounded-xl bg-accent text-white font-semibold text-base active:scale-[0.98] transition"
            >
              + 새 팀 만들기
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className="w-full h-14 rounded-xl border border-neutral-300 text-neutral-800 font-semibold text-base active:scale-[0.98] transition"
            >
              팀 코드로 참여하기
            </button>
            <p className="text-[11px] text-neutral-400 text-center pt-3 leading-relaxed">
              팀을 만들면 팀 코드를 직접 정할 수 있어요.<br />
              이 코드를 팀원에게 공유하면 같은 팀에 합류할 수 있어요.<br />
              <span className="text-neutral-500">처음 만든 사람이 팀 리더 👑</span>
            </p>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={onCreate} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setMode('choose');
                setError(null);
              }}
              className="text-sm text-neutral-500 mb-2"
            >
              ← 뒤로
            </button>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                팀 이름
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="우리 크루"
                className="w-full h-12 rounded-xl border border-neutral-200 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                팀 코드 (3~12자, 영문·숫자)
              </label>
              <input
                type="text"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="예: CREW2026"
                maxLength={12}
                className="w-full h-12 rounded-xl border border-neutral-200 px-4 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                팀원에게 공유할 코드예요. 팀원들은 이 코드로 참여합니다.
              </p>
            </div>
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
              {busy ? '만드는 중…' : '팀 만들기'}
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={onJoin} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setMode('choose');
                setError(null);
              }}
              className="text-sm text-neutral-500 mb-2"
            >
              ← 뒤로
            </button>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                팀 코드 (6자리)
              </label>
              <input
                type="text"
                inputMode="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC234"
                className="w-full h-12 rounded-xl border border-neutral-200 px-4 tracking-[0.3em] font-mono text-center text-lg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                maxLength={6}
                autoFocus
              />
            </div>
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
              {busy ? '확인 중…' : '참여하기'}
            </button>
          </form>
        )}

        {mode === 'created' && issuedCode && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-accent/5 border border-accent/20 p-5 text-center">
              <p className="text-xs text-neutral-500 mb-2">팀이 만들어졌어요 🎉</p>
              <p className="font-bold text-neutral-900 mb-3">{issuedTeamName}</p>
              <p className="text-[11px] text-neutral-500">팀 코드</p>
              <p className="text-3xl font-mono tracking-[0.3em] font-bold text-accent mt-1 mb-3">
                {issuedCode}
              </p>
              <button
                type="button"
                onClick={copyCode}
                className="text-xs text-accent underline"
              >
                코드 복사
              </button>
            </div>
            <p className="text-xs text-neutral-500 text-center leading-relaxed">
              이 코드를 팀원에게 공유하세요.<br />
              다음 화면에서 본인 이름과 비밀번호로 가입하면 돼요.
            </p>
            <button
              type="button"
              onClick={() => {
                // Team is already set in store via createTeam; move to signup.
                window.location.href = '/';
              }}
              className="w-full h-12 rounded-xl bg-accent text-white font-semibold active:scale-95"
            >
              다음 — 가입하기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
