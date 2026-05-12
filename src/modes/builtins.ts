import { Mode } from '../types';

/**
 * Built-in modes. Users can override any of these by defining a mode
 * with the same `id` in `focusbar.modes` in their settings.
 *
 * Tool IDs follow VS Code's command conventions:
 *  - Built-in view containers: `workbench.view.{explorer|search|scm|debug|extensions}`
 *  - Extension-contributed containers: `workbench.view.extension.{containerId}`
 */
export const BUILTIN_MODES: Mode[] = [
  {
    id: 'default',
    name: 'Default',
    icon: 'home',
    description: 'Everything visible — your usual setup.',
    groups: [
      {
        label: 'Workspace',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.explorer', label: 'Explorer', icon: 'files' },
          { type: 'viewContainer', id: 'workbench.view.search', label: 'Search', icon: 'search' },
          { type: 'viewContainer', id: 'workbench.view.scm', label: 'Source Control', icon: 'source-control' },
          { type: 'viewContainer', id: 'workbench.view.debug', label: 'Run and Debug', icon: 'debug-alt' },
          { type: 'viewContainer', id: 'workbench.view.extensions', label: 'Extensions', icon: 'extensions' }
        ]
      }
    ]
  },

  {
    id: 'frontend',
    name: 'Frontend',
    icon: 'browser',
    description: 'Building UIs — React, Vue, Svelte, etc.',
    groups: [
      {
        label: 'Workspace',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.explorer', label: 'Explorer', icon: 'files' },
          { type: 'viewContainer', id: 'workbench.view.search', label: 'Search', icon: 'search' }
        ]
      },
      {
        label: 'Git',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.scm', label: 'Source Control', icon: 'source-control' }
        ]
      },
      {
        label: 'Run',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.debug', label: 'Run and Debug', icon: 'debug-alt' }
        ]
      }
    ],
    autoDetect: [
      { kind: 'languageId', languageId: 'typescriptreact', priority: 10 },
      { kind: 'languageId', languageId: 'javascriptreact', priority: 10 },
      { kind: 'languageId', languageId: 'vue', priority: 10 },
      { kind: 'languageId', languageId: 'svelte', priority: 10 },
      { kind: 'filePattern', pattern: '**/*.{tsx,jsx,vue,svelte}', priority: 10 },
      { kind: 'workspaceMarker', pattern: '**/package.json', priority: 3 }
    ]
  },

  {
    id: 'backend',
    name: 'Backend',
    icon: 'server',
    description: 'APIs, services, databases.',
    groups: [
      {
        label: 'Workspace',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.explorer', label: 'Explorer', icon: 'files' },
          { type: 'viewContainer', id: 'workbench.view.search', label: 'Search', icon: 'search' }
        ]
      },
      {
        label: 'Run & Debug',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.debug', label: 'Run and Debug', icon: 'debug-alt' }
        ]
      },
      {
        label: 'Git',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.scm', label: 'Source Control', icon: 'source-control' }
        ]
      }
    ],
    autoDetect: [
      { kind: 'languageId', languageId: 'csharp', priority: 10 },
      { kind: 'languageId', languageId: 'go', priority: 10 },
      { kind: 'languageId', languageId: 'java', priority: 10 },
      { kind: 'languageId', languageId: 'rust', priority: 10 },
      { kind: 'languageId', languageId: 'python', priority: 8 },
      { kind: 'filePattern', pattern: '**/*.{cs,go,java,rs}', priority: 10 },
      { kind: 'workspaceMarker', pattern: '**/{Cargo.toml,go.mod,pom.xml,*.csproj}', priority: 4 }
    ]
  },

  {
    id: 'devops',
    name: 'DevOps',
    icon: 'cloud',
    description: 'Infrastructure, containers, pipelines.',
    groups: [
      {
        label: 'Workspace',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.explorer', label: 'Explorer', icon: 'files' }
        ]
      },
      {
        label: 'Git',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.scm', label: 'Source Control', icon: 'source-control' }
        ]
      },
      {
        label: 'Containers',
        tools: [
          {
            type: 'viewContainer',
            id: 'workbench.view.extension.dockerView',
            label: 'Docker',
            icon: 'package',
            description: 'Requires the Docker extension (ms-azuretools.vscode-docker)'
          }
        ]
      }
    ],
    autoDetect: [
      { kind: 'filePattern', pattern: '**/Dockerfile*', priority: 15 },
      { kind: 'filePattern', pattern: '**/{docker-compose,compose}*.{yml,yaml}', priority: 15 },
      { kind: 'filePattern', pattern: '**/*.{tf,tfvars}', priority: 15 },
      { kind: 'filePattern', pattern: '**/k8s/**/*.{yml,yaml}', priority: 12 },
      { kind: 'workspaceMarker', pattern: '**/Dockerfile', priority: 5 }
    ]
  },

  {
    id: 'debug',
    name: 'Debug',
    icon: 'bug',
    description: 'Active debug session — eyes on the call stack.',
    groups: [
      {
        label: 'Debug',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.debug', label: 'Run and Debug', icon: 'debug-alt' }
        ]
      },
      {
        label: 'Workspace',
        tools: [
          { type: 'viewContainer', id: 'workbench.view.explorer', label: 'Explorer', icon: 'files' }
        ]
      }
    ],
    autoDetect: [
      { kind: 'debugActive', priority: 100 }
    ]
  }
];
