// Barra superior compartilhada. Cada página chama montarTopbar('Título da página')
// depois de montarSidebar(). Precisa de <div id="topbar-container"></div>.

function pegarUsuarioAtual() {
  const token = sessionStorage.getItem('token');
  if (!token) return null;
  try {
    // O token JWT tem 3 partes separadas por ".". A parte do meio (payload)
    // é só um texto em base64 — aqui a gente só LÊ ela pra mostrar o nome
    // de usuário na tela, não estamos validando a assinatura (quem garante
    // que o token é válido de verdade é sempre o backend, em cada requisição).
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (erro) {
    return null;
  }
}

function montarTopbar(tituloPagina) {
  const container = document.getElementById('topbar-container');
  if (!container) return;

  const usuario = pegarUsuarioAtual();
  const login = usuario ? usuario.login : 'usuário';
  const inicial = login.charAt(0).toUpperCase();

  container.innerHTML = `
    <header class="topbar">
      <div class="titulo-pagina">${tituloPagina}</div>
      <div class="acoes-topbar">
        <div class="busca-global">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Pesquisar (em breve)" disabled>
        </div>

        <button class="icone-topbar" id="botaoNotificacoes" title="Notificações">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>

        <div class="menu-usuario">
          <button class="botao-usuario" id="botaoUsuario">
            <div class="avatar-usuario">${inicial}</div>
            <span class="nome-usuario">${login}</span>
            <svg class="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-usuario" id="dropdownUsuario">
            <button onclick="sair()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sair do sistema
            </button>
          </div>
        </div>
      </div>
    </header>
  `;

  document.getElementById('botaoUsuario').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('dropdownUsuario').classList.toggle('aberto');
  });
  document.addEventListener('click', () => {
    document.getElementById('dropdownUsuario').classList.remove('aberto');
  });
  document.getElementById('botaoNotificacoes').addEventListener('click', () => {
    alert('Central de notificações ainda em construção — em breve você verá aqui alertas de estoque baixo, caixa aberto e mais.');
  });
}
