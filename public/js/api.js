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
