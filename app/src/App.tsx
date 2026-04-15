import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTeamStore, type Member } from './store/useTeamStore';
import { goalScore } from './store/score';
import BottomTabs from './components/BottomTabs';
import CelebrationModal from './components/CelebrationModal';
import OnboardingTour from './components/OnboardingTour';
import LoginPage from './pages/LoginPage';
import TeamOnboardingPage from './pages/TeamOnboardingPage';
import RankingPage from './pages/RankingPage';
import CertifyPage from './pages/CertifyPage';
import RecordsPage from './pages/RecordsPage';
import GoalsPage from './pages/GoalsPage';
import MemberDetailPage from './pages/MemberDetailPage';
import NotFoundPage from './pages/NotFoundPage';

function RequireTeamAndMember({ children }: { children: React.ReactNode }) {
  const currentTeamId = useTeamStore((s) => s.currentTeamId);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const location = useLocation();
  if (!currentTeamId) {
    return <Navigate to="/team" replace state={{ from: location.pathname }} />;
  }
  if (!currentMemberId) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function CelebrationWatcher() {
  const members = useTeamStore((s) => s.members);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const markCelebrated = useTeamStore((s) => s.markCelebrated);
  const [celebrating, setCelebrating] = useState<Member | null>(null);

  useEffect(() => {
    if (celebrating) return;
    if (!currentMemberId) return;
    // Only trigger for the CURRENT user reaching 100. Other teammates'
    // achievements must not pop up on my screen (those get celebrated on
    // their own device when they do the transition).
    const me = members.find((m) => m.id === currentMemberId);
    if (!me) return;
    if (goalScore(me) !== 100) return;
    if (me.celebrated) return;
    setCelebrating(me);
    markCelebrated(me.id);
  }, [members, celebrating, markCelebrated, currentMemberId]);

  return <CelebrationModal member={celebrating} onClose={() => setCelebrating(null)} />;
}

function TourGate() {
  const members = useTeamStore((s) => s.members);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);
  const markTourCompleted = useTeamStore((s) => s.markTourCompleted);
  const [dismissed, setDismissed] = useState(false);
  const me = members.find((m) => m.id === currentMemberId);
  if (!me || me.tourCompleted || dismissed) return null;
  return (
    <OnboardingTour
      onDone={() => {
        setDismissed(true);
        void markTourCompleted();
      }}
    />
  );
}

export default function App() {
  const currentTeamId = useTeamStore((s) => s.currentTeamId);
  const currentMemberId = useTeamStore((s) => s.currentMemberId);

  return (
    <div className="min-h-full bg-white text-neutral-900">
      <Routes>
        <Route
          path="/team"
          element={currentTeamId ? <Navigate to="/login" replace /> : <TeamOnboardingPage />}
        />
        <Route
          path="/login"
          element={
            !currentTeamId ? (
              <Navigate to="/team" replace />
            ) : currentMemberId ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/"
          element={
            <RequireTeamAndMember>
              <RankingPage />
            </RequireTeamAndMember>
          }
        />
        <Route
          path="/certify"
          element={
            <RequireTeamAndMember>
              <CertifyPage />
            </RequireTeamAndMember>
          }
        />
        <Route
          path="/records"
          element={
            <RequireTeamAndMember>
              <RecordsPage />
            </RequireTeamAndMember>
          }
        />
        <Route
          path="/goals"
          element={
            <RequireTeamAndMember>
              <GoalsPage />
            </RequireTeamAndMember>
          }
        />
        <Route
          path="/member/:id"
          element={
            <RequireTeamAndMember>
              <MemberDetailPage />
            </RequireTeamAndMember>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {currentMemberId && <BottomTabs />}
      {currentMemberId && <CelebrationWatcher />}
      {currentMemberId && <TourGate />}
    </div>
  );
}
