import * as vscode from 'vscode';
import { Mode } from '../types';
import { BUILTIN_MODES } from './builtins';

/**
 * Combines built-in modes with user-defined ones from `focusbar.modes`.
 * User modes with the same id override built-ins.
 */
export class ModeRegistry {
  private modes = new Map<string, Mode>();

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.modes.clear();
    for (const mode of BUILTIN_MODES) {
      this.modes.set(mode.id, mode);
    }

    const userModes = vscode.workspace
      .getConfiguration('focusbar')
      .get<Mode[]>('modes', []);

    for (const mode of userModes) {
      if (this.isValidMode(mode)) {
        this.modes.set(mode.id, mode);
      } else {
        console.warn('[FocusBar] Ignoring invalid user mode:', mode);
      }
    }
  }

  get(id: string): Mode | undefined {
    return this.modes.get(id);
  }

  list(): Mode[] {
    return Array.from(this.modes.values());
  }

  private isValidMode(mode: unknown): mode is Mode {
    if (!mode || typeof mode !== 'object') return false;
    const m = mode as Partial<Mode>;
    return (
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      Array.isArray(m.groups)
    );
  }
}
