import * as RadixContextMenu from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";

// --- Shared context menu primitives with Dracula styling ---

export interface ContextMenuProps {
  children: ReactNode;
  content: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

/** Wraps a trigger element with a right-click context menu */
export function ContextMenu({ children, content, onOpenChange }: ContextMenuProps) {
  return (
    <RadixContextMenu.Root onOpenChange={onOpenChange}>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          className="min-w-[180px] bg-background-overlay border border-border-strong rounded-lg shadow-lg p-1 animate-fade-in z-50"
          collisionPadding={8}
        >
          {content}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}

// --- Menu item primitives ---

export interface MenuItemProps {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
}

export function MenuItem({
  icon,
  label,
  shortcut,
  disabled,
  destructive,
  onSelect,
}: MenuItemProps) {
  return (
    <RadixContextMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={`
        flex items-center gap-2 px-2 py-1.5 text-sm rounded-md outline-none cursor-pointer
        transition-default select-none
        ${destructive
          ? "text-foreground-secondary data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
          : "text-foreground-secondary data-[highlighted]:bg-accent-secondary/10 data-[highlighted]:text-foreground"
        }
        data-[disabled]:text-foreground-muted data-[disabled]:cursor-not-allowed data-[disabled]:pointer-events-none
      `}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-2xs text-foreground-muted ml-auto pl-4">{shortcut}</span>
      )}
    </RadixContextMenu.Item>
  );
}

export function MenuSeparator() {
  return <RadixContextMenu.Separator className="h-px bg-border my-1" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <RadixContextMenu.Label className="px-2 py-1 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
      {children}
    </RadixContextMenu.Label>
  );
}

// Re-export Root/Trigger/Content for advanced usage
export { RadixContextMenu };
