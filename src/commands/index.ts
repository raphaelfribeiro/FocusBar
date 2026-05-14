import * as vscode from 'vscode';
import { ModeRegistry } from '../modes/ModeRegistry';
import { ModeStore } from '../modes/ModeStore';
import { ReplaceModeController } from '../ui/ReplaceModeController';
import { CustomModeEditor } from '../customMode/CustomModeEditor';

export function registerCommands(
  context: vscode.ExtensionContext,
  registry: ModeRegistry,
  store: ModeStore,
  replaceMode: ReplaceModeController,
  editor: CustomModeEditor,
  treeView: vscode.TreeView<unknown>
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
      const target = vscode.workspace.workspaceFolders?.length
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
      await cfg.update('autoSwitch', !current, target);
      vscode.window.setStatusBarMessage(
        `FocusBar auto-switch: ${current ? 'OFF' : 'ON'}`,
        2000
      );
    }),

    vscode.commands.registerCommand('focusbar.openSettings', async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:RaphaelRibeiro.focusbar-vscode-extension'
      );
    }),

    vscode.commands.registerCommand('focusbar.toggleReplaceMode', async () => {
      await replaceMode.toggle();
    }),

    vscode.commands.registerCommand('focusbar.enableReplaceMode', async () => {
      await replaceMode.enable();
    }),

    vscode.commands.registerCommand('focusbar.disableReplaceMode', async () => {
      await replaceMode.disable();
    }),

    vscode.commands.registerCommand('focusbar.openEditor', () => {
      editor.open();
    }),

    vscode.commands.registerCommand('focusbar.show', async () => {
      try {
        if (treeView.visible) {
          await vscode.commands.executeCommand('workbench.action.closeSidebar');
        } else {
          await vscode.commands.executeCommand('workbench.view.extension.focusbar');
        }
      } catch {
        // safe to swallow — view container may not be registered yet
      }
    }),

    vscode.commands.registerCommand('focusbar.refresh', () => {
      registry.refresh();
      vscode.window.setStatusBarMessage('FocusBar: modes reloaded', 2000);
    })
  );
}
