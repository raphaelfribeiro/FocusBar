import * as vscode from 'vscode';

const STORAGE_KEY = 'focusbar.replaceMode.active';
const NUDGE_KEY = 'focusbar.replaceMode.firstRunNudgeSeen';
const CTX_KEY = 'focusbar.replaceModeActive';

/**
 * Replace Mode = hide the native Activity Bar and use the FocusBar sidebar
 * as the sole navigation surface.
 *
 * Mechanism: toggles the built-in setting `workbench.activityBar.location`
 * between 'default' and 'hidden'. This is a public, stable setting — same
 * one used by View → Appearance → Activity Bar Position → Hidden.
 *
 * On activation in replace mode, we also auto-reveal the FocusBar sidebar
 * so the user is never left with no navigation.
 */
export class ReplaceModeController {
  constructor(private readonly context: vscode.ExtensionContext) {}

  isActive(): boolean {
    return this.context.globalState.get<boolean>(STORAGE_KEY, false);
  }

  async restoreOnBoot(): Promise<void> {
    // Re-establish the context key and re-apply the setting if the user
    // had replace mode on when they last closed VS Code.
    await this.syncContextKey();
    if (this.isActive()) {
      await this.applyHidden(true);
      await this.revealFocusBarSidebar();
    }
  }

  async enable(): Promise<void> {
    await this.applyHidden(true);
    await this.context.globalState.update(STORAGE_KEY, true);
    await this.syncContextKey();
    await this.revealFocusBarSidebar();

    // First-run nudge: explain the escape hatch so the user is never stuck.
    const seenNudge = this.context.globalState.get<boolean>(NUDGE_KEY, false);
    if (!seenNudge) {
      await this.context.globalState.update(NUDGE_KEY, true);
      void vscode.window
        .showInformationMessage(
          'FocusBar is now your activity bar. Press Ctrl/Cmd+K F (or click "Show" in the status bar) to bring this sidebar back anytime. To restore the native bar, run "FocusBar: Restore Native Activity Bar".',
          'Got it'
        );
    } else {
      vscode.window.setStatusBarMessage('FocusBar replace mode: ON', 2000);
    }
  }

  async disable(): Promise<void> {
    await this.applyHidden(false);
    await this.context.globalState.update(STORAGE_KEY, false);
    await this.syncContextKey();
    vscode.window.setStatusBarMessage('FocusBar replace mode: OFF', 2000);
  }

  async toggle(): Promise<void> {
    if (this.isActive()) {
      await this.disable();
    } else {
      await this.enable();
    }
  }

  private async applyHidden(hidden: boolean): Promise<void> {
    // The built-in setting accepts 'default' | 'top' | 'bottom' | 'hidden'.
    // We only flip between 'default' and 'hidden' so we don't fight the
    // user's preferred layout when they turn replace mode off.
    await vscode.workspace
      .getConfiguration('workbench')
      .update(
        'activityBar.location',
        hidden ? 'hidden' : 'default',
        vscode.ConfigurationTarget.Global
      );
  }

  private async revealFocusBarSidebar(): Promise<void> {
    // Open the FocusBar view container so the user isn't left adrift.
    try {
      await vscode.commands.executeCommand('workbench.view.extension.focusbar');
    } catch {
      // Container not registered yet on first-run race; safe to ignore.
    }
  }

  private async syncContextKey(): Promise<void> {
    await vscode.commands.executeCommand('setContext', CTX_KEY, this.isActive());
  }
}
