# FocusBar

> Replace VS Code's Activity Bar with a curated, mode-aware sidebar that reorganizes itself based on what you're actually doing.

Tired of an Activity Bar with 15 icons you only use 3 of at a time? FocusBar **replaces the native Activity Bar** with a single curated sidebar that shows only the tools relevant to your current mode — Frontend, Backend, DevOps, Debug, or whatever you define. Tools are **grouped by category**, not dumped in a flat list.

**Modes switch automatically** based on the file you're editing, the markers in your workspace (`package.json`, `Dockerfile`, `Cargo.toml`, etc.), and whether a debug session is active. Or pin one manually with `Ctrl/Cmd+K M`.

## How the "replace" works

VS Code's extension API does not let third-party extensions reorder or individually hide other extensions' Activity Bar icons ([microsoft/vscode#86275](https://github.com/microsoft/vscode/issues/86275), open since 2019). FocusBar takes a different route:

1. It **hides the entire native Activity Bar** using the built-in `workbench.activityBar.location` setting (the same one in `View → Appearance → Activity Bar Position → Hidden`).
2. It contributes **its own sidebar** where the tools are grouped by category per mode.
3. Each tool item, when clicked, focuses its target view container — so clicking "Docker" inside the FocusBar sidebar opens the Docker view exactly as the native Docker icon would.

Result: instead of 15 flat icons always visible, you see one curated, grouped sidebar that changes with context.

**Trade-off (be honest about it):** this is all-or-nothing. The native Activity Bar is either fully visible or fully hidden — there's no API to hide some icons and keep others. If you need a hybrid, you'll need to live with the native bar visible.

## Quickstart

1. Install the extension.
2. Run **FocusBar: Replace Activity Bar (Hide Native)** from the Command Palette — or click the layout icon at the top of the FocusBar sidebar.
3. The native Activity Bar disappears; the FocusBar sidebar takes over.
4. `Ctrl/Cmd+K M` to switch modes. Or just open a `.tsx` file — Frontend mode kicks in automatically.
5. To revert anytime, run **FocusBar: Restore Native Activity Bar**.

If you'd rather keep the native bar visible and use FocusBar as a *secondary* curated view alongside it, just skip step 2 — FocusBar works fine without replace mode.

## Built-in modes

| Mode | Triggers |
|------|----------|
| **Default** | Fallback when nothing else matches — shows all built-in views plus every installed extension that contributes a view container |
| **Frontend** | `.tsx`, `.jsx`, `.vue`, `.svelte`, languageId `typescriptreact`, etc. |
| **Backend** | `.cs`, `.go`, `.java`, `.rs`, `.py`; `Cargo.toml`, `go.mod`, `pom.xml`, `*.csproj` |
| **DevOps** | `Dockerfile`, `docker-compose.yml`, `*.tf`, `k8s/**/*.yml` |
| **Debug** | Active debug session (highest priority — overrides everything) |

## Custom modes — visual editor

Run **FocusBar: Open Mode Editor** (Command Palette or pencil icon in the sidebar header) to manage modes visually. No JSON editing required.

The editor lets you:

- Create, rename, and delete custom modes
- Add/remove groups inside a mode and rename them inline
- **Drag-and-drop** tools from the side palette directly into any group — or drag to reorder within/between groups
- **Drag-and-drop** to reorder groups themselves
- Extension icons load automatically in monochrome, matching VS Code's activity bar style
- Edit auto-detect rules (file patterns, language IDs, workspace markers, debug)
- **Edit built-in modes** directly — changes are saved as user overrides; a `modified` badge appears on the tab
- **Reset to default** — one click restores any customized built-in back to its factory state
- **Duplicate** any mode as a starting point for a new one
- **From installed extensions** — auto-generates a mode by categorizing every view container currently installed
- **Export** any mode to your clipboard as JSON (foundation for shareable "Mode Packs")
- **Import** a mode from clipboard JSON

## Custom modes — JSON (advanced)

If you'd rather edit `settings.json` directly, the schema is unchanged:

```json
"focusbar.modes": [
  {
    "id": "ai",
    "name": "AI Dev",
    "icon": "sparkle",
    "description": "Working with LLMs and AI tooling",
    "groups": [
      {
        "label": "AI",
        "tools": [
          { "type": "viewContainer", "id": "workbench.view.extension.github-copilot", "label": "Copilot", "icon": "copilot" }
        ]
      },
      {
        "label": "Workspace",
        "tools": [
          { "type": "viewContainer", "id": "workbench.view.explorer", "label": "Explorer", "icon": "files" }
        ]
      }
    ],
    "autoDetect": [
      { "kind": "filePattern", "pattern": "**/prompts/**", "priority": 12 }
    ]
  }
]
```

### Finding view container IDs

For built-in containers: `workbench.view.{explorer|search|scm|debug|extensions}`.
For extension-contributed containers: `workbench.view.extension.{id}` — find the id in the extension's `package.json` under `contributes.viewsContainers.activitybar[].id`.

### Auto-detect rule kinds

| Kind | Matches when |
|------|------|
| `debugActive` | A debug session is running |
| `languageId` | Active editor's languageId equals `languageId` |
| `filePattern` | Active file's path matches `pattern` (glob) |
| `workspaceMarker` | A file matching `pattern` exists anywhere in the workspace |

Each rule has an optional `priority` (default 0). Highest wins.

## Settings

| Setting | Default | What it does |
|---------|---------|--------------|
| `focusbar.autoSwitch` | `true` | Auto-switch mode on context changes |
| `focusbar.currentMode` | `default` | Active mode ID (managed by the extension) |
| `focusbar.statusBarBadge` | `true` | Show the active mode in the status bar |
| `focusbar.modes` | `[]` | User-defined modes |

## Development

```bash
npm install
npm run compile         # tsc -p ./
# F5 in VS Code to launch the Extension Development Host
npm run package         # produces a .vsix you can install locally
```

## Roadmap

- [ ] Pin a mode to disable auto-switch temporarily without flipping the setting
- [ ] "Mode Packs" — shareable mode bundles (Frontend Pro, Rust DevOps, etc.)
- [ ] Sync custom modes across machines via Settings Sync

## Limitations (be honest)

- **All-or-nothing on the native bar.** Replace mode hides the entire Activity Bar — there's no public API to hide individual icons (Docker, GitLens, etc.) while keeping others (Explorer, SCM). If you need that level of control, this isn't your tool.
- `workspaceMarker` scanning has a hard cap (25 files per pattern) for speed.
- Auto-switch picks the highest-priority match; ties are resolved by mode declaration order.
- Replace mode toggles `workbench.activityBar.location` globally. If you sync settings across machines, the change syncs too.

## License

MIT
