import * as vscode from 'vscode';
import { ModeRegistry } from './modes/ModeRegistry';
import { ModeStore } from './modes/ModeStore';
import { ContextDetector } from './detection/ContextDetector';
import { FocusBarTreeProvider } from './ui/FocusBarTreeProvider';
import { StatusBarController } from './ui/StatusBarController';
import { ReplaceModeController } from './ui/ReplaceModeController';
import { CustomModeEditor } from './customMode/CustomModeEditor';
import { ModeRepository } from './customMode/modeRepository';
import { ModeTemplates } from './customMode/modeTemplates';
import { ModeImportExport } from './customMode/modeImportExport';
import { ExtensionDiscovery } from './customMode/extensionDiscovery';
import { registerCommands } from './commands';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const registry = new ModeRegistry();
  const store = new ModeStore(registry);
  const treeProvider = new FocusBarTreeProvider(store);
  const statusBar = new StatusBarController(store);
  const detector = new ContextDetector(registry, store);
  const replaceMode = new ReplaceModeController(context);

  const discovery = new ExtensionDiscovery();
  const repository = new ModeRepository();
  const templates = new ModeTemplates(discovery);
  const importExport = new ModeImportExport();
  const editor = new CustomModeEditor(context, repository, templates, importExport, discovery);

  const treeView = vscode.window.createTreeView('focusbar.modeView', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });

  const updateTitle = () => {
    treeView.title = `FocusBar · ${store.current().name}`;
  };
  store.onModeChange(updateTitle);
  updateTitle();

  registerCommands(context, registry, store, replaceMode, editor);

  // Re-apply replace mode state if it was on when VS Code last closed.
  await replaceMode.restoreOnBoot();

  void detector.start();

  context.subscriptions.push(
    treeView,
    statusBar,
    { dispose: () => store.dispose() },
    { dispose: () => detector.dispose() }
  );
}

export function deactivate(): void {
  // Resources disposed via context.subscriptions.
}
