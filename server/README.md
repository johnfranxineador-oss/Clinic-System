# CvSU Infirmary Appointment System API

Standalone REST API for the Cavite State University (CvSU) Infirmary Appointment System. Every user, doctor, service, appointment, and activity log is stored in MongoDB through Mongoose. Restarting the server does not erase data.

## Connected frontend

### Optional sample accounts

Run `npm.cmd run setup-demo` from `server` with MongoDB running. This creates `demo.admin` (admin), `demo.staff` (staff), and `demo.patient` (student, displayed as patient). All newly created sample accounts use `Infirmary@2026`. The login page's **Demo accounts** card lists the credentials to enter in the login form. **Continue as Visitor** opens the existing guest view without an account.

These accounts persist in MongoDB; setup can be rerun and leaves existing profiles and passwords unchanged. Your original `admin` account is preserved. Demo actions save real changes to the configured database, so use a development database. Remove or deactivate sample accounts before public deployment. If you change a demo password, use its new password instead of the sample password listed on the card.

The server now serves the existing interface at **http://localhost:5000/**, along with `/js` and `/css`. `GET /api` returns the API greeting. Restart any previously running server to load these changes.

```powershell
cd server
npm.cmd run setup-admin
npm.cmd start
```

`setup-admin` creates an initial `admin` account and prints a randomly generated password once. It leaves an existing admin account unchanged. To choose initial settings, set `INITIAL_ADMIN_PASSWORD` (8–128 characters), `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PHONE` in the terminal before running setup. These variables are optional. Default contact details are placeholders to update before use. No doctors, services, patients, or appointments are automatically fabricated.

Log in as admin, add a doctor with a valid license and availability, add a service matching that specialty, then create patient and staff accounts with email addresses and passwords. Log in as a patient to book; log in as staff to approve or complete visits. Approval maps to API status `confirmed`; rejecting a request maps to `cancelled` because the API has four supported statuses. Student and faculty roles display as patients; admin and staff keep their roles. The old demo viewer account is no longer offered as an assignable role.

If the admin password is lost, run `npm.cmd run reset-admin-password` from `server`. This generates a new random password, saves only its salted hash, and prints the new password once in the terminal. Save that output and log in with username `admin`. Only the existing admin account's password is changed; other records and the account's active status remain unchanged. MongoDB must be running. The API does not need to restart.

To replace a known temporary password, log in and click **Change password** beside the logout button. Enter the current password, a different new password (8–128 characters), and confirm it. After saving, log in again with the new password. This is available to all signed-in account roles, excluding visitors. `POST /api/auth/change-password` accepts `username`, `currentPassword`, and `newPassword`; the server verifies the current password and stores only the new salted hash. Invalid credentials, invalid length, and reusing the current password return `400`. The response never contains passwords or hashes.

`js/api.js` maps the interface fields to the REST models. Browser arrays are temporary API snapshots only; localStorage is no longer used for records, and old demo records are not migrated. Refresh server data reloads MongoDB without deleting records. sessionStorage stores only the current user ID for the existing interface session. A separate localhost Live Server is supported; `window.CVSU_API_URL` can override the API base before loading scripts.

`POST /api/auth/login` accepts `{ "username": "admin", "password": "your-password" }`. Passwords are verified on the server with salted scrypt hashes and hashes are excluded from API responses. This adds credential verification, not API access control: the original endpoints remain unauthenticated and UI role checks are not authorization. Keep this local until server-enforced sessions and permissions are implemented.

The integration test also exercises login, secret-field exclusion, static frontend delivery, and a save through the actual frontend adapter against MongoDB. Browser interaction testing is still manual.

## Technology stack

- Node.js
- Express 4
- MongoDB with Mongoose
- dotenv for environment variables
- cors so a React (Vite) app can call the API with `fetch` or Axios
- nodemon for local development

## Folder structure

```text
server/
├── config/
│   └── db.js                  MongoDB connection
├── controllers/
│   ├── activityLogController.js
│   ├── appointmentController.js
│   ├── doctorController.js
│   ├── serviceController.js
│   └── userController.js
├── middleware/
│   ├── asyncHandler.js        Forwards async errors to the error handler
│   └── errorHandler.js        JSON errors only; no stack traces or credentials
├── models/
│   ├── ActivityLog.js
│   ├── Appointment.js
│   ├── Doctor.js
│   ├── Service.js
│   └── User.js
├── routes/
│   ├── activityLogRoutes.js
│   ├── appointmentRoutes.js
│   ├── doctorRoutes.js
│   ├── serviceRoutes.js
│   └── userRoutes.js
├── utils/
│   ├── AppError.js
│   └── http.js                ObjectId checks, field picking, date parsing
├── .env                       Local environment (not committed)
├── .env.example               Template for environment variables
├── .gitignore
├── package.json
└── server.js
```

## MongoDB setup

The application uses `clinic_db`. Existing local records were copied from `cvsu_infirmary`, which remains as a backup. Restart the API after changing `.env`; a running process keeps its previous connection until restarted. In Compass, refresh the database list and open `clinic_db`.

The application connection explicitly selects `clinic_db` in `config/db.js`, even when an older shell environment supplies a URI ending in another database name. `MONGODB_URI` still determines the MongoDB server and credentials. `GET /api/health` reports the active database name and connection state without exposing connection strings. Automated integration tests use their separately specified test database directly.

For another installation that still has data in `cvsu_infirmary`, stop the API and run `node scripts/migrate-clinic-db.js` from `server`, then set the database name in `MONGODB_URI` to `clinic_db` and restart. The script copies documents, ObjectIds, and indexes on the configured MongoDB server. It refuses a nonempty target and never deletes the source. Do not run it on a fresh installation; ordinary setup creates `clinic_db` automatically.

1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and start it on the default port `27017`.
2. No manual database creation is required. Mongoose creates the `clinic_db` database and collections on the first write.
3. Collections used: `users`, `doctors`, `services`, `appointments`, `activity_logs`.

Confirm MongoDB is running before `npm start`. A failed connection stops the process and does not print the connection string.

## Environment variables

Copy the example file if `.env` is missing:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

| Name | Example | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | HTTP port |
| `MONGODB_URI` | `mongodb://localhost:27017/clinic_db` | MongoDB connection string |

`.gitignore` excludes `.env` and `node_modules/`.

## Install and run

From the `server` directory:

```bash
npm install
npm run dev
```

`npm start` runs `node server.js` without nodemon. `npm run dev` restarts the process when files change.

The API listens at `http://localhost:5000`. A React app on another origin can call it directly; CORS allows the requesting origin and the `Content-Type` and `x-user-id` headers.

Example frontend call:

```js
const response = await fetch('http://localhost:5000/api/appointments');
const body = await response.json();
```

## Response shape and status codes

Successful reads, updates, and deletes return `200`. Creates return `201`.

```json
{ "success": true, "count": 1, "data": [] }
```

```json
{ "success": true, "data": {} }
```

Failures:

| Status | When |
| --- | --- |
| `400` | Validation failed, duplicate unique field, malformed JSON, or a malformed MongoDB ObjectId |
| `404` | The route exists but that record id is not in the database, or the path itself is unknown |
| `500` | Unexpected server error. The body is only `{ "success": false, "message": "Internal server error" }` |

Error bodies never include stack traces, file paths, or database credentials.

```json
{ "success": false, "message": "Full name is required" }
```

`PUT` replaces the writable fields of a record. `PATCH` changes only the fields you send. Unknown JSON properties are ignored.

## Data rules

**User:** `studentEmployeeId`, `fullName`, `email`, `role` (`student`, `faculty`, `staff`, `admin`), `contactNumber`. IDs and license numbers are stored in uppercase. Email is stored in lowercase.

**Doctor:** `fullName`, `specialization`, `licenseNumber`, `availability`, `isActive`. Each availability slot has `day` (full English weekday), `startTime`, and `endTime` in 24-hour `HH:MM`. The end time is exclusive: a slot of `09:00`–`16:00` accepts `09:00` through `15:59`.

**Service:** `name`, `description`, `durationMinutes` (integer from 5 to 240), `isActive`.

**Appointment:** ObjectId references `user`, `doctor`, and `service`, plus `appointmentDate` (`YYYY-MM-DD`), `timeSlot` (`HH:MM`), `reason`, `status` (`pending`, `confirmed`, `completed`, `cancelled`), and `notes`. Pending and confirmed visits must fall inside an active doctor's schedule for an active service, and cannot double-book that doctor. Dates are stored as UTC midnight and interpreted on the Asia/Manila calendar.

**Activity log:** `user`, `action`, `targetResource` (`User`, `Doctor`, `Service`, or `Appointment`), `resourceId`, and `details`.

Creating, updating, or deleting an appointment writes an activity log. The actor is `performedBy` in the JSON body, or the `x-user-id` header. If both are omitted, the appointment's user is recorded as the actor. That user must already exist. If logging fails, the controller attempts a compensating rollback. This is not an atomic transaction: a database outage or concurrent changes can prevent restoration. The API works with standalone MongoDB; strict atomic audit guarantees would require replica-set transactions.

This API does not implement authentication or authorization. The actor header identifies a user for logging only; it does not authenticate them.

Users, doctors, and services that are still referenced cannot be deleted (`400`).

Optional list filters:

- `GET /api/users?role=student`
- `GET /api/doctors?isActive=true`
- `GET /api/services?isActive=true`
- `GET /api/appointments?status=pending&user=&doctor=&service=&date=2026-11-23`
- `GET /api/activity-logs?targetResource=Appointment&user=`

## Sample records

Use a date that matches the doctor's weekday. `2026-11-23` is a Monday.

### User

`POST /api/users`

```json
{
  "studentEmployeeId": "2024-00123",
  "fullName": "Juan Dela Cruz",
  "email": "juan.delacruz@cvsu.edu.ph",
  "role": "student",
  "contactNumber": "09171234567"
}
```

### Doctor

`POST /api/doctors`

```json
{
  "fullName": "Dr. Maria Santos",
  "specialization": "General Medicine",
  "licenseNumber": "PRC-100200",
  "isActive": true,
  "availability": [
    { "day": "Monday", "startTime": "09:00", "endTime": "16:00" },
    { "day": "Wednesday", "startTime": "09:00", "endTime": "16:00" },
    { "day": "Friday", "startTime": "09:00", "endTime": "12:00" }
  ]
}
```

### Services

`POST /api/services`

```json
{
  "name": "Medical Consultation",
  "description": "Face-to-face checkup for illness, injury, or follow-up care.",
  "durationMinutes": 30,
  "isActive": true
}
```

```json
{
  "name": "Dental",
  "description": "Dental examination and basic infirmary dental care.",
  "durationMinutes": 45,
  "isActive": true
}
```

```json
{
  "name": "Medical Certificate",
  "description": "Clinical review required before a medical certificate is issued.",
  "durationMinutes": 20,
  "isActive": true
}
```

### Appointment

`POST /api/appointments`

Replace the three ids with values returned by the creates above.

```json
{
  "user": "USER_OBJECT_ID",
  "doctor": "DOCTOR_OBJECT_ID",
  "service": "SERVICE_OBJECT_ID",
  "appointmentDate": "2026-11-23",
  "timeSlot": "10:00",
  "reason": "Headache and fever since last night",
  "status": "pending",
  "notes": "",
  "performedBy": "USER_OBJECT_ID"
}
```

### Update and delete

`PATCH /api/appointments/:id`

```json
{
  "status": "confirmed",
  "notes": "Bring the university ID.",
  "performedBy": "USER_OBJECT_ID"
}
```

`PUT /api/appointments/:id` sends the full appointment body (`user`, `doctor`, `service`, `appointmentDate`, `timeSlot`, `reason`, `status`, and usually `notes`).

`DELETE /api/appointments/:id` removes the appointment and writes a `delete` activity log. Send `performedBy` or `x-user-id` when the actor is not the patient on the record. A delete with no body still logs the appointment user.

### Activity log

Appointment changes create these automatically. You can also post one directly:

`POST /api/activity-logs`

```json
{
  "user": "USER_OBJECT_ID",
  "action": "create",
  "targetResource": "Appointment",
  "resourceId": "APPOINTMENT_OBJECT_ID",
  "details": "Walk-in request encoded by infirmary staff"
}
```

## Endpoints

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/api/users` | 200 |
| `GET` | `/api/users/:id` | 200 |
| `POST` | `/api/users` | 201 |
| `PUT` | `/api/users/:id` | 200 |
| `PATCH` | `/api/users/:id` | 200 |
| `DELETE` | `/api/users/:id` | 200 |
| `GET` | `/api/doctors` | 200 |
| `GET` | `/api/doctors/:id` | 200 |
| `POST` | `/api/doctors` | 201 |
| `PUT` | `/api/doctors/:id` | 200 |
| `PATCH` | `/api/doctors/:id` | 200 |
| `DELETE` | `/api/doctors/:id` | 200 |
| `GET` | `/api/services` | 200 |
| `GET` | `/api/services/:id` | 200 |
| `POST` | `/api/services` | 201 |
| `PUT` | `/api/services/:id` | 200 |
| `PATCH` | `/api/services/:id` | 200 |
| `DELETE` | `/api/services/:id` | 200 |
| `GET` | `/api/appointments` | 200 |
| `GET` | `/api/appointments/:id` | 200 |
| `POST` | `/api/appointments` | 201 |
| `PUT` | `/api/appointments/:id` | 200 |
| `PATCH` | `/api/appointments/:id` | 200 |
| `DELETE` | `/api/appointments/:id` | 200 |
| `GET` | `/api/activity-logs` | 200 |
| `GET` | `/api/activity-logs/:id` | 200 |
| `POST` | `/api/activity-logs` | 201 |

`GET /api` returns a short JSON greeting with status `200`. `GET /` serves the frontend HTML.

## Testing with curl, Postman, or Thunder Client

Start MongoDB, then from `server` run `npm run dev`. Base URL: `http://localhost:5000`.

On Windows PowerShell, call `curl.exe` so `curl` is not aliased to `Invoke-WebRequest`. Keep the JSON in single quotes.

### 1. Valid create and read

```powershell
curl.exe -s -X POST http://localhost:5000/api/users -H "Content-Type: application/json" -d '{"studentEmployeeId":"2024-00123","fullName":"Juan Dela Cruz","email":"juan.delacruz@cvsu.edu.ph","role":"student","contactNumber":"09171234567"}'
```

Copy `_id` from the `201` response, then:

```powershell
curl.exe -s http://localhost:5000/api/users
curl.exe -s http://localhost:5000/api/users/USER_OBJECT_ID
```

Create a doctor and a service with the sample JSON, then create an appointment for Monday `2026-11-23` at `10:00`. `GET /api/activity-logs` should show a `create` row for that appointment.

In Postman or Thunder Client, set the body type to raw JSON and the header `Content-Type: application/json`.

### 2. Invalid input (`400`)

Missing name:

```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST http://localhost:5000/api/users -H "Content-Type: application/json" -d '{"email":"incomplete@cvsu.edu.ph","role":"student"}'
```

Bad role, bad email, a time slot outside the doctor's hours, a second pending appointment for the same doctor at the same time, and a non-hex id such as `GET /api/users/not-an-id` all return `400`.

Malformed JSON:

```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST http://localhost:5000/api/users -H "Content-Type: application/json" -d '{"fullName":'
```

### 3. Missing record (`404`)

Use a well-formed id that was never inserted:

```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" http://localhost:5000/api/users/507f1f77bcf86cd799439011
```

`GET /api/appointments/507f1f77bcf86cd799439011` and `GET /api/activity-logs/507f1f77bcf86cd799439011` behave the same way. `DELETE` of a missing appointment also returns `404` and does not write a log.

### 4. Update, delete, and the activity log

```powershell
curl.exe -s -X PATCH http://localhost:5000/api/appointments/APPOINTMENT_OBJECT_ID -H "Content-Type: application/json" -d '{"status":"confirmed","notes":"Bring the university ID."}'
curl.exe -s -X DELETE http://localhost:5000/api/appointments/APPOINTMENT_OBJECT_ID
curl.exe -s http://localhost:5000/api/activity-logs
```

The log list should contain `create`, then `update`, then `delete` for that appointment id.

### 5. Persistence across restart

1. Create a user and note the `_id`.
2. Stop the API (`Ctrl+C`) and start it again with `npm run dev`.
3. `GET /api/users/USER_OBJECT_ID` still returns `200` and the same document.

The record lives in MongoDB, not in server memory. Dropping the `clinic_db` database is what clears it. From a machine with the MongoDB shell on `PATH`:

```powershell
mongosh clinic_db --eval "db.dropDatabase()"
```

MongoDB Compass can drop the same database when `mongosh` is not installed.

## Automated checks

Node.js 18 or newer is required for the test runner and built-in fetch. Run `npm test` for database-independent HTTP checks. To also exercise real MongoDB CRUD, validation, audit logs, and persistence after disconnect/reconnect, start MongoDB and run from `server` in PowerShell:

```powershell
$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/clinic_db_test'
npm.cmd test
```

Use a dedicated test database. Tests create uniquely named fixtures and remove those fixtures afterward; they do not drop the database. Without `TEST_MONGODB_URI`, the integration test is skipped. The manual stop/start procedure above verifies persistence across an API process restart.

If PowerShell blocks `npm.ps1`, use `npm.cmd install`, `npm.cmd start`, or `npm.cmd run dev` without changing the machine's execution policy.
