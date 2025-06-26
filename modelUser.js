const pool = require('./db');

async function createUser(login, passwordHash) {
  const res = await pool.query(
    "INSERT INTO users (login, password_hash) VALUES ($1, $2) RETURNING id",
    [login, passwordHash]
  );
  return res.rows[0];
}

async function findUserByLogin(login) {
  const res = await pool.query("SELECT * FROM users WHERE login = $1", [login]);
  return res.rows[0];
}

async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      login VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL
    );
  `);
}

module.exports = { createUser, findUserByLogin, createTable };
