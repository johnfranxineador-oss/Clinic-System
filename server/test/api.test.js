const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const ActivityLog = require('../models/ActivityLog');

test('HTTP errors are JSON and do not expose internal details', async () => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['users', 'doctors', 'services', 'appointments', 'activity-logs']) {
      const response = await fetch(`${base}/api/${path}/invalid`);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).success, false);
    }
    const malformed = await fetch(`${base}/api/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).message, 'Malformed JSON in request body');
    assert.equal((await fetch(`${base}/unknown`)).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('MongoDB CRUD, validation, appointment audit logs, and reconnect persistence', {
  skip: !process.env.TEST_MONGODB_URI
}, async () => {
  // Explicit test URI only: never automatically use the application database.
  await mongoose.connect(process.env.TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const ids = {};
  const suffix = new mongoose.Types.ObjectId().toString();
  async function request(path, method = 'GET', body, expected = 200) {
    const response = await fetch(`${base}/${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const json = await response.json();
    assert.equal(response.status, expected, JSON.stringify(json));
    return json.data;
  }
  try {
    await Promise.all([User.init(), Doctor.init(), Service.init(), Appointment.init(), ActivityLog.init()]);
    const user = { studentEmployeeId: suffix.slice(-20), fullName: 'API Test User',
      email: `${suffix}@example.com`, role: 'student', contactNumber: '09171234567',
      username: `t${suffix.slice(-15)}`, password: 'Test-password-123' };
    const doctor = { fullName: 'API Test Doctor', specialization: 'General Medicine',
      licenseNumber: suffix, isActive: true,
      availability: [{ day: 'Monday', startTime: '09:00', endTime: '16:00' }] };
    const service = { name: `Consultation ${suffix}`, description: 'Integration test consultation',
      durationMinutes: 30, isActive: true };
    for (const [resource, body] of [['users', user], ['doctors', doctor], ['services', service]]) {
      ids[resource] = (await request(resource, 'POST', body, 201))._id;
      await request(resource);
      await request(`${resource}/${ids[resource]}`);
      await request(`${resource}/${ids[resource]}`, 'PUT', body);
      await request(`${resource}/${ids[resource]}`, 'PATCH', body);
      await request(`${resource}/000000000000000000000000`, 'GET', undefined, 404);
    }
    await request('users', 'POST', user, 400);
    const signedIn = await request('auth/login', 'POST', { username: user.username, password: user.password });
    assert.equal(signedIn._id, ids.users);
    assert.equal(signedIn.passwordHash, undefined);
    assert.equal((await request(`users/${ids.users}`)).passwordHash, undefined);
    await request('auth/login', 'POST', { username: user.username, password: 'wrong' }, 400);
    await request('auth/change-password', 'POST', { username: user.username,
      currentPassword: 'wrong', newPassword: 'Replacement-password-123' }, 400);
    await request('auth/change-password', 'POST', { username: user.username,
      currentPassword: user.password, newPassword: 'short' }, 400);
    await request('auth/change-password', 'POST', { username: user.username,
      currentPassword: user.password, newPassword: user.password }, 400);
    await request('auth/change-password', 'POST', { username: user.username,
      currentPassword: user.password, newPassword: 'Replacement-password-123' });
    await request('auth/login', 'POST', { username: user.username, password: user.password }, 400);
    await request('auth/login', 'POST', { username: user.username, password: 'Replacement-password-123' });
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');
    const context = vm.createContext({
      window: { CVSU_API_URL: base }, location: { protocol: 'http:', hostname: 'localhost', port: '5000' },
      Auth: { user: null }, fetch, structuredClone, console, Intl, render() {}, toast() {}
    });
    for (const file of ['data.js', 'api.js']) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js', file), 'utf8'), context);
    }
    await vm.runInContext('DB.init()', context);
    context.testId = ids.users;
    await vm.runInContext("Q.user(testId).name = 'Updated through frontend'; DB.save()", context);
    assert.equal((await request(`users/${ids.users}`)).fullName, 'Updated through frontend');
    // A fresh login must edit the same user object that the adapter saves.
    const authContext = vm.createContext({
      window: { CVSU_API_URL: base }, location: { protocol: 'http:', hostname: 'localhost', port: '5000' },
      fetch, structuredClone, console, Intl, render() {}, toast() {},
      sessionStorage: { setItem() {}, removeItem() {} }, setTimeout() { return 0; }, clearTimeout() {}
    });
    for (const file of ['data.js', 'api.js', 'auth.js']) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js', file), 'utf8'), authContext);
    }
    authContext.username = user.username;
    await vm.runInContext('DB.init()', authContext);
    assert.equal(await vm.runInContext("Auth.login(username, 'Replacement-password-123')", authContext), '');
    assert.equal(vm.runInContext('Auth.user === Q.user(Auth.user.id)', authContext), true);
    await vm.runInContext("Auth.user.name = 'Profile saved after login'; Auth.user.photo = 'data:image/jpeg;base64,dGVzdA=='; DB.save()", authContext);
    const savedProfile = await request(`users/${ids.users}`);
    assert.equal(savedProfile.fullName, 'Profile saved after login');
    assert.equal(savedProfile.photo, 'data:image/jpeg;base64,dGVzdA==');
    assert.ok((await fetch(base.replace('/api', '/'))).headers.get('content-type').includes('text/html'));
    assert.equal((await fetch(base.replace('/api', '/js/api.js'))).status, 200);
    await request(`users/${ids.users}`, 'PATCH', { role: 'invalid' }, 400);
    await request(`users/${ids.users}`, 'PATCH', { contactNumber: '-------' }, 400);
    await request(`services/${ids.services}`, 'PATCH', { durationMinutes: 3.5 }, 400);
    await request(`doctors/${ids.doctors}`, 'PATCH', {
      availability: [{ day: 'Monday', startTime: '16:00', endTime: '09:00' }]
    }, 400);
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
    const appointment = { user: ids.users, doctor: ids.doctors, service: ids.services,
      appointmentDate: date.toISOString().slice(0, 10), timeSlot: '10:00',
      reason: 'Integration test checkup', status: 'pending' };
    ids.appointments = (await request('appointments', 'POST', appointment, 201))._id;
    await request('appointments');
    await request('appointments', 'POST', appointment, 400);
    await request(`appointments/${ids.appointments}`, 'PUT', appointment);
    await request(`appointments/${ids.appointments}`, 'PATCH', { status: 'confirmed' });
    await request(`users/${ids.users}`, 'DELETE', undefined, 400);
    const manual = await request('activity-logs', 'POST', { user: ids.users, action: 'review',
      targetResource: 'Appointment', resourceId: ids.appointments, details: 'Reviewed test appointment' }, 201);
    await request(`activity-logs/${manual._id}`);
    await request('activity-logs/000000000000000000000000', 'GET', undefined, 404);
    await mongoose.disconnect();
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    assert.equal((await request(`appointments/${ids.appointments}`)).status, 'confirmed');
    await request(`appointments/${ids.appointments}`, 'DELETE');
    await request(`appointments/${ids.appointments}`, 'GET', undefined, 404);
    const logs = await ActivityLog.find({ resourceId: ids.appointments });
    assert.deepEqual(logs.filter(log => log.action !== 'review').map(log => log.action).sort(),
      ['create', 'delete', 'update', 'update']);
    await ActivityLog.deleteMany({ user: ids.users });
    for (const resource of ['doctors', 'services', 'users']) {
      await request(`${resource}/${ids[resource]}`, 'DELETE');
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      if (ids.appointments) await Appointment.deleteMany({ _id: ids.appointments });
      if (ids.users) await ActivityLog.deleteMany({ user: ids.users });
      for (const [resource, Model] of [['users', User], ['doctors', Doctor], ['services', Service]]) {
        if (ids[resource]) await Model.deleteMany({ _id: ids[resource] });
      }
    }
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
});
