import * as vscode from 'vscode';
import { ModeStore } from '../modes/ModeStore';

/**
 * Status bar item showing the active mode.
 * Click it → opens the mode switcher.
 */
export class StatusBarController {
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly store: ModeStore) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'focusbar.switchMode';
    this.item.tooltip = 'FocusBar — click to switch mode';

    this.disposables.push(
      store.onModeChange(() => this.render()),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('focusbar.statusBarBadge')) this.render();
      })
    );

    this.render();
  }

  private render(): void {
    const enabled = vscode.workspace
      .getConfiguration('focusbar')
      .get<boolean>('statusBarBadge', true);

    if (!enabled) {
      this.item.hide();
      return;
    }

    const mode = this.store.current();
    const icon = `$(${mode.icon ?? 'target'})`;
    this.item.text = `${icon} ${mode.name}`;
    this.item.show();
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.item.dispose();
  }
}
