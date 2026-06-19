/**
 * Grid layout manager for draggable, resizable panels.
 * Handles drag/drop, resizing, adding/removing panels.
 * Persists layout to localStorage.
 */
class DashboardGrid {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container #${containerId} not found`);
    }

    this.panels = [];  // Array of DashboardPanel instances
    this.gridSize = options.gridSize || 12;  // CSS grid columns
    this.storageKey = options.storageKey || 'dashboard_layout';
    this.isDragging = false;
    this.draggedPanel = null;
    this.filterManager = options.filterManager || null;  // NEW

    this._setupGrid();
  }

  /**
   * Set up the grid container CSS.
   */
  _setupGrid() {
    this.container.style.display = 'grid';
    this.container.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;
    this.container.style.gap = '12px';
    this.container.style.padding = '12px';
  }

  /**
   * Add a panel to the grid and render it.
   */
  addPanel(panel, gridCol, gridRow, colSpan = 4, rowSpan = 2) {
    if (this.panels.some(p => p.id === panel.id)) {
      console.warn(`Panel ${panel.id} already exists`);
      return;
    }

    // Create panel DOM element
    const el = document.createElement('div');
    el.className = 'dashboard-panel';
    el.id = `panel-${panel.id}`;
    el.style.gridColumn = `${gridCol} / span ${colSpan}`;
    el.style.gridRow = `${gridRow} / span ${rowSpan}`;
    el.dataset.panelId = panel.id;
    el.dataset.colSpan = colSpan;
    el.dataset.rowSpan = rowSpan;

    // Header with drag handle, title, buttons
    el.innerHTML = `
      <div class="panel-header" style="cursor: move; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); background: var(--bg-0);">
        <div style="display: flex; gap: 8px; align-items: center; flex: 1;">
          <span class="panel-drag-handle" style="color: var(--ink-3); font-size: 10px;">⋮⋮</span>
          <span class="panel-title" style="font-weight: 600; font-size: 13px;">${panel.title}</span>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <span class="panel-freshness" style="font-size: 10px; color: var(--ink-3);">—</span>
          <button class="panel-refresh-btn" style="background: none; border: none; cursor: pointer; color: var(--ink-3); font-size: 12px;">↻</button>
          <button class="panel-collapse-btn" style="background: none; border: none; cursor: pointer; color: var(--ink-3); font-size: 12px;">▼</button>
          <button class="panel-close-btn" style="background: none; border: none; cursor: pointer; color: var(--ink-3); font-size: 12px;">✕</button>
        </div>
      </div>
      <div class="panel-body" style="padding: 12px; overflow: auto; flex: 1; background: var(--bg-1);">
        <div style="color: var(--ink-4); font-size: 11px;">Loading...</div>
      </div>
    `;

    this.container.appendChild(el);
    panel.el = el;
    this.panels.push(panel);

    // Attach event listeners
    this._attachPanelListeners(panel, el);

    return el;
  }

  /**
   * Remove a panel from the grid.
   */
  removePanel(panelId) {
    const idx = this.panels.findIndex(p => p.id === panelId);
    if (idx === -1) return;

    const panel = this.panels[idx];
    if (panel.el) panel.el.remove();
    this.panels.splice(idx, 1);

    this.saveLayout();
  }

  /**
   * Attach drag/drop and button listeners to a panel.
   */
  _attachPanelListeners(panel, el) {
    const header = el.querySelector('.panel-header');
    const dragHandle = el.querySelector('.panel-drag-handle');
    const refreshBtn = el.querySelector('.panel-refresh-btn');
    const collapseBtn = el.querySelector('.panel-collapse-btn');
    const closeBtn = el.querySelector('.panel-close-btn');

    // Drag start on handle
    dragHandle.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.draggedPanel = panel;
      el.style.opacity = '0.7';
      e.preventDefault();
    });

    // Drag end
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.draggedPanel = null;
        el.style.opacity = '1';
        this.saveLayout();
      }
    });

    // Refresh button
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.refresh(this.getCurrentFilters());
    });

    // Collapse button
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.toggleCollapse();
      this.saveLayout();
    });

    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removePanel(panel.id);
    });
  }

  /**
   * Get current filters from FilterManager.
   */
  getCurrentFilters() {
    if (this.filterManager) {
      return this.filterManager.getFilters();
    }
    return {
      timeRange: '1h',
      userSegment: 'all',
      eventTypes: [],
      status: 'all',
    };
  }

  /**
   * Save layout to localStorage.
   */
  saveLayout() {
    const layout = this.panels.map(p => ({
      id: p.id,
      type: p.type,
      title: p.title,
      gridCol: p.el.style.gridColumn,
      gridRow: p.el.style.gridRow,
      colSpan: p.el.dataset.colSpan,
      rowSpan: p.el.dataset.rowSpan,
      isCollapsed: p.isCollapsed,
    }));
    localStorage.setItem(this.storageKey, JSON.stringify(layout));
  }

  /**
   * Load layout from localStorage.
   */
  loadLayout() {
    const saved = localStorage.getItem(this.storageKey);
    return saved ? JSON.parse(saved) : [];
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardGrid;
}
