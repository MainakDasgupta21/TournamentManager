import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/store/auth';

import PublicLayout from '@/components/layout/PublicLayout';
import Home from '@/pages/public/Home';
import PublicTournamentLayout from '@/pages/public/PublicTournamentLayout';
import TournamentHub from '@/pages/public/TournamentHub';
import StandingsPage from '@/pages/public/StandingsPage';
import FixturesPage from '@/pages/public/FixturesPage';
import BracketPage from '@/pages/public/BracketPage';
import LeaderboardsPage from '@/pages/public/LeaderboardsPage';
import TeamPage from '@/pages/public/TeamPage';
import PlayerPage from '@/pages/public/PlayerPage';
import MatchCenter from '@/pages/public/MatchCenter';
import NotFound from '@/pages/public/NotFound';

import Login from '@/pages/admin/Login';
import Signup from '@/pages/admin/Signup';
import ForgotPassword from '@/pages/admin/ForgotPassword';
import ResetPassword from '@/pages/admin/ResetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/pages/admin/AdminLayout';
import Dashboard from '@/pages/admin/Dashboard';
import AccessRequests from '@/pages/admin/AccessRequests';
import TournamentAccessRequests from '@/pages/admin/TournamentAccessRequests';
import AccountSettings from '@/pages/admin/AccountSettings';
import NewTournament from '@/pages/admin/NewTournament';
import AdminTournamentLayout from '@/pages/admin/AdminTournamentLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminSetup from '@/pages/admin/AdminSetup';
import AdminTeams from '@/pages/admin/AdminTeams';
import AdminGroups from '@/pages/admin/AdminGroups';
import AdminFixtures from '@/pages/admin/AdminFixtures';
import AdminKnockout from '@/pages/admin/AdminKnockout';
import AdminCollaborators from '@/pages/admin/AdminCollaborators';
import AdminAuditLog from '@/pages/admin/AdminAuditLog';

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);

  // Attempt to restore the session from the refresh cookie on first load.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/t/:id" element={<PublicTournamentLayout />}>
          <Route index element={<TournamentHub />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="fixtures" element={<FixturesPage />} />
          <Route path="bracket" element={<BracketPage />} />
          <Route path="leaderboards" element={<LeaderboardsPage />} />
          <Route path="teams/:teamId" element={<TeamPage />} />
          <Route path="players/:playerId" element={<PlayerPage />} />
          <Route path="match/:fixtureId" element={<MatchCenter />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<AccessRequests />} />
        <Route path="tournament-access" element={<TournamentAccessRequests />} />
        <Route path="account" element={<AccountSettings />} />
        <Route path="new" element={<NewTournament />} />
        <Route path="t/:id" element={<AdminTournamentLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="setup" element={<AdminSetup />} />
          <Route path="teams" element={<AdminTeams />} />
          <Route path="groups" element={<AdminGroups />} />
          <Route path="fixtures" element={<AdminFixtures />} />
          <Route path="knockout" element={<AdminKnockout />} />
          <Route path="collaborators" element={<AdminCollaborators />} />
          <Route path="audit" element={<AdminAuditLog />} />
        </Route>
      </Route>
    </Routes>
  );
}
