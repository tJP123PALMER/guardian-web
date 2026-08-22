/* Guardian Fire Control - Command Suite
   Self-contained command views. Designed to coexist with the legacy MDT tabs. */
(function () {
    'use strict';

    var state = {
        units: {},
        callsigns: [],
        callSignStations: {},
        incidents: [],
        events: [],
        alerts: [],
        lastBoardSignature: ''
    };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function lower(value) { return String(value || '').toLowerCase(); }
    function openIncident(i) { return i && String(i.status || '').toUpperCase() !== 'CLOSED'; }
    function timeNow() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    function statusClass(s) { return lower(s).replace(/[^a-z0-9]+/g, '-'); }
    function stationFor(callsign) {
        var key = String(callsign || '').trim().toUpperCase();
        var map = state.callSignStations || {};
        if (map[key] != null && String(map[key]).trim() !== '') return String(map[key]);
        // Be tolerant if the Lua table contains lowercase keys.
        var found = Object.keys(map).find(function(k){ return String(k).trim().toUpperCase() === key; });
        return found ? String(map[found]) : 'Unallocated';
    }
    function priorityRank(p) { return p === 'Immediate' ? 0 : (p === 'Prompt' ? 1 : 2); }

    function incidentUnits(inc) {
        var list = inc && Array.isArray(inc.assignedUnits) ? inc.assignedUnits : [];
        return list.map(function (x) { return String(x).toUpperCase(); });
    }

    function record(type, text, incident) {
        var now = Date.now();
        var last = state.events[0];
        if (last && last.type === type && last.text === text && (now - (last._ts || 0)) < 2500) return;
        var item = { time: timeNow(), type: type, text: text, incident: incident, _ts: now };
        state.events.unshift(item);
        if (state.events.length > 150) state.events.length = 150;
        if (type !== 'sync') {
            state.alerts.unshift(item);
            if (state.alerts.length > 60) state.alerts.length = 60;
        }
    }

    function empty(text) { return '<div class="emptyState">' + esc(text) + '</div>'; }

    function setActiveExtra(tab) {
        document.querySelectorAll('.tab[data-extra-tab]').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-extra-tab') === tab);
        });
        document.querySelectorAll('.tab[data-tab]').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.pane').forEach(function (p) { p.classList.remove('active'); });
        var pane = document.getElementById('tab-' + tab);
        if (pane) pane.classList.add('active');
        var board = document.querySelector('.applianceColumn');
        if (board) board.style.display = 'none';
        renderAll();
    }

    window.guardianCommandOpen = function (tab) { setActiveExtra(tab); };

    function renderDashboard() {
        var el = document.getElementById('extraDashboard');
        if (!el) return;
        var incidents = state.incidents.filter(openIncident);
        var units = Object.entries(state.units || {});
        var busy = {};
        incidents.forEach(function (inc) {
            incidentUnits(inc).forEach(function (cs) { busy[cs] = true; });
        });
        var available = units.filter(function (pair) {
            var cs = String(pair[0]).toUpperCase();
            var status = lower(pair[1] && pair[1].status);
            return !busy[cs] && status !== 'off run' && status !== 'offline';
        }).length;
        var mobile = units.filter(function (p) { return /mobile/.test(lower(p[1] && p[1].status)); }).length;
        var scene = units.filter(function (p) { return /attendance|on scene|scene/.test(lower(p[1] && p[1].status)); }).length;
        var immediate = incidents.slice().sort(function (a, b) { return priorityRank(a.priority) - priorityRank(b.priority); })[0];

        el.innerHTML =
            '<div class="commandHero">' +
                '<div><div class="eyebrow">GUARDIAN FIRE CONTROL</div><h2>Command Dashboard</h2><p>Live operational overview of incidents, appliances and crew activity.</p></div>' +
                '<div class="liveBadge"><span></span> LIVE</div>' +
            '</div>' +
            '<div class="statGrid">' +
                statCard('🔥', incidents.length, 'Active Incidents', 'Open operational incidents') +
                statCard('🚒', available, 'Available Appliances', 'Ready for mobilisation') +
                statCard('➡️', mobile, 'Mobile', 'Currently travelling') +
                statCard('📍', scene, 'On Scene', 'Current attendance status') +
            '</div>' +
            '<div class="commandGrid">' +
                '<section class="featureCard commandPriority"><div class="featureTitle">🚨 Highest Priority</div>' +
                    (immediate ? incidentCommandCard(immediate) : empty('No active incidents')) +
                '</section>' +
                '<section class="featureCard"><div class="featureTitle">🚒 Appliance Snapshot</div>' +
                    (units.slice(0, 10).map(function (p) {
                        var cs = p[0], u = p[1] || {};
                        var station = stationFor(cs);
                        return '<div class="miniRow"><div><b>' + esc(cs) + '</b><small>' + esc(station) + '</small></div><span class="statusPill ' + statusClass(u.status) + '">' + esc(u.status || 'OFF RUN') + '</span></div>';
                    }).join('') || empty('No signed-on appliances')) +
                '</section>' +
            '</div>' +
            '<section class="featureCard"><div class="featureTitle">⚡ Recent Activity</div>' +
                '<div class="activityHint">Only meaningful dispatch and operational changes are shown here.</div>' +
                (state.events.slice(0, 6).map(function (e) { return '<div class="timelineRow"><span>' + esc(e.time) + '</span><b>' + esc(e.text) + '</b></div>'; }).join('') || empty('No recent activity')) +
            '</section>';

        bindCommandIncidentButtons(el);
    }

    function statCard(icon, value, title, sub) {
        return '<div class="statCard"><div class="statIcon">' + icon + '</div><div><strong>' + value + '</strong><span>' + esc(title) + '</span><small>' + esc(sub) + '</small></div></div>';
    }

    function incidentCommandCard(inc) {
        return '<div class="incidentCommandCard" data-open-incident="' + esc(inc.id) + '">' +
            '<div class="incidentMiniTop"><b>#' + esc(inc.id) + ' — ' + esc(inc.type || 'INCIDENT') + '</b><span class="priority ' + lower(inc.priority).replace(/\s/g, '-') + '">' + esc(inc.priority || '') + '</span></div>' +
            '<div class="incidentAddress">📍 ' + esc(inc.address || 'Location not provided') + (inc.postal ? ' • ' + esc(inc.postal) : '') + '</div>' +
            '<div class="commandCardMeta"><span>🚒 ' + incidentUnits(inc).length + ' appliances</span><span>📋 ' + esc(inc.sceneStatus || 'Awaiting update') + '</span></div>' +
            '<button class="primaryBtn" data-open-incident="' + esc(inc.id) + '">OPEN COMMAND WORKSPACE</button>' +
        '</div>';
    }

    function bindCommandIncidentButtons(root) {
        root.querySelectorAll('[data-open-incident]').forEach(function (b) {
            b.addEventListener('click', function () {
                var id = this.getAttribute('data-open-incident');
                window.dispatchEvent(new CustomEvent('guardian:openIncident', { detail: { id: id } }));
            });
        });
    }

    function renderAppliances() {
        var el = document.getElementById('extraAppliances');
        if (!el) return;
        var busy = {};
        state.incidents.filter(openIncident).forEach(function (inc) { incidentUnits(inc).forEach(function (cs) { busy[cs] = inc; }); });
        var rows = Object.entries(state.units || {}).sort();
        el.innerHTML =
            '<div class="pageHead"><div><div class="eyebrow">COMMAND</div><h2>🚒 Appliance Board</h2><p>Every signed-on appliance, its live MDT status and current commitment.</p></div>' +
            '<div class="filterChips"><button class="chip active" data-filter="all">All</button><button class="chip" data-filter="available">Available</button><button class="chip" data-filter="mobile">Mobile</button><button class="chip" data-filter="scene">On Scene</button><button class="chip" data-filter="offrun">Off Run</button></div></div>' +
            '<div class="dataTable"><div class="tableHead"><span>Callsign</span><span>Station</span><span>Status</span><span>Incident</span><span>Crew</span></div>' +
            (rows.map(function (p) {
                var cs = p[0], u = p[1] || {}, inc = busy[String(cs).toUpperCase()];
                var crew = inc && inc.applianceCrew && (inc.applianceCrew[cs] || inc.applianceCrew[String(cs).toUpperCase()]);
                crew = crew && crew.count ? crew.count : '';
                var station = stationFor(cs);
                return '<div class="tableRow" data-status="' + esc(lower(u.status || 'off run')) + '"><b>🚒 ' + esc(cs) + '</b><span>' + esc(station) + '</span><span class="statusPill ' + statusClass(u.status) + '">' + esc(u.status || 'OFF RUN') + '</span><span>' + (inc ? '#' + esc(inc.id) + ' — ' + esc(inc.type) : 'Available') + '</span><span>' + esc(crew || '—') + '</span></div>';
            }).join('') || empty('No signed-on appliances')) + '</div>';

        el.querySelectorAll('.chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                el.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('active'); });
                chip.classList.add('active');
                var f = chip.getAttribute('data-filter');
                el.querySelectorAll('.tableRow').forEach(function (row) {
                    var s = row.getAttribute('data-status');
                    var show = f === 'all' ||
                        (f === 'available' && /available|home station/.test(s)) ||
                        (f === 'mobile' && /mobile/.test(s)) ||
                        (f === 'scene' && /attendance|scene/.test(s)) ||
                        (f === 'offrun' && /off run|offline/.test(s));
                    row.style.display = show ? 'grid' : 'none';
                });
            });
        });
    }

    function renderCrews() {
        var el = document.getElementById('extraCrews');
        if (!el) return;
        var cards = [];
        state.incidents.filter(openIncident).forEach(function (inc) {
            (inc.assignedUnits || []).forEach(function (cs) {
                var key = String(cs).toUpperCase();
                var roster = (inc.crewMembers && (inc.crewMembers[cs] || inc.crewMembers[key])) || {};
                var crewInfo = (inc.applianceCrew && (inc.applianceCrew[cs] || inc.applianceCrew[key])) || {};
                var count = Number(crewInfo.count || Object.keys(roster).length || 0);
                var people = Object.values(roster).filter(Boolean);
                cards.push('<div class="crewCard"><div class="crewCardTop"><b>🚒 ' + esc(cs) + '</b><span>' + count + ' crew</span></div><div class="crewIncident">Incident #' + esc(inc.id) + ' — ' + esc(inc.type) + '</div><div class="crewPeople">' +
                    (people.map(function (p) { return '<div class="person"><b>' + esc(p.name || 'Unnamed') + '</b><span>' + esc(p.rank || '') + '</span><em>' + esc(p.role || 'Crew') + '</em></div>'; }).join('') || empty('No named crew')) + '</div></div>');
            });
        });
        el.innerHTML = '<div class="pageHead"><div><div class="eyebrow">PERSONNEL</div><h2>👨‍🚒 Crews & Personnel</h2><p>Command identities and crew composition attached to active appliances.</p></div></div><div class="crewGrid">' + (cards.join('') || empty('No crews currently assigned to incidents')) + '</div>';
    }

    function renderMap() {
        var el = document.getElementById('extraMap');
        if (!el) return;
        var incidents = state.incidents.filter(openIncident);
        el.innerHTML = '<div class="pageHead"><div><div class="eyebrow">OPERATIONS</div><h2>🗺️ Incident Map</h2><p>Operational incident board. Postal coordinates from the existing Guardian postal integration are shown where supplied.</p></div></div>' +
            '<div class="mapCommandBoard"><div class="mapGridLines"></div><div class="mapCompass">N</div>' +
            (incidents.map(function (inc, idx) {
                return '<button class="mapIncidentPin pin' + (idx % 6) + '" data-open-incident="' + esc(inc.id) + '"><span>🔥</span><b>#' + esc(inc.id) + '</b><small>' + esc(inc.postal || 'NO POSTAL') + '</small></button>';
            }).join('') || '<div class="mapEmpty">' + empty('No active incidents to plot') + '</div>') +
            '</div><div class="mapLegend"><span>🔥 Incident</span><span>🚒 Assigned appliance</span><span>📍 Postal</span></div>';
        bindCommandIncidentButtons(el);
    }

    function renderAlerts() {
        var el = document.getElementById('extraAlerts');
        if (!el) return;
        el.innerHTML = '<div class="pageHead"><div><div class="eyebrow">OPERATIONS</div><h2>🚨 Alert Centre</h2><p>Recent dispatch, appliance and incident activity.</p></div><button id="clearExtraAlerts" class="secondaryBtn">Clear</button></div>' +
            '<div class="alertList">' + (state.alerts.map(function (a) { return '<div class="alertItem ' + (a.type === 'critical' ? 'critical' : '') + '"><span>' + esc(a.time) + '</span><b>' + esc(a.text) + '</b><em>' + (a.incident ? '#' + esc(a.incident) : '') + '</em></div>'; }).join('') || empty('No alerts')) + '</div>';
        var clear = document.getElementById('clearExtraAlerts');
        if (clear) clear.onclick = function () { state.alerts = []; renderAlerts(); };
    }

    function renderIncidentLog() {
        var el = document.getElementById('extraIncidentLog');
        if (!el) return;
        el.innerHTML = '<div class="pageHead"><div><div class="eyebrow">AUDIT</div><h2>📋 Incident Log</h2><p>Chronological operational activity generated while Control is open.</p></div></div><div class="timeline">' +
            (state.events.map(function (e) { return '<div class="timelineItem"><div class="timelineDot"></div><div><b>' + esc(e.time) + '</b><strong>' + esc(e.text) + '</strong>' + (e.incident ? '<small>Incident #' + esc(e.incident) + '</small>' : '') + '</div></div>'; }).join('') || empty('No activity recorded yet')) + '</div>';
    }

    function renderStations() {
        var el = document.getElementById('extraStations');
        if (!el) return;
        var groups = {};
        Object.entries(state.units || {}).forEach(function (p) {
            var cs = String(p[0]).toUpperCase();
            var station = stationFor(cs);
            if (!groups[station]) groups[station] = [];
            groups[station].push(p);
        });

        var cards = Object.entries(groups).sort().map(function (g) {
            var available = g[1].filter(function(p){
                var s = lower(p[1] && p[1].status);
                return /available|home station/.test(s);
            }).length;
            return '<div class="stationCard">' +
                '<div class="stationHeader"><div><div class="eyebrow">FIRE STATION</div><h3>🏠 ' + esc(g[0]) + '</h3></div>' +
                '<span class="stationCount">' + available + ' available</span></div>' +
                g[1].map(function (p) {
                    var u = p[1] || {};
                    return '<div class="miniRow"><div><b>' + esc(p[0]) + '</b><small>' + esc(g[0]) + '</small></div><span class="statusPill ' + statusClass(u.status) + '">' + esc(u.status || 'OFF RUN') + '</span></div>';
                }).join('') +
            '</div>';
        }).join('');

        el.innerHTML =
            '<div class="pageHead"><div><div class="eyebrow">RESOURCES</div><h2>🏠 Stations</h2><p>Appliances grouped by the station mapping in <code>config.lua</code>.</p></div></div>' +
            '<div class="stationGrid">' + (cards || empty('No signed-on appliances')) + '</div>';
    }

    function renderHandover() {
        var el = document.getElementById('extraHandover');
        if (!el) return;
        var incidents = state.incidents.filter(openIncident);
        var units = Object.entries(state.units || {});
        el.innerHTML = '<div class="pageHead"><div><div class="eyebrow">CONTROL</div><h2>📝 Shift Handover</h2><p>Snapshot of current operational commitments for the incoming Control operator.</p></div><button id="refreshHandover" class="secondaryBtn">Refresh</button></div>' +
            '<div class="handoverSheet"><h3>GUARDIAN FIRE CONTROL — ' + esc(new Date().toLocaleDateString()) + '</h3><div class="handoverStats"><div><b>' + incidents.length + '</b><span>Active incidents</span></div><div><b>' + units.length + '</b><span>Signed-on appliances</span></div><div><b>' + units.filter(function (p) { return /off run/i.test(p[1] && p[1].status || ''); }).length + '</b><span>Off run</span></div></div>' +
            '<h4>Active incidents</h4>' + (incidents.map(function (i) { return incidentCommandCard(i); }).join('') || empty('None')) +
            '<h4>Recent activity</h4>' + (state.events.slice(0, 12).map(function (e) { return '<div class="timelineRow"><span>' + esc(e.time) + '</span><b>' + esc(e.text) + '</b></div>'; }).join('') || empty('None')) + '</div>';
        bindCommandIncidentButtons(el);
        var refresh = document.getElementById('refreshHandover');
        if (refresh) refresh.onclick = renderHandover;
    }

    function renderAll() {
        renderDashboard();
        renderAppliances();
        renderCrews();
        renderMap();
        renderAlerts();
        renderIncidentLog();
        renderStations();
        renderHandover();
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-extra-tab]').forEach(function (button) {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                setActiveExtra(button.getAttribute('data-extra-tab'));
            });
        });
        renderAll();
    });

    window.addEventListener('message', function (e) {
        var d = e.data || {};
        if (d.type === 'unitBoard') {
            state.units = d.units || {};
            state.callsigns = d.callsigns || [];
            state.callSignStations = d.callSignStations || {};
            renderAll();
        } else if (d.type === 'ongoingIncidents') {
            state.incidents = d.incidents || [];
            renderAll();
        } else if (d.type === 'status') {
            var item = d.item || {};
            record('activity', (item.callsign || item.sender || item.unit || 'Appliance') + ' status: ' + (item.status || item.text || 'updated'));
            renderAll();
        } else if (d.type === 'message') {
            var msg = d.item || {};
            record('message', 'Message received from ' + (msg.sender || msg.callsign || 'crew'));
            renderAll();
        } else if (d.type === 'ack') {
            var ack = d.item || {};
            record('ack', 'Dispatch ACK received' + (ack.callsign ? ' from ' + ack.callsign : ''));
            renderAll();
        } else if (d.type === 'open') {
            setTimeout(function () { renderAll(); }, 100);
            setTimeout(function () {
                fetch('https://' + GetParentResourceName() + '/requestOngoingIncidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(function () {});
                fetch('https://' + GetParentResourceName() + '/requestUnitBoard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(function () {});
            }, 120);
        }
    });

    // Immediate render for FiveM NUI, plus a delayed retry in case the DOM is still settling.
    renderAll();
    setTimeout(renderAll, 250);
})();
