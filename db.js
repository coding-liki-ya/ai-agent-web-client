const { Pool } = require('pg');

const pool = new Pool({
  user: 'user',
  host: 'localhost',
  database: 'authdb',
  password: 'password',
  port: 5432,
});

module.exports = pool;
