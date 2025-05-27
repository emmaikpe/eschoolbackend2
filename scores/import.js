const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const sql = require('mssql');
const { getPool } = require('../db'); // your db pool module

const upload = multer({ storage: multer.memoryStorage() });

router.post('/import', upload.single('scoreFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const row of rows) {
        await transaction.request()
          .input('studentId', sql.VarChar, row.StudentId)
          .input('courseCode', sql.VarChar, row.CourseCode)
          .input('score', sql.Decimal(5, 2), row.Score)
          .input('semester', sql.VarChar, row.Semester)
          .query(`
            INSERT INTO score (StudentId, CourseCode, Score, Semester)
            VALUES (@studentId, @courseCode, @score, @semester)
          `);
      }

      await transaction.commit();
      res.json({ success: true, message: `${rows.length} scores imported successfully` });

    } catch (err) {
      await transaction.rollback();
      console.error('Score import error:', err);
      res.status(500).json({ success: false, error: 'Failed to import scores' });
    }

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
