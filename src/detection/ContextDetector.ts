import * as vscode from 'vscode';
import { ModeRegistry } from '../modes/ModeRegistry';
import { ModeStore } from '../modes/ModeStore';
import { Mode, AutoDetectRule } from '../types';

/**
 * Watches editor changes, debug sessions, and workspace markers,
 * and switches the active mode to the highest-priority match.
 *
 * Priority semantics: the rule with the highest `priority` wins.
 * A debug session (priority 100) trumps everything; file patterns
 * sit at 10-15; workspace markers are weak (3-5) and only kick in
 * when no stronger signal is present.
 */
export class ContextDetector {
  private readonly disposables: vscode.Disposable[] = [];
  private workspaceMarkers = new Set<string>();
  private debugActive = false;

  constructor(
    private readonly registry: ModeRegistry,
    private readonly store: ModeStore
  ) {}

  async start(): Promise<void> {
    await this.scanWorkspaceMarkers();

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.evaluate()),

      vscode.workspace.onDidChangeConfiguration(e => {
        if (
          e.affectsConfiguration('focusbar.modes') ||
          e.affectsConfiguration('focusbar.autoSwitch')
        ) {
          this.registry.refresh();
          this.evaluate();
        }
      }),

      vscode.debug.onDidStartDebugSession(() => {
        this.debugActive = true;
        this.evaluate();
      }),
      vscode.debug.onDidTerminateDebugSession(() => {
        this.debugActive = false;
        this.evaluate();
      }),

      vscode.workspace.onDidCreateFiles(async () => {
        await this.scanWorkspaceMarkers();
        this.evaluate();
      }),
      vscode.workspace.onDidDeleteFiles(async () => {
        await this.scanWorkspaceMarkers();
        this.evaluate();
      })
    );

    this.evaluate();
  }

  private async scanWorkspaceMarkers(): Promise<void> {
    this.workspaceMarkers.clear();
    const markers = [
      '**/package.json',
      '**/Dockerfile',
      '**/docker-compose.{yml,yaml}',
      '**/*.tf',
      '**/Cargo.toml',
      '**/go.mod',
      '**/pom.xml',
      '**/*.csproj'
    ];
    for (const pattern of markers) {
      try {
        const found = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 25);
        for (const uri of found) {
          this.workspaceMarkers.add(uri.fsPath);
        }
      } catch {
        // ignore — workspace might be closed mid-scan
      }
    }
  }

  private autoSwitchEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('focusbar')
      .get<boolean>('autoSwitch', true);
  }

  private evaluate(): void {
    if (!this.autoSwitchEnabled()) return;

    const activeDoc = vscode.window.activeTextEditor?.document;
    let best: { mode: Mode; priority: number } | null = null;

    for (const mode of this.registry.list()) {
      if (!mode.autoDetect || mode.autoDetect.length === 0) continue;

      for (const rule of mode.autoDetect) {
        if (this.matches(rule, activeDoc)) {
          const p = rule.priority ?? 0;
          if (!best || p > best.priority) {
            best = { mode, priority: p };
          }
        }
      }
    }

    if (best) {
      void this.store.set(best.mode.id, 'auto');
    }
  }

  private matches(rule: AutoDetectRule, doc: vscode.TextDocument | undefined): boolean {
    switch (rule.kind) {
      case 'debugActive':
        return this.debugActive;
      case 'languageId':
        return !!doc && doc.languageId === rule.languageId;
      case 'filePattern':
        return !!doc && this.globMatch(doc.uri.fsPath, rule.pattern);
      case 'workspaceMarker':
        for (const marker of this.workspaceMarkers) {
          if (this.globMatch(marker, rule.pattern)) return true;
        }
        return false;
    }
  }

  /**
   * Lightweight glob → regex. Supports `*`, `**`, and `{a,b}` alternation.
   * Good enough for filename matching; not a full minimatch implementation.
   */
  private globMatch(filePath: string, glob: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    const pattern = glob
      .replace(/[.+^$()|[\]\\]/g, '\\$&')
      .replace(/\{([^}]+)\}/g, (_, inner: string) => `(${inner.split(',').join('|')})`)
      .replace(/\*\*\//g, '___DSS___')
      .replace(/\*\*/g, '___DS___')
      .replace(/\*/g, '[^/]*')
      .replace(/___DSS___/g, '(?:.*/)?')
      .replace(/___DS___/g, '.*');
    return new RegExp(`^${pattern}$`).test(normalized);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
