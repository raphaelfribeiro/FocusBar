import * as vscode from 'vscode';
import { Mode, Tool } from '../types';
import { BUILTIN_MODES } from './builtins';
import { ExtensionDiscovery } from '../customMode/extensionDiscovery';

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

    this.enrichDefaultMode();

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

  private enrichDefaultMode(): void {
    const defaultMode = this.modes.get('default');
    if (!defaultMode) return;

    const extensionTools: Tool[] = new ExtensionDiscovery()
      .list()
      .filter(c => !c.builtin && c.location === 'activitybar')
      .map(c => ({
        type: 'viewContainer' as const,
        id: c.commandId,
        label: c.title,
        icon: c.icon,
        lightIconDataUri: c.lightIconDataUri,
        darkIconDataUri:  c.darkIconDataUri,
      }));

    if (extensionTools.length === 0) return;

    this.modes.set('default', {
      ...defaultMode,
      groups: [
        ...defaultMode.groups,
        { label: 'Installed Extensions', tools: extensionTools }
      ]
    });
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
