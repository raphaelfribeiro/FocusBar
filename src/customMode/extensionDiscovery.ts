import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface DiscoveredContainer {
  commandId: string;
  title: string;
  /** Codicon name — used for built-ins. */
  icon?: string;
  /** Base64 data URI — used for extension-contributed icons. */
  iconDataUri?: string;
  location: 'activitybar' | 'panel';
  source: string;
  builtin: boolean;
}

/**
 * Inspects all installed extensions + built-ins and returns every view container
 * the user could plausibly want to add to a custom mode.
 */
export class ExtensionDiscovery {
  private static readonly BUILTINS: DiscoveredContainer[] = [
    { commandId: 'workbench.view.explorer',   title: 'Explorer',       icon: 'files',          location: 'activitybar', source: 'Built-in', builtin: true },
    { commandId: 'workbench.view.search',      title: 'Search',         icon: 'search',         location: 'activitybar', source: 'Built-in', builtin: true },
    { commandId: 'workbench.view.scm',         title: 'Source Control', icon: 'source-control', location: 'activitybar', source: 'Built-in', builtin: true },
    { commandId: 'workbench.view.debug',       title: 'Run and Debug',  icon: 'debug-alt',      location: 'activitybar', source: 'Built-in', builtin: true },
    { commandId: 'workbench.view.extensions',  title: 'Extensions',     icon: 'extensions',     location: 'activitybar', source: 'Built-in', builtin: true },
  ];

  list(): DiscoveredContainer[] {
    const result: DiscoveredContainer[] = [...ExtensionDiscovery.BUILTINS];

    for (const ext of vscode.extensions.all) {
      if (ext.id.startsWith('vscode.')) continue;

      const contributes = ext.packageJSON?.contributes;
      if (!contributes) continue;

      const containers = contributes.viewsContainers;
      if (!containers) continue;

      for (const location of ['activitybar', 'panel'] as const) {
        const list = containers[location];
        if (!Array.isArray(list)) continue;

        for (const container of list) {
          if (!container?.id || !container?.title) continue;

          const { icon, iconDataUri } = this.resolveIcon(container.icon, ext.extensionPath);
          result.push({
            commandId: `workbench.view.extension.${container.id}`,
            title: container.title,
            icon,
            iconDataUri,
            location,
            source: ext.packageJSON?.displayName ?? ext.id,
            builtin: false
          });
        }
      }
    }

    const seen = new Map<string, DiscoveredContainer>();
    for (const c of result) {
      if (!seen.has(c.commandId)) seen.set(c.commandId, c);
    }

    return Array.from(seen.values()).sort((a, b) => {
      if (a.builtin && !b.builtin) return -1;
      if (!a.builtin && b.builtin) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  private resolveIcon(rawIcon: unknown, extPath: string): { icon?: string; iconDataUri?: string } {
    if (!rawIcon) return {};

    // Object format: { "dark": "resources/icon-dark.svg", "light": "resources/icon-light.svg" }
    if (typeof rawIcon === 'object') {
      const obj = rawIcon as Record<string, unknown>;
      return this.resolveIcon(obj.dark ?? obj.light, extPath);
    }

    if (typeof rawIcon !== 'string') return {};

    // Codicon reference: "$(search)"
    const codiconMatch = rawIcon.match(/^\$\((.+)\)$/);
    if (codiconMatch) return { icon: codiconMatch[1] };

    // File path — read and encode as data URI so the webview can display it
    const fullPath = path.isAbsolute(rawIcon) ? rawIcon : path.join(extPath, rawIcon);
    // Try the exact path first, then common variations (no extension → .svg / .png)
    const candidates = [fullPath];
    if (!path.extname(fullPath)) {
      candidates.push(fullPath + '.svg', fullPath + '.png');
    }

    for (const candidate of candidates) {
      try {
        const data = fs.readFileSync(candidate);
        const ext = path.extname(candidate).toLowerCase();
        const mime = ext === '.svg'  ? 'image/svg+xml' :
                     ext === '.png'  ? 'image/png'     :
                     (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
        return { iconDataUri: `data:${mime};base64,${data.toString('base64')}` };
      } catch {
        // try next candidate
      }
    }
    return {};
  }
}
