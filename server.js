require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const questionRoutes = require('./routes/questions');

const app = express();

// Middleware

app.use(cors({
   origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/questions', questionRoutes);
const rateLimit = require('express-rate-limit');
//security 
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/questions/import', limiter);
// Health check
app.get('/', (req, res) => {
  res.send('Quiz API Running');
});

// Start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Handle shutdown
process.on('SIGINT', async () => {
  const { getPool } = require('./db');
  const pool = getPool();
  await pool.close();
  console.log('Database connection closed');
  process.exit(0);
});
