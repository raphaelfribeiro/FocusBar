import * as vscode from 'vscode';
import { ModeStore } from '../modes/ModeStore';
import { Tool } from '../types';

type TreeNode = HeaderNode | GroupNode | ToolNode;

interface HeaderNode {
  kind: 'header';
  modeName: string;
  modeIcon?: string;
  modeDescription?: string;
}

interface GroupNode {
  kind: 'group';
  label: string;
  tools: Tool[];
}

interface ToolNode {
  kind: 'tool';
  tool: Tool;
}

/**
 * Renders the FocusBar HUB sidebar:
 *   - Header row showing the current mode name (clickable → switch mode)
 *   - One collapsible group per ModeGroup
 *   - Each tool is a clickable item that focuses its target view container
 */
export class FocusBarTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly store: ModeStore) {
    store.onModeChange(() => this.refresh());
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    switch (node.kind) {
      case 'header': {
        const item = new vscode.TreeItem(
          `Mode: ${node.modeName}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.iconPath = new vscode.ThemeIcon(node.modeIcon ?? 'target');
        item.tooltip = node.modeDescription ?? 'Click to switch mode';
        item.contextValue = 'focusbar.header';
        item.command = {
          command: 'focusbar.switchMode',
          title: 'Switch Mode'
        };
        return item;
      }
      case 'group': {
        const item = new vscode.TreeItem(
          node.label,
          vscode.TreeItemCollapsibleState.Expanded
        );
        item.contextValue = 'focusbar.group';
        return item;
      }
      case 'tool': {
        const t = node.tool;
        const item = new vscode.TreeItem(
          t.label ?? t.id,
          vscode.TreeItemCollapsibleState.None
        );
        item.iconPath = (t.lightIconDataUri && t.darkIconDataUri)
          ? { light: vscode.Uri.parse(t.lightIconDataUri), dark: vscode.Uri.parse(t.darkIconDataUri) }
          : t.icon ? new vscode.ThemeIcon(t.icon) : undefined;
        item.tooltip = t.description ?? t.id;
        item.contextValue = 'focusbar.tool';
        item.command = this.commandForTool(t);
        return item;
      }
    }
  }

  getChildren(node?: TreeNode): TreeNode[] {
    const mode = this.store.current();

    if (!node) {
      const header: HeaderNode = {
        kind: 'header',
        modeName: mode.name,
        modeIcon: mode.icon,
        modeDescription: mode.description
      };
      const groups: GroupNode[] = mode.groups.map(g => ({
        kind: 'group',
        label: g.label,
        tools: g.tools
      }));
      return [header, ...groups];
    }

    if (node.kind === 'group') {
      return node.tools.map(tool => ({ kind: 'tool', tool } as ToolNode));
    }

    return [];
  }

  /**
   * Map a Tool to the VS Code command that should run on click.
   *
   * VS Code convention for view containers:
   *   - Built-ins: `workbench.view.{explorer|search|scm|debug|extensions}`
   *   - Extension-contributed: `workbench.view.extension.{containerId}`
   * For individual views inside a container, focus with `${viewId}.focus`.
   */
  private commandForTool(tool: Tool): vscode.Command {
    switch (tool.type) {
      case 'viewContainer':
        return { command: tool.id, title: 'Focus', arguments: [] };
      case 'view':
        return { command: `${tool.id}.focus`, title: 'Focus', arguments: [] };
      case 'command':
        return { command: tool.id, title: tool.label ?? tool.id, arguments: [] };
    }
  }
}
