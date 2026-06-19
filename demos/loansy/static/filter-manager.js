/**
 * Global filter state manager.
 * Subscribes panels to filter changes.
 * Triggers panel refreshes when filters change.
 */
class FilterManager {
  constructor(options = {}) {
    this.filters = {
      timeRange: options.timeRange || '1h',
      userSegment: options.userSegment || 'all',
      eventTypes: options.eventTypes || [],
      status: options.status || 'all',
    };

    this.subscribers = [];  // Panels subscribed to filter changes
    this.storageKey = options.storageKey || 'dashboard_filters';

    this._loadFilters();
  }

  /**
   * Register a panel to be notified of filter changes.
   */
  subscribe(panel) {
    if (!this.subscribers.includes(panel)) {
      this.subscribers.push(panel);
    }
  }

  /**
   * Unregister a panel.
   */
  unsubscribe(panel) {
    const idx = this.subscribers.indexOf(panel);
    if (idx !== -1) {
      this.subscribers.splice(idx, 1);
    }
  }

  /**
   * Update a filter and notify all subscribers.
   */
  setFilter(key, value) {
    if (!(key in this.filters)) {
      console.warn(`Unknown filter key: ${key}`);
      return;
    }

    if (this.filters[key] === value) {
      return;  // No change
    }

    this.filters[key] = value;
    this._saveFilters();
    this._notifySubscribers();
  }

  /**
   * Update multiple filters at once.
   */
  setFilters(updates) {
    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      if (key in this.filters && this.filters[key] !== value) {
        this.filters[key] = value;
        changed = true;
      }
    }
    if (changed) {
      this._saveFilters();
      this._notifySubscribers();
    }
  }

  /**
   * Get all current filters.
   */
  getFilters() {
    return { ...this.filters };
  }

  /**
   * Notify all subscribed panels to refresh.
   */
  async _notifySubscribers() {
    await Promise.allSettled(
      this.subscribers.map(panel => panel.refresh(this.filters))
    );
  }

  /**
   * Save filters to localStorage.
   */
  _saveFilters() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.filters));
  }

  /**
   * Load filters from localStorage.
   */
  _loadFilters() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.filters = { ...this.filters, ...JSON.parse(saved) };
      } catch (err) {
        console.warn('Failed to load filters from localStorage:', err);
      }
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilterManager;
}
