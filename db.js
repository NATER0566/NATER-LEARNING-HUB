const { Pool } = require('pg');

// This configuration automatically uses the DATABASE_URL variable you set in Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // This is required for Railway's secure database connections
    rejectUnauthorized: false
  }
});

module.exports = {
  /**
   * Helper function to execute SQL queries
   * @param {string} text - The SQL query string
   * @param {Array} params - The values for parameterized queries
   */
  query: (text, params) => pool.query(text, params),
};
