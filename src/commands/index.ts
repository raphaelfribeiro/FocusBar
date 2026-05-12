import * as vscode from 'vscode';
import { ModeRegistry } from '../modes/ModeRegistry';
import { ModeStore } from '../modes/ModeStore';

export function registerCommands(
  context: vscode.ExtensionContext,
  registry: ModeRegistry,
  store: ModeStore
): void {

  context.subscriptions.push(
    // Open a QuickPick listing all available modes.
    vscode.commands.registerCommand('focusbar.switchMode', async () => {
      const modes = registry.list();
      const currentId = store.current().id;

      const items: (vscode.QuickPickItem & { modeId: string })[] = modes.map(m => ({
        label: `$(${m.icon ?? 'target'}) ${m.name}`,
        description: m.id === currentId ? '(current)' : '',
        detail: m.description ?? '',
        modeId: m.id
      }));

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a FocusBar mode',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!picked) return;
      await store.set(picked.modeId, 'user');
    }),

    // Programmatic switch — useful for keybindings or other extensions.
    vscode.commands.registerCommand('focusbar.setMode', async (modeId: string) => {
      if (!modeId) {
        vscode.window.showErrorMessage('FocusBar: focusbar.setMode requires a mode ID argument.');
        return;
      }
      await store.set(modeId, 'user');
    }),

    vscode.commands.registerCommand('focusbar.toggleAutoSwitch', async () => {
      const cfg = vscode.workspace.getConfiguration('focusbar');
      const current = cfg.get<boolean>('autoSwitch', true);
      await cfg.update('autoSwitch', !current, vscode.ConfigurationTarget.Workspace);
      vscode.window.setStatusBarMessage(
        `FocusBar auto-switch: ${!current ? 'ON' : 'OFF'}`,
        2000
      );
    }),

    vscode.commands.registerCommand('focusbar.openSettings', async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:your-publisher.focusbar'
      );
    }),

    vscode.commands.registerCommand('focusbar.refresh', () => {
      registry.refresh();
      vscode.window.setStatusBarMessage('FocusBar: modes reloaded', 2000);
    })
  );
}
