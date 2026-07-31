const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.connect()
  .then((client) => {
    console.log('✅ Conectado ao PostgreSQL com sucesso.');
    client.release();
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar ao PostgreSQL:', err.message);
  });

module.exports = pool;
