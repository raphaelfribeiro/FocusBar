import { Mode, Tool } from '../types';
import { DiscoveredContainer, ExtensionDiscovery } from './extensionDiscovery';

/**
 * Builders for the four ways a user can create a custom mode:
 *   1. Blank (empty shell with one empty group)
 *   2. Duplicate (copy an existing mode and reset its id)
 *   3. From installed extensions (auto-grouped by category heuristic)
 *   4. Import from JSON (handled in modeImportExport.ts)
 */
export class ModeTemplates {
  constructor(private readonly discovery: ExtensionDiscovery) {}

  blank(id: string, name: string): Mode {
    return {
      id,
      name,
      icon: 'target',
      description: '',
      groups: [{ label: 'Tools', tools: [] }],
      autoDetect: []
    };
  }

  duplicate(source: Mode, newId: string, newName: string): Mode {
    return {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: newName
    };
  }

  /**
   * Scan installed view containers and produce a sensible starter mode.
   * Categorization is rule-of-thumb — the user is expected to refine after.
   */
  fromInstalled(id: string, name: string): Mode {
    const containers = this.discovery.list();

    const buckets: Record<string, DiscoveredContainer[]> = {
      Workspace: [],
      Git: [],
      'Run & Debug': [],
      Containers: [],
      Testing: [],
      AI: [],
      Other: []
    };

    for (const c of containers) {
      buckets[this.bucketFor(c)].push(c);
    }

    const groups = Object.entries(buckets)
      .filter(([, tools]) => tools.length > 0)
      .map(([label, tools]) => ({
        label,
        tools: tools.map(c => this.toTool(c))
      }));

    return {
      id,
      name,
      icon: 'rocket',
      description: 'Auto-generated from installed extensions. Edit to taste.',
      groups: groups.length > 0 ? groups : [{ label: 'Tools', tools: [] }],
      autoDetect: []
    };
  }

  private bucketFor(c: DiscoveredContainer): string {
    const t = c.title.toLowerCase();
    const id = c.commandId.toLowerCase();

    if (t.includes('explorer') || t.includes('search') || t.includes('outline')) {
      return 'Workspace';
    }
    if (
      t.includes('source control') ||
      t.includes('git') ||
      id.includes('scm') ||
      id.includes('github') ||
      id.includes('gitlens')
    ) {
      return 'Git';
    }
    if (t.includes('debug') || t.includes('run')) {
      return 'Run & Debug';
    }
    if (t.includes('docker') || t.includes('kubernetes') || t.includes('container')) {
      return 'Containers';
    }
    if (t.includes('test')) {
      return 'Testing';
    }
    if (t.includes('copilot') || t.includes('ai') || t.includes('claude') || t.includes('chat')) {
      return 'AI';
    }
    return 'Other';
  }

  private toTool(c: DiscoveredContainer): Tool {
    return {
      type: 'viewContainer',
      id: c.commandId,
      label: c.title,
      icon: c.icon,
      description: c.source
    };
  }
}
