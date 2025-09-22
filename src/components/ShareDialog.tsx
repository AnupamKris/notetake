import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export type PeerInfo = { name: string; ip: string; port: number; id: string };

type ShareDialogProps = {
  open: boolean;
  peers: PeerInfo[];
  busy?: boolean;
  title?: string;
  onRefresh: () => void;
  onClose: () => void;
  onSelect: (peer: PeerInfo) => void;
};

export default function ShareDialog({ open, peers, busy, title = "Select a receiver", onRefresh, onClose, onSelect }: ShareDialogProps) {
  useEffect(() => {
    if (open) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {peers.length === 0 ? (
            <div className="text-sm text-muted-foreground">{busy ? "Searching…" : "No receivers found yet."}</div>
          ) : (
            peers.map((p) => (
              <Button key={`${p.ip}:${p.port}`} variant="secondary" className="justify-between" onClick={() => onSelect(p)}>
                <span className="truncate">{p.name || p.ip}</span>
                <span className="text-muted-foreground text-xs">{p.ip}:{p.port}</span>
              </Button>
            ))
          )}
          <div className="mt-2 flex gap-2 justify-end">
            <Button variant="outline" onClick={onRefresh} disabled={!!busy}>Refresh</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

