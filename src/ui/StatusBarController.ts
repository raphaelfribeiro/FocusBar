import * as vscode from 'vscode';
import { ModeStore } from '../modes/ModeStore';

/**
 * Two status bar items, side by side on the left:
 *
 *   [$(target) Frontend]  [$(layout-sidebar-left) Show]
 *     ↑ click: switch mode  ↑ click: reveal FocusBar sidebar
 *
 * The second item is the escape hatch when replace mode is on: hiding the
 * native Activity Bar also hides the FocusBar icon there, so users need a
 * persistent way back into the FocusBar sidebar after clicking through to
 * Extensions, Source Control, etc.
 */
export class StatusBarController {
  private readonly modeItem: vscode.StatusBarItem;
  private readonly showItem: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly store: ModeStore) {
    // Priority controls left-to-right ordering within the same alignment.
    // Higher = further left. We want [mode] [show], so mode > show.
    this.modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
    this.modeItem.command = 'focusbar.switchMode';
    this.modeItem.tooltip = 'FocusBar — click to switch mode';

    this.showItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.showItem.command = 'focusbar.show';
    this.showItem.text = '$(layout-sidebar-left) Show';
    this.showItem.tooltip = 'Show the FocusBar sidebar (Ctrl/Cmd+K F)';

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
      this.modeItem.hide();
      this.showItem.hide();
      return;
    }

    const mode = this.store.current();
    const icon = `$(${mode.icon ?? 'target'})`;
    this.modeItem.text = `${icon} ${mode.name}`;
    this.modeItem.show();
    this.showItem.show();
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.modeItem.dispose();
    this.showItem.dispose();
  }
}
