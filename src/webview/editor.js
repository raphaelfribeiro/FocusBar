// @ts-check
/// <reference no-default-lib="true"/>
/// <reference lib="dom" />

(function () {
  // @ts-ignore - provided by VS Code
  const vscode = acquireVsCodeApi();

  /** @typedef {{ type: 'viewContainer'|'view'|'command', id: string, label?: string, icon?: string, description?: string }} Tool */
  /** @typedef {{ label: string, tools: Tool[] }} Group */
  /** @typedef {{ kind: 'filePattern'|'languageId'|'workspaceMarker'|'debugActive', pattern?: string, languageId?: string, priority?: number }} AutoRule */
  /** @typedef {{ id: string, name: string, icon?: string, description?: string, groups: Group[], autoDetect?: AutoRule[], _builtin?: boolean }} Mode */

  /** @type {{ modes: Mode[], selectedId: string|null, dirty: boolean, containers: any[], paletteOpen: boolean, paletteSearch: string }} */
  const state = {
    modes: [],
    selectedId: null,
    dirty: false,
    containers: [],
    paletteOpen: true,
    paletteSearch: ''
  };

  // ---------------- DOM refs ----------------
  const modeTabsEl = /** @type {HTMLElement} */ (document.getElementById('modeTabs'));
  const emptyStateEl = /** @type {HTMLElement} */ (document.getElementById('emptyState'));
  const editorContentEl = /** @type {HTMLElement} */ (document.getElementById('editorContent'));
  const tplGroup = /** @type {HTMLTemplateElement} */ (document.getElementById('tpl-group'));
  const tplTool = /** @type {HTMLTemplateElement} */ (document.getElementById('tpl-tool'));

  // ---------------- Messaging ----------------
  window.addEventListener('message', e => {
    const msg = e.data;
    switch (msg.type) {
      case 'init':
        state.modes = msg.modes;
        state.containers = msg.containers;
        if (state.modes.length > 0 && !state.selectedId) {
          state.selectedId = state.modes[0].id;
        }
        render();
        break;
      case 'modesUpdated':
        state.modes = msg.modes;
        state.dirty = false;
        render();
        break;
      case 'containersUpdated':
        state.containers = msg.containers;
        break;
    }
  });

  function post(msg) { vscode.postMessage(msg); }

  // ---------------- State helpers ----------------
  function getSelected() {
    return state.modes.find(m => m.id === state.selectedId) || null;
  }

  function selectMode(id) {
    // confirm() doesn't work in VS Code webviews — just discard and switch.
    // The toolbar's Save/Discard buttons handle intentional save workflow.
    state.selectedId = id;
    state.dirty = false;
    render();
  }

  function markDirty() { state.dirty = true; renderToolbar(); }

  // ---------------- Mutations ----------------

  /**
   * @param {(m: Mode) => Mode} updater
   * @param {boolean} [rerender=true] - pass false for input handlers to keep focus
   */
  function updateSelected(updater, rerender = true) {
    const idx = state.modes.findIndex(m => m.id === state.selectedId);
    if (idx < 0) return;
    state.modes[idx] = updater(state.modes[idx]);
    markDirty();
    if (rerender) renderEditor();
  }

  function addGroup() {
    updateSelected(m => ({ ...m, groups: [...m.groups, { label: 'New group', tools: [] }] }));
  }

  function deleteGroup(index) {
    updateSelected(m => ({ ...m, groups: m.groups.filter((_, i) => i !== index) }));
  }

  function updateGroupLabel(index, label) {
    // rerender=false so the input keeps focus while typing
    updateSelected(m => ({
      ...m,
      groups: m.groups.map((g, i) => i === index ? { ...g, label } : g)
    }), false);
  }

  function containerToTool(container) {
    return {
      type: 'viewContainer',
      id: container.commandId,
      label: container.title,
      icon: container.icon,
      description: container.source
    };
  }

  function addToolToGroup(groupIndex, container) {
    updateSelected(m => ({
      ...m,
      groups: m.groups.map((g, i) => i === groupIndex ? {
        ...g,
        tools: [...g.tools, containerToTool(container)]
      } : g)
    }));
  }

  function addToolBeforeIndex(groupIndex, beforeIndex, container) {
    updateSelected(m => ({
      ...m,
      groups: m.groups.map((g, i) => {
        if (i !== groupIndex) return g;
        const tools = [...g.tools];
        tools.splice(beforeIndex, 0, containerToTool(container));
        return { ...g, tools };
      })
    }));
  }

  function removeTool(groupIndex, toolIndex) {
    updateSelected(m => ({
      ...m,
      groups: m.groups.map((g, i) => i === groupIndex ? {
        ...g,
        tools: g.tools.filter((_, j) => j !== toolIndex)
      } : g)
    }));
  }

  function moveGroup(from, to) {
    if (from === to) return;
    updateSelected(m => {
      const groups = [...m.groups];
      const [moved] = groups.splice(from, 1);
      groups.splice(to, 0, moved);
      return { ...m, groups };
    });
  }

  function moveTool(groupIndex, from, to) {
    if (from === to) return;
    updateSelected(m => ({
      ...m,
      groups: m.groups.map((g, i) => {
        if (i !== groupIndex) return g;
        const tools = [...g.tools];
        const [moved] = tools.splice(from, 1);
        tools.splice(to, 0, moved);
        return { ...g, tools };
      })
    }));
  }

  // ---------------- Render ----------------
  function render() {
    renderModeList();
    renderEditor();
  }

  function renderModeList() {
    modeTabsEl.innerHTML = '';
    for (const mode of state.modes) {
      const tab = document.createElement('button');
      tab.className = 'mode-tab';
      if (mode.id === state.selectedId) tab.classList.add('active');

      const icon = document.createElement('i');
      icon.className = `codicon codicon-${mode.icon || 'target'} mode-tab-icon`;
      tab.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'mode-tab-name';
      name.textContent = mode.name;
      tab.appendChild(name);

      if (mode._builtin) {
        // Original built-in, not yet customized
        const badge = document.createElement('span');
        badge.className = 'mode-tab-badge';
        badge.textContent = 'built-in';
        tab.appendChild(badge);
      } else if (mode._isBuiltinId) {
        // Built-in that the user has customized
        const badge = document.createElement('span');
        badge.className = 'mode-tab-badge mode-tab-badge--modified';
        badge.textContent = 'modified';
        tab.appendChild(badge);
      }

      tab.addEventListener('click', () => selectMode(mode.id));
      modeTabsEl.appendChild(tab);
    }
  }

  function renderEditor() {
    const mode = getSelected();
    if (!mode) {
      emptyStateEl.hidden = false;
      editorContentEl.hidden = true;
      return;
    }
    emptyStateEl.hidden = true;
    editorContentEl.hidden = false;
    editorContentEl.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'editor-header';
    const nameInput = document.createElement('input');
    nameInput.className = 'mode-name-input';
    nameInput.type = 'text';
    nameInput.value = mode.name;
    nameInput.addEventListener('input', () =>
      updateSelected(m => ({ ...m, name: nameInput.value }), false)
    );
    header.appendChild(nameInput);

    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    toolbar.id = 'editorToolbar';
    header.appendChild(toolbar);
    editorContentEl.appendChild(header);
    renderToolbar();

    // Meta row (icon + description)
    const meta = document.createElement('div');
    meta.className = 'mode-meta';
    meta.innerHTML = `
      <div class="meta-field">
        <label>Icon</label>
        <input class="icon-input" type="text" value="${escape(mode.icon || '')}" placeholder="target" />
      </div>
      <div class="meta-field" style="flex:1">
        <label>Description</label>
        <input type="text" style="flex:1; width:auto" value="${escape(mode.description || '')}" placeholder="Optional" />
      </div>
    `;
    const iconInput = /** @type {HTMLInputElement} */ (meta.querySelector('.icon-input'));
    iconInput.addEventListener('input', () => updateSelected(m => ({ ...m, icon: iconInput.value }), false));
    const descInput = /** @type {HTMLInputElement} */ (meta.querySelectorAll('input[type="text"]')[1]);
    descInput.addEventListener('input', () => updateSelected(m => ({ ...m, description: descInput.value }), false));
    editorContentEl.appendChild(meta);

    // Tool palette - drag source for adding tools to groups
    editorContentEl.appendChild(renderPalette());

    // Groups
    const groups = document.createElement('div');
    groups.className = 'groups-container';
    mode.groups.forEach((g, i) => groups.appendChild(renderGroup(g, i, false)));
    editorContentEl.appendChild(groups);

    const addGroupBtn = document.createElement('button');
    addGroupBtn.className = 'ghost-btn add-group';
    addGroupBtn.innerHTML = '<i class="codicon codicon-add"></i> Add group';
    addGroupBtn.addEventListener('click', addGroup);
    editorContentEl.appendChild(addGroupBtn);

    // Auto-detect section
    editorContentEl.appendChild(renderAutoDetect(mode, false));
  }

  function renderToolbar() {
    const toolbar = document.getElementById('editorToolbar');
    if (!toolbar) return;
    const mode = getSelected();
    if (!mode) return;
    toolbar.innerHTML = '';

    if (state.dirty) {
      toolbar.appendChild(primaryBtn('Save', save));
      toolbar.appendChild(secondaryBtn('Discard', () => post({ type: 'reload' })));
    }

    toolbar.appendChild(secondaryBtn('Duplicate', () => post({ type: 'duplicate', id: mode.id })));
    toolbar.appendChild(secondaryBtn('Export', () => post({ type: 'export', id: mode.id })));

    if (mode._isBuiltinId && !mode._builtin) {
      // User override exists — offer reset back to factory default
      toolbar.appendChild(dangerBtn('Reset to default', resetToDefault));
    } else if (!mode._isBuiltinId) {
      // Pure user mode — can be deleted entirely
      toolbar.appendChild(dangerBtn('Delete', deleteSelected));
    }
  }

  // ---------------- Icon helper ----------------

  /**
   * Returns either an <img> (data URI icon) or a <i> (codicon) for a container icon.
   * @param {string|undefined} iconDataUri
   * @param {string|undefined} codiconName
   * @param {string} cssClass
   */
  function makeIconEl(iconDataUri, codiconName, cssClass) {
    if (iconDataUri) {
      const img = document.createElement('img');
      img.src = iconDataUri;
      img.className = cssClass + ' icon-img';
      return img;
    }
    const i = document.createElement('i');
    i.className = `codicon codicon-${codiconName || 'symbol-misc'} ${cssClass}`;
    return i;
  }

  // ---------------- Tool palette ----------------

  function renderPalette() {
    const section = document.createElement('div');
    section.className = 'palette-section';

    const toggle = document.createElement('button');
    toggle.className = 'palette-toggle';
    toggle.innerHTML =
      `<i class="codicon codicon-${state.paletteOpen ? 'chevron-down' : 'chevron-right'}"></i>` +
      `<span>Available tools</span>` +
      `<span class="palette-hint">drag into a group below</span>`;
    toggle.addEventListener('click', () => {
      state.paletteOpen = !state.paletteOpen;
      renderEditor();
    });
    section.appendChild(toggle);

    if (!state.paletteOpen) return section;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'palette-search';
    searchInput.placeholder = 'Filter tools…';
    searchInput.value = state.paletteSearch;
    section.appendChild(searchInput);

    const listEl = document.createElement('div');
    listEl.className = 'palette-list';

    function refreshList() {
      listEl.innerHTML = '';
      const q = state.paletteSearch.toLowerCase();
      const filtered = state.containers.filter(c =>
        !q || c.title.toLowerCase().includes(q) || (c.source || '').toLowerCase().includes(q)
      );
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'palette-empty';
        empty.textContent = q ? 'No matching tools.' : 'No tools discovered yet.';
        listEl.appendChild(empty);
      } else {
        filtered.forEach(c => listEl.appendChild(makePaletteItem(c)));
      }
    }

    searchInput.addEventListener('input', () => {
      state.paletteSearch = searchInput.value;
      refreshList();
    });

    refreshList();
    section.appendChild(listEl);
    return section;
  }

  function makePaletteItem(container) {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.draggable = true;
    item.title = container.source || '';

    const iconEl = makeIconEl(container.iconDataUri, container.icon, 'palette-item-icon');

    const meta = document.createElement('div');
    meta.className = 'palette-item-meta';

    const labelEl = document.createElement('span');
    labelEl.className = 'palette-item-label';
    labelEl.textContent = container.title;

    const sourceEl = document.createElement('span');
    sourceEl.className = 'palette-item-source';
    sourceEl.textContent = container.source || (container.builtin ? 'Built-in' : '');

    meta.append(labelEl, sourceEl);
    item.append(iconEl, meta);

    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('focusbar/palette', JSON.stringify(container));
      e.dataTransfer.effectAllowed = 'copy';
      item.classList.add('dragging');
      e.stopPropagation();
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    return item;
  }

  // ---------------- Group & tool render ----------------

  function renderGroup(group, index, readonly) {
    const node = /** @type {HTMLElement} */ (tplGroup.content.firstElementChild.cloneNode(true));
    node.dataset.groupIndex = String(index);

    const labelInput = /** @type {HTMLInputElement} */ (node.querySelector('.group-label'));
    labelInput.value = group.label;
    labelInput.disabled = readonly;
    labelInput.addEventListener('input', () => updateGroupLabel(index, labelInput.value));

    const deleteBtn = /** @type {HTMLButtonElement} */ (node.querySelector('[data-action="delete-group"]'));
    if (readonly) deleteBtn.style.display = 'none';
    deleteBtn.addEventListener('click', () => deleteGroup(index));

    const toolList = /** @type {HTMLUListElement} */ (node.querySelector('.tool-list'));
    group.tools.forEach((t, ti) => toolList.appendChild(renderTool(t, index, ti, readonly)));

    const dropHint = /** @type {HTMLElement} */ (node.querySelector('.group-drop-hint'));
    if (group.tools.length > 0 || readonly) dropHint.style.display = 'none';

    if (!readonly) attachGroupDnD(node, index);

    return node;
  }

  function renderTool(tool, groupIndex, toolIndex, readonly) {
    const node = /** @type {HTMLElement} */ (tplTool.content.firstElementChild.cloneNode(true));
    node.dataset.toolIndex = String(toolIndex);
    node.dataset.groupIndex = String(groupIndex);

    // Resolve icon: prefer live container lookup (has dataUri), fall back to stored codicon
    const container = state.containers.find(c => c.commandId === tool.id);
    const iconDataUri = container?.iconDataUri;
    const codiconName = tool.icon || container?.icon;
    const iconPlaceholder = /** @type {HTMLElement} */ (node.querySelector('.tool-icon'));
    const iconEl = makeIconEl(iconDataUri, codiconName, 'tool-icon');
    iconPlaceholder.replaceWith(iconEl);

    node.querySelector('.tool-label').textContent = tool.label || tool.id;
    node.querySelector('.tool-source').textContent = tool.description || tool.id;

    const removeBtn = /** @type {HTMLButtonElement} */ (node.querySelector('[data-action="remove-tool"]'));
    if (readonly) removeBtn.style.display = 'none';
    removeBtn.addEventListener('click', () => removeTool(groupIndex, toolIndex));

    if (readonly) node.draggable = false;
    if (!readonly) attachToolDnD(node, groupIndex, toolIndex);

    return node;
  }

  function renderAutoDetect(mode, readonly) {
    const section = document.createElement('div');
    section.className = 'detect-section';
    section.innerHTML = '<h3>Auto-detect rules</h3>';
    const rules = mode.autoDetect || [];

    rules.forEach((rule, i) => {
      const row = document.createElement('div');
      row.className = 'detect-rule';

      const kindSelect = document.createElement('select');
      ['filePattern', 'languageId', 'workspaceMarker', 'debugActive'].forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        if (rule.kind === k) opt.selected = true;
        kindSelect.appendChild(opt);
      });
      kindSelect.disabled = readonly;
      kindSelect.addEventListener('change', () => updateRule(i, { kind: /** @type {any} */ (kindSelect.value) }));
      row.appendChild(kindSelect);

      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.placeholder = rule.kind === 'languageId' ? 'typescript' : '**/*.tsx';
      valueInput.value = rule.pattern || rule.languageId || '';
      valueInput.disabled = readonly || rule.kind === 'debugActive';
      valueInput.addEventListener('input', () => {
        const key = rule.kind === 'languageId' ? 'languageId' : 'pattern';
        updateRule(i, { [key]: valueInput.value }, false);
      });
      row.appendChild(valueInput);

      const priorityInput = document.createElement('input');
      priorityInput.type = 'number';
      priorityInput.value = String(rule.priority ?? 10);
      priorityInput.disabled = readonly;
      priorityInput.addEventListener('input', () => updateRule(i, { priority: Number(priorityInput.value) }, false));
      row.appendChild(priorityInput);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-btn danger';
      removeBtn.innerHTML = '<i class="codicon codicon-close"></i>';
      removeBtn.disabled = readonly;
      removeBtn.addEventListener('click', () => removeRule(i));
      row.appendChild(removeBtn);

      section.appendChild(row);
    });

    if (!readonly) {
      const addBtn = document.createElement('button');
      addBtn.className = 'ghost-btn';
      addBtn.style.marginTop = '8px';
      addBtn.innerHTML = '<i class="codicon codicon-add"></i> Add rule';
      addBtn.addEventListener('click', () =>
        updateSelected(m => ({
          ...m,
          autoDetect: [...(m.autoDetect || []), { kind: 'filePattern', pattern: '', priority: 10 }]
        }))
      );
      section.appendChild(addBtn);
    }

    return section;
  }

  function updateRule(index, patch, rerender = true) {
    updateSelected(m => ({
      ...m,
      autoDetect: (m.autoDetect || []).map((r, i) => i === index ? { ...r, ...patch } : r)
    }), rerender);
  }

  function removeRule(index) {
    updateSelected(m => ({
      ...m,
      autoDetect: (m.autoDetect || []).filter((_, i) => i !== index)
    }));
  }

  // ---------------- Drag-and-drop ----------------

  function attachGroupDnD(node, index) {
    let dragDepth = 0;
    let handlePressed = false;

    // Track whether the drag started from the gripper handle.
    // We can't use e.target inside dragstart because the browser always sets
    // e.target to the draggable element (the section), not the clicked child.
    const handle = node.querySelector('.drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => { handlePressed = true; });
      handle.addEventListener('mouseup',   () => { handlePressed = false; });
    }

    node.addEventListener('dragstart', e => {
      if (!handlePressed) {
        e.preventDefault();
        return;
      }
      handlePressed = false;
      e.dataTransfer.setData('focusbar/group', String(index));
      e.dataTransfer.effectAllowed = 'move';
      node.classList.add('dragging');
    });
    node.addEventListener('dragend', () => {
      handlePressed = false;
      node.classList.remove('dragging');
      dragDepth = 0;
      node.classList.remove('drop-target');
    });

    node.addEventListener('dragenter', e => {
      if (e.dataTransfer.types.includes('focusbar/group') ||
          e.dataTransfer.types.includes('focusbar/palette')) {
        dragDepth++;
        node.classList.add('drop-target');
      }
    });
    node.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('focusbar/group') ||
          e.dataTransfer.types.includes('focusbar/palette')) {
        e.preventDefault();
      }
    });
    node.addEventListener('dragleave', () => {
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        node.classList.remove('drop-target');
      }
    });
    node.addEventListener('drop', e => {
      e.preventDefault();
      dragDepth = 0;
      node.classList.remove('drop-target');

      if (e.dataTransfer.types.includes('focusbar/palette')) {
        try {
          const container = JSON.parse(e.dataTransfer.getData('focusbar/palette'));
          addToolToGroup(index, container);
        } catch { /* malformed payload */ }
      } else {
        const from = Number(e.dataTransfer.getData('focusbar/group'));
        moveGroup(from, index);
      }
    });
  }

  function attachToolDnD(node, groupIndex, toolIndex) {
    node.addEventListener('dragstart', e => {
      e.dataTransfer.setData('focusbar/tool', JSON.stringify({ groupIndex, toolIndex }));
      e.dataTransfer.effectAllowed = 'move';
      node.classList.add('dragging');
      e.stopPropagation();
    });
    node.addEventListener('dragend', () => node.classList.remove('dragging'));
    node.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('focusbar/tool') ||
          e.dataTransfer.types.includes('focusbar/palette')) {
        e.preventDefault();
        node.classList.add('drop-target');
        e.stopPropagation();
      }
    });
    node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
    node.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove('drop-target');

      if (e.dataTransfer.types.includes('focusbar/palette')) {
        try {
          const container = JSON.parse(e.dataTransfer.getData('focusbar/palette'));
          addToolBeforeIndex(groupIndex, toolIndex, container);
        } catch { /* malformed payload */ }
      } else {
        try {
          const payload = JSON.parse(e.dataTransfer.getData('focusbar/tool'));
          if (payload.groupIndex === groupIndex) {
            moveTool(groupIndex, payload.toolIndex, toolIndex);
          }
        } catch { /* malformed payload */ }
      }
    });
  }

  // ---------------- Top-level actions ----------------
  function save() {
    const mode = getSelected();
    if (!mode) return;
    post({ type: 'save', mode });
  }

  function deleteSelected() {
    const mode = getSelected();
    if (!mode || mode._isBuiltinId) return;
    post({ type: 'delete', id: mode.id });
  }

  function resetToDefault() {
    const mode = getSelected();
    if (!mode || !mode._isBuiltinId) return;
    post({ type: 'resetBuiltin', id: mode.id });
  }

  // ---------------- Top-level button handlers ----------------
  document.querySelector('[data-action="new-mode"]')?.addEventListener('click', () => post({ type: 'newMode' }));
  document.querySelector('[data-action="import"]')?.addEventListener('click', () => post({ type: 'import' }));

  // ---------------- Helpers ----------------
  function primaryBtn(label, onClick) {
    const b = document.createElement('button');
    b.className = 'primary-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function secondaryBtn(label, onClick) {
    const b = document.createElement('button');
    b.className = 'secondary-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function dangerBtn(label, onClick) {
    const b = document.createElement('button');
    b.className = 'danger-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------- Boot ----------------
  post({ type: 'ready' });
})();
