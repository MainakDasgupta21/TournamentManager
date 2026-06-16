import { toast } from 'sonner';
import { useFixtureMutations } from '@/hooks/queries';
import { useConfirm } from '@/components/ui/confirm';
import { apiError } from '@/lib/api';

/**
 * Wraps the result-submit mutation with the Module 5B "downstream invalidation"
 * confirm flow: if editing a played knockout result changes the winner and a
 * later round was already decided, the server responds with `requiresConfirm`
 * and a list of affected matches. We ask the admin, then re-submit with
 * `confirm:true` to propagate (resetting the orphaned matches).
 */
export function useSubmitResult(tournamentId) {
  const { submitResult } = useFixtureMutations(tournamentId);
  const confirm = useConfirm();

  const submit = async ({ fixtureId, body, onDone }) => {
    try {
      let res = await submitResult.mutateAsync({ fixtureId, body });

      if (res?.requiresConfirm) {
        const affected = res.affected ?? [];
        const list = affected
          .map((a) => `#${a.matchNumber ?? '?'}${a.roundName ? ` (${a.roundName})` : ''}`)
          .join(', ');
        const ok = await confirm({
          title: 'Reset downstream knockout matches?',
          description:
            `This result change invalidates ${affected.length} already-played match(es): ${list}. ` +
            'Confirm to reset them to scheduled and re-advance the bracket from this result.',
          confirmLabel: 'Reset & propagate',
        });
        if (!ok) {
          toast('Result saved; downstream matches left unchanged');
          onDone?.();
          return;
        }
        res = await submitResult.mutateAsync({ fixtureId, body: { ...body, confirm: true } });
      }

      toast.success('Result saved');
      onDone?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return { submit, isPending: submitResult.isPending };
}
