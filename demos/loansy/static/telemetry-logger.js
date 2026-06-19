/**
 * Telemetry Logger - Auto-injected into all pages
 * Captures: clicks, inputs, API calls, console errors, page loads, form submissions
 * Sends to: POST /api/telemetry
 */

(function() {
  const TELEMETRY_ENDPOINT = '/api/telemetry';
  const BATCH_SIZE = 10;
  const BATCH_TIMEOUT = 5000; // 5 seconds
  const STORAGE_KEY = 'telemetry_pending_events';
  const MAX_STORED_EVENTS = 500;

  let eventQueue = [];
  let batchTimer = null;

  /**
   * Save events to localStorage as fallback when server is down
   */
  function saveToLocalStorage(events) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const combined = [...existing, ...events].slice(-MAX_STORED_EVENTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
    } catch (e) {
      console.debug('Failed to save telemetry to localStorage:', e);
    }
  }

  /**
   * Attempt to flush stored events from localStorage (on page load)
   */
  function flushStoredEvents() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (stored.length === 0) return;

      navigator.sendBeacon(TELEMETRY_ENDPOINT, JSON.stringify({events: stored}));
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.debug('Failed to flush stored telemetry:', e);
    }
  }

  /**
   * Log an event to the queue (batches before sending)
   */
  function queueEvent(eventType, data, page = null) {
    try {
      const event = {
        type: eventType,
        timestamp: new Date().toISOString(),
        page: page || window.location.href,
        data: data
      };

      eventQueue.push(event);

      // Send if batch is full
      if (eventQueue.length >= BATCH_SIZE) {
        flushEvents();
      } else if (!batchTimer) {
        // Start batch timer if not already running
        batchTimer = setTimeout(flushEvents, BATCH_TIMEOUT);
      }
    } catch (e) {
      console.debug('Telemetry queueEvent error:', e);
    }
  }

  /**
   * Flush all queued events to backend with localStorage fallback
   */
  function flushEvents() {
    if (eventQueue.length === 0) return;

    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = null;

    const eventsToSend = [...eventQueue];
    eventQueue = [];

    try {
      const payload = JSON.stringify({events: eventsToSend});
      const sent = navigator.sendBeacon(TELEMETRY_ENDPOINT, payload);

      if (!sent) {
        saveToLocalStorage(eventsToSend);
      }
    } catch (e) {
      console.debug('Telemetry flushEvents error:', e);
      saveToLocalStorage(eventsToSend);
    }
  }

  // Attempt to flush any stored events when page loads
  window.addEventListener('load', flushStoredEvents);

  /**
   * Extract comprehensive click information from target element
   */
  function extractClickInfo(target) {
    if (!target) {
      return { text: '[no target]', id: null, class: null, testid: null, tagName: 'UNKNOWN' };
    }

    // ── Text extraction with fallback chain ──
    let text = (target.innerText || '').trim();
    if (!text) text = (target.textContent || '').trim();
    if (!text) text = target.title || '';
    if (!text) text = target.getAttribute('aria-label') || '';
    if (!text) text = target.getAttribute('data-label') || '';
    if (!text && target.type === 'submit') text = target.value || '';
    if (!text && target.placeholder) text = target.placeholder;
    if (!text) {
      // Walk up parents to find text
      let parent = target.parentElement;
      let depth = 0;
      while (parent && depth < 3) {
        const parentText = (parent.innerText || '').trim().substring(0, 50);
        if (parentText && parentText.length > 3) {
          text = parentText;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
    }
    if (!text) text = target.tagName.toLowerCase();
    if (!text) text = '[no text]';

    // ── Element identity ──
    const id = target.id || null;
    const classList = target.className || '';

    // Extract first non-utility class
    let meaningfulClass = null;
    if (classList && typeof classList === 'string') {
      const classes = classList.split(' ');
      for (const cls of classes) {
        if (cls && !cls.match(/^(btn|col|row|form|grid|container|wrapper|d-|m-|p-|w-|h-|flex|align|justify)/i)) {
          meaningfulClass = cls;
          break;
        }
      }
    }

    const testid = target.getAttribute('data-testid') || null;
    const tagName = target.tagName || 'UNKNOWN';

    // ── Action intent ──
    const href = target.href || null;
    const dataAction = target.getAttribute('data-action') || null;
    const buttonType = target.type || null;
    const hasOnclick = !!target.onclick;

    // ── Context ──
    let parentSelector = null;
    if (target.parentElement) {
      const parent = target.parentElement;
      if (parent.id) {
        parentSelector = parent.tagName.toLowerCase() + '#' + parent.id;
      } else if (parent.className) {
        const firstClass = parent.className.split(' ')[0];
        if (firstClass) {
          parentSelector = parent.tagName.toLowerCase() + '.' + firstClass;
        }
      }
    }

    return {
      text: text.substring(0, 100),
      id: id,
      class: meaningfulClass || (typeof classList === 'string' ? classList.substring(0, 100) : ''),
      testid: testid,
      tagName: tagName,
      action: {
        href: href,
        dataAction: dataAction,
        type: buttonType,
        hasOnclick: hasOnclick
      },
      parentSelector: parentSelector,
      isClickable: !!(href || dataAction || buttonType || hasOnclick)
    };
  }

  /**
   * Capture click events
   */
  document.addEventListener('click', function(e) {
    try {
      const target = e.target;
      const clickInfo = extractClickInfo(target);

      queueEvent('click', {
        element: {
          text: clickInfo.text,
          id: clickInfo.id,
          class: clickInfo.class,
          testid: clickInfo.testid,
          tagName: clickInfo.tagName
        },
        action: clickInfo.action,
        context: {
          x: e.clientX,
          y: e.clientY,
          parentSelector: clickInfo.parentSelector,
          isClickable: clickInfo.isClickable
        }
      });
    } catch (e) {
      console.debug('Telemetry click handler error:', e);
    }
  }, true);

  /**
   * Capture input/change events
   */
  document.addEventListener('input', function(e) {
    try {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        queueEvent('input', {
          element: {
            id: target.id,
            name: target.name,
            type: target.type,
            tagName: target.tagName
          },
          value: target.value?.substring(0, 100) // Don't send full values (privacy)
        });
      }
    } catch (e) {
      console.debug('Telemetry input handler error:', e);
    }
  }, true);

  /**
   * Capture form submissions
   */
  document.addEventListener('submit', function(e) {
    try {
      const form = e.target;
      const formData = new FormData(form);
      const data = {};

      for (let [key, value] of formData.entries()) {
        data[key] = value?.substring(0, 100);
      }

      queueEvent('form_submit', {
        form_id: form.id,
        form_name: form.name,
        action: form.action,
        method: form.method,
        data: data
      });
    } catch (e) {
      console.debug('Telemetry form handler error:', e);
    }
  }, true);

  /**
   * Intercept fetch/XHR API calls
   */
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    try {
      const [resource, config] = args;
      const startTime = performance.now();

      return originalFetch.apply(this, args).then(response => {
        try {
          const duration = Math.round(performance.now() - startTime);
          const status = response.status;

          // Log API call
          queueEvent('api_request', {
            method: config?.method || 'GET',
            url: resource instanceof Request ? resource.url : resource,
            status: status,
            duration: duration,
            headers: config?.headers ? Object.keys(config.headers) : []
          });

          return response;
        } catch (e) {
          console.debug('Telemetry fetch response handler error:', e);
          throw e;
        }
      }).catch(error => {
        try {
          const duration = Math.round(performance.now() - startTime);

          queueEvent('api_error', {
            method: config?.method || 'GET',
            url: resource instanceof Request ? resource.url : resource,
            error: error.message,
            duration: duration
          });
        } catch (e) {
          console.debug('Telemetry fetch error handler error:', e);
        }

        throw error;
      });
    } catch (e) {
      console.debug('Telemetry fetch wrapper error:', e);
      throw e;
    }
  };

  /**
   * Capture XHR (older AJAX) calls
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try {
      this._telemetryMethod = method;
      this._telemetryUrl = url;
      this._telemetryStartTime = performance.now();
      return originalXHROpen.apply(this, arguments);
    } catch (e) {
      console.debug('Telemetry XHR open error:', e);
      return originalXHROpen.apply(this, arguments);
    }
  };

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    try {
      const self = this;

      this.addEventListener('loadend', function() {
        try {
          const duration = Math.round(performance.now() - self._telemetryStartTime);

          queueEvent('api_request', {
            method: self._telemetryMethod,
            url: self._telemetryUrl,
            status: self.status,
            duration: duration,
            headers: self._telemetryMethod ? [] : []
          });
        } catch (e) {
          console.debug('Telemetry XHR loadend handler error:', e);
        }
      });

      return originalXHRSend.apply(this, arguments);
    } catch (e) {
      console.debug('Telemetry XHR send error:', e);
      return originalXHRSend.apply(this, arguments);
    }
  };

  /**
   * Capture console errors
   */
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = function(...args) {
    try {
      queueEvent('console_error', {
        message: args[0]?.toString?.() || String(args[0]),
        stack: args[1]?.stack || new Error().stack,
        args: args.map(a => String(a).substring(0, 100))
      });
    } catch (e) {
      console.debug('Telemetry console.error handler error:', e);
    }
    return originalError.apply(console, args);
  };

  console.warn = function(...args) {
    try {
      queueEvent('console_warn', {
        message: args[0]?.toString?.() || String(args[0]),
        args: args.map(a => String(a).substring(0, 100))
      });
    } catch (e) {
      console.debug('Telemetry console.warn handler error:', e);
    }
    return originalWarn.apply(console, args);
  };

  /**
   * Capture uncaught errors
   */
  window.addEventListener('error', function(event) {
    try {
      queueEvent('uncaught_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || ''
      });
    } catch (e) {
      console.debug('Telemetry uncaught error handler error:', e);
    }
  });

  /**
   * Capture unhandled promise rejections
   */
  window.addEventListener('unhandledrejection', function(event) {
    try {
      queueEvent('unhandled_rejection', {
        reason: event.reason?.toString?.() || String(event.reason),
        stack: event.reason?.stack || ''
      });
    } catch (e) {
      console.debug('Telemetry unhandled rejection handler error:', e);
    }
  });

  /**
   * Capture page visibility changes (detect tab switches)
   */
  document.addEventListener('visibilitychange', function() {
    queueEvent('visibility_change', {
      visible: !document.hidden,
      state: document.visibilityState
    });
  });

  /**
   * Capture page load time
   */
  window.addEventListener('load', function() {
    if (performance.timing) {
      const timing = performance.timing;
      queueEvent('page_load', {
        url: window.location.href,
        duration: timing.loadEventEnd - timing.navigationStart,
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        request: timing.responseStart - timing.requestStart,
        response: timing.responseEnd - timing.responseStart,
        dom_interactive: timing.domInteractive - timing.navigationStart
      });
    }
  });

  /**
   * Flush remaining events before page unload
   */
  window.addEventListener('beforeunload', flushEvents);

  // Periodic flush (every 10 seconds)
  setInterval(flushEvents, 10000);

  // Expose global API for manual logging
  window.TelemetryLog = queueEvent;
})();
