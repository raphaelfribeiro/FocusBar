import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface DiscoveredContainer {
  commandId: string;
  title: string;
  /** Codicon name — used for built-ins and codicon-based extension icons. */
  icon?: string;
  /** Base64 data URI of the original icon — used in webviews. */
  iconDataUri?: string;
  /** Theme-aware monochrome data URIs for native tree view icons. */
  lightIconDataUri?: string;
  darkIconDataUri?: string;
  location: 'activitybar' | 'panel';
  source: string;
  builtin: boolean;
}

// Colors that match VS Code's sidebar icon appearance per theme
const DARK_ICON_COLOR  = '#C5C5C5';
const LIGHT_ICON_COLOR = '#424242';

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

          const resolved = this.resolveIcon(container.icon, ext.extensionPath);
          result.push({
            commandId: `workbench.view.extension.${container.id}`,
            title: container.title,
            ...resolved,
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

  private resolveIcon(
    rawIcon: unknown,
    extPath: string
  ): Pick<DiscoveredContainer, 'icon' | 'iconDataUri' | 'lightIconDataUri' | 'darkIconDataUri'> {
    if (!rawIcon) return {};

    // Object format: { "dark": "path", "light": "path" } — resolve each variant separately
    if (typeof rawIcon === 'object') {
      const obj = rawIcon as Record<string, unknown>;
      if (obj.dark || obj.light) {
        const dark  = obj.dark  ? this.resolveIconFile(String(obj.dark),  extPath) : undefined;
        const light = obj.light ? this.resolveIconFile(String(obj.light), extPath) : undefined;
        const fallback = dark ?? light;
        return {
          iconDataUri:      fallback?.original,
          lightIconDataUri: light?.monochrome(LIGHT_ICON_COLOR) ?? dark?.monochrome(LIGHT_ICON_COLOR),
          darkIconDataUri:  dark?.monochrome(DARK_ICON_COLOR)   ?? light?.monochrome(DARK_ICON_COLOR),
        };
      }
      return {};
    }

    if (typeof rawIcon !== 'string') return {};

    // Codicon reference: "$(search)"
    const codiconMatch = rawIcon.match(/^\$\((.+)\)$/);
    if (codiconMatch) return { icon: codiconMatch[1] };

    // File path
    const resolved = this.resolveIconFile(rawIcon, extPath);
    if (!resolved) return {};

    return {
      iconDataUri:      resolved.original,
      lightIconDataUri: resolved.monochrome(LIGHT_ICON_COLOR),
      darkIconDataUri:  resolved.monochrome(DARK_ICON_COLOR),
    };
  }

  private resolveIconFile(
    rawPath: string,
    extPath: string
  ): { original: string; monochrome: (color: string) => string | undefined } | undefined {
    const fullPath = path.isAbsolute(rawPath) ? rawPath : path.join(extPath, rawPath);
    const candidates = [fullPath];
    if (!path.extname(fullPath)) {
      candidates.push(fullPath + '.svg', fullPath + '.png');
    }

    for (const candidate of candidates) {
      try {
        const data = fs.readFileSync(candidate);
        const ext  = path.extname(candidate).toLowerCase();

        if (ext === '.svg') {
          const svgText = data.toString('utf-8');
          const originalUri = `data:image/svg+xml;base64,${Buffer.from(svgText).toString('base64')}`;
          return {
            original:   originalUri,
            monochrome: (color: string) => {
              const mono = this.makeSvgMonochrome(svgText, color);
              return `data:image/svg+xml;base64,${Buffer.from(mono).toString('base64')}`;
            }
          };
        }

        // PNG / JPEG — can't recolor; return original only (tree view will fall back to generic icon)
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const originalUri = `data:${mime};base64,${data.toString('base64')}`;
        return {
          original:   originalUri,
          monochrome: () => undefined   // signals "no monochrome available"
        };
      } catch {
        // try next candidate
      }
    }
    return undefined;
  }

  /**
   * Replaces all fill/stroke color values in an SVG with a single flat color,
   * producing a monochrome icon that matches VS Code's sidebar icon style.
   * Values of "none" and "transparent" are intentionally preserved.
   */
  private makeSvgMonochrome(svg: string, color: string): string {
    return svg
      // Presentation attributes
      .replace(/\bfill="(?!none\b|transparent\b)([^"]*)"/gi,   `fill="${color}"`)
      .replace(/\bstroke="(?!none\b|transparent\b)([^"]*)"/gi, `stroke="${color}"`)
      // Inline style properties
      .replace(/\bfill\s*:\s*(?!none\b|transparent\b)[^;}"']*/gi,   `fill: ${color}`)
      .replace(/\bstroke\s*:\s*(?!none\b|transparent\b)[^;}"']*/gi, `stroke: ${color}`)
      // Gradient stop colors
      .replace(/\bstop-color="([^"]*)"/gi,                `stop-color="${color}"`)
      .replace(/\bstop-color\s*:\s*[^;}"']*/gi,           `stop-color: ${color}`);
  }
}
