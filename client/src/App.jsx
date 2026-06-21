import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/store/auth';

// Eagerly loaded: the public shell + landing page are needed for the first paint
// on the most common (anonymous) entry point, plus the tiny route guards.
import PublicLayout from '@/components/layout/PublicLayout';
import Home from '@/pages/public/Home';
import ProtectedRoute, { SuperAdminRoute } from '@/components/ProtectedRoute';

// Everything else is code-split so anonymous visitors never download the admin
// app (and vice-versa). React.lazy requires default exports, which every page
// module provides. A single Suspense boundary below covers all of them.
const PublicTournamentLayout = lazy(() => import('@/pages/public/PublicTournamentLayout'));
const TournamentHub = lazy(() => import('@/pages/public/TournamentHub'));
const StandingsPage = lazy(() => import('@/pages/public/StandingsPage'));
const FixturesPage = lazy(() => import('@/pages/public/FixturesPage'));
const BracketPage = lazy(() => import('@/pages/public/BracketPage'));
const LeaderboardsPage = lazy(() => import('@/pages/public/LeaderboardsPage'));
const TeamPage = lazy(() => import('@/pages/public/TeamPage'));
const PlayerPage = lazy(() => import('@/pages/public/PlayerPage'));
const MatchCenter = lazy(() => import('@/pages/public/MatchCenter'));
const NotFound = lazy(() => import('@/pages/public/NotFound'));

const Login = lazy(() => import('@/pages/admin/Login'));
const Signup = lazy(() => import('@/pages/admin/Signup'));
const ForgotPassword = lazy(() => import('@/pages/admin/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/admin/ResetPassword'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AccessRequests = lazy(() => import('@/pages/admin/AccessRequests'));
const TournamentAccessRequests = lazy(() => import('@/pages/admin/TournamentAccessRequests'));
const AccountSettings = lazy(() => import('@/pages/admin/AccountSettings'));
const NewTournament = lazy(() => import('@/pages/admin/NewTournament'));
const AdminTournamentLayout = lazy(() => import('@/pages/admin/AdminTournamentLayout'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminSetup = lazy(() => import('@/pages/admin/AdminSetup'));
const AdminTeams = lazy(() => import('@/pages/admin/AdminTeams'));
const AdminGroups = lazy(() => import('@/pages/admin/AdminGroups'));
const AdminFixtures = lazy(() => import('@/pages/admin/AdminFixtures'));
const AdminKnockout = lazy(() => import('@/pages/admin/AdminKnockout'));
const AdminCollaborators = lazy(() => import('@/pages/admin/AdminCollaborators'));
const AdminAuditLog = lazy(() => import('@/pages/admin/AdminAuditLog'));

/** Lightweight fallback shown while a route chunk loads. */
function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);

  // Attempt to restore the session from the refresh cookie on first load.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <Suspense fallback={<RouteFallback />}>
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
          <Route
            path="users"
            element={(
              <SuperAdminRoute>
                <AccessRequests />
              </SuperAdminRoute>
            )}
          />
          <Route
            path="tournament-access"
            element={(
              <SuperAdminRoute>
                <TournamentAccessRequests />
              </SuperAdminRoute>
            )}
          />
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
    </Suspense>
  );
}
