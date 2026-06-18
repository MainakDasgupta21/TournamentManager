import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Shared review modal for approve/decline actions with an optional audit note.
 */
export default function ReviewActionDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  confirmLabel,
  onConfirm,
  isSubmitting,
}) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) setNote('');
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    await onConfirm(note.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="review-note">Review note (optional)</Label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for audit history or follow-up."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This note is stored with the review decision.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={mode === 'reject' ? 'outline' : 'default'}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
