# FocusBar

> Context-aware modes for VS Code. Curate your sidebar tools by what you're actually doing.

Tired of an Activity Bar with 15 icons you only use 3 of at a time? FocusBar adds a single icon — the **HUB** — whose sidebar reorganizes itself based on the *mode* you're in. Frontend work? You see Explorer, Search, Git, Debug. Editing a Dockerfile? You see Docker, SCM. Debug session running? You see Run & Debug front and center.

**Modes switch automatically** based on the file you're editing, the markers in your workspace (`package.json`, `Dockerfile`, `Cargo.toml`, etc.), and whether a debug session is active. Or pin one manually with `Ctrl/Cmd+K M`.

## Why FocusBar (and not just hiding icons)

VS Code's extension API does not let third-party extensions reorder or individually hide other extensions' Activity Bar icons (open issue since 2019: [microsoft/vscode#86275](https://github.com/microsoft/vscode/issues/86275)). FocusBar takes a different route: it gives you **one** icon — a curated, mode-aware launcher that focuses the right view container with a click. You can keep the native Activity Bar, or hide it entirely (`View → Appearance → Activity Bar`) and navigate from the HUB.

## Quickstart

1. Install the extension.
2. Click the FocusBar target icon in the Activity Bar.
3. The sidebar shows the active mode's curated tools, grouped.
4. `Ctrl/Cmd+K M` to switch modes. Or just open a `.tsx` file — Frontend mode kicks in automatically.

## Built-in modes

| Mode | Triggers |
|------|----------|
| **Default** | Fallback when nothing else matches |
| **Frontend** | `.tsx`, `.jsx`, `.vue`, `.svelte`, languageId `typescriptreact`, etc. |
| **Backend** | `.cs`, `.go`, `.java`, `.rs`, `.py`; `Cargo.toml`, `go.mod`, `pom.xml`, `*.csproj` |
| **DevOps** | `Dockerfile`, `docker-compose.yml`, `*.tf`, `k8s/**/*.yml` |
| **Debug** | Active debug session (highest priority — overrides everything) |

## Custom modes

Add your own in `settings.json`:

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
- [ ] Visual mode editor (webview) instead of editing JSON
- [ ] Hide native Activity Bar via in-HUB toggle
- [ ] Sync custom modes across machines via Settings Sync

## Limitations (be honest)

- We can't reorder or hide individual icons from other extensions on the native Activity Bar — that's an API limitation, not a FocusBar bug.
- `workspaceMarker` scanning has a hard cap (25 files per pattern) for speed.
- Auto-switch picks the highest-priority match; ties are resolved by mode declaration order.

## License

MIT
