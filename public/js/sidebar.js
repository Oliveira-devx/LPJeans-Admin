// Menu lateral compartilhado. Cada página só precisa ter uma
// <div id="sidebar-container"></div> e chamar montarSidebar('id-da-pagina').
//
// A visibilidade dos itens "restritos" agora vem do backend (tabela
// permissoes_modulo, editável em Configurações > Permissões) — isso aqui
// só decide o que MOSTRAR; quem decide o que é PERMITIDO de verdade é
// sempre o servidor, em cada requisição.

const ICONES_MENU = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  vendas: '<circle cx="12" cy="12" r="9"/><path d="M15 9.3c0-1.3-1.4-2.3-3-2.3s-3 .9-3 2.3 1.3 1.9 3 2.3 3 .9 3 2.3-1.4 2.3-3 2.3-3-.9-3-2.3" /><line x1="12" y1="5.5" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="18.5"/>',
  produtos: '<path d="M20.5 12.5l-8 8-9-9v-8h8l9 9z"/><circle cx="7" cy="7.5" r="1.3"/>',
  compras: '<path d="M6 8h12l-1.2 12H7.2L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  estoque: '<rect x="3" y="7.5" width="18" height="12.5" rx="1"/><path d="M3 7.5l2.2-4h13.6l2.2 4"/><line x1="9" y1="12.5" x2="15" y2="12.5"/>',
  clientes: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.3"/><path d="M15.5 20c0-2.2 1-4 3-4.6"/>',
  fornecedores: '<rect x="4" y="3" width="9" height="18"/><rect x="13" y="10" width="7" height="11"/><circle cx="7" cy="7" r="0.6" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r="0.6" fill="currentColor" stroke="none"/><circle cx="7" cy="11" r="0.6" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r="0.6" fill="currentColor" stroke="none"/>',
  caixa: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><circle cx="16" cy="14.5" r="1.1" fill="currentColor" stroke="none"/>',
  relatorios: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="7" width="3" height="13"/><rect x="16" y="14" width="3" height="6"/>',
  usuarios: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  configuracoes: '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="18" r="2"/>',
};

// moduloChave: nome usado na tabela permissoes_modulo (null = sempre visível
// pra qualquer cargo logado). adminApenas: só Administrador/Proprietaria,
// nunca configurável (evita paradoxo de travar o próprio acesso).
const ITENS_MENU = [
  { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', moduloChave: null },
  { id: 'vendas', label: 'Vendas', href: 'vendas.html', moduloChave: null },
  { id: 'produtos', label: 'Produtos', href: 'produtos.html', moduloChave: null },
  { id: 'compras', label: 'Compras', href: 'compras.html', moduloChave: 'compras' },
  { id: 'estoque', label: 'Estoque', href: 'estoque.html', moduloChave: null },
  { id: 'clientes', label: 'Clientes', href: 'clientes.html', moduloChave: null },
  { id: 'fornecedores', label: 'Fornecedores', href: 'fornecedores.html', moduloChave: 'fornecedores' },
  { id: 'caixa', label: 'Caixa', href: 'caixa.html', moduloChave: 'caixa' },
  { id: 'relatorios', label: 'Relatórios', href: 'relatorios.html', moduloChave: 'relatorios' },
  { id: 'usuarios', label: 'Usuários', href: 'usuarios.html', moduloChave: 'usuarios' },
  { id: 'configuracoes', label: 'Configurações', href: 'configuracoes.html', adminApenas: true },
];

function svgIcone(nome) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES_MENU[nome]}</svg>`;
}

async function montarSidebar(paginaAtiva) {
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  const usuario = pegarUsuarioAtual();
  const ehAdmin = usuario && ['Administrador', 'Proprietaria'].includes(usuario.cargo);

  let modulosLiberados = [];
  if (!ehAdmin) {
    try {
      const minhas = await apiFetch('/api/permissoes/minhas');
      modulosLiberados = minhas.modulos || [];
    } catch (erro) {
      // Se der erro consultando permissões, por segurança mostramos só o básico.
      modulosLiberados = [];
    }
  }

  const itensVisiveis = ITENS_MENU.filter(item => {
    if (item.adminApenas) return ehAdmin;
    if (!item.moduloChave) return true; // módulo básico, todo mundo logado vê
    return ehAdmin || modulosLiberados.includes(item.moduloChave);
  });

  const itensHtml = itensVisiveis.map(item => `
    <a href="${item.href}" class="${item.id === paginaAtiva ? 'ativo' : ''}">
      ${svgIcone(item.id)} ${item.label}
    </a>
  `).join('');

  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-topo">
        <div class="marca-icone">LP</div>
        <div>
          <p class="marca-nome">LP Jeans</p>
          <p class="marca-sub">Sistema LPJeans</p>
        </div>
      </div>
      <nav class="menu">${itensHtml}</nav>
      <div class="sidebar-rodape">Sistema LPJeans · v1.0</div>
    </aside>
  `;
}
