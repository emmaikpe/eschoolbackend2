require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB,getPool, sql } = require('./db');
const questionRoutes = require('./routes/questions');
const scoreRoutes = require('./scores/import');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://gowfin.github.io','https://cbt.ohafiamicrofinancebankplc.com']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/questions', questionRoutes);
app.use('/api/scores', scoreRoutes);
 
const rateLimit = require('express-rate-limit');
//security 
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/questions/import', limiter);
app.use('/api/scores/import', limiter);
// Health check
app.get('/', (req, res) => {
  res.send('Quiz API Running');
});


// Student ID
app.get('/students/:id', async(req, res) => {
  const studentId = req.params.id;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('studentId', sql.VarChar, studentId)
      .query(`
        SELECT StudentId, StudentName
        FROM student
        WHERE StudentId = @studentId
      `);

    if (result.recordset.length > 0) {
      // Student exists
      res.json({
        exists: true,
        student: result.recordset[0]
      });
    } else {
      // Student not found
      res.status(404).json({ exists: false });
    }
  } catch (err) {
    console.error('Error checking student:', err);
    res.status(500).json({ exists: false, error: err.message });
  }
});

// get scores
app.get('/scores/:id', async(req, res) => {
  const studentId = req.params.id.toString();
  
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('studentId', sql.VarChar, studentId)
      .query(`
        SELECT StudentId,	s.CourseCode,	Score,Semester,CourseTitle as CourseName
        FROM score s inner join course c on s.CourseCode=C.CourseCode
        WHERE StudentId =@studentId
      `);

    if (result.recordset.length > 0) {
      // Student exists
      res.json({
        exists: true,
        scores: result.recordset
      });
    } else {
      // Student not found
      res.status(404).json({ exists: false });
    }
  } catch (err) {
    console.error('Error checking scores:', err);
    res.status(500).json({ exists: false, error: err.message });
  }
});
app.post('/save',async(req,res)=>{
  const {score,name,course}=req.body;
  const semester = new Date().toISOString().slice(0, 10);
  //  const semester='2025-05-27';
 
    try {
    const pool = await getPool();
    await pool.request()
            .input('studentId', sql.VarChar, name)
            .input('courseCode', sql.VarChar, course)
            .input('score', sql.Decimal(5, 2), score)
            .input('semester', sql.VarChar, semester)
            .query(`
              INSERT INTO score (StudentId, CourseCode, Score, Semester)
              VALUES (@studentId, @courseCode, @score, @semester)
            `);
            res.status(201).json({ success: true, message: 'Score added!' });
  } catch (err) {
     res.status(500).json({ success: false, error: err.message });
  }          
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
