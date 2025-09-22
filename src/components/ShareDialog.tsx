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
        <div className="flex flex-col gap-3">
          {peers.length === 0 ? (
            <div className="text-sm text-muted-foreground">{busy ? "Searching…" : "No receivers found yet."}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {peers.map((p) => (
                <button
                  key={`${p.ip}:${p.port}`}
                  onClick={() => onSelect(p)}
                  className="flex items-center gap-3 rounded-md border p-3 text-left hover:bg-muted/50"
                >
                  <div className="bg-muted text-foreground/80 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium">
                    {(p.name || p.ip).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name || p.ip}</div>
                    <div className="text-muted-foreground text-xs truncate">{p.ip}:{p.port}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 flex gap-2 justify-end">
            <Button variant="outline" onClick={onRefresh} disabled={!!busy}>{busy ? "Scanning…" : "Scan Again"}</Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
