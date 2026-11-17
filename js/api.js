/* MongoDB is the source of truth. DB.d is only the current screen's API snapshot. */
const API = {
    base: window.CVSU_API_URL || (location.protocol === 'file:' ||
        (['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== '5000')
        ? 'http://localhost:5000/api' : '/api'),
    async request(path, method = 'GET', body) {
        let response;
        try {
            response = await fetch(this.base + path, {
                method, headers: { 'Content-Type': 'application/json',
                    ...(Auth.user && !Auth.user.guest ? { 'x-user-id': Auth.user.id } : {}) },
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
        } catch (_) { throw new Error('Cannot reach the server. Start it with npm.cmd start in the server folder.'); }
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || 'Request failed');
        return json.data;
    }
};
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const uiStatus = { pending: 'Pending', confirmed: 'Approved', completed: 'Completed', cancelled: 'Cancelled' };
const apiStatus = { Pending: 'pending', Approved: 'confirmed', Completed: 'completed', Cancelled: 'cancelled' };
Object.assign(DB, {
    original: null,
    sidErr(sid, except) {
        if (!/^[A-Za-z0-9-]{4,20}$/.test(sid || '')) return 'ID must have 4 to 20 letters, digits or dashes.';
        return this.d.users.some(u => u.id !== except && u.sid.toLowerCase() === sid.toLowerCase())
            ? 'That student or employee ID is already registered.' : '';
    },
    async init() { await this.refresh(); },
    userView(u) {
        return { id: u._id, name: u.fullName, username: u.username || u.studentEmployeeId,
            role: ['student', 'faculty'].includes(u.role) ? 'patient' : u.role,
            apiRole: u.role, active: u.active, phone: u.contactNumber, sid: u.studentEmployeeId,
            email: u.email, dob: u.dob || '', address: u.address || '', photo: u.photo || '' };
    },
    async refresh() {
        const [users, doctors, services, appointments, logs] = await Promise.all(
            ['/users', '/doctors', '/services', '/appointments', '/activity-logs'].map(p => API.request(p)));
        this.d = {
            users: users.map(u => this.userView(u)),
            docs: doctors.map(d => ({ id: d._id, name: d.fullName, sp: d.specialization,
                license: d.licenseNumber, phone: d.contactNumber || '', on: d.isActive,
                availability: d.availability, days: d.availability.map(s => weekdayNames.indexOf(s.day)),
                s: Number(d.availability[0]?.startTime.split(':')[0] || 9),
                e: Number(d.availability[0]?.endTime.split(':')[0] || 16) })),
            svcs: services.map(s => ({ id: s._id, name: s.name, sp: s.specialization,
                description: s.description, duration: s.durationMinutes, on: s.isActive })),
            appts: appointments.map(a => ({ id: a._id, pid: a.user?._id, did: a.doctor?._id,
                svc: a.service?._id, date: a.appointmentDate.slice(0, 10), time: a.timeSlot,
                status: uiStatus[a.status], note: a.reason, notes: a.notes })),
            logs: logs.map(l => ({ t: new Date(l.createdAt).toLocaleString(),
                u: l.user?.studentEmployeeId || 'Deleted user', n: l.user?.fullName || 'Deleted user',
                r: ['student', 'faculty'].includes(l.user?.role) ? 'patient' : l.user?.role,
                a: l.details }))
        };
        this.original = structuredClone(this.d);
        if (Auth.user && !Auth.user.guest) Auth.user = Q.user(Auth.user.id) || null;
    },
    payload(kind, o) {
        if (kind === 'users') return { fullName: o.name, studentEmployeeId: o.sid, email: o.email,
            role: o.role === 'patient' ? (o.apiRole === 'faculty' ? 'faculty' : 'student') : o.role,
            contactNumber: o.phone, username: o.username, active: o.active,
            dob: o.dob, address: o.address, photo: o.photo };
        if (kind === 'docs') {
            const before = this.original.docs.find(x => x.id === o.id);
            const unchangedSchedule = before && before.s === o.s && before.e === o.e &&
                JSON.stringify(before.days) === JSON.stringify(o.days);
            return { fullName: o.name, specialization: o.sp, licenseNumber: o.license,
            contactNumber: o.phone, isActive: o.on, availability: o.days.map(day => ({ day: weekdayNames[day],
                startTime: `${String(o.s).padStart(2, '0')}:00`, endTime: `${String(o.e).padStart(2, '0')}:00` })) ,
            ...(unchangedSchedule ? { availability: before.availability } : {}) };
        }
        if (kind === 'svcs') return { name: o.name, specialization: o.sp, isActive: o.on,
            description: o.description, durationMinutes: o.duration };
        return { user: o.pid, doctor: o.did, service: o.svc, appointmentDate: o.date,
            timeSlot: o.time, status: apiStatus[o.status], reason: o.note, notes: o.notes || '' };
    },
    async save() {
        const routes = { users: 'users', docs: 'doctors', svcs: 'services', appts: 'appointments' };
        try {
            for (const [kind, route] of Object.entries(routes)) {
                for (const row of this.d[kind]) {
                    const before = this.original[kind].find(x => x.id === row.id);
                    if (before && JSON.stringify(before) === JSON.stringify(row)) continue;
                    const result = await API.request(`/${route}${before ? '/' + row.id : ''}`,
                        before ? 'PATCH' : 'POST', this.payload(kind, row));
                    row.id = result._id;
                }
                for (const row of this.original[kind]) {
                    if (!this.d[kind].some(x => x.id === row.id)) await API.request(`/${route}/${row.id}`, 'DELETE');
                }
            }
        } finally { await this.refresh(); }
    },
    reset() { this.refresh().then(render).catch(e => toast(e.message)); },
    log() { /* Appointment actions are logged by the API, never fabricated in the browser. */ },
    async addUser(o) {
        try {
            await API.request('/users', 'POST', { fullName: o.name, username: o.username,
                password: o.password, studentEmployeeId: o.sid || o.username,
                email: o.email, role: o.role === 'patient' ? 'student' : o.role,
                contactNumber: o.phone, dob: o.dob, address: o.address });
            await this.refresh();
            return '';
        } catch (e) { return e.message; }
    }
});
