import * as vscode from 'vscode';
import { Mode } from '../types';

/**
 * Trades modes as JSON via the system clipboard. Two reasons we don't write
 * files: (a) clipboard is one-step share — paste into Slack, GitHub, gist;
 * (b) it sidesteps the cross-platform file picker rabbit hole.
 *
 * This is the foundation for the future "Mode Packs" feature — same JSON
 * format, just hosted on a URL instead of pasted.
 */
export class ModeImportExport {
  /** Returns a JSON string the user can paste anywhere. */
  serialize(mode: Mode): string {
    return JSON.stringify(mode, null, 2);
  }

  async copyToClipboard(mode: Mode): Promise<void> {
    await vscode.env.clipboard.writeText(this.serialize(mode));
    vscode.window.setStatusBarMessage(
      `FocusBar: "${mode.name}" copied to clipboard`,
      2500
    );
  }

  /**
   * Parse a JSON string into a Mode. Validates required fields and rejects
   * anything that smells off — better to refuse than corrupt the user's
   * settings.
   */
  parse(raw: string): Mode {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Clipboard does not contain valid JSON.');
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Expected a JSON object describing a mode.');
    }

    const candidate = data as Partial<Mode>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string' ||
      !Array.isArray(candidate.groups)
    ) {
      throw new Error('Mode JSON is missing required fields: id, name, groups.');
    }

    // Sanity-check group shape so downstream code doesn't crash on bad input.
    for (const g of candidate.groups) {
      if (typeof g.label !== 'string' || !Array.isArray(g.tools)) {
        throw new Error('Every group must have a string label and a tools array.');
      }
      for (const t of g.tools) {
        if (typeof t.id !== 'string' || typeof t.type !== 'string') {
          throw new Error('Every tool must have id and type.');
        }
      }
    }

    return candidate as Mode;
  }

  async readFromClipboard(): Promise<Mode> {
    const raw = await vscode.env.clipboard.readText();
    if (!raw) throw new Error('Clipboard is empty.');
    return this.parse(raw);
  }
}
