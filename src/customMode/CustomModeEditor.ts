import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Mode } from '../types';
import { ModeRepository } from './modeRepository';
import { ModeTemplates } from './modeTemplates';
import { ModeImportExport } from './modeImportExport';
import { ExtensionDiscovery, DiscoveredContainer } from './extensionDiscovery';
import { BUILTIN_MODES } from '../modes/builtins';

/**
 * Manages the Custom Mode Editor webview panel. There's only ever one panel
 * open at a time — revealing it if it already exists, creating it otherwise.
 */
export class CustomModeEditor {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly repository: ModeRepository,
    private readonly templates: ModeTemplates,
    private readonly importExport: ModeImportExport,
    private readonly discovery: ExtensionDiscovery
  ) {}

  open(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'focusbar.modeEditor',
      'FocusBar — Mode Editor',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview'),
          vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
        ]
      }
    );

    this.panel.webview.html = this.renderHtml(this.panel.webview);
    this.panel.onDidDispose(() => (this.panel = undefined));
    this.panel.webview.onDidReceiveMessage(msg => this.onMessage(msg));
  }

  // ---------------- Message handlers ----------------
  private async onMessage(msg: any): Promise<void> {
    try {
      switch (msg.type) {
        case 'ready':
          this.sendInit();
          break;

        case 'newMode':
          await this.newModeFlow();
          break;

        case 'save':
          await this.repository.upsert(this.stripBuiltinFlag(msg.mode));
          this.sendInit();
          vscode.window.setStatusBarMessage(`FocusBar: "${msg.mode.name}" saved`, 2000);
          break;

        case 'delete': {
          const modeToDelete = this.allModes().find(m => m.id === msg.id);
          const label = modeToDelete?.name ?? msg.id;
          const choice = await vscode.window.showWarningMessage(
            `Delete mode "${label}"? This cannot be undone.`,
            { modal: true },
            'Delete'
          );
          if (choice !== 'Delete') break;
          await this.repository.delete(msg.id);
          this.sendInit();
          break;
        }

        case 'duplicate': {
          const source = this.allModes().find(m => m.id === msg.id);
          if (!source) return;
          const all = this.allModes();
          const newId = this.repository.generateId(`${source.name} copy`, all.map(m => m.id));
          const dup = this.templates.duplicate(source, newId, `${source.name} (copy)`);
          await this.repository.upsert(dup);
          this.selectAfterRefresh = newId;
          this.sendInit();
          break;
        }

        case 'reload':
          this.sendInit();
          break;

        case 'export': {
          const mode = this.allModes().find(m => m.id === msg.id);
          if (mode) await this.importExport.copyToClipboard(this.stripBuiltinFlag(mode));
          break;
        }

        case 'import':
          await this.importFlow();
          break;

        case 'pickContainer':
          await this.pickContainerFlow(msg.groupIndex);
          break;
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`FocusBar: ${err?.message ?? err}`);
    }
  }

  private selectAfterRefresh: string | undefined;

  private sendInit(): void {
    if (!this.panel) return;
    const modes = this.allModes();
    const containers = this.discovery.list();
    this.panel.webview.postMessage({ type: 'init', modes, containers });
    if (this.selectAfterRefresh) {
      // The webview tracks its own selection, so we don't push it; we only
      // need this when we just created a mode and want it focused.
      this.selectAfterRefresh = undefined;
    }
  }

  /** Built-in modes are marked with `_builtin: true` so the UI can disable edits. */
  private allModes(): Mode[] {
    const userMap = new Map(this.repository.list().map(m => [m.id, m]));
    const merged: Mode[] = [];

    for (const b of BUILTIN_MODES) {
      const userOverride = userMap.get(b.id);
      if (userOverride) {
        merged.push(userOverride);
        userMap.delete(b.id);
      } else {
        merged.push({ ...b, _builtin: true } as Mode & { _builtin: boolean });
      }
    }
    for (const u of userMap.values()) merged.push(u);
    return merged;
  }

  private stripBuiltinFlag(mode: Mode): Mode {
    const { _builtin, ...rest } = mode as any;
    return rest;
  }

  // ---------------- Flows ----------------
  private async newModeFlow(): Promise<void> {
    const choice = await vscode.window.showQuickPick(
      [
        { label: '$(file) Blank', detail: 'Start from scratch', value: 'blank' },
        { label: '$(copy) Duplicate existing mode', detail: 'Copy any built-in or custom mode', value: 'duplicate' },
        { label: '$(rocket) From installed extensions', detail: 'Auto-group all installed view containers', value: 'installed' },
        { label: '$(clippy) Import from clipboard', detail: 'Paste a previously exported mode', value: 'import' }
      ],
      { placeHolder: 'How do you want to create the new mode?' }
    );
    if (!choice) return;

    const all = this.allModes();
    const name = await vscode.window.showInputBox({
      prompt: 'Mode name',
      value: choice.value === 'installed' ? 'My Workspace' : 'New mode',
      validateInput: v => v.trim() === '' ? 'Name is required' : null
    });
    if (!name) return;
    const id = this.repository.generateId(name, all.map(m => m.id));

    let mode: Mode | undefined;
    switch (choice.value) {
      case 'blank':
        mode = this.templates.blank(id, name);
        break;
      case 'duplicate': {
        const src = await vscode.window.showQuickPick(
          all.map(m => ({ label: m.name, description: m.id, mode: m })),
          { placeHolder: 'Duplicate which mode?' }
        );
        if (!src) return;
        mode = this.templates.duplicate(src.mode, id, name);
        break;
      }
      case 'installed':
        mode = this.templates.fromInstalled(id, name);
        break;
      case 'import':
        await this.importFlow();
        return;
    }

    if (mode) {
      await this.repository.upsert(this.stripBuiltinFlag(mode));
      this.sendInit();
    }
  }

  private async importFlow(): Promise<void> {
    try {
      const mode = await this.importExport.readFromClipboard();
      const existing = this.allModes().find(m => m.id === mode.id);
      if (existing) {
        const choice = await vscode.window.showWarningMessage(
          `A mode with id "${mode.id}" already exists. Overwrite?`,
          { modal: true },
          'Overwrite', 'Rename'
        );
        if (choice === 'Rename') {
          mode.id = this.repository.generateId(mode.name, this.allModes().map(m => m.id));
        } else if (choice !== 'Overwrite') {
          return;
        }
      }
      await this.repository.upsert(mode);
      this.sendInit();
      vscode.window.setStatusBarMessage(`FocusBar: imported "${mode.name}"`, 2500);
    } catch (err: any) {
      vscode.window.showErrorMessage(`FocusBar import failed: ${err?.message ?? err}`);
    }
  }

  private async pickContainerFlow(groupIndex: number): Promise<void> {
    if (!this.panel) return;
    const containers = this.discovery.list();
    const items = containers.map(c => ({
      label: `$(${c.icon ?? 'symbol-misc'}) ${c.title}`,
      description: c.builtin ? 'Built-in' : c.source,
      detail: c.commandId,
      container: c
    }));
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Pick a view container to add to this group',
      matchOnDescription: true,
      matchOnDetail: true
    });
    if (!picked) return;
    this.panel.webview.postMessage({
      type: 'pickContainerResult',
      groupIndex,
      container: picked.container as DiscoveredContainer
    });
  }

  // ---------------- HTML rendering ----------------
  private renderHtml(webview: vscode.Webview): string {
    const root = this.context.extensionUri;
    // We support both running from `out/webview` (compiled) and `src/webview`
    // (during development without a build step for the static assets).
    const compiledRoot = vscode.Uri.joinPath(root, 'out', 'webview');
    const compiledHtmlPath = path.join(compiledRoot.fsPath, 'editor.html');
    const useCompiled = fs.existsSync(compiledHtmlPath);
    const assetRoot = useCompiled
      ? compiledRoot
      : vscode.Uri.joinPath(root, 'src', 'webview');

    const htmlPath = useCompiled
      ? compiledHtmlPath
      : path.join(assetRoot.fsPath, 'editor.html');

    let html = fs.readFileSync(htmlPath, 'utf8');

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetRoot, 'editor.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetRoot, 'editor.css'));
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(root, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
    );
    const nonce = crypto.randomBytes(16).toString('base64');

    return html
      .replace(/\$\{scriptUri\}/g, String(scriptUri))
      .replace(/\$\{styleUri\}/g, String(styleUri))
      .replace(/\$\{codiconsUri\}/g, String(codiconsUri))
      .replace(/\$\{cspSource\}/g, webview.cspSource)
      .replace(/\$\{nonce\}/g, nonce);
  }
}
