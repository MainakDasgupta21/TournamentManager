import { useRef } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUploadImage } from '@/hooks/queries';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Image picker that uploads to the server and stores the returned URL. Users
 * can also paste a URL directly. `variant` controls the preview shape.
 */
export default function ImageUpload({ label, value, onChange, hint, variant = 'logo' }) {
  const fileRef = useRef(null);
  const upload = useUploadImage();

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    try {
      const url = await upload.mutateAsync(file);
      onChange(url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const isBanner = variant === 'banner';

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary/40',
            isBanner ? 'h-16 w-28' : 'h-16 w-16'
          )}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                <X /> Remove
              </Button>
            )}
          </div>
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… or upload a file"
          />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
