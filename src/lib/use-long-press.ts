import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";

const DEFAULT_MS = 550;

export type LongPressHandlers = {
  onPointerDown: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
  onClick: (e: MouseEvent) => void;
  onContextMenu: (e: MouseEvent) => void;
};

/**
 * Tap → onTap. Hold ≥ holdMs → onLongPress (no tap).
 * Blocks context menu / synthetic click after a hold.
 */
export function useLongPress(
  onTap: () => void,
  onLongPress: () => void,
  holdMs = DEFAULT_MS,
  enabled = true,
): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const active = useRef(false);

  const clear = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      active.current = true;
      held.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        held.current = true;
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(12);
          }
        } catch {
          /* ignore */
        }
        onLongPress();
      }, holdMs);
    },
    [clear, enabled, holdMs, onLongPress],
  );

  const end = useCallback(() => {
    clear();
    active.current = false;
  }, [clear]);

  const onPointerUp = useCallback(() => {
    end();
  }, [end]);

  const onPointerLeave = useCallback(() => {
    if (active.current) end();
  }, [end]);

  const onPointerCancel = useCallback(() => {
    end();
  }, [end]);

  const onClick = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      if (held.current) {
        e.preventDefault();
        e.stopPropagation();
        held.current = false;
        return;
      }
      onTap();
    },
    [enabled, onTap],
  );

  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onClick,
    onContextMenu,
  };
}
