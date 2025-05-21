
require('dotenv').config({path: __dirname + '/.env'})


const express = require('express');

const sql = require('mssql');
const bodyParser = require('body-parser');







// Create an Express application
const app = express();

// Middleware to parse JSON requests
app.use(express.json());
//handle cross-origin resource sharing
const cors = require('cors');
app.use(cors(
   {
  origin: 'http://localhost:3000', 
 }
)); // Enable CORS for all routes
app.use(bodyParser.json({ limit: '100mb' })); // Adjust size if needed

// Database configuration
const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER || '(local)', // Default to local if DB_SERVER is not set
  port: parseInt(process.env.DB_PORT, 10),
  options: {
    encrypt: false, // Use encryption (adjust based on your server config)
    trustServerCertificate: false // Only set to true for development
  },
  pool: {
    max: 10, // Maximum number of connections
    min: 0, // Minimum number of connections
    idleTimeoutMillis: 3000000 // Close idle connections after 30 seconds
}
};
// Create a connection pool
let poolPromise;

// Create a connection pool


// Function to initialize the connection pool
const initializePool = async () => {
    try {
        poolPromise = await sql.connect(sqlConfig);
        console.log('Connected to SQL Server');
    } catch (err) {
        console.error('Database connection failed: ', err);
    }
};

// Check if the pool is connected
const checkPoolConnection = async () => {
    if (!poolPromise) {
        console.log('Reconnecting to SQL Server...');
        await initializePool();
    } else {
        // Check the state of the connection pool
        const pool = await poolPromise;
        if (pool.connected === false) {
            console.log('Connection is closed. Reconnecting...');
            await initializePool();
        }
    }
};

////////////////////////////////////////////////////////////////////////////


// Get all questions
app.get('/api/questions', async (req, res) => {
    try {
        const { type } = req.query;
        const allowedTables = [
            'domain1',
            'domain2',
            'domain3',
            'domain4',
            'domain5',
            'domain6',
            'domain7',
            'domain8',
            'cbt',
             'test'
        ];
// Validate the type to prevent SQL injection
if (!allowedTables.includes(type)) {
     return res.status(400).send('Invalid quiz domain type.');
}
        
         // Connect to the SQL Server
    await checkPoolConnection(); // Ensure the connection is active
    const sql = await poolPromise;
     const query=`SELECT * FROM [${type}]`;
     // console.log(`[${type}]`);
        const result = await sql.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send('err');
        //res.status(500).send('Server Error');
    }
});



// Ensure to handle connection pool shutdown gracefully
process.on('SIGINT', async () => {
  try {
    
      const pool = await poolPromise;
      await pool.close();
      console.log('Connection pool closed.');
  } catch (err) {
      console.error('Error closing connection pool:', err);
  } finally {
      process.exit(0);
  }
});


// Start the server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  

});
