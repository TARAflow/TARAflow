// ==================== useKeyboardShortcuts HOOK ====================
// Custom hook for managing keyboard shortcuts

import { useEffect, useCallback, useRef } from 'react';

// ==================== TYPES ====================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Command key on Mac
  description: string;
  action: () => void;
  preventDefault?: boolean;
  enabled?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  disableInInputs?: boolean;
}

// ==================== HELPER FUNCTIONS ====================

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const isInputElement = (element: Element | null): boolean => {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  const isEditable = element.getAttribute('contenteditable') === 'true';
  
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    isEditable
  );
};

const matchesShortcut = (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
  const key = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();
  
  // Check if key matches
  if (key !== shortcutKey) return false;
  
  // Check modifiers
  const ctrlMatch = shortcut.ctrl ? (isMac ? event.metaKey : event.ctrlKey) : true;
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;
  const metaMatch = shortcut.meta ? event.metaKey : true;
  
  return ctrlMatch && shiftMatch && altMatch && metaMatch;
};

const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.meta) parts.push('⌘');
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join('+');
};

// ==================== HOOK ====================

export const useKeyboardShortcuts = (
  options: UseKeyboardShortcutsOptions
): {
  shortcuts: KeyboardShortcut[];
  formattedShortcuts: Array<{ keys: string; description: string }>;
} => {
  const { shortcuts, enabled = true, disableInInputs = true } = options;
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if event target is an input element
      if (disableInInputs && isInputElement(event.target as Element)) {
        // Allow Escape key even in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      // Check each shortcut
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;

        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          
          shortcut.action();
          break; // Only trigger one shortcut per event
        }
      }
    },
    [enabled, disableInInputs]
  );

  // Register event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Format shortcuts for display
  const formattedShortcuts = shortcuts.map(shortcut => ({
    keys: formatShortcut(shortcut),
    description: shortcut.description
  }));

  return {
    shortcuts,
    formattedShortcuts
  };
};

// ==================== PREDEFINED SHORTCUTS ====================

export const createNavigationShortcuts = (handlers: {
  onToggleSidebar?: () => void;
  onSave?: () => void;
  onNew?: () => void;
  onOpen?: () => void;
  onExport?: () => void;
  onFind?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPhase0?: () => void;
  onPhase1?: () => void;
  onPhase2?: () => void;
  onPhase3?: () => void;
  onPhase4?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (handlers.onToggleSidebar) {
    shortcuts.push({
      key: 'b',
      ctrl: true,
      description: 'Toggle sidebar',
      action: handlers.onToggleSidebar,
      preventDefault: true
    });
  }

  if (handlers.onSave) {
    shortcuts.push({
      key: 's',
      ctrl: true,
      description: 'Save project',
      action: handlers.onSave,
      preventDefault: true
    });
  }

  if (handlers.onNew) {
    shortcuts.push({
      key: 'n',
      ctrl: true,
      description: 'New project',
      action: handlers.onNew,
      preventDefault: true
    });
  }

  if (handlers.onOpen) {
    shortcuts.push({
      key: 'o',
      ctrl: true,
      description: 'Open project',
      action: handlers.onOpen,
      preventDefault: true
    });
  }

  if (handlers.onExport) {
    shortcuts.push({
      key: 'e',
      ctrl: true,
      description: 'Export project',
      action: handlers.onExport,
      preventDefault: true
    });
  }

  if (handlers.onFind) {
    shortcuts.push({
      key: 'f',
      ctrl: true,
      description: 'Search/Find',
      action: handlers.onFind,
      preventDefault: true
    });
  }

  if (handlers.onUndo) {
    shortcuts.push({
      key: 'z',
      ctrl: true,
      description: 'Undo',
      action: handlers.onUndo,
      preventDefault: true
    });
  }

  if (handlers.onRedo) {
    shortcuts.push({
      key: 'z',
      ctrl: true,
      shift: true,
      description: 'Redo',
      action: handlers.onRedo,
      preventDefault: true
    });
  }

  // Phase navigation shortcuts
  if (handlers.onPhase0) {
    shortcuts.push({
      key: '1',
      ctrl: true,
      description: 'Jump to General tab',
      action: handlers.onPhase0,
      preventDefault: true
    });
  }

  if (handlers.onPhase1) {
    shortcuts.push({
      key: '2',
      ctrl: true,
      description: 'Jump to DFD (Phase 1)',
      action: handlers.onPhase1,
      preventDefault: true
    });
  }

  if (handlers.onPhase2) {
    shortcuts.push({
      key: '3',
      ctrl: true,
      description: 'Jump to Assets (Phase 2)',
      action: handlers.onPhase2,
      preventDefault: true
    });
  }

  if (handlers.onPhase3) {
    shortcuts.push({
      key: '4',
      ctrl: true,
      description: 'Jump to Threats (Phase 3)',
      action: handlers.onPhase3,
      preventDefault: true
    });
  }

  if (handlers.onPhase4) {
    shortcuts.push({
      key: '5',
      ctrl: true,
      description: 'Jump to Risk (Phase 4)',
      action: handlers.onPhase4,
      preventDefault: true
    });
  }

  return shortcuts;
};

// ==================== DIALOG SHORTCUTS ====================

export const createDialogShortcuts = (handlers: {
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (handlers.onClose) {
    shortcuts.push({
      key: 'Escape',
      description: 'Close dialog',
      action: handlers.onClose,
      preventDefault: false // Allow native Escape behavior
    });
  }

  if (handlers.onConfirm) {
    shortcuts.push({
      key: 'Enter',
      description: 'Confirm',
      action: handlers.onConfirm,
      preventDefault: true
    });
  }

  if (handlers.onCancel) {
    shortcuts.push({
      key: 'Escape',
      description: 'Cancel',
      action: handlers.onCancel,
      preventDefault: false
    });
  }

  return shortcuts;
};

// ==================== TABLE SHORTCUTS ====================

export const createTableShortcuts = (handlers: {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSelect?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (handlers.onMoveUp) {
    shortcuts.push({
      key: 'ArrowUp',
      description: 'Move up',
      action: handlers.onMoveUp,
      preventDefault: true
    });
  }

  if (handlers.onMoveDown) {
    shortcuts.push({
      key: 'ArrowDown',
      description: 'Move down',
      action: handlers.onMoveDown,
      preventDefault: true
    });
  }

  if (handlers.onSelect) {
    shortcuts.push({
      key: 'Enter',
      description: 'Select/Open',
      action: handlers.onSelect,
      preventDefault: true
    });
  }

  if (handlers.onDelete) {
    shortcuts.push({
      key: 'Delete',
      description: 'Delete',
      action: handlers.onDelete,
      preventDefault: true
    });
  }

  if (handlers.onEdit) {
    shortcuts.push({
      key: 'e',
      description: 'Edit',
      action: handlers.onEdit,
      preventDefault: true
    });
  }

  return shortcuts;
};

// ==================== SHORTCUT HELP MODAL ====================

export interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

export const groupShortcuts = (shortcuts: KeyboardShortcut[]): ShortcutGroup[] => {
  const groups: { [key: string]: KeyboardShortcut[] } = {
    'Navigation': [],
    'Editing': [],
    'Dialogs': [],
    'Other': []
  };

  shortcuts.forEach(shortcut => {
    const desc = shortcut.description.toLowerCase();
    
    if (desc.includes('jump') || desc.includes('tab') || desc.includes('phase')) {
      groups['Navigation'].push(shortcut);
    } else if (desc.includes('save') || desc.includes('undo') || desc.includes('redo')) {
      groups['Editing'].push(shortcut);
    } else if (desc.includes('close') || desc.includes('confirm') || desc.includes('cancel')) {
      groups['Dialogs'].push(shortcut);
    } else {
      groups['Other'].push(shortcut);
    }
  });

  return Object.entries(groups)
    .filter(([_, shortcuts]) => shortcuts.length > 0)
    .map(([title, shortcuts]) => ({
      title,
      shortcuts: shortcuts.map(s => ({
        keys: formatShortcut(s),
        description: s.description
      }))
    }));
};

export default useKeyboardShortcuts;