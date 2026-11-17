/* ACTIONS – what happens on click (data-act), on change (data-change) and on submit (data-form).
   Every action re-checks the user's role, not just the menu. */
const $ = (s) => document.querySelector(s);
const need = (...roles) => {
    if (!Auth.can(roles)) {
        toast('You don’t have access to that.');
        return false;
    }
    return true;
};
const showErr = (m) => {
    const e = $('#err');
    if (e)
        e.innerHTML = m ? `<div class="alert" role="alert">${U.esc(m)}</div>` : '';
};
const showLoginErr = (m) => {
    $('#login-err').innerHTML = m ? `<div class="alert" role="alert">${U.esc(m)}</div>` : '';
};
const done = async () => {
    if (DB.saving) return;
    DB.saving = true;
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await DB.save(); render(); }
    catch (error) { render(); toast(error.message); }
    finally { DB.saving = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
};
const PHONE = /^[0-9+\-\s()]{7,18}$/;
const Actions = {
    changePassword() {
        if (!Auth.user || Auth.user.guest) return;
        S.m = { k: 'changePassword' };
        render();
    },
    visitor: () => {
        Auth.guest();
        showLoginErr('');
        location.hash = '#/doctors';
        render();
    },
    reset: () => DB.reset(),
    print: () => window.print(),
    logout: () => Auth.logout(),
    closeModal: () => {
        S.resched = null;
        S.m = null;
        render();
    },
    slot: (b) => {
        S[b.dataset.scope][b.dataset.scope == 'book' ? 'time' : 't'] = b.dataset.t;
        render();
    },
    goStatus(b) {
        if (!need('admin', 'staff'))
            return;
        S.st = b.dataset.st || '';
        S.q = '';
        location.hash = '#/appointments';
    },
    openM(b) {
        const k = b.dataset.k, ok = {
            editPatient: ['admin'], addPatient: ['admin', 'staff'], viewPatient: ['admin', 'staff'], editDoctor: ['admin', 'staff'], addDoctor: ['admin'], addService: ['admin'], addAccount: ['admin']
        }[k];
        if (!ok || !need(...ok))
            return;
        S.m = {
            k, id: b.dataset.id
        };
        render();
    },
    pickRole: (b) => {
        if (need('admin') && S.m) {
            S.m.role = b.dataset.r;
            render();
        }
    },
    toggleRole: (b) => {
        S.rv[b.dataset.r] = !S.rv[b.dataset.r];
        render();
    },
    toggleFA: () => {
        S.fa = !S.fa;
        render();
    },
    editProfile: () => {
        if (need('patient')) {
            S.ep = true;
            render();
        }
    },
    cancelProfile: () => {
        S.ep = false;
        render();
    },
    toggleMore: () => {
        S.lmore = !S.lmore;
        render();
    },
    status(b) {
        const a = DB.d.appts.find((x) => x.id == b.dataset.id), to = b.dataset.to;
        if (!a)
            return;
        const staffOk = Auth.can(['staff']) && ['Approved', 'Completed', 'Cancelled'].includes(to);
        const own = Auth.user.role == 'patient' && a.pid == Auth.user.id && to == 'Cancelled';
        if (!staffOk && !own)
            return toast('Not allowed.');
        a.status = to;
        DB.log(`${to} appointment ${a.id}`);
        done();
    },
    resched(b) {
        const a = DB.d.appts.find((x) => x.id == b.dataset.id);
        if (!a || !['Pending', 'Approved'].includes(a.status))
            return;
        if (!(Auth.user.role == 'patient' && a.pid == Auth.user.id) && !need('staff'))
            return;
        S.resched = {
            id: a.id, date: a.date, t: ''
        };
        render();
    },
    saveResched() {
        const R = S.resched, a = DB.d.appts.find((x) => x.id == R.id);
        if (!(Auth.user.role == 'patient' && a.pid == Auth.user.id) && !Auth.can(['staff']))
            return toast('Not allowed.');
        if (!R.t || !Rules.slots(a.did, R.date, a.id).find((s) => s.t == R.t && s.free))
            return toast('That time is not available.');
        a.date = R.date;
        a.time = R.t;
        if (Auth.user.role == 'patient')
            a.status = 'Pending'; // staff re-confirm the new time
        DB.log(`Rescheduled appointment ${a.id} to ${a.date} ${a.time}`);
        S.resched = null;
        done();
    },
    toggle(b) {
        if (!need('admin'))
            return;
        const o = DB.d[b.dataset.c].find((x) => x.id == b.dataset.id);
        o.on = !o.on;
        const sv = b.dataset.c == 'svcs';
        DB.log(`${sv ? (o.on ? 'Opened' : 'Closed') : (o.on ? 'Activated' : 'Deactivated')} ${o.name}`);
        done();
    },
    toggleUser(b) {
        if (!need('admin'))
            return;
        const u = Q.user(b.dataset.id);
        if (u.id == Auth.user.id)
            return;
        u.active = !u.active;
        DB.log(`${u.active ? 'Activated' : 'Deactivated'} account ${u.username}`);
        done();
    },
    delUser(b) {
        if (!need('admin'))
            return;
        const u = Q.user(b.dataset.id);
        if (!u || u.id == Auth.user.id)
            return;
        if (!confirm(`Delete ${u.name}'s account? Linked appointments or logs prevent deletion.`))
            return;
        DB.d.users = DB.d.users.filter((x) => x.id != u.id);
        DB.log('Deleted account ' + u.username);
        done();
    },
    photo(el) {
        if (!need('patient'))
            return;
        const f = el.files[0];
        if (!f || !f.type.startsWith('image/'))
            return toast('Choose an image file.');
        const img = new Image(), url = URL.createObjectURL(f);
        img.onload = () => {
            const c = document.createElement('canvas'), m = Math.min(img.width, img.height);
            c.width = c.height = 160;
            c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 160, 160);
            Auth.user.photo = c.toDataURL('image/jpeg', 0.8);
            URL.revokeObjectURL(url);
            DB.log('Updated profile photo');
            done();
        };
        img.src = url;
    },
    set(el) {
        const k = el.dataset.k, path = k.split('.');
        let o = S;
        while (path.length > 1)
            o = o[path.shift()];
        o[path[0]] = el.value;
        if (k == 'book.svc')
            Object.assign(S.book, {
                doctor: '', date: '', time: ''
            }); // service → doctors of that specialty → doctor's dates → times
        if (k == 'book.doctor')
            Object.assign(S.book, {
                date: '', time: ''
            });
        if (k == 'book.date')
            S.book.time = '';
        if (k == 'resched.date')
            S.resched.t = '';
        render();
    },
    role(el) {
        if (!need('admin'))
            return;
        const u = Q.user(el.dataset.id);
        if (u.id == Auth.user.id || !ROLES[el.value] || ROLES[el.value].hidden)
            return;
        u.role = el.value;
        DB.log(`Changed ${u.username} to ${el.value}`);
        done();
    },
};
const Forms = {
    async changePassword(f, d) {
        if (!Auth.user || Auth.user.guest) return;
        const newPassword = d.get('newPassword');
        if (newPassword !== d.get('confirmPassword')) return showErr('New passwords do not match.');
        const button = f.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            await API.request('/auth/change-password', 'POST', {
                username: Auth.user.username, currentPassword: d.get('currentPassword'), newPassword
            });
            f.reset();
            S.m = null;
            Auth.logout('Password changed. Log in with your new password.');
        } catch (error) { showErr(error.message); }
        finally { button.disabled = false; }
    },
    async login(f, d) {
        const e = await Auth.login(d.get('username').trim(), d.get('password'));
        if (e)
            return showLoginErr(e);
        showLoginErr('');
        f.reset();
        location.hash = '#/dashboard';
        render();
    },
    book(f, d) {
        if (!need('patient'))
            return;
        const B = S.book, sv = Q.svc(B.svc), dc = Q.doc(B.doctor);
        if (!sv || !dc || !B.date || !B.time)
            return showErr('Pick a service, doctor, date and time.');
        if (sv.sp && dc.sp != sv.sp)
            return showErr('That doctor does not handle this service.');
        if (!Rules.slots(B.doctor, B.date).find((s) => s.t == B.time && s.free))
            return showErr('That time was just taken. Pick another.');
        if (DB.d.appts.some((a) => a.pid == Auth.user.id && a.date == B.date && a.time == B.time && ['Pending', 'Approved'].includes(a.status)))
            return showErr('You already have an appointment at that time.');
        const a = {
            id: U.uid(), pid: Auth.user.id, did: B.doctor, svc: B.svc, date: B.date, time: B.time, status: 'Pending', note: d.get('reason').slice(0, 200)
        };
        DB.d.appts.push(a);
        DB.log(`Created appointment ${a.date} ${a.time}`);
        S.book = {};
        location.hash = '#/appointments';
        toast('Request sent. Staff will review it.');
        done();
    },
    async patient(f, d) {
        if (!need('admin', 'staff') || !S.m)
            return;
        const ed = S.m.k == 'editPatient';
        if (ed && !need('admin'))
            return;
        const info = {
            name: d.get('name').trim(), email: d.get('email').trim(), phone: d.get('phone').trim(), dob: d.get('dob'), address: d.get('address').trim(), sid: d.get('sid').trim()
        };
        if (info.name.length < 2 || !PHONE.test(info.phone))
            return showErr('Enter a full name and a valid phone number.');
        if (ed) {
            const e = DB.sidErr(info.sid, S.m.id);
            if (e)
                return showErr(e);
            Object.assign(Q.user(S.m.id), info);
            DB.log(`Updated patient ${Q.user(S.m.id).username}`);
        }
        else {
            const e = await DB.addUser({
                ...info, username: d.get('username').trim(), password: d.get('password'), role: 'patient'
            });
            if (e)
                return showErr(e);
            DB.log('Registered patient ' + d.get('username'));
        }
        S.m = null;
        toast('Saved.');
        done();
    },
    profile(f, d) {
        if (!need('patient'))
            return;
        const p = d.get('phone').trim(), n = d.get('name').trim();
        if (n.length < 2 || !PHONE.test(p))
            return showErr('Check your name and phone number.');
        Object.assign(Auth.user, {
            name: n, phone: p, dob: d.get('dob'), address: d.get('address').trim()
        }); // student number is never changed here
        DB.log('Updated own profile');
        S.ep = false;
        toast('Saved.');
        done();
    },
    doctor(f, d) {
        if (!need('admin', 'staff') || !S.m)
            return;
        const adm = Auth.user.role == 'admin', add = S.m.k != 'editDoctor';
        if (add && !adm)
            return;
        const days = d.getAll('days').map(Number), s = +d.get('s'), e = +d.get('e'), name = (d.get('name') || '').trim(), sp = (d.get('sp') || '').trim(), phone = (d.get('phone') || '').trim();
        if (adm && (name.length < 3 || !sp))
            return showErr('Enter the doctor’s name and specialty.');
        if (adm && !PHONE.test(phone))
            return showErr('Enter a valid contact number for the doctor.');
        if (!days.length)
            return showErr('Select at least one working day.');
        if (!(s >= 6 && e <= 21 && s < e))
            return showErr('Hours must be between 6 and 21, with start before end.');
        if (add)
            DB.d.docs.push({
                id: U.uid(), name, sp, phone, license: d.get('license'), days, s, e, on: true
            });
        else {
            const o = Q.doc(S.m.id);
            Object.assign(o, {
                days, s, e
            }, adm ? {
                name, sp, phone, license: d.get('license')
            } : {});
        }
        DB.log((add ? 'Added doctor ' : 'Updated doctor ') + (add ? name : Q.doc(S.m.id).name));
        S.m = null;
        done();
    },
    service(f, d) {
        if (!need('admin'))
            return;
        const n = d.get('name').trim();
        if (n.length < 3)
            return showErr('Enter a service name.');
        DB.d.svcs.push({
            id: U.uid(), name: n, sp: d.get('sp') || '', description: d.get('description'), duration: Number(d.get('duration')), on: true
        });
        DB.log('Added service ' + n);
        S.m = null;
        done();
    },
    async staff(f, d) {
        if (!need('admin'))
            return;
        const e = await DB.addUser({
            name: d.get('name').trim(), email: d.get('email').trim(), phone: d.get('phone').trim(), username: d.get('username').trim(), password: d.get('password'), role: 'staff'
        });
        if (e)
            return showErr(e);
        DB.log('Created staff account ' + d.get('username'));
        S.m = null;
        toast('Staff account created.');
        done();
    },
};
// Chart hover/focus: highlight one status in the donut and bars, show its numbers in the centre
const hl = (e, on) => {
    const t = e.target.closest && e.target.closest('.chart [data-st]');
    if (!t)
        return;
    const ch = t.closest('.chart');
    ch.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('dim', on && x.dataset.st != t.dataset.st));
    ch.querySelector('.dn').textContent = on ? t.dataset.pc + '%' : ch.dataset.total;
    ch.querySelector('.dl').textContent = on ? `${t.dataset.st} (${t.dataset.c})` : 'appointments';
};
['mouseover', 'focusin'].forEach((n) => document.addEventListener(n, (e) => hl(e, true)));
['mouseout', 'focusout'].forEach((n) => document.addEventListener(n, (e) => hl(e, false)));
document.addEventListener('keydown', (e) => {
    if (e.key == 'Enter' && e.target.dataset && e.target.dataset.act == 'goStatus')
        Actions.goStatus(e.target);
});
// One listener per event type (event delegation) – no inline onclick needed anywhere
document.addEventListener('click', (e) => {
    if (DB.saving) { e.preventDefault(); return; }
    const b = e.target.closest('[data-act]');
    if (b)
        Actions[b.dataset.act]?.(b);
    if (Auth.user)
        Auth.touch();
});
document.addEventListener('change', (e) => {
    const c = e.target.closest('[data-change]');
    if (c)
        Actions[c.dataset.change]?.(c);
});
document.addEventListener('submit', (e) => {
    if (DB.saving) { e.preventDefault(); return; }
    const f = e.target.closest('form[data-form]');
    if (f) {
        e.preventDefault();
        Forms[f.dataset.form]?.(f, new FormData(f));
    }
});
document.addEventListener('keydown', () => Auth.user && Auth.touch());

