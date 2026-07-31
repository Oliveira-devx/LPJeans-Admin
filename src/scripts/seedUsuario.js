// Script para criar o primeiro (e único, nesse modelo) usuário de login.
// Uso: node src/scripts/seedUsuario.js <login> <senha> <id_funcionario>

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function seed() {
  const [, , login, senha, idFuncionario] = process.argv;

  if (!login || !senha || !idFuncionario) {
    console.log('Uso: node src/scripts/seedUsuario.js <login> <senha> <id_funcionario>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(senha, 10);

  try {
    const resultado = await pool.query(
      `INSERT INTO usuarios (id_funcionario, login, senha_hash)
       VALUES ($1, $2, $3)
       RETURNING id_usuario, login`,
      [idFuncionario, login, hash]
    );
    console.log('✅ Usuário criado:', resultado.rows[0]);
  } catch (erro) {
    console.error('❌ Erro ao criar usuário:', erro.message);
  } finally {
    pool.end();
  }
}

seed();
