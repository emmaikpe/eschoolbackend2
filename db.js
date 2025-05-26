require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER || '(local)',
  port: parseInt(process.env.DB_PORT, 10),
  options: {
    encrypt: false,
    trustServerCertificate: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 3000000
  }
};

let pool = null;

// Connect to SQL Server
const connectDB = async () => {
  try {
    pool = await sql.connect(config);
    console.log('Connected to SQL Server');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
};

// Reconnection check logic
const checkPoolConnection = async () => {
  try {
    if (!pool) {
      console.log('Reconnecting to SQL Server...');
      await connectDB();
    } else if (!pool.connected) {
      console.log('Connection is closed. Reconnecting...');
      await connectDB();
    }
  } catch (err) {
    console.error('Error while checking or reconnecting to SQL Server:', err);
  }
};

// Safe accessor that ensures connection is alive
const getPool = async () => {
  await checkPoolConnection();
  return pool;
};

module.exports = { connectDB, getPool, sql };
