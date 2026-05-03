import { useEffect, useState } from 'react';
import { useTeamStore } from '../store/useTeamStore';
import { supabase } from '../lib/supabase';

type Mode = 'home' | 'create' | 'created';

type TeamInfo = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  challengeTitle?: string;
};

export default function TeamOnboardingPage() {
  const createTeam = useTeamStore((s) => s.createTeam);
  const joinTeam = useTeamStore((s) => s.joinTeam);

  const [mode, setMode] = useState<Mode>('home');
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuedTeamName, setIssuedTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingTeams(true);
    (async () => {
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, code, created_at')
        .order('created_at');
      if (cancelled || !teamsData) {
        setLoadingTeams(false);
        return;
      }
      const enriched = await Promise.all(
        teamsData.map(async (t) => {
          const [{ count }, { data: chal }] = await Promise.all([
            supabase
              .from('members')
              .select('id', { count: 'exact', head: true })
              .eq('team_id', t.id),
            supabase
              .from('team_challenges')
              .select('title')
              .eq('team_id', t.id)
              .maybeSingle(),
          ]);
          return {
            id: t.id,
            name: t.name,
            code: t.code,
            memberCount: count ?? 0,
            challengeTitle: chal?.title ?? undefined,
          };
        })
      );
      if (!cancelled) {
        setTeams(enriched);
        setLoadingTeams(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const onJoin = async (code: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const r = await joinTeam(code);
    setBusy(false);
    if (!r.ok) {
      setError(
        r.reason === 'team-not-found'
          ? '해당 코드의 팀을 찾을 수 없어요'
          : '팀 참여에 실패했어요.'
      );
    }
  };

  const onJoinForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await onJoin(joinCode);
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
          <p className="text-sm text-neutral-500 mt-1">참여할 팀을 선택하세요</p>
        </div>

        {mode === 'home' && (
          <div className="space-y-4">
            {/* 팀 리스트 */}
            {loadingTeams ? (
              <div className="py-8 text-center text-sm text-neutral-400">팀 목록 불러오는 중…</div>
            ) : teams.length === 0 ? (
              <div className="py-6 text-center text-sm text-neutral-400 rounded-xl border border-dashed border-neutral-200">
                아직 팀이 없어요
              </div>
            ) : (
              <ul className="space-y-2">
                {teams.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onJoin(t.code)}
                      className="w-full text-left rounded-xl border border-neutral-200 px-4 py-3 hover:border-accent hover:bg-accent/5 active:scale-[0.99] transition disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900">{t.name}</span>
                        <span className="text-[11px] font-mono text-neutral-400">{t.code}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                        <span>팀원 {t.memberCount}명</span>
                        {t.challengeTitle && (
                          <span className="truncate">🏆 {t.challengeTitle}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* 코드 직접 입력 */}
            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400 shrink-0">코드 직접 입력</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <form onSubmit={onJoinForm} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="팀 코드"
                className="flex-1 h-12 rounded-xl border border-neutral-200 px-4 font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                maxLength={12}
              />
              <button
                type="submit"
                disabled={busy || !joinCode.trim()}
                className="h-12 px-5 rounded-xl bg-accent text-white font-semibold active:scale-95 transition disabled:opacity-60"
              >
                {busy ? '…' : '참여'}
              </button>
            </form>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            {/* 새 팀 만들기 */}
            <div className="relative flex items-center gap-2 pt-1">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400 shrink-0">또는</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <button
              type="button"
              onClick={() => { setMode('create'); setError(null); }}
              className="w-full h-12 rounded-xl border border-neutral-300 text-neutral-700 font-semibold text-sm active:scale-[0.98] transition"
            >
              + 새 팀 만들기
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={onCreate} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode('home'); setError(null); }}
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
                팀 코드 (3~12자리 숫자)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="예: 20260501"
                maxLength={12}
                className="w-full h-12 rounded-xl border border-neutral-200 px-4 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                팀원에게 공유할 숫자 코드예요. 팀원들은 이 코드로 참여합니다.
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
              onClick={() => { window.location.href = '/'; }}
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
