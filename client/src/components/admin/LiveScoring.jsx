import { useTeam } from '@/hooks/queries';
import { SPORTS } from '@tms/shared/constants';
import { DialogContent } from '@/components/ui/dialog';
import { Loading } from '@/components/ui/misc';
import CricketConsole from './CricketConsole';
import FootballConsole from './FootballConsole';

/**
 * Sport-aware live scoring console. Loads both teams' rosters (so events can be
 * attributed to players) then mounts the cricket ball-by-ball or football
 * event-by-event console. Every committed event broadcasts over Socket.io.
 */
export default function LiveScoring({ tournament, tournamentId, fixture, onClose }) {
  const teamAId = fixture.teamA?._id;
  const teamBId = fixture.teamB?._id;
  const a = useTeam(tournamentId, teamAId);
  const b = useTeam(tournamentId, teamBId);

  const ready = a.isSuccess && b.isSuccess;
  const rosterByTeam = {
    [teamAId]: a.data?.players ?? [],
    [teamBId]: b.data?.players ?? [],
  };
  const teamsById = {
    [teamAId]: fixture.teamA,
    [teamBId]: fixture.teamB,
  };

  const Console = tournament.sportType === SPORTS.CRICKET ? CricketConsole : FootballConsole;

  return (
    <DialogContent className="max-w-2xl">
      {!ready ? (
        <div className="py-10"><Loading label="Loading rosters…" /></div>
      ) : (
        <Console
          // Force a fresh mount per fixture so the console never resumes another
          // match's innings/event state (its initial state is seeded once).
          key={fixture._id}
          tournament={tournament}
          tournamentId={tournamentId}
          fixture={fixture}
          rosterByTeam={rosterByTeam}
          teamsById={teamsById}
          onClose={onClose}
        />
      )}
    </DialogContent>
  );
}
