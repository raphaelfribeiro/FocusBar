import * as vscode from 'vscode';
import { ModeRegistry } from './ModeRegistry';
import { Mode } from '../types';

export type ModeChangeSource = 'user' | 'auto';

export interface ModeChange {
  mode: Mode;
  source: ModeChangeSource;
}

/**
 * Holds the current mode state and emits when it changes.
 * Persists to workspace settings so each project can pin its own default.
 */
export class ModeStore {
  private readonly emitter = new vscode.EventEmitter<ModeChange>();
  readonly onModeChange = this.emitter.event;

  constructor(private readonly registry: ModeRegistry) {}

  current(): Mode {
    const id = vscode.workspace
      .getConfiguration('focusbar')
      .get<string>('currentMode', 'default');

    return (
      this.registry.get(id) ??
      this.registry.get('default') ??
      this.registry.list()[0]
    );
  }

  async set(modeId: string, source: ModeChangeSource = 'user'): Promise<void> {
    const mode = this.registry.get(modeId);
    if (!mode) {
      vscode.window.showWarningMessage(`FocusBar: mode "${modeId}" not found.`);
      return;
    }

    const cfg = vscode.workspace.getConfiguration('focusbar');
    const previous = cfg.get<string>('currentMode');
    if (previous === modeId) return;

    // Workspace-scoped so each project keeps its own active mode.
    await cfg.update('currentMode', modeId, vscode.ConfigurationTarget.Workspace);
    this.emitter.fire({ mode, source });

    if (source === 'user') {
      vscode.window.setStatusBarMessage(`FocusBar → ${mode.name}`, 2000);
    }
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
