import { Share2, Printer, ImageDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { buildResultCardSvg, svgToPngBlob, downloadBlob } from '@/lib/resultCard';
import { slugify } from '@/lib/exportCsv';

/**
 * Share / print / save-image actions for a match. Save-image renders a
 * self-contained SVG result card to PNG; print relies on the page's
 * `#print-root` + print stylesheet.
 */
export default function MatchShareBar({ card, canSaveImage = false, className }) {
  const onShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${card.teamAName} vs ${card.teamBName}`, url });
        return;
      }
    } catch {
      return; // user dismissed
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Match link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const onSaveImage = async () => {
    try {
      const svg = buildResultCardSvg(card);
      const blob = await svgToPngBlob(svg);
      downloadBlob(`${slugify(`${card.teamAName}-vs-${card.teamBName}`, 'result')}.png`, blob);
      toast.success('Result card downloaded');
    } catch {
      toast.error('Could not generate the image');
    }
  };

  return (
    <div className={`no-print flex items-center gap-2 ${className ?? ''}`}>
      <Button variant="outline" size="sm" onClick={onShare}>
        <Share2 /> Share
      </Button>
      {canSaveImage && (
        <Button variant="outline" size="sm" onClick={onSaveImage}>
          <ImageDown /> Save image
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer /> Print
      </Button>
    </div>
  );
}
