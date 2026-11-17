const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(uri, { dbName: 'clinic_db' });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
};

module.exports = connectDB;
