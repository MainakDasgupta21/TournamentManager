import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { useUpdateTournament } from '@/hooks/queries';
import { apiError } from '@/lib/api';
import TournamentForm from '@/components/admin/TournamentForm';
import { PageHeader } from '@/components/ui/page-header';

export default function AdminSetup() {
  const { tournament, tournamentId } = useOutletContext();
  const update = useUpdateTournament(tournamentId);

  const onSubmit = async (payload) => {
    try {
      // Sport is fixed post-creation; the form locks it and we omit it here.
      const { sportType, ...rest } = payload;
      await update.mutateAsync(rest);
      toast.success('Tournament updated');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Setup & configuration"
        description="Update tournament metadata, rules, visual identity, and publication settings."
        className="mb-6"
      />
      <TournamentForm
        initial={tournament}
        onSubmit={onSubmit}
        submitting={update.isPending}
        submitLabel="Save changes"
        lockSport
      />
    </div>
  );
}
