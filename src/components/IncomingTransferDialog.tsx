import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type IncomingTransfer = {
  id: string;
  peer: string;
  kind: string;
  size: number;
  filename: string;
};

type Props = {
  open: boolean;
  offer?: IncomingTransfer | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onClose: () => void;
};

export default function IncomingTransferDialog({ open, offer, onAccept, onReject, onClose }: Props) {
  const prettySize = (n?: number) => {
    if (!n && n !== 0) return "";
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Incoming Share</DialogTitle>
        </DialogHeader>
        {offer ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full font-semibold">
                {offer.peer.split(":"[0] as any)?.[0]?.slice(0,2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{offer.peer}</div>
                <div className="text-muted-foreground text-xs truncate">{offer.filename} • {prettySize(offer.size)} • {offer.kind}</div>
              </div>
            </div>
            <div className="text-sm">Accept incoming notes?</div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onReject(offer.id)}>Reject</Button>
              <Button onClick={() => onAccept(offer.id)}>Accept</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

