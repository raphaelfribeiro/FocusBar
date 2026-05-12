import * as vscode from 'vscode';
import { ModeRegistry } from './modes/ModeRegistry';
import { ModeStore } from './modes/ModeStore';
import { ContextDetector } from './detection/ContextDetector';
import { FocusBarTreeProvider } from './ui/FocusBarTreeProvider';
import { StatusBarController } from './ui/StatusBarController';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  const registry = new ModeRegistry();
  const store = new ModeStore(registry);
  const treeProvider = new FocusBarTreeProvider(store);
  const statusBar = new StatusBarController(store);
  const detector = new ContextDetector(registry, store);

  const treeView = vscode.window.createTreeView('focusbar.modeView', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });

  // Keep the view title in sync with the active mode.
  const updateTitle = () => {
    treeView.title = `FocusBar · ${store.current().name}`;
  };
  store.onModeChange(updateTitle);
  updateTitle();

  registerCommands(context, registry, store);

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
