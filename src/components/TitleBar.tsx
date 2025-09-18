import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "./ui/button";

type TitleBarProps = {
  className?: string;
  appName?: string;
  hasActiveNote?: boolean;
  canSave?: boolean;
  onNew?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onTogglePreview?: () => void;
  onOpenPalette?: () => void;
};

export function TitleBar({
  className,
  appName = "QuickMark",
  hasActiveNote,
  canSave,
  onNew,
  onSave,
  onDelete,
  onTogglePreview,
  onOpenPalette,
}: TitleBarProps) {
  const appWindow = getCurrentWindow();
  return (
    <div
      className={cn(
        "titlebar bg-card text-card-foreground border-border flex h-9 select-none items-center gap-2 border-b px-2 text-[13px]",
        className
      )}
      data-tauri-drag-region
    >
      <div className="no-drag">
        <Menubar className="h-7 text-[13px] border-none bg-card">
          <img
            src="/logo.png"
            alt="App logo"
            className="h-4 w-4 rounded-sm dark:invert mx-2"
          />
          <MenubarMenu>
            <MenubarTrigger className="px-2">File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={onNew}>
                New Note <MenubarShortcut>Ctrl+N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={onSave} disabled={!canSave}>
                Save <MenubarShortcut>Ctrl+S</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={onDelete} disabled={!hasActiveNote}>
                Delete <MenubarShortcut>Del</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => appWindow.close()}>Quit</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="px-2">View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={onTogglePreview} disabled={!hasActiveNote}>
                Toggle Preview <MenubarShortcut>Ctrl+\</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={onOpenPalette}>
                Command Palette… <MenubarShortcut>Ctrl+K</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="px-2">Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => appWindow.setFocus()}>
                About
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
      <div className="mx-auto flex items-center gap-2 truncate text-center opacity-70">
        <span>{appName}</span>
      </div>
      <div className="no-drag w-fit flex items-center gap-1">
        <ThemeToggle />
        <Button
          className="hover:bg-muted inline-flex size-7 items-center justify-center rounded-md"
          onClick={() => appWindow.minimize()}
          aria-label="Minimize"
          title="Minimize"
          variant="ghost"
          size="icon"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60"></span>
        </Button>
        <Button
          className="hover:bg-muted inline-flex size-7 items-center justify-center rounded-md"
          onClick={() => appWindow.toggleMaximize()}
          aria-label="Maximize"
          title="Maximize"
          variant="ghost"
          size="icon"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60"></span>
        </Button>
        <Button
          className="hover:bg-destructive/10 inline-flex size-7 items-center justify-center rounded-md"
          onClick={() => appWindow.close()}
          aria-label="Close"
          title="Close"
          variant="ghost"
          size="icon"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-destructive"></span>
        </Button>
      </div>
    </div>
  );
}

export default TitleBar;

