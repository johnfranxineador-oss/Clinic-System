/* APP – decides which screen to show (login or app), fills the page, start-up.
   The page frame, menu and login form now live in index.html. */
// Small pop-up message at the bottom of the screen
function toast(text) {
    const box = $('#toast');
    box.textContent = text;
    clearTimeout(box.timer);
    box.timer = setTimeout(() => (box.textContent = ''), 3500);
}
function render() {
    const loginScreen = $('#login-screen');
    const appScreen = $('#app-screen');
    const modal = $('#modal');
    // Nobody logged in → show the login screen only
    if (!Auth.user) {
        S.resched = S.m = null;
        S.ep = false;
        document.body.removeAttribute('data-role'); // CSS uses this to hide/show menu links
        loginScreen.hidden = false;
        appScreen.hidden = true;
        modal.hidden = true;
        return;
    }
    const role = Auth.user.role;
    document.body.dataset.role = role;
    // Menu links this role may use (taken from data-roles in index.html)
    const allowedLinks = [...document.querySelectorAll('.side nav a')].filter((link) => link.dataset.roles.split(' ').includes(role));
    const allowedPaths = allowedLinks.map((link) => link.getAttribute('href').replace('#/', ''));
    // Wrong or missing page in the address → go to the first page this role may open
    const wanted = location.hash.replace('#/', '') || 'dashboard';
    if (!allowedPaths.includes(wanted)) {
        location.hash = '#/' + allowedPaths[0];
        if (wanted != allowedPaths[0])
            return;
    }
    const path = allowedPaths.includes(wanted) ? wanted : allowedPaths[0];
    const page = PAGES.find((p) => p.path == path);
    // Highlight the current menu link
    document.querySelectorAll('.side nav a').forEach((link) => link.classList.toggle('on', link.getAttribute('href') == '#/' + path));
    // Fill "who is logged in"
    $('#me-icon').innerHTML = roleIcon(role, 16);
    $('#me-name').textContent = Auth.user.name;
    $('#me-role').innerHTML = roleBadge(role);
    $('#logout-btn').textContent = Auth.user.guest ? 'Back to login' : 'Log out';
    $('#change-password-btn').hidden = !!Auth.user.guest;
    $('#today').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    // Show the screens
    loginScreen.hidden = true;
    appScreen.hidden = false;
    $('#page').innerHTML = Views[page.view]();
    modal.innerHTML = Views.modal();
    modal.hidden = !(S.resched || S.m);
}
window.addEventListener('hashchange', () => {
    S.resched = S.m = null;
    S.ep = false;
    render();
});
// Start-up
(async () => {
    try {
        await DB.init();
        Auth.restore();
        render();
    } catch (error) { showLoginErr(error.message); }
})();

