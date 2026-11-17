/* DATA LAYER – the only file that knows how data is stored (MongoDB API snapshot).
   API adapters are defined in api.js. */
const STATUSES = ['Pending', 'Approved', 'Completed', 'Cancelled'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const U = {
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c])),
    iso: (d) => d.toLocaleDateString('en-CA'),
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nextWeekday(n) {
        const d = new Date();
        d.setDate(d.getDate() + n);
        while ([0, 6].includes(d.getDay()))
            d.setDate(d.getDate() + 1);
        return U.iso(d);
    },
};
const Q = {
    user: (i) => DB.d.users.find((x) => x.id == i),
    doc: (i) => DB.d.docs.find((x) => x.id == i),
    svc: (i) => DB.d.svcs.find((x) => x.id == i),
};
const DB = {};
/* SCHEDULING RULES – no double booking, working days/hours, no past times */
const Rules = {
    HOLD: ['Pending', 'Approved', 'Completed'], // statuses that occupy a slot
    taken(did, date, t, except) {
        return DB.d.appts.some((a) => a.id != except && a.did == did && a.date == date && a.time == t && this.HOLD.includes(a.status));
    },
    dates(did, except) {
        const out = [];
        for (let i = 0; i < 60; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const iso = U.iso(d);
            if (this.slots(did, iso, except).some((x) => x.free))
                out.push([iso, d.toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                    })]);
        }
        return out;
    },
    slots(did, date, except) {
        const d = Q.doc(did);
        if (!d || !d.on || !date || !d.days.includes(new Date(date + 'T00:00').getDay()))
            return [];
        const now = new Date(), out = [];
        const availability = d.availability?.find(s => s.day === weekdayNames[new Date(date + 'T00:00').getDay()]);
        const minutes = t => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
        const start = availability ? minutes(availability.startTime) : d.s * 60;
        const end = availability ? minutes(availability.endTime) : d.e * 60;
        for (let m = start; m < end; m += 60) {
            const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
                past = date < U.iso(now) || (date == U.iso(now) && m <= now.getHours() * 60 + now.getMinutes());
            out.push({
                t, free: !past && !this.taken(did, date, t, except)
            });
        }
        return out;
    },
};


