/* VIEWS – each screen returns HTML. To change a screen's layout, edit its function here.
   Buttons use data-act="name" (see actions.js); forms use data-form="name". */
const S = {
    authMode: 'login', q: '', st: '', pq: '', editId: null, book: {}, resched: null, rep: {
        from: '', to: '', st: ''
    }, aq: '', rv: {}, fa: false, lq: '', lr: '', lmore: false, m: null, ep: false
}; // screen state
const chip = (s) => `<span class="chip s-${s}">${s}</span>`;
const nm = (o) => (o ? U.esc(o.name) : '—');
const tbl = (cols, rows, empty = 'Nothing to show.') => !rows.length ? `<p class="muted">${empty}</p>` :
    `<div class="tablewrap"><table class="rt"><thead><tr>${cols.map((c) => `<th>${c.h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td data-l="${c.h}">${c.c(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const fld = (name, label, v = '', type = 'text', x = '') => `<label>${label}<input name="${name}" type="${type}" value="${U.esc(v)}" ${x}></label>`;
const opts = (pairs, sel) => pairs.map(([v, l]) => `<option value="${U.esc(v)}" ${v == sel ? 'selected' : ''}>${U.esc(l)}</option>`).join('');
const roleOpts = (sel) => opts(Object.entries(ROLES).filter(([, r]) => !r.hidden).map(([k, r]) => [k, r.label]), sel);
const dayBoxes = (sel) => `<div class="days">${DAYS.map((d, i) => `<label><input type="checkbox" name="days" value="${i}" ${sel.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div>`;
const statusChart = () => {
    const A = DB.d.appts, n = A.length, C = 301.59;
    let off = 0;
    const rows = STATUSES.map((st) => {
        const c = A.filter((a) => a.status == st).length;
        return {
            st, c, pc: n ? Math.round(c / n * 100) : 0
        };
    });
    const segs = rows.filter((x) => x.c).map((x) => {
        const len = x.c / n * C, el = `<circle class="seg s-${x.st}" cx="60" cy="60" r="48" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" data-st="${x.st}" data-pc="${x.pc}" data-c="${x.c}" data-act="goStatus" tabindex="0"><title>${x.st}: ${x.c}</title></circle>`;
        off += len;
        return el;
    }).join('');
    return `<div class="card chart" data-total="${n}"><h3>Appointments by status</h3><p class="muted">Hover to compare. Click a status to open that list.</p><div class="chartbody"><svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Appointments by status"><circle cx="60" cy="60" r="48" fill="none" stroke="#e4eee9" stroke-width="16"/><g transform="rotate(-90 60 60)">${segs}</g><text class="dn" x="60" y="66" text-anchor="middle">${n}</text><text class="dl" x="60" y="82" text-anchor="middle">appointments</text></svg>
    <div class="bars">${rows.map((x) => `<a class="bar" href="#/appointments" data-act="goStatus" data-st="${x.st}" data-pc="${x.pc}" data-c="${x.c}"><span>${x.st}</span><div class="track s-${x.st}"><i style="width:${x.pc}%"></i></div><b>${x.pc}% <small class="muted">(${x.c})</small></b></a>`).join('')}</div></div></div>`;
};
const weekChart = () => {
    const A = DB.d.appts.filter((a) => ['Pending', 'Approved'].includes(a.status)), days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            d, c: A.filter((a) => a.date == U.iso(d)).length
        };
    }), mx = Math.max(1, ...days.map((x) => x.c));
    return `<div class="card"><h3>Upcoming 7 days</h3><p class="muted">Pending and approved appointments per day.</p><div class="week">${days.map((x) => `<div class="col" data-tip="${x.c} appointment${x.c == 1 ? '' : 's'}" tabindex="0"><div class="colbar"><i style="height:${Math.max(x.c / mx * 100, 4)}%"></i></div><b>${x.c}</b><span>${x.d.toLocaleDateString('en-US', {
        weekday: 'short'
    })}<br><small>${x.d.getDate()}</small></span></div>`).join('')}</div></div>`;
};
const onoff = (o) => (o.on ?? o.active) ? 'Active' : 'Inactive';
const slotBtns = (sl, sel, scope) => !sl.length ? '<p class="muted">No working hours for that doctor on this date.</p>' :
    `<div class="slots">${sl.map((s) => `<button type="button" class="slot ${sel == s.t ? 'on' : ''}" data-act="slot" data-scope="${scope}" data-t="${s.t}" ${s.free ? '' : 'disabled'}>${s.t}</button>`).join('')}</div>`;
/* appointment table shared by several screens. mode: staff | mine | viewer | report */
function apTable(rows, mode) {
    const hidePat = mode == 'viewer' || mode == 'mine', noAct = ['viewer', 'report', 'admin'].includes(mode);
    const cols = [{
            h: 'When', c: (a) => `${a.date}<br>${a.time}`
        }];
    if (!hidePat)
        cols.push({
            h: 'Patient', c: (a) => nm(Q.user(a.pid))
        });
    cols.push({
        h: 'Doctor', c: (a) => nm(Q.doc(a.did))
    }, {
        h: 'Service', c: (a) => nm(Q.svc(a.svc))
    }, {
        h: 'Status', c: (a) => chip(a.status)
    });
    if (!noAct)
        cols.push({
            h: 'Actions', c: (a) => apActions(a, mode)
        });
    return tbl(cols, [...rows].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), 'No appointments to show.');
}
function apActions(a, mode) {
    const open = ['Pending', 'Approved'].includes(a.status);
    const b = (to, label, ghost) => `<button class="sm ${ghost ? 'ghost' : ''}" data-act="status" data-id="${a.id}" data-to="${to}">${label}</button>`;
    if (mode == 'mine')
        return open ? `<button class="sm ghost" data-act="resched" data-id="${a.id}">Edit date/time</button>` + b('Cancelled', 'Cancel request', 1) : '';
    return (a.status == 'Pending' ? b('Approved', 'Approve') + b('Cancelled', 'Reject', 1) : '') + (a.status == 'Approved' ? b('Completed', 'Complete') : '') +
        (open ? `<button class="sm ghost" data-act="resched" data-id="${a.id}">Reschedule</button>` + b('Cancelled', 'Cancel', 1) : '');
}
const filterBar = () => `<div class="filters"><label>Search<input value="${U.esc(S.q)}" data-change="set" data-k="q" placeholder="Doctor, service, date…"></label>
  <label>Status<select data-change="set" data-k="st"><option value="">All statuses</option>${STATUSES.map((s) => `<option ${S.st == s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>`;
function filtered(rows, hidePat) {
    const q = S.q.toLowerCase();
    return rows.filter((a) => (!S.st || a.status == S.st) && (!q || [hidePat ? '' : (Q.user(a.pid) || {}).name, (Q.doc(a.did) || {}).name, (Q.svc(a.svc) || {}).name, a.date].join(' ').toLowerCase().includes(q)));
}
const Views = {
    dashboard() {
        const r = Auth.user.role, D = DB.d, me = Auth.user.id, today = U.iso(new Date());
        let h = '<h2>Dashboard</h2>';
        if (['admin', 'staff'].includes(r))
            h += `<div class="stats"><a class="stat" href="#/patients"><b>${D.users.filter((u) => u.role == 'patient').length}</b>Patients</a><a class="stat" href="#/appointments" data-act="goStatus" data-st=""><b>${D.appts.length}</b>Appointments</a><a class="stat" href="#/appointments" data-act="goStatus" data-st="Pending"><b>${D.appts.filter((a) => a.status == 'Pending').length}</b>Pending requests</a></div><div class="twocol">${statusChart()}${weekChart()}</div>
      <div class="card"><h3>Pending requests</h3>${apTable(D.appts.filter((a) => a.status == 'Pending'), r == 'staff' ? 'staff' : 'admin')}</div>`;
        if (r == 'patient') {
            const mine = D.appts.filter((a) => a.pid == me), srt = (x, y) => (x.date + x.time).localeCompare(y.date + y.time);
            const up = mine.filter((a) => ['Pending', 'Approved'].includes(a.status) && a.date >= today).sort(srt), hist = mine.filter((a) => a.status == 'Completed').sort((x, y) => srt(y, x));
            h += `<div class="card"><h3>Next appointment</h3>${tbl([{
                    h: 'Date', c: (a) => a.date
                }, {
                    h: 'Time', c: (a) => a.time
                }, {
                    h: 'Doctor', c: (a) => nm(Q.doc(a.did))
                }, {
                    h: 'Session / check-up', c: (a) => nm(Q.svc(a.svc))
                }, {
                    h: 'Status', c: (a) => chip(a.status)
                }], up, 'You have no upcoming appointments.')}<a class="btn" href="#/book">Book an appointment</a></div>
        <div class="card"><h3>My records</h3><p class="muted">Your visit history. This record is read-only.</p>${tbl([{
                    h: 'Date', c: (a) => a.date
                }, {
                    h: 'Doctor', c: (a) => nm(Q.doc(a.did))
                }, {
                    h: 'Session / check-up', c: (a) => nm(Q.svc(a.svc))
                }], hist, 'No past visits yet.')}</div>`;
        }
        return h;
    },
    book() {
        const B = S.book, svcs = DB.d.svcs.filter((s) => s.on), sv = Q.svc(B.svc), docs = sv ? DB.d.docs.filter((d) => d.on && (!sv.sp || d.sp == sv.sp)) : [];
        const dates = B.doctor ? Rules.dates(B.doctor) : [], sl = B.doctor && B.date ? Rules.slots(B.doctor, B.date) : null;
        return `<h2>Book an appointment</h2><div id="err"></div><form class="card" data-form="book"><div class="grid">
      <label>Service<select data-change="set" data-k="book.svc"><option value="">Select a service</option>${opts(svcs.map((s) => [s.id, s.name]), B.svc)}</select></label>
      <label>Doctor<select data-change="set" data-k="book.doctor" ${sv ? '' : 'disabled'}><option value="">${sv ? (docs.length ? 'Select a doctor' : 'No doctor available') : 'Select a service first'}</option>${opts(docs.map((d) => [d.id, `${d.name} – ${d.sp}`]), B.doctor)}</select></label>
      <label>Date<select data-change="set" data-k="book.date" ${B.doctor ? '' : 'disabled'}><option value="">${B.doctor ? (dates.length ? 'Select a date' : 'No open dates') : 'Select a doctor first'}</option>${opts(dates, B.date)}</select></label></div>
      ${B.doctor && Q.doc(B.doctor)?.phone ? `<p class="muted">Doctor’s contact no.: ${U.esc(Q.doc(B.doctor).phone)}</p>` : ''}
      ${sl ? `<b>Open times</b>${slotBtns(sl, B.time, 'book')}` : ''}
      ${fld('reason', 'Reason for visit (optional)', '', 'text', 'maxlength="200"')}<button>Request appointment</button></form>`;
    },
    appointments() {
        const r = Auth.user.role, mode = {
            viewer: 'viewer', patient: 'mine', staff: 'staff', admin: 'admin'
        }[r];
        const rows = filtered(r == 'patient' ? DB.d.appts.filter((a) => a.pid == Auth.user.id) : DB.d.appts, ['viewer', 'mine'].includes(mode));
        return `<h2>${r == 'patient' ? 'My appointments' : 'Appointments'}</h2>${r == 'viewer' ? '<p class="muted">View-only. Patient details are hidden.</p>' : r == 'admin' ? '<p class="muted">View-only. Staff approve, reject and complete appointments.</p>' : ''}${filterBar()}${apTable(rows, mode)}`;
    },
    patients() {
        const q = S.pq.toLowerCase(), adm = Auth.user.role == 'admin';
        const rows = DB.d.users.filter((u) => u.role == 'patient' && (!q || (u.name + u.username + u.phone + (u.sid || '')).toLowerCase().includes(q)));
        const btn = (k, id, l) => `<button class="sm ghost" data-act="openM" data-k="${k}" data-id="${id}">${l}</button>`;
        return `<h2>Patients</h2>${adm ? '' : '<p class="muted">View-only records. Only the administrator can edit patient information.</p>'}<div class="filters"><label>Search<input value="${U.esc(S.pq)}" data-change="set" data-k="pq" placeholder="Name, student no., username or phone"></label></div>
      ${tbl([{
                h: 'Name', c: (u) => U.esc(u.name)
            }, {
                h: 'Student No.', c: (u) => U.esc(u.sid) || '—'
            }, {
                h: 'Username', c: (u) => U.esc(u.username)
            }, {
                h: 'Phone', c: (u) => U.esc(u.phone)
            }, {
                h: 'Actions', c: (u) => btn('viewPatient', u.id, 'View') + (adm ? btn('editPatient', u.id, 'Edit') : '')
            }], rows, 'No patients found.')}
      <button class="sm" data-act="openM" data-k="addPatient">+ Add patient</button>`;
    },
    doctors() {
        const r = Auth.user.role, adm = r == 'admin', sf = r == 'staff', b = (k, id, l) => `<button class="sm ghost" data-act="openM" data-k="${k}" data-id="${id}">${l}</button>`;
        const act = (d) => (adm ? b('editDoctor', d.id, 'Edit') + `<button class="sm ghost" data-act="toggle" data-c="docs" data-id="${d.id}">${d.on ? 'Deactivate' : 'Activate'}</button>` : '') + (sf ? b('editDoctor', d.id, 'Edit schedule') : '');
        return `<h2>Doctors</h2>${tbl([{
                h: 'Doctor', c: (d) => U.esc(d.name)
            }, {
                h: 'Specialty', c: (d) => U.esc(d.sp)
            }, ...(!['viewer', 'visitor'].includes(r) ? [{
                    h: 'Contact no.', c: (d) => U.esc(d.phone) || '—'
                }] : []), {
                h: 'Days', c: (d) => d.days.map((i) => DAYS[i]).join(', ')
            }, {
                h: 'Hours', c: (d) => `${d.s}:00–${d.e}:00`
            }, {
                h: 'Status', c: onoff
            }, ...(adm || sf ? [{
                    h: 'Actions', c: act
                }] : [])], DB.d.docs)}
      ${adm ? '<button class="sm" data-act="openM" data-k="addDoctor">+ Add doctor</button>' : ''}`;
    },
    services() {
        const adm = Auth.user.role == 'admin';
        return `<h2>Clinic services</h2>${tbl([{
                h: 'Service', c: (s) => U.esc(s.name)
            }, {
                h: 'Specialty', c: (s) => U.esc(s.sp) || 'Any'
            }, {
                h: 'Status', c: (s) => (s.on ? 'Open' : 'Closed')
            }, ...(adm ? [{
                    h: 'Actions', c: (s) => `<button class="sm ghost" data-act="toggle" data-c="svcs" data-id="${s.id}">${s.on ? 'Close' : 'Open'}</button>`
                }] : [])], DB.d.svcs)}
      ${adm ? '<button class="sm" data-act="openM" data-k="addService">+ Add service</button>' : ''}`;
    },
    accounts() {
        const me = Auth.user.id, q = S.aq.toLowerCase(), rows = DB.d.users.filter((u) => !q || (u.name + ' ' + u.username + ' ' + ROLES[u.role].label).toLowerCase().includes(q));
        return `<h2>Accounts and roles</h2><div class="filters"><label>Search<input value="${U.esc(S.aq)}" data-change="set" data-k="aq" placeholder="Name, username or role"></label></div>
      ${tbl([{
                h: 'Name', c: (u) => roleIcon(u.role, 16) + ' ' + U.esc(u.name)
            }, {
                h: 'Username', c: (u) => U.esc(u.username)
            }, {
                h: 'Role', c: (u) => u.id == me ? roleBadge(u.role) : `<select data-change="role" data-id="${u.id}">${roleOpts(u.role)}</select>`
            }, {
                h: 'Status', c: (u) => u.active ? 'Active' : 'Deactivated'
            }, {
                h: 'Actions', c: (u) => u.id == me ? '' : `<button class="sm ghost" data-act="toggleUser" data-id="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button><button class="sm ghost" data-act="delUser" data-id="${u.id}">Delete</button>`
            }], rows, 'No accounts found.')}
      <button class="sm" data-act="openM" data-k="addAccount">+ Add account</button>`;
    },
    roles() {
        const n = (r) => DB.d.users.filter((u) => u.role == r).length;
        return `<h2>Roles and permissions</h2><div class="rolegrid">${Object.entries(ROLES).filter(([, r]) => !r.hidden).map(([k, r]) => `<div class="card">${roleIcon(k, 36)}<p>${roleBadge(k)}</p><div class="bignum">${n(k)}<small>account(s)</small></div>
      <button class="sm ghost" data-act="toggleRole" data-r="${k}">${S.rv[k] ? 'Hide roles' : 'View roles'}</button>${S.rv[k] ? `<ul>${r.features.map((f) => `<li>${f}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>
      <button class="sm" data-act="toggleFA">${S.fa ? 'Hide feature access' : 'View feature access'}</button>
      ${S.fa ? `<h3>Feature access</h3><div class="tablewrap"><table><thead><tr><th>Feature</th>${Object.values(ROLES).filter((r) => !r.hidden).map((r) => `<th>${r.label}</th>`).join('')}</tr></thead>
      <tbody>${FEATURES.map(([f, who]) => `<tr><td>${f}</td>${Object.keys(ROLES).filter((k) => !ROLES[k].hidden).map((k) => `<td>${who.split(' ').includes(k) ? '✓' : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      <p class="muted">Change someone’s role on the Accounts page.</p>`;
    },
    logs() {
        const q = S.lq.toLowerCase(), rows = DB.d.logs.filter((l) => (!S.lr || l.r == S.lr) && (!q || ((l.n || '') + ' ' + l.u).toLowerCase().includes(q))), shown = S.lmore ? rows : rows.slice(0, 10);
        return `<h2>Activity log</h2><div class="filters"><label>Show<select data-change="set" data-k="lr"><option value="">All users</option>${opts([['patient', 'Patients'], ['staff', 'Staff']], S.lr)}</select></label>
      <label>Search name<input value="${U.esc(S.lq)}" data-change="set" data-k="lq" placeholder="Staff or patient name"></label></div>
      ${tbl([{
                h: 'Time', c: (l) => U.esc(l.t)
            }, {
                h: 'Name', c: (l) => `${U.esc(l.n || l.u)}<br><small class="muted">@${U.esc(l.u)}</small>`
            }, {
                h: 'Role', c: (l) => (l.r && ROLES[l.r] ? roleBadge(l.r) : '—')
            }, {
                h: 'Action', c: (l) => U.esc(l.a)
            }], shown, 'No activity found.')}
      ${rows.length > 10 ? `<button class="sm ghost" data-act="toggleMore">${S.lmore ? 'Show less' : `See more (${rows.length - 10})`}</button>` : ''}`;
    },
    reports() {
        const R = S.rep, rows = DB.d.appts.filter((a) => (!R.from || a.date >= R.from) && (!R.to || a.date <= R.to) && (!R.st || a.status == R.st));
        return `<h2>Appointment report</h2><div class="filters noprint"><label>From<input type="date" value="${R.from}" data-change="set" data-k="rep.from"></label><label>To<input type="date" value="${R.to}" data-change="set" data-k="rep.to"></label>
      <label>Status<select data-change="set" data-k="rep.st"><option value="">All</option>${STATUSES.map((s) => `<option ${R.st == s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <div><button data-act="print">Print report</button></div></div><p>Generated ${new Date().toLocaleString()} · ${rows.length} appointments</p>${apTable(rows, 'report')}`;
    },
    profile() {
        const u = Auth.user;
        if (!S.ep)
            return `<h2>My profile</h2><div class="card"><div class="row">${u.photo ? `<img class="avatar" src="${U.esc(u.photo)}" alt="Profile photo">` : roleIcon('patient', 56)}<div><b>${U.esc(u.name)}</b><br><label class="btn ghost sm">Change photo<input type="file" accept="image/*" data-change="photo" hidden></label></div></div>
      <p><span class="muted">Student number</span><br>${U.esc(u.sid) || '—'}</p><p><span class="muted">Phone</span><br>${U.esc(u.phone) || '—'}</p><p><span class="muted">Birthdate</span><br>${U.esc(u.dob) || '—'}</p><p><span class="muted">Address</span><br>${U.esc(u.address) || '—'}</p>
      <button data-act="editProfile">Edit profile</button></div>`;
        return `<h2>Edit profile</h2><div id="err"></div><form class="card" data-form="profile"><div class="grid">${fld('name', 'Full name', u.name, 'text', 'required maxlength="80"')}${fld('phone', 'Phone', u.phone, 'tel', 'required maxlength="18"')}
      ${fld('dob', 'Birthdate', u.dob, 'date')}${fld('address', 'Address', u.address, 'text', 'maxlength="120"')}${fld('sid_ro', 'Student number (cannot be changed)', u.sid, 'text', 'disabled')}</div>
      <div class="row"><button>Save changes</button><button type="button" class="ghost" data-act="cancelProfile">Cancel</button></div></form>`;
    },
    modal() {
        const R = S.resched, M = S.m;
        let cancel = '<button type="button" class="ghost" data-act="closeModal">Cancel</button>';
        if (R) {
            const a = DB.d.appts.find((x) => x.id == R.id);
            return `<div class="card modal"><h3>${Auth.user.role == 'patient' ? 'Edit date and time' : 'Reschedule'} with ${nm(Q.doc(a.did))}</h3><label>Date<select data-change="set" data-k="resched.date"><option value="">Select a date</option>${opts(Rules.dates(a.did, a.id), R.date)}</select></label>
        ${R.date ? slotBtns(Rules.slots(a.did, R.date, a.id), R.t, 'resched') : ''}<div class="row"><button data-act="saveResched" ${R.t ? '' : 'disabled'}>Confirm new time</button><button class="ghost" data-act="closeModal">Close</button></div></div>`;
        }
        if (!M)
            return '';
        let k = M.k;
        if (k === 'changePassword') {
            return `<div class="card modal"><h3>Change password</h3><div id="err" role="alert"></div><form data-form="changePassword"><div class="grid"><label>Current password<input name="currentPassword" type="password" required maxlength="128" autocomplete="current-password"></label><label>New password<input name="newPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><label>Confirm new password<input name="confirmPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label></div><p class="muted">Use 8 to 128 characters. You will log in again after saving.</p><div class="row"><button type="submit">Save password</button>${cancel}</div></form></div>`;
        }
        if (k == 'addAccount') {
            if (!M.role)
                return `<div class="card modal"><h3>Add account</h3><p class="muted">Who is this account for?</p><div class="row">${['doctor', 'staff', 'patient'].map((r) => `<button data-act="pickRole" data-r="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div><p></p>${cancel}</div>`;
            k = {
                patient: 'addPatient', doctor: 'addDoctor', staff: 'addStaff'
            }[M.role];
            cancel = '<button type="button" class="ghost" data-act="pickRole" data-r="">Back</button>';
        }
        if (k == 'addService') {
            const sps = [...new Set(DB.d.docs.map((d) => d.sp))].map((x) => [x, x]);
            return `<div class="card modal"><h3>Add service</h3><div id="err"></div><form data-form="service"><div class="grid">${fld('name', 'Service name', '', 'text', 'required maxlength="80"')}${fld('description', 'Description', '', 'text', 'required minlength="10" maxlength="500"')}${fld('duration', 'Duration in minutes', 30, 'number', 'required min="5" max="240" step="1"')}<label>Doctor specialty<select name="sp">${opts(sps, '')}</select></label></div><div class="row"><button>Add service</button>${cancel}</div></form></div>`;
        }
        if (k == 'addStaff')
            return `<div class="card modal"><h3>Add staff account</h3><div id="err"></div><form data-form="staff"><div class="grid">${fld('name', 'Full name', '', 'text', 'required maxlength="80"')}${fld('email', 'Email', '', 'email', 'required')}${fld('phone', 'Phone', '', 'tel', 'maxlength="18"')}${fld('username', 'Username', '', 'text', 'required maxlength="20"')}${fld('password', 'Password (8+ characters)', '', 'password', 'required')}</div><div class="row"><button>Save</button>${cancel}</div></form></div>`;
        if (k == 'viewPatient') {
            const u = Q.user(M.id), hist = DB.d.appts.filter((a) => a.pid == u.id).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
            return `<div class="card modal"><h3>${U.esc(u.name)}</h3><p><span class="muted">Student no.</span> ${U.esc(u.sid) || '—'}<br><span class="muted">Phone</span> ${U.esc(u.phone) || '—'}<br><span class="muted">Birthdate</span> ${U.esc(u.dob) || '—'}<br><span class="muted">Address</span> ${U.esc(u.address) || '—'}</p>
        <b>Appointment history</b>${tbl([{
                    h: 'Date', c: (a) => a.date
                }, {
                    h: 'Doctor', c: (a) => nm(Q.doc(a.did))
                }, {
                    h: 'Service', c: (a) => nm(Q.svc(a.svc))
                }, {
                    h: 'Status', c: (a) => chip(a.status)
                }], hist, 'No appointments yet.')}<button class="ghost" data-act="closeModal">Close</button></div>`;
        }
        if (k == 'editPatient' || k == 'addPatient') {
            const e = k == 'editPatient' ? Q.user(M.id) : null;
            return `<div class="card modal"><h3>${e ? 'Edit patient' : 'Add patient'}</h3><div id="err"></div><form data-form="patient"><div class="grid">${fld('name', 'Full name', e?.name, 'text', 'required maxlength="80"')}${fld('email', 'Email', e?.email, 'email', 'required')}${fld('sid', 'Student number', e?.sid, 'text', 'required maxlength="20"')}${fld('phone', 'Phone', e?.phone, 'tel', 'required maxlength="18"')}${fld('dob', 'Birthdate', e?.dob, 'date')}${fld('address', 'Address', e?.address, 'text', 'maxlength="120"')}
        ${e ? '' : fld('username', 'Username', '', 'text', 'required maxlength="20"') + fld('password', 'Temporary password', '', 'password', 'required')}</div><div class="row"><button>Save</button>${cancel}</div></form></div>`;
        }
        const e = k == 'editDoctor' ? Q.doc(M.id) : null, adm = Auth.user.role == 'admin';
        return `<div class="card modal"><h3>${e ? (adm ? 'Edit doctor' : 'Edit schedule – ' + U.esc(e.name)) : 'Add doctor'}</h3><div id="err"></div><form data-form="doctor"><div class="grid">${adm ? fld('name', 'Name', e?.name, 'text', 'required maxlength="80"') + fld('license', 'License number', e?.license, 'text', 'required minlength="5" maxlength="30"') + fld('sp', 'Specialty', e?.sp, 'text', 'required maxlength="60"') + fld('phone', 'Contact number', e?.phone, 'tel', 'required maxlength="18"') : ''}
      ${fld('s', 'Start hour (24h)', e ? e.s : 9, 'number', 'min="6" max="20"')}${fld('e', 'End hour (24h)', e ? e.e : 16, 'number', 'min="7" max="21"')}</div>${dayBoxes(e ? e.days : [1, 2, 3, 4, 5])}<div class="row"><button>Save</button>${cancel}</div></form></div>`;
    },
};
/* PAGES – which function draws which page. WHO may open a page is set in the menu in index.html (data-roles). */
const PAGES = [
    {
        path: 'dashboard', view: 'dashboard'
    },
    {
        path: 'book', view: 'book'
    },
    {
        path: 'appointments', view: 'appointments'
    },
    {
        path: 'patients', view: 'patients'
    },
    {
        path: 'doctors', view: 'doctors'
    },
    {
        path: 'services', view: 'services'
    },
    {
        path: 'accounts', view: 'accounts'
    },
    {
        path: 'roles', view: 'roles'
    },
    {
        path: 'logs', view: 'logs'
    },
    {
        path: 'reports', view: 'reports'
    },
    {
        path: 'profile', view: 'profile'
    },
];


