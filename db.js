const { Pool } = require('pg');

// Railway provides the connection string via the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // This block is mandatory for Railway's production database connections
    rejectUnauthorized: false
  }
});

module.exports = {
  /**
   * Method to run SQL queries against the Railway database
   * @param {string} text - The SQL query
   * @param {Array} params - Parameters for the query
   */
  query: (text, params) => pool.query(text, params),
};
