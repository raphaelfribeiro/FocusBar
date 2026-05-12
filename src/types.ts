// Shared type definitions for FocusBar.

export type ToolType = 'viewContainer' | 'view' | 'command';

export interface Tool {
  /** Where to route the click:
   *  - 'viewContainer' → executes the container's focus command directly
   *    (e.g. 'workbench.view.explorer' or 'workbench.view.extension.dockerView').
   *  - 'view' → executes `${id}.focus` to focus a specific view inside a container.
   *  - 'command' → executes the given command ID with no args.
   */
  type: ToolType;
  id: string;
  label?: string;
  /** Codicon name, e.g. 'files', 'source-control', 'debug-alt'. */
  icon?: string;
  description?: string;
}

export interface ModeGroup {
  label: string;
  tools: Tool[];
}

export type AutoDetectRule =
  | { kind: 'filePattern'; pattern: string; priority?: number }
  | { kind: 'languageId'; languageId: string; priority?: number }
  | { kind: 'workspaceMarker'; pattern: string; priority?: number }
  | { kind: 'debugActive'; priority?: number };

export interface Mode {
  id: string;
  name: string;
  /** Codicon name used in QuickPick and status bar. */
  icon?: string;
  description?: string;
  groups: ModeGroup[];
  autoDetect?: AutoDetectRule[];
}
