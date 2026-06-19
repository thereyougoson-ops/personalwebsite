// Notification inbox client-side logic

let currentPage = 0;
const pageSize = 50;
let allNotifications = [];
let selectedIds = new Set();

async function loadNotifications() {
    const severity = document.getElementById('filterSeverity')?.value || '';
    const category = document.getElementById('filterCategory')?.value || '';
    const state = document.getElementById('filterState')?.value || 'all';
    const search = document.getElementById('searchBox')?.value || '';

    const params = new URLSearchParams({
        page: currentPage,
        ...(severity && {severity}),
        ...(category && {category}),
        ...(state !== 'all' && {state}),
        ...(search && {search}),
    });

    try {
        const resp = await fetch(`/api/admin/notifications?${params}`);
        const data = await resp.json();

        if (!data.notifications) {
            document.getElementById('notifRows').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--ink-3);">No notifications match your filters.</td></tr>';
            return;
        }

        allNotifications = data.notifications;
        renderTable();
        updatePagination(data.total);
    } catch (e) {
        console.error('Failed to load notifications:', e);
        document.getElementById('notifRows').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--bad);">Error loading notifications</td></tr>';
    }
}

function renderTable() {
    const tbody = document.getElementById('notifRows');
    if (allNotifications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--ink-3);">No notifications.</td></tr>';
        return;
    }

    tbody.innerHTML = allNotifications.map(n => {
        const severityDot = {info: '⚪', warn: '🟡', critical: '🔴'}[n.severity] || '⚪';
        const categoryIcon = {
            financial: '💰',
            loans: '📊',
            risk: '🔒',
            users: '👥',
            system: '⚙️',
            governance: '📋'
        }[n.category] || '📌';

        const isRead = n.read_by && n.read_by.length > 0;
        const isAcknowledged = n.acknowledged_by;
        const hasDmPending = !n.delivery || n.delivery.length === 0;

        let stateHtml = '';
        if (isAcknowledged) {
            stateHtml += `<span style="padding:2px 6px;background:var(--bg-3);border-radius:3px;font-size:11px;">✅ ack'd</span>`;
        } else if (isRead) {
            stateHtml += `<span style="padding:2px 6px;background:var(--bg-3);border-radius:3px;font-size:11px;">✓ read</span>`;
        } else {
            stateHtml += `<span style="padding:2px 6px;background:var(--ok-soft);border-radius:3px;font-size:11px;color:var(--ok);">🆕 unread</span>`;
        }

        if (hasDmPending) {
            stateHtml += ` <span style="padding:2px 6px;background:var(--bad-soft);border-radius:3px;font-size:11px;color:var(--bad);">📵 pending</span>`;
        }

        const countBadge = n.count > 1 ? `<span style="margin-left:4px;padding:2px 6px;background:var(--line);border-radius:3px;font-size:11px;">×${n.count}</span>` : '';

        const rowStyle = isAcknowledged ? 'opacity: 0.6;' : (isRead ? '' : 'font-weight: bold; background: rgba(76, 175, 80, 0.05);');
        const borderStyle = n.severity === 'critical' && !isAcknowledged ? 'border-left: 3px solid #d32f2f;' : '';
        const selectedStyle = selectedIds.has(n._id) ? 'background: rgba(33, 150, 243, 0.1); border-left: 3px solid #2196F3;' : '';

        return `
            <tr style="${rowStyle}${borderStyle}${selectedStyle}">
                <td style="padding:12px;"><input type="checkbox" value="${n._id}" onchange="updateSelection()"></td>
                <td style="padding:12px;text-align:center;">${severityDot}</td>
                <td style="padding:12px;text-align:center;">${categoryIcon}</td>
                <td style="padding:12px;cursor:pointer;color:var(--link);" onclick="showDetail(${allNotifications.indexOf(n)})">
                    ${n.title}${countBadge}
                </td>
                <td style="padding:12px;color:var(--ink-2);font-size:12px;">${formatRelativeTime(new Date(n.last_seen))}</td>
                <td style="padding:12px;font-size:11px;">${stateHtml}</td>
                <td style="padding:12px;text-align:center;">
                    <button class="action-btn" style="padding:4px 8px;font-size:11px;" onclick="showDetail(${allNotifications.indexOf(n)})">View</button>
                    ${!isAcknowledged ? `<button class="action-btn ok-btn" style="padding:4px 8px;font-size:11px;margin-left:2px;" onclick="acknowledgeOne('${n._id}')">✅</button>` : ''}
                    ${hasDmPending ? `<button class="action-btn" style="padding:4px 8px;font-size:11px;margin-left:2px;" onclick="resendDm('${n._id}')">📬</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function formatRelativeTime(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function updateSelection() {
    selectedIds.clear();
    document.querySelectorAll('#notifRows input[type="checkbox"]:checked').forEach(cb => {
        selectedIds.add(cb.value);
    });

    const bar = document.getElementById('bulkActionBar');
    if (selectedIds.size > 0) {
        bar.style.display = 'flex';
        document.getElementById('selectedCount').textContent = `${selectedIds.size} selected`;
    } else {
        bar.style.display = 'none';
    }
}

function toggleSelectAll() {
    const checkbox = document.getElementById('selectAll');
    document.querySelectorAll('#notifRows input[type="checkbox"]').forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateSelection();
}

function clearSelection() {
    document.getElementById('selectAll').checked = false;
    updateSelection();
    loadNotifications();
}

async function bulkAcknowledge() {
    if (!confirm(`Acknowledge ${selectedIds.size} notifications?`)) return;

    try {
        const resp = await fetch('/api/admin/notifications/bulk-acknowledge', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({notification_ids: Array.from(selectedIds)})
        });
        const data = await resp.json();
        if (data.success) {
            clearSelection();
        }
    } catch (e) {
        console.error('Bulk acknowledge failed:', e);
    }
}

async function bulkPurge() {
    if (!confirm(`Delete ${selectedIds.size} notifications? This cannot be undone.`)) return;

    try {
        const resp = await fetch('/api/admin/notifications/bulk-purge', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({notification_ids: Array.from(selectedIds)})
        });
        const data = await resp.json();
        if (data.success) {
            clearSelection();
        }
    } catch (e) {
        console.error('Bulk purge failed:', e);
    }
}

async function acknowledgeOne(notifId) {
    try {
        await fetch(`/api/admin/notifications/${notifId}/acknowledge`, {method: 'POST'});
        loadNotifications();
    } catch (e) {
        console.error('Acknowledge failed:', e);
    }
}

async function resendDm(notifId) {
    try {
        const resp = await fetch(`/api/admin/notifications/${notifId}/resend-dm`, {method: 'POST'});
        const data = await resp.json();
        if (data.success) {
            alert('DM sent!');
        } else {
            alert('Failed to send DM');
        }
    } catch (e) {
        console.error('Resend DM failed:', e);
    }
}

function showDetail(index) {
    const notif = allNotifications[index];
    if (!notif) return;

    // Mark as read
    fetch(`/api/admin/notifications/${notif._id}/read`, {method: 'POST'});

    document.getElementById('detailTitle').textContent = notif.title;
    document.getElementById('detailBody').textContent = notif.body;

    let linkHtml = '';
    if (notif.link) {
        linkHtml = `<a href="${notif.link}" class="action-btn ok-btn" style="padding:8px 16px;">→ Open</a>`;
    }
    document.getElementById('detailLink').innerHTML = linkHtml;

    let deliveryHtml = '<h4 style="margin:0 0 8px 0;font-size:12px;">Delivery Status:</h4>';
    if (notif.delivery && notif.delivery.length > 0) {
        deliveryHtml += notif.delivery.map(d => {
            const statusIcon = {sent: '✅', failed: '❌', skipped: '⏭️'}[d.status] || '⚪';
            return `<div style="font-size:11px;margin:4px 0;">${statusIcon} Admin ${d.admin_id}: ${d.status}</div>`;
        }).join('');
    } else {
        deliveryHtml += '<div style="font-size:11px;color:var(--ink-3);">Not yet dispatched</div>';
    }
    document.getElementById('detailDelivery').innerHTML = deliveryHtml;

    const panel = document.getElementById('detailPanel');
    panel.style.display = 'block';
    panel.scrollIntoView({behavior: 'smooth', block: 'start'});
    loadNotifications(); // Refresh to show updated read state
}

function closeDetail() {
    document.getElementById('detailPanel').style.display = 'none';
}

function applyFilters() {
    currentPage = 0;
    loadNotifications();
}

function updatePagination(total) {
    const loaded = (currentPage + 1) * pageSize;
    const btn = document.querySelector('#pagination button');
    if (loaded < total) {
        btn.style.display = 'block';
        btn.onclick = () => {
            currentPage++;
            loadNotifications();
        };
    } else {
        btn.style.display = 'none';
    }
}

async function loadRecipients() {
    try {
        const resp = await fetch('/api/admin/notifications/recipients');
        const data = await resp.json();

        const container = document.getElementById('recipientsList');
        if (!data.recipients || data.recipients.length === 0) {
            container.innerHTML = '<div style="color:var(--ink-3);font-size:12px;">No recipients configured</div>';
        } else {
            container.innerHTML = data.recipients.map(r => {
                // Count enabled types for this admin
                const enabledCount = Object.values(r.routing || {}).filter(Boolean).length;
                const totalCount = Object.keys(r.routing || {}).length;
                return `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);">
                        <div style="flex:1;">
                            <div style="font-family:monospace;font-size:11px;">Admin ${r.admin_id}</div>
                            <div style="font-size:10px;color:var(--ink-3);">${enabledCount}/${totalCount} types enabled</div>
                        </div>
                        <button class="action-btn bad-btn" style="padding:2px 6px;font-size:11px;" onclick="removeRecipient(${r.admin_id})">Remove</button>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.error('Failed to load recipients:', e);
    }
}

async function addRecipient() {
    const input = document.getElementById('newRecipientId');
    const id = parseInt(input.value);
    if (!id) return;

    try {
        await fetch('/api/admin/notifications/recipients', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({admin_id: id})
        });
        input.value = '';
        loadRecipients();
    } catch (e) {
        console.error('Failed to add recipient:', e);
    }
}

async function removeRecipient(id) {
    try {
        await fetch('/api/admin/notifications/recipients', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({admin_id: id})
        });
        loadRecipients();
    } catch (e) {
        console.error('Failed to remove recipient:', e);
    }
}

async function loadRouting() {
    try {
        const resp = await fetch('/api/admin/notifications/routing');
        const data = await resp.json();

        const container = document.getElementById('routingTable');
        const admins = Object.keys(data.admins || {}).map(id => parseInt(id));

        if (admins.length === 0) {
            container.innerHTML = '<div style="color:var(--ink-3);font-size:12px;">No recipients configured</div>';
            return;
        }

        // Create tabbed layout
        let html = '<div style="border-bottom:1px solid var(--line);margin-bottom:8px;display:flex;gap:4px;overflow-x:auto;">';
        admins.forEach((aid, idx) => {
            html += `<button class="routing-tab" data-admin-id="${aid}" style="padding:4px 8px;background:${idx === 0 ? 'var(--line)' : 'transparent'};border:none;cursor:pointer;font-size:11px;border-bottom:2px solid ${idx === 0 ? 'var(--ok)' : 'transparent'};" onclick="switchAdminTab(${aid})">Admin ${aid}</button>`;
        });
        html += '</div>';

        // Content panels for each admin
        admins.forEach((aid, idx) => {
            html += `<div id="admin-routing-${aid}" style="display:${idx === 0 ? 'block' : 'none'};">`;
            const adminRouting = data.admins[aid] || {};
            const grouped = {};
            for (const [type, enabled] of Object.entries(adminRouting)) {
                const config = data.type_defaults[type];
                if (!config) continue;
                if (!grouped[config.category]) grouped[config.category] = [];
                grouped[config.category].push({type, enabled});
            }

            for (const [category, types] of Object.entries(grouped)) {
                html += `<div style="margin-bottom:12px;">
                    <div style="font-weight:bold;margin-bottom:4px;color:var(--ink-2);font-size:11px;">${category}</div>`;
                types.forEach(t => {
                    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:11px;">
                        <span>${t.type}</span>
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                            <input type="checkbox" ${t.enabled ? 'checked' : ''} onchange="setRouting('${t.type}', this.checked, ${aid})">
                            DM
                        </label>
                    </div>`;
                });
                html += '</div>';
            }
            html += '</div>';
        });

        container.innerHTML = html;
    } catch (e) {
        console.error('Failed to load routing:', e);
    }
}

function switchAdminTab(adminId) {
    // Hide all panels
    document.querySelectorAll('[id^="admin-routing-"]').forEach(el => {
        el.style.display = 'none';
    });
    // Show selected panel
    document.getElementById(`admin-routing-${adminId}`).style.display = 'block';
    // Update tab styling
    document.querySelectorAll('.routing-tab').forEach(btn => {
        const aid = parseInt(btn.getAttribute('data-admin-id'));
        if (aid === adminId) {
            btn.style.background = 'var(--line)';
            btn.style.borderBottom = '2px solid var(--ok)';
        } else {
            btn.style.background = 'transparent';
            btn.style.borderBottom = '2px solid transparent';
        }
    });
}

async function setRouting(type, enabled, targetAdminId) {
    try {
        await fetch('/api/admin/notifications/routing', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({type, dm_enabled: enabled, admin_id: targetAdminId})
        });
    } catch (e) {
        console.error('Failed to set routing:', e);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadNotifications();
    loadRecipients();
    loadRouting();

    // Reload every 30s
    setInterval(loadNotifications, 30000);
});
