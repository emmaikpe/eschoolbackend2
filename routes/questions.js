const express = require('express');
const fs = require('fs');
const router = express.Router();
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { getPool, sql } = require('../db');

// Add new question (with image)
router.post('/add', upload.single('image'), async (req, res) => {
  const { question, optionA, optionB, optionC, optionD, correctAnswer,explanation, type } = req.body;
  const imageBuffer = req.file?.buffer || null;
  const allowedTables = [
            'domain1', 'domain2', 'domain3', 'domain4',
            'domain5', 'domain6', 'domain7', 'domain8',
            'cbt', 'test'
        ];

        // Validate input
        if (!allowedTables.includes(type)) {
            return res.status(400).send('Invalid quiz domain type.');
        }

      const insertStatement=`INSERT INTO ${type} 
        (question, OptionA, OptionB, OptionC, OptionD, correctAnswer, Explanation, QuestionImage)
        VALUES (@question, @optionA, @optionB, @optionC, @optionD, @correctAnswer, @explanation, @image)
      `;
       const insertStatement2=`INSERT INTO cbt 
        (question, OptionA, OptionB, OptionC, OptionD, correctAnswer, Explanation)
        VALUES (@question, @optionA, @optionB, @optionC, @optionD, @correctAnswer, @explanation)
      `;

 
  try {
    const pool = await getPool();
    await pool.request()
      .input('question', sql.NVarChar, question)
      .input('optionA', sql.NVarChar, optionA)
      .input('optionB', sql.NVarChar, optionB)
      .input('optionC', sql.NVarChar, optionC)
      .input('optionD', sql.NVarChar, optionD)
      .input('correctAnswer', sql.NVarChar, correctAnswer)
      .input('explanation', sql.NVarChar, explanation)
      .input('image', sql.VarBinary, imageBuffer)
      .query(insertStatement);
    res.status(201).json({ success: true, message: 'Question added!' });
  } catch (err) {
    // res.status(500).json({ success: false, error: err.message });

  res.status(500).json({
    success: false,
    error: err.message,
    stack: err.stack.split("\n").slice(0,5) }) ;
  }
});

// Get all questions
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        const allowedTables = [
            'domain1', 'domain2', 'domain3', 'domain4',
            'domain5', 'domain6', 'domain7', 'domain8',
            'cbt', 'test'
        ];

        // Validate input
        if (!allowedTables.includes(type)) {
            return res.status(400).send('Invalid quiz domain type.');
        }

        // PROPERLY get the pool with connection check
        const pool = await getPool(); 
        
        // SAFE parameterized query 
        const result = await pool.request()
            .query(`SELECT * FROM ${type}`); 


// console.log('Recordset type:', typeof result.recordset);
// console.log('Recordset contents:', result.recordset);
 res.json(result.recordset);
        // Format response
        // const questions = result.recordset.map(q => ({
        //     ...q,
        //     QuestionImage: q.QuestionImage?.toString('base64') || null
        // }));

        // res.json({ success: true, data: questions });
        
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ 
            success: false,
            error: 'Server Error',
            details: err.message // Include for debugging
        });
    }
});

// Delete question
router.delete('/delete/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
        const allowedTables = [
            'domain1', 'domain2', 'domain3', 'domain4',
            'domain5', 'domain6', 'domain7', 'domain8',
            'cbt', 'test'
        ];

        // Validate input
        if (!allowedTables.includes(type)) {
            return res.status(400).send('Invalid quiz domain type.');
        }
  
        // SAFE parameterized query 

    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM ${type} WHERE id = @id`);
    res.json({ success: true, message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Excel Import Endpoint
router.post('/import', upload.single('excelFile'), async (req, res) => {
  try {
    const { type } = req.body;
    const allowedTables = [
      'domain1','domain2','domain3','domain4',
      'domain5','domain6','domain7','domain8',
      'cbt','test'
    ];

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(fileExt)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    if (!allowedTables.includes(type)) {
      return res.status(400).json({ error: 'Invalid quiz domain type' });
    }

    // Read from memory buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const questions = XLSX.utils.sheet_to_json(worksheet);

    // Begin transaction
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const q of questions) {
        await transaction.request()
          .input('question', sql.NVarChar, q.QuestionText)
          .input('optionA', sql.NVarChar, q.OptionA)
          .input('optionB', sql.NVarChar, q.OptionB)
          .input('optionC', sql.NVarChar, q.OptionC)
          .input('optionD', sql.NVarChar, q.OptionD)
          .input('correctAnswer', sql.Char, q.CorrectAnswer)
          .input('explanation', sql.NVarChar, q.Explanation || '')
          .query(`
            INSERT INTO [${type}]
            (question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation)
            VALUES
            (@question, @optionA, @optionB, @optionC, @optionD, @correctAnswer, @explanation)
          `);
      }
      await transaction.commit();

      return res.json({
        success: true,
        message: `${questions.length} questions imported successfully`
      });
    } catch (txErr) {
      await transaction.rollback();
      console.error('Transaction error:', txErr);
      return res.status(500).json({
        success: false,
        error: 'Import failed during transaction',
        details: process.env.NODE_ENV === 'development' ? txErr.message : undefined
      });
    }
  } catch (err) {
    console.error('Import endpoint error:', err);
    return res.status(500).json({
      success: false,
      error: 'Import failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


module.exports = router;


