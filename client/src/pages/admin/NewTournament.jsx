import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateTournament } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import TournamentForm from '@/components/admin/TournamentForm';
import { Button } from '@/components/ui/button';

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
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/admin"><ArrowLeft /> Back</Link>
      </Button>
      <h1 className="mb-6 font-display text-4xl tracking-wide">New tournament</h1>
      <TournamentForm onSubmit={onSubmit} submitting={create.isPending} submitLabel="Create tournament" />
    </div>
  );
}
