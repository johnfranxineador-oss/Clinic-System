/* ROLES – from section D (User Roles). Edit names, colors and feature lists here. */
const ICONS = {
    admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    staff: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    patient: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7z"/>',
    visitor: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7z"/>',
    viewer: '<path d="M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3"/>',
};
const ROLES = {
    admin: {
        label: 'Administrator', color: '#7c3aed', features: ['Manages accounts, roles and deletion', 'Adds and edits patients and doctors', 'Manages clinic services (open/close)', 'Views appointments (view-only), activity log and reports']
    },
    staff: {
        label: 'Clinic Staff', color: '#0b6e63', features: ['Approves, rejects and completes appointments', 'Views patient records and adds patients', 'Edits doctors’ schedules']
    },
    patient: {
        label: 'Patient', color: '#0e7490', features: ['Books and edits own appointments', 'Views own records and history']
    },
    visitor: {
        label: 'Visitor', color: '#64748b', hidden: true, features: []
    }, // guest session, not a real account
    viewer: {
        label: 'Viewer', color: '#b45309', hidden: true, features: ['Can only view permitted clinic and appointment information']
    },
};
const FEATURES = [
    ['Manage user accounts, roles and deletion', 'admin'], ['Add and edit doctors', 'admin'], ['Edit doctors’ schedules', 'admin staff'], ['Open/close clinic services', 'admin'],
    ['View activity log and print reports', 'admin'], ['Add patients', 'admin staff'], ['Edit patient information', 'admin'], ['View patient records', 'admin staff'],
    ['Approve, reject, complete and reschedule appointments', 'staff'], ['View all appointments (view-only)', 'admin'], ['Book appointments', 'patient'],
    ['Edit date/time or cancel own appointment', 'patient'], ['View own records and appointment status', 'patient'],
    ['View doctors and their schedules', 'admin staff patient viewer'], ['View clinic services', 'admin viewer'], ['View appointments (without patient details)', 'viewer'],
];
const roleIcon = (r, size = 32) => `<span class="ravatar" style="width:${size + 12}px;height:${size + 12}px;color:${ROLES[r].color};background:${ROLES[r].color}22"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[r]}</svg></span>`;
const roleBadge = (r) => `<span class="rbadge" style="background:${ROLES[r].color}">${ROLES[r].label}</span>`;

