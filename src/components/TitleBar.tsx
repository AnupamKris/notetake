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
import { Input } from "./ui/input";
import { ChevronLeft, Eye, EyeOff, Loader2, Save, Trash2 } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

type TitleBarProps = {
  className?: string;
  appName?: string;
  hasActiveNote?: boolean;
  canSave?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  noteTitle?: string;
  showPreview?: boolean;
  onNew?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onTogglePreview?: () => void;
  onOpenPalette?: () => void;
  onBack?: () => void;
  onTitleChange?: (value: string) => void;
};

export function TitleBar({
  className,
  appName = "QuickMark",
  hasActiveNote,
  canSave,
  isSaving,
  isDirty,
  noteTitle,
  showPreview,
  onNew,
  onSave,
  onDelete,
  onTogglePreview,
  onOpenPalette,
  onBack,
  onTitleChange,
}: TitleBarProps) {
  const appWindow = getCurrentWindow();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const previousTitleRef = useRef<string>("");

  useEffect(() => {
    if (!hasActiveNote) {
      setIsEditingTitle(false);
    }
  }, [hasActiveNote]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  function startEditingTitle() {
    if (!hasActiveNote || !onTitleChange) {
      return;
    }
    previousTitleRef.current = noteTitle ?? "";
    setIsEditingTitle(true);
  }

  function handleTitleBlur() {
    setIsEditingTitle(false);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onTitleChange?.(previousTitleRef.current);
      setIsEditingTitle(false);
    }
  }

  return (
    <div
      className={cn(
        "titlebar bg-card text-card-foreground border-border flex justify-between h-11 select-none items-center gap-2 border-b px-2 text-[13px]",
        className,
      )}
      data-tauri-drag-region
    >
      <div className="no-drag flex items-center gap-2">
        {hasActiveNote && onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
            <ChevronLeft className="size-3.5" />
          </Button>
        ) : null}
        <img src="/logo.png" alt="App logo" className="h-5 w-5 rounded-sm dark:invert" />
        <Menubar className="hidden h-8 border-none bg-card text-[13px] sm:flex">
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
                Toggle Preview <MenubarShortcut>Ctrl+\\</MenubarShortcut>
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
      <div className="no-drag w-fit flex items-center justify-center gap-2 overflow-hidden px-2">
        {hasActiveNote ? (
          isEditingTitle && onTitleChange ? (
            <Input
              ref={titleInputRef}
              value={noteTitle ?? ""}
              onChange={(event) => onTitleChange(event.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled"
              className="h-8 max-w-xl flex-1 text-center"
            />
          ) : (
            <div
              className="max-w-xl w-fit truncate rounded px-2 py-1 text-center transition hover:bg-muted/60"
              onDoubleClick={startEditingTitle}
              role="button"
              tabIndex={hasActiveNote ? 0 : -1}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && onTitleChange) {
                  event.preventDefault();
                  startEditingTitle();
                }
              }}
              aria-label="Note title"
            >
              {noteTitle?.trim() ? noteTitle : "Untitled"}
              {isDirty ? " •" : ""}
            </div>
          )
        ) : (
          <span className="truncate text-center opacity-70">{appName}</span>
        )}
      </div>
      <div className="no-drag flex items-center gap-1">
        {hasActiveNote ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onTogglePreview}
              disabled={!onTogglePreview || !hasActiveNote}
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 hover:!bg-red-500/50 hover:text-foreground"
              onClick={onDelete}
              disabled={!hasActiveNote}
            >
              <Trash2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8" onClick={onSave} disabled={!canSave}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            </Button>
          </>
        ) : null}
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
