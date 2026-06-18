import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateTournament } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import TournamentForm from '@/components/admin/TournamentForm';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

export default function NewTournament() {
  const navigate = useNavigate();
  const create = useCreateTournament();
  useDocumentTitle('New tournament · Admin');

  const onSubmit = async (payload) => {
    try {
      const t = await create.mutateAsync(payload);
      toast.success('Tournament created');
      navigate(`/admin/t/${t._id}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New tournament"
        description="Create a new competition with the right sport, format, and schedule settings."
        className="mb-6"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin"><ArrowLeft /> Back to dashboard</Link>
          </Button>
        }
      />
      <TournamentForm onSubmit={onSubmit} submitting={create.isPending} submitLabel="Create tournament" />
    </div>
  );
}
