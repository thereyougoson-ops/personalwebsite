const API_ENDPOINT = '/api/telemetry';
const STATS_ENDPOINT = '/api/telemetry/stats';
const USERS_API = '/api/users';
let currentOffset = 0;
let currentLimit = 50;
let autoRefresh = true;
let allEvents = [];
let currentUserId = null;

const eventIcons = {
    click: '🖱️', input: '⌨️', api_request: '📤', api_error: '❌',
    console_error: '⚠️', console_warn: '⚠️', page_load: '📄',
    form_submit: '📋', uncaught_error: '💥', unhandled_rejection: '💔',
    visibility_change: '👁️', telegram_action: '🤖'
};

function getRiskSeverity(riskScore) {
    if (riskScore >= 70) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
}

function formatTimeDelta(ms) {
    if (!ms) return '';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `+${h}h`;
    if (m > 0) return `+${m}m`;
    return `+${s}s`;
}

async function loadEvents() {
    const eventType = document.getElementById('filterType').value;
    const sinceMinutes = document.getElementById('filterTime').value;
    const page = document.getElementById('filterPage').value;

    const params = new URLSearchParams({
        limit: currentLimit,
        offset: currentOffset,
        ...(eventType && { type: eventType }),
        since_minutes: sinceMinutes,
        ...(page && { page })
    });

    try {
        const response = await fetch(`${API_ENDPOINT}?${params}`);
        const data = await response.json();
        allEvents = data.events || [];
        renderEvents();
        loadStats();
        updateThreatCounter();
    } catch (e) {
        console.error('Failed to load events:', e);
    }
}

function renderEvents() {
    const container = document.getElementById('eventsContainer');
    const search = document.getElementById('searchInput').value.toLowerCase();

    let filtered = allEvents.filter(event => {
        if (!search) return true;
        return JSON.stringify(event).toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-events">No events captured</div>';
        return;
    }

    container.innerHTML = filtered.map((event, idx) => {
        const severity = getRiskSeverity(event.risk_score || 0);
        const delay = (idx * 0.05);
        return `
            <div class="event severity-${severity}" data-id="${event._id}" data-user-id="${event.user_id || ''}" style="animation-delay: ${delay}s;">
                <div class="event-header">
                    <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
                    <div class="event-icon">${eventIcons[event.type] || '📍'}</div>
                    <div class="event-type">${event.type}</div>
                    <div class="event-summary">${getSummary(event)}</div>
                    <div class="event-arrow">▶</div>
                </div>
                <div class="event-details">
                    ${renderDetails(event)}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.event').forEach(elem => {
        elem.addEventListener('click', (e) => {
            if (e.target.closest('.event-details')) return;
            elem.classList.toggle('expanded');

            const userId = elem.dataset.userId;
            if (userId && userId !== '0' && userId !== '') {
                openUserPanel(parseInt(userId));
            }
        });
    });
}

async function openUserPanel(userId) {
    currentUserId = userId;
    const panel = document.getElementById('investigationPanel');
    panel.style.display = 'flex';

    try {
        const response = await fetch(`${USERS_API}/${userId}/identity`);
        if (!response.ok) throw new Error('User not found');
        const identity = await response.json();

        document.getElementById('userName').textContent = `${identity.username} (${identity.telegram_id})`;
        document.getElementById('userId').textContent = identity.telegram_id;
        document.getElementById('userIp').textContent = identity.current_ip || '—';
        document.getElementById('userLocation').textContent =
            identity.location ? `${identity.location.city}, ${identity.location.country}` : '—';
        document.getElementById('userWallet').textContent =
            identity.linked_wallets.length > 0 ? identity.linked_wallets[0].address.slice(0, 15) + '...' : '—';
        document.getElementById('userCredit').textContent = identity.credit_score;

        const riskScore = identity.risk_score || 0;
        document.getElementById('userRisk').textContent = `${riskScore} (${getRiskSeverity(riskScore).toUpperCase()})`;

        // Force load FLOW tab on open
        setTimeout(() => loadUserTimeline(userId), 100);
    } catch (e) {
        console.error('Failed to load user identity:', e);
        document.getElementById('userName').textContent = 'User Not Found';
    }
}

async function loadUserTimeline(userId) {
    const timeRange = document.getElementById('flowTimeRange')?.value || 'all';
    const sinceMinutes = timeRange === 'all' ? 'all' : (parseInt(timeRange) * 24 * 60).toString();

    try {
        const response = await fetch(`${USERS_API}/${userId}/timeline?since_minutes=${sinceMinutes}`);
        const data = await response.json();
        const timeline = document.getElementById('flowTimeline');

        if (!data.events || data.events.length === 0) {
            timeline.innerHTML = '<div style="color: #a0aec0; padding: 20px; text-align: center;">No activity recorded</div>';
            return;
        }

        const actionIcons = {
            'page_load': '📄', 'click': '🖱️', 'input': '⌨️', 'api_request': '📤',
            'form_submit': '📋', 'loan_request': '💰', 'payment': '💳', 'error': '❌'
        };

        timeline.innerHTML = data.events.map((evt, idx) => {
            const time = new Date(evt.timestamp).toLocaleTimeString();
            const delta = evt.duration_since_last_action_ms ? formatTimeDelta(evt.duration_since_last_action_ms) : '';
            const icon = actionIcons[evt.action] || actionIcons[evt.type] || '📍';
            const isLoan = evt.action && evt.action.includes('loan');
            const severity = isLoan ? 'critical' : 'info';

            return `
                <div class="timeline-item ${severity}">
                    <span style="display: block; margin-bottom: 4px;">
                        <span style="font-size: 18px; margin-right: 8px;">${icon}</span>
                        <span class="timeline-time">${time}</span>
                    </span>
                    <span class="timeline-action">${evt.action || evt.type}</span>
                    ${delta ? `<span class="timeline-delta">${delta}</span>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Failed to load timeline:', e);
        document.getElementById('flowTimeline').innerHTML = '<div style="color: #ef4444; padding: 20px;">Error loading timeline</div>';
    }
}

async function loadUserPatterns(userId) {
    try {
        const response = await fetch(`${USERS_API}/${userId}/patterns?since_days=7`);
        const data = await response.json();
        const content = document.getElementById('patternsContent');
        const stats = data.session_stats;

        if (!stats || stats.total_sessions === 0) {
            content.innerHTML = '<div style="color: #a0aec0; padding: 20px; text-align: center;">No patterns detected (no activity)</div>';
            return;
        }

        let html = `
            <div class="pattern-section">
                <div class="pattern-title">📊 Session Statistics</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 4px; border-left: 2px solid #3b82f6;">
                        <div style="font-size: 10px; color: #a0aec0;">Avg Duration</div>
                        <div style="font-size: 14px; color: #3b82f6; font-weight: 600; margin-top: 4px;">${stats.avg_duration_minutes}m</div>
                    </div>
                    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 4px; border-left: 2px solid #10b981;">
                        <div style="font-size: 10px; color: #a0aec0;">Total Sessions</div>
                        <div style="font-size: 14px; color: #10b981; font-weight: 600; margin-top: 4px;">${stats.total_sessions}</div>
                    </div>
                </div>
            </div>
        `;

        if (stats.most_active_hours && stats.most_active_hours.length > 0) {
            html += `
                <div class="pattern-section">
                    <div class="pattern-title">🕐 Most Active Hours</div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px;">
                        ${stats.most_active_hours.map(h => `<span style="background: #3b82f6; color: #fff; padding: 4px 8px; border-radius: 3px; font-size: 10px; font-weight: 600;">${h}:00</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (data.repeated_sequences && data.repeated_sequences.length > 0) {
            html += '<div class="pattern-section"><div class="pattern-title">🔄 Repeated Sequences</div>';
            data.repeated_sequences.forEach(seq => {
                html += `<div style="background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 3px; margin-top: 6px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #3b82f6;">${seq.sequence.join(' → ')}</span>
                    <span style="background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 2px; font-weight: 600;">${seq.count}x</span>
                </div>`;
            });
            html += '</div>';
        }

        content.innerHTML = html;
    } catch (e) {
        console.error('Failed to load patterns:', e);
        document.getElementById('patternsContent').innerHTML = '<div style="color: #ef4444; padding: 20px;">Error loading patterns</div>';
    }
}

async function loadUserCorrelations(userId) {
    try {
        const response = await fetch(`${USERS_API}/${userId}/correlations`);
        const data = await response.json();
        const content = document.getElementById('correlationsContent');
        let html = '';

        if (data.shared_ip && data.shared_ip.length > 0) {
            data.shared_ip.forEach(item => {
                html += `
                    <div class="correlation-item info">
                        <span class="correlation-label">⚠️ Shared IP</span>
                        <span style="font-size: 11px; font-family: 'Geist Mono', monospace;">${item.ip}</span>
                        <div style="font-size: 10px; color: #a0aec0; margin-top: 4px;">with ${item.other_users.join(', ')}</div>
                    </div>
                `;
            });
        }

        if (data.shared_wallet && data.shared_wallet.length > 0) {
            data.shared_wallet.forEach(item => {
                html += `
                    <div class="correlation-item warning">
                        <span class="correlation-label">🚨 Shared Wallet</span>
                        <span style="font-size: 11px; font-family: 'Geist Mono', monospace;">${item.address.slice(0, 15)}...</span>
                        <div style="font-size: 10px; color: #a0aec0; margin-top: 4px;">with ${item.other_users.join(', ')}</div>
                    </div>
                `;
            });
        }

        if (data.wash_lending && data.wash_lending.length > 0) {
            data.wash_lending.forEach(item => {
                html += `
                    <div class="correlation-item critical">
                        <span class="correlation-label">🚨 CRITICAL: Wash Lending</span>
                        <div style="font-size: 10px; color: #a0aec0; margin-top: 4px;">Circular lending detected</div>
                    </div>
                `;
            });
        }

        if (data.impossible_travel && data.impossible_travel.length > 0) {
            data.impossible_travel.forEach(item => {
                html += `
                    <div class="correlation-item warning">
                        <span class="correlation-label">⚠️ Impossible Travel</span>
                        <div style="font-size: 10px; color: #a0aec0; margin-top: 4px;">
                            ${item.location_a.city} → ${item.location_b.city} (${item.distance_km}km in ${item.time_between_minutes}min)
                        </div>
                    </div>
                `;
            });
        }

        if (html === '') {
            html = '<div style="color: #a0aec0; padding: 20px; text-align: center;">No correlations detected</div>';
        }

        content.innerHTML = html;
    } catch (e) {
        console.error('Failed to load correlations:', e);
        document.getElementById('correlationsContent').innerHTML = '<div style="color: #ef4444; padding: 20px;">Error loading correlations</div>';
    }
}

function updateThreatCounter() {
    const threats = allEvents.filter(e => e.risk_score >= 70).length;
    const highRisk = allEvents.filter(e => e.risk_score >= 50).length;
    const anomalies = 0;

    document.getElementById('threatCounter').textContent =
        `🚨 ACTIVE THREATS: ${threats} | HIGH-RISK USERS: ${highRisk} | ANOMALIES: ${anomalies}`;
    document.getElementById('syncStatus').textContent =
        `AUTO-UPDATE | Last update: ${new Date().toLocaleTimeString()}`;
}

async function loadStats() {
    const sinceMinutes = document.getElementById('filterTime').value;
    try {
        const response = await fetch(`${STATS_ENDPOINT}?since_minutes=${sinceMinutes}`);
        const stats = await response.json();
        document.getElementById('statTotal').textContent = stats.total_events;
        document.getElementById('statErrors').textContent = stats.errors;
        document.getElementById('statDuration').textContent = formatDuration(stats.session_duration_seconds);
        document.getElementById('statPages').textContent = stats.pages.length;
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

function formatDuration(seconds) {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

function getSummary(event) {
    try {
        switch (event.type) {
            case 'click':
                const elem = event.data?.element;
                return `<strong>${elem?.text || elem?.tagName || 'Click'}</strong>`;
            case 'input':
                const inp = event.data?.element;
                return `Input: <strong>${inp?.name || inp?.id || 'Field'}</strong>`;
            case 'api_request':
                return `${event.data?.method || 'REQ'} <strong>${event.data?.url || 'API'}</strong>`;
            case 'console_error':
                return `Error: <strong>${event.data?.message || 'Unknown'}</strong>`;
            case 'page_load':
                return `<strong>${event.page || 'Page Load'}</strong>`;
            case 'form_submit':
                return `Form: <strong>${event.data?.form_id || event.data?.form_name || 'Submit'}</strong>`;
            case 'visibility_change':
                return `Visibility: <strong>${event.data?.state || 'Unknown'}</strong>`;
            default:
                return `<strong>${event.type || 'Event'}</strong>`;
        }
    } catch (e) {
        return `<strong>${event.type || 'Event'}</strong>`;
    }
}

function renderDetails(event) {
    const rows = [];
    const data = event.data || {};
    Object.entries(data).forEach(([key, value]) => {
        rows.push(`
            <div class="detail-row">
                <div class="detail-label">${key}</div>
                <div class="detail-value">${formatValue(value)}</div>
            </div>
        `);
    });
    return rows.join('');
}

function formatValue(value) {
    if (typeof value === 'object') {
        return '<pre>' + JSON.stringify(value, null, 2) + '</pre>';
    }
    return value;
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('closePanel').addEventListener('click', () => {
        document.getElementById('investigationPanel').style.display = 'none';
        currentUserId = null;
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tab}Tab`).classList.add('active');

            if (currentUserId) {
                if (tab === 'flow') loadUserTimeline(currentUserId);
                else if (tab === 'patterns') loadUserPatterns(currentUserId);
                else if (tab === 'risks') loadUserCorrelations(currentUserId);
            }
        });
    });

    document.getElementById('filterType').addEventListener('change', () => {
        currentOffset = 0;
        loadEvents();
    });

    document.getElementById('filterTime').addEventListener('change', () => {
        currentOffset = 0;
        loadEvents();
    });

    document.getElementById('filterPage').addEventListener('change', () => {
        currentOffset = 0;
        loadEvents();
    });

    document.getElementById('searchInput').addEventListener('input', renderEvents);

    document.getElementById('clearFilters').addEventListener('click', () => {
        document.getElementById('filterType').value = '';
        document.getElementById('filterTime').value = '30';
        document.getElementById('filterPage').value = '';
        document.getElementById('searchInput').value = '';
        currentOffset = 0;
        loadEvents();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        const data = JSON.stringify(allEvents, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `telemetry-${new Date().toISOString()}.json`;
        a.click();
    });

    document.getElementById('autoRefreshBtn').addEventListener('click', function() {
        autoRefresh = !autoRefresh;
        this.textContent = `Auto-refresh: ${autoRefresh ? 'ON' : 'OFF'}`;
        if (autoRefresh) startAutoRefresh();
    });

    loadEvents();
    if (autoRefresh) startAutoRefresh();
});

function startAutoRefresh() {
    if (!autoRefresh) return;
    setTimeout(() => {
        // Don't refresh if user has a panel open (preserve investigation context)
        if (!currentUserId) {
            loadEvents();
        }
        startAutoRefresh();
    }, 3000);
}

// ===== User Events Telemetry (from Logs collection) =====

let userEventsChart = null;

function loadUserEvents(hours) {
    const url = `/api/telemetry/user-events?hours=${hours}&limit=20`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (!data.ok) {
                const feed = document.getElementById('userActivityFeed');
                if (feed) {
                    feed.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
                }
                return;
            }

            renderUserActivityFeed(data.events);
        })
        .catch(e => {
            console.error('Error loading user events:', e);
            const feed = document.getElementById('userActivityFeed');
            if (feed) {
                feed.innerHTML = `<p class="text-danger">Error: ${e.message}</p>`;
            }
        });
}

function renderUserActivityFeed(events) {
    const feed = document.getElementById('userActivityFeed');
    if (!feed) return;

    if (!events || events.length === 0) {
        feed.innerHTML = '<p class="text-muted">No events in this time range.</p>';
        return;
    }

    let html = '<table class="table table-sm table-striped">';
    html += '<thead><tr><th>Time</th><th>Event Type</th><th>User ID</th><th>Description</th></tr></thead>';
    html += '<tbody>';

    events.forEach(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const eventType = event.event_type || 'UNKNOWN';
        const userId = event.user_id || '-';
        const desc = (event.description || '').substring(0, 50);

        html += `<tr>
            <td><small>${time}</small></td>
            <td><span class="badge badge-info">${eventType}</span></td>
            <td><small>${userId}</small></td>
            <td><small>${desc}</small></td>
        </tr>`;
    });

    html += '</tbody></table>';
    feed.innerHTML = html;
}

function loadEventDistribution(hours = 24) {
    const url = `/api/telemetry/event-distribution?hours=${hours}`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (!data.ok) {
                console.error('Error loading event distribution:', data.error);
                return;
            }
            renderEventDistributionChart(data.distribution);
        })
        .catch(e => console.error('Error loading event distribution:', e));
}

function renderEventDistributionChart(distribution) {
    const canvas = document.getElementById('eventDistributionChart');
    if (!canvas) return;

    const labels = distribution.map(d => d._id);
    const counts = distribution.map(d => d.count);

    // Destroy existing chart if any
    if (window.eventDistChartInstance) {
        window.eventDistChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    window.eventDistChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + ' events';
                        }
                    }
                }
            }
        }
    });
}

function loadActivityHeatmap(hours = 168) {
    const url = `/api/telemetry/activity-heatmap?hours=${hours}`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (!data.ok) {
                console.error('Error loading activity heatmap:', data.error);
                return;
            }
            renderActivityHeatmap(data.heatmap);
        })
        .catch(e => console.error('Error loading activity heatmap:', e));
}

function renderActivityHeatmap(heatmapData) {
    const container = document.querySelector('#activityHeatmap div[style*="grid"]');
    if (!container) return;

    if (!heatmapData || heatmapData.length === 0) {
        container.innerHTML = '<p class="text-muted">No activity data available.</p>';
        return;
    }

    // Find max count for scaling
    const maxCount = Math.max(...heatmapData.map(h => h.count), 1);

    let html = '';
    heatmapData.forEach(item => {
        const count = item.count;
        const level = Math.min(4, Math.floor((count / maxCount) * 5));
        const hour = item._id;

        html += `<div class="heatmap-cell level${level}" title="${hour}: ${count} events">${count}</div>`;
    });

    container.innerHTML = html;
}

// ===== Telemetry Chart Cards (Loan Funnel, Default Rate, Lender Concentration) =====

/**
 * Load and render loan funnel (REQUESTED → MATCHED → REPAID → DEFAULTED).
 */
async function loadLoanFunnel() {
    const window = document.getElementById('funnel-window').value || '7d';
    const url = `/api/telemetry/loan-funnel?window=${window}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.funnel || data.funnel.length === 0) {
            document.getElementById('loan-funnel-chart').innerHTML = '<p style="color: var(--ink-3);">No funnel data available</p>';
            return;
        }

        renderLoanFunnel(data.funnel);
    } catch (e) {
        console.error('Error loading loan funnel:', e);
        document.getElementById('loan-funnel-chart').innerHTML = '<p style="color: #ef4444;">Error loading funnel data</p>';
    }
}

/**
 * Render loan funnel as vertical bars with drop-off indicators.
 */
function renderLoanFunnel(funnel) {
    const container = document.getElementById('loan-funnel-chart');
    const colors = {
        'REQUESTED': '#6366f1',
        'MATCHED': '#00d4ff',
        'REPAID': '#10b981',
        'DEFAULTED': '#ef4444'
    };

    const maxCount = Math.max(...funnel.map(s => s.count), 1);
    let html = '';

    funnel.forEach((stage, idx) => {
        const barWidth = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
        const pctText = Math.round(stage.pct_from_prev * 10) / 10 + '%';
        const color = colors[stage.stage] || '#888';

        html += `
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--ink-2);">${stage.stage}</span>
                    <span style="font-family: var(--mono); font-size: 10px; color: var(--ink-3);">${stage.count} (${pctText})</span>
                </div>
                <div style="background: rgba(136, 136, 136, 0.2); border-radius: 3px; height: 20px; overflow: hidden;">
                    <div style="background: ${color}; height: 100%; width: ${barWidth}%; transition: width 0.3s ease;"></div>
                </div>
            </div>
        `;

        // Add drop-off arrow between stages
        if (idx < funnel.length - 1) {
            const dropoff = ((funnel[idx].pct_from_prev - funnel[idx + 1].pct_from_prev) / funnel[idx].pct_from_prev * 100).toFixed(0);
            if (dropoff > 0) {
                html += `
                    <div style="text-align: center; color: #ef4444; font-size: 10px; margin: 4px 0; font-family: var(--mono);">
                        ↓ ${dropoff}% drop
                    </div>
                `;
            }
        }
    });

    container.innerHTML = html;
}

/**
 * Load and render default rate line chart over 30 days.
 */
async function loadDefaultRate() {
    const url = `/api/telemetry/default-rate`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.days || !data.rate) {
            console.error('Invalid default rate data');
            return;
        }

        renderDefaultRateChart(data.days, data.rate, data.threshold);
    } catch (e) {
        console.error('Error loading default rate:', e);
    }
}

/**
 * Render default rate as a line chart using Chart.js.
 */
function renderDefaultRateChart(days, rates, threshold) {
    const canvas = document.getElementById('default-rate-chart');
    if (!canvas) return;

    // Check if a previous chart exists and destroy it
    if (window.defaultRateChartInstance) {
        window.defaultRateChartInstance.destroy();
    }

    // Determine line color based on whether any point exceeds threshold
    const lineColor = rates.some(r => r > threshold) ? '#ef4444' : '#00d4ff';

    const ctx = canvas.getContext('2d');
    window.defaultRateChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Default Rate',
                    data: rates,
                    borderColor: lineColor,
                    backgroundColor: lineColor + '15',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1
                },
                {
                    label: 'Threshold (10%)',
                    data: Array(days.length).fill(threshold),
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: 'var(--ink-2)',
                        font: { size: 11, family: 'var(--mono)' },
                        padding: 12
                    },
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 8,
                    titleFont: { size: 11, family: 'var(--mono)' },
                    bodyFont: { size: 10, family: 'var(--mono)' },
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + (context.parsed.y * 100).toFixed(2) + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 0.5,
                    ticks: {
                        color: 'var(--ink-3)',
                        font: { size: 10, family: 'var(--mono)' },
                        callback: function(value) {
                            return (value * 100).toFixed(0) + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(136, 136, 136, 0.1)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: 'var(--ink-3)',
                        font: { size: 9, family: 'var(--mono)' }
                    },
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                }
            }
        }
    });
}

/**
 * Load and render lender concentration table.
 */
async function loadLenderConcentration() {
    const window = document.getElementById('lender-window').value || '7d';
    const url = `/api/telemetry/lender-concentration?window=${window}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.lenders || data.lenders.length === 0) {
            document.getElementById('lender-concentration-table').innerHTML = '<p style="color: var(--ink-3);">No lenders in this period</p>';
            return;
        }

        renderLenderConcentration(data.lenders);
    } catch (e) {
        console.error('Error loading lender concentration:', e);
        document.getElementById('lender-concentration-table').innerHTML = '<p style="color: #ef4444;">Error loading lender data</p>';
    }
}

/**
 * Render lender concentration as a ranked table with inline bars.
 */
function renderLenderConcentration(lenders) {
    const container = document.getElementById('lender-concentration-table');
    const maxCount = Math.max(...lenders.map(l => l.loan_count), 1);

    let html = '<table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: var(--mono);">';
    html += '<thead><tr style="border-bottom: 1px solid var(--line-2);">';
    html += '<th style="text-align: left; padding: 8px; color: var(--ink-3); font-weight: 600;">Rank</th>';
    html += '<th style="text-align: left; padding: 8px; color: var(--ink-3); font-weight: 600;">Lender Name</th>';
    html += '<th style="text-align: center; padding: 8px; color: var(--ink-3); font-weight: 600;">Loans</th>';
    html += '<th style="text-align: right; padding: 8px; color: var(--ink-3); font-weight: 600;">Total (USDT)</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    lenders.forEach((lender, idx) => {
        const barWidth = maxCount > 0 ? (lender.loan_count / maxCount) * 100 : 0;
        const rowStyle = idx % 2 === 0 ? 'background: rgba(136, 136, 136, 0.05);' : '';

        html += `<tr style="border-bottom: 1px solid var(--line-2); ${rowStyle}">`;
        html += `<td style="padding: 8px; color: var(--ink-2);">${idx + 1}</td>`;
        html += `<td style="padding: 8px; color: var(--ink-1);">${lender.name}</td>`;
        html += `<td style="padding: 8px; text-align: center;">
            <div style="background: rgba(99, 102, 241, 0.15); border-radius: 2px; height: 20px; display: flex; align-items: center; justify-content: center;">
                <div style="background: #6366f1; height: 100%; width: ${barWidth}%; border-radius: 2px;"></div>
                <span style="position: absolute; color: var(--ink-2);">${lender.loan_count}</span>
            </div>
        </td>`;
        html += `<td style="padding: 8px; text-align: right; color: #10b981; font-weight: 600;">${lender.total_amount.toFixed(2)}</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Initialize telemetry panels on page load
function initTelemetryPanels() {
    console.log('Initializing telemetry user action tracking panels...');

    loadUserEvents(24);           // Load 24h of events
    loadEventDistribution(24);    // Load 24h distribution
    loadActivityHeatmap(168);     // Load 7d heatmap
    loadLoanFunnel();             // Load loan funnel
    loadDefaultRate();            // Load default rate chart
    loadLenderConcentration();    // Load lender concentration

    // Refresh every 30 seconds
    setInterval(() => {
        loadUserEvents(24);
        loadEventDistribution(24);
        loadActivityHeatmap(168);
        loadLoanFunnel();
        loadDefaultRate();
        loadLenderConcentration();
    }, 30000);
}

// Call on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTelemetryPanels);
} else {
    initTelemetryPanels();
}
