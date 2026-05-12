import * as vscode from 'vscode';
import { Mode } from '../types';

/**
 * Read/write user-defined modes in `focusbar.modes`.
 *
 * Built-in modes live in code and are immutable from the user's perspective.
 * Editing a built-in actually creates a custom mode with the same id, which
 * the registry then prefers over the built-in. This means "Reset to default"
 * is just "delete the custom override".
 */
export class ModeRepository {
  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('focusbar');
  }

  list(): Mode[] {
    return this.config.get<Mode[]>('modes', []);
  }

  get(id: string): Mode | undefined {
    return this.list().find(m => m.id === id);
  }

  async upsert(mode: Mode, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    if (!this.isValid(mode)) {
      throw new Error('Invalid mode: missing required fields (id, name, groups).');
    }

    const all = this.list();
    const idx = all.findIndex(m => m.id === mode.id);
    if (idx >= 0) {
      all[idx] = mode;
    } else {
      all.push(mode);
    }
    await this.config.update('modes', all, target);
  }

  async delete(id: string, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    const all = this.list().filter(m => m.id !== id);
    await this.config.update('modes', all, target);
  }

  /**
   * Generate a unique id from a display name. Used when creating new modes
   * so the user doesn't have to think about ids.
   */
  generateId(name: string, existingIds: string[]): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'mode';

    if (!existingIds.includes(base)) return base;
    let i = 2;
    while (existingIds.includes(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  private isValid(mode: Partial<Mode>): mode is Mode {
    return (
      typeof mode.id === 'string' &&
      mode.id.length > 0 &&
      typeof mode.name === 'string' &&
      mode.name.length > 0 &&
      Array.isArray(mode.groups)
    );
  }
}
