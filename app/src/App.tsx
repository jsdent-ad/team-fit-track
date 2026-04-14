import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTeamStore, type Member } from './store/useTeamStore';
import { goalScore } from './store/score';
import BottomTabs from './components/BottomTabs';
import CelebrationModal from './components/CelebrationModal';
import LoginPage from './pages/LoginPage';
import RankingPage from './pages/RankingPage';
import CertifyPage from './pages/CertifyPage';
import RecordsPage from './pages/RecordsPage';
import GoalsPage from './pages/GoalsPage';
import NotFoundPage from './pages/NotFoundPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const location = useLocation();
  if (!currentMemberId) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function CelebrationWatcher() {
  const members = useTeamStore((s) => s.members);
  const celebratedMemberIds = useTeamStore((s) => s.celebratedMemberIds);
  const markCelebrated = useTeamStore((s) => s.markCelebrated);
  const [celebrating, setCelebrating] = useState<Member | null>(null);

  useEffect(() => {
    if (celebrating) return;
    const achiever = members.find(
      (m) => goalScore(m) === 100 && !celebratedMemberIds.includes(m.id)
    );
    if (achiever) {
      setCelebrating(achiever);
      markCelebrated(achiever.id);
    }
  }, [members, celebratedMemberIds, celebrating, markCelebrated]);

  return (
    <CelebrationModal
      member={celebrating}
      onClose={() => setCelebrating(null)}
    />
  );
}

export default function App() {
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  return (
    <div className="min-h-full bg-white text-neutral-900">
      <Routes>
        <Route
          path="/login"
          element={currentMemberId ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <RankingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/certify"
          element={
            <RequireAuth>
              <CertifyPage />
            </RequireAuth>
          }
        />
        <Route
          path="/records"
          element={
            <RequireAuth>
              <RecordsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/goals"
          element={
            <RequireAuth>
              <GoalsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {currentMemberId && <BottomTabs />}
      {currentMemberId && <CelebrationWatcher />}
    </div>
  );
}
