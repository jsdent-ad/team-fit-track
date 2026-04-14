import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../store/useTeamStore';

const TEAM_PASSWORD = 'sd2026';

export default function LoginPage() {
  const navigate = useNavigate();
  const currentUser = useTeamStore((s) => s.currentUser);
  const login = useTeamStore((s) => s.login);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) navigate('/', { replace: true });
  }, [currentUser, navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('이름을 입력해주세요');
      return;
    }
    if (password !== TEAM_PASSWORD) {
      setError('팀 비밀번호가 올바르지 않습니다');
      return;
    }
    setSubmitting(true);
    login(trimmedName);
    // Navigate happens via useEffect once currentUser updates.
  };

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-white text-2xl font-bold mb-4">
            FT
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Team Fit-Track</h1>
          <p className="text-sm text-neutral-500 mt-1">오늘 운동 완료, 팀과 함께</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="login-password">
              팀 비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="팀 비밀번호 입력"
              className="w-full h-12 rounded-xl border border-neutral-200 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>

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

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold active:scale-95 transition disabled:opacity-60"
          >
            {submitting ? '로그인 중…' : '로그인'}
          </button>

          <p className="text-xs text-center text-neutral-400 pt-2">
            힌트: 팀 비밀번호는 <code className="font-mono">sd2026</code>
          </p>
        </form>
      </div>
    </main>
  );
}
