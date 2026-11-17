const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const userRoutes = require('./routes/userRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');

const app = express();
const mongoose = require('mongoose');

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user-id'],
  })
);
app.use(express.json());
app.use('/api/auth', require('./routes/authRoutes'));
const frontend = path.join(__dirname, '..');
app.get('/', (req, res) => res.sendFile(path.join(frontend, 'index.html')));
app.use('/js', express.static(path.join(frontend, 'js')));
app.use('/css', express.static(path.join(frontend, 'css')));

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CvSU Infirmary Appointment System API',
  });
});

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 500).json({
    success: connected,
    database: mongoose.connection.name || null,
    connected,
  });
});

app.use('/api/users', userRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/activity-logs', activityLogRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

const redact = (value) =>
  String(value || '').replace(/mongodb(\+srv)?:\/\/\S+/gi, 'mongodb://[redacted]');

if (require.main === module) connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(redact(error.message || 'Database connection failed'));
    process.exit(1);
  });

module.exports = app;
