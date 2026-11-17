# CvSU Infirmary Appointment System

An infirmary appointment interface with administrator, staff, patient, and visitor views, backed by Express.js and MongoDB/Mongoose.

## Run locally

Install Node.js 18+ and MongoDB Community Server. Start MongoDB, then run:

```powershell
cd server
npm.cmd install
Copy-Item .env.example .env
npm.cmd run setup-admin
npm.cmd start
```

Save the generated administrator password printed by setup. Open **http://localhost:5000** and log in with username `admin`. Each installation uses its own MongoDB database by default; existing records are not distributed with the source code.

See [server/README.md](server/README.md) for API documentation, account setup, password reset, and testing instructions.

## Project folders

- `index.html`, `css/`, `js/`: frontend interface and API adapter.
- `server/`: backend, schemas, controllers, routes, setup scripts, and tests.

## Environment and access

Copy `server/.env.example` to `server/.env` for local configuration. `.env`, installed dependencies, and local logs are excluded from Git. Never commit database credentials or real patient records.

This project is currently intended for local development. Password verification is implemented, but server-enforced sessions and role permissions are still required before public deployment. UI role checks alone do not protect API access.
