async function apiFetch(caminho, opcoes = {}) {
  const token = sessionStorage.getItem('token');
  const cabecalhos = { 'Content-Type': 'application/json', ...(opcoes.headers || {}) };
  if (token) cabecalhos['Authorization'] = `Bearer ${token}`;
  const resposta = await fetch(caminho, { ...opcoes, headers: cabecalhos });
  if (resposta.status === 401) {
    sessionStorage.removeItem('token');
    window.location.href = '/index.html';
    throw new Error('Sessão expirada.');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || 'Erro inesperado.');
  return dados;
}

function exigirLogin() {
  const token = sessionStorage.getItem('token');
  if (!token) window.location.href = '/index.html';
}

function sair() {
  sessionStorage.removeItem('token');
  window.location.href = '/index.html';
}

// Lê os dados do usuário logado a partir do token (nome, cargo, etc.)
// só para EXIBIÇÃO na tela. A validação de verdade sempre acontece no
// backend, a cada requisição — isso aqui nunca deve ser usado como
// controle de segurança no frontend.
function pegarUsuarioAtual() {
  const token = sessionStorage.getItem('token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (erro) {
    return null;
  }
}
