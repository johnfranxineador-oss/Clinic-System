/* AUTH – login, register, logout, 15-minute inactivity timeout, lockout after 5 wrong tries */
const Auth = {
    user: null, fails: 0, lock: 0, timer: null,
    can(roles) {
        return !!this.user && roles.includes(this.user.role);
    },
    async login(username, password) {
        if (Date.now() < this.lock)
            return 'Too many attempts. Wait 30 seconds.';
        let u;
        try { u = DB.userView(await API.request('/auth/login', 'POST', { username, password })); }
        catch (error) {
            if (++this.fails >= 5) {
                this.lock = Date.now() + 3e4;
                this.fails = 0;
            }
            return error.message;
        }
        if (!u.active)
            return 'This account is deactivated. Contact an administrator.';
        try { await DB.refresh(); } catch (error) { return error.message; }
        this.fails = 0;
        this.set(u);
        DB.log('Logged in');
        return '';
    },
    guest() {
        this.user = {
            id: 'guest', name: 'Visitor', username: 'visitor', role: 'visitor', guest: true
        };
        this.touch();
    }, // no account, nothing saved
    set(u) {
        // Keep profile/photo edits attached to the snapshot that DB.save compares.
        this.user = Q.user(u.id) || u;
        try {
            sessionStorage.setItem('clinic_uid', u.id);
        }
        catch (e) {
        }
        this.touch();
    },
    restore() {
        try {
            const u = DB.d.users.find((x) => x.id == sessionStorage.getItem('clinic_uid') && x.active);
            if (u)
                this.set(u);
        }
        catch (e) {
        }
    },
    touch() {
        clearTimeout(this.timer);
        if (this.user)
            this.timer = setTimeout(() => this.logout('Signed out after 15 minutes of inactivity.'), 9e5);
    },
    logout(msg) {
        if (this.user)
            DB.log('Logged out');
        this.user = null;
        clearTimeout(this.timer);
        try {
            sessionStorage.removeItem('clinic_uid');
        }
        catch (e) {
        }
        location.hash = '';
        render();
        if (msg)
            toast(msg);
    },
};

