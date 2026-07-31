// Menu lateral compartilhado. Cada página só precisa ter uma
// <div id="sidebar-container"></div> e chamar montarSidebar('id-da-pagina').
//
// Módulos ainda sem backend apontam para em-construcao.html — não fingimos
// funcionalidade que ainda não existe.

const ITENS_MENU = [
  { id: 'dashboard', icone: '◇', label: 'Dashboard', href: 'dashboard.html' },
  { id: 'vendas', icone: '＄', label: 'Vendas', href: 'em-construcao.html?modulo=Vendas' },
  { id: 'produtos', icone: '▤', label: 'Produtos', href: 'produtos.html' },
  { id: 'compras', icone: '↓', label: 'Compras', href: 'em-construcao.html?modulo=Compras' },
  { id: 'estoque', icone: '▦', label: 'Estoque', href: 'em-construcao.html?modulo=Estoque' },
  { id: 'clientes', icone: '☺', label: 'Clientes', href: 'clientes.html' },
  { id: 'fornecedores', icone: '⚑', label: 'Fornecedores', href: 'em-construcao.html?modulo=Fornecedores' },
  { id: 'caixa', icone: '▢', label: 'Caixa', href: 'em-construcao.html?modulo=Caixa' },
  { id: 'relatorios', icone: '▥', label: 'Relatórios', href: 'em-construcao.html?modulo=Relatórios' },
  { id: 'usuarios', icone: '◎', label: 'Usuários', href: 'em-construcao.html?modulo=Usuários' },
  { id: 'configuracoes', icone: '⚙', label: 'Configurações', href: 'em-construcao.html?modulo=Configurações' },
];

function montarSidebar(paginaAtiva) {
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  const itensHtml = ITENS_MENU.map(item => `
    <a href="${item.href}" class="${item.id === paginaAtiva ? 'ativo' : ''}">
      <span class="icone">${item.icone}</span> ${item.label}
    </a>
  `).join('');

  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-topo">
        <p class="marca-nome">LP Jeans</p>
        <p class="marca-sub">ERP</p>
      </div>
      <nav class="menu">${itensHtml}</nav>
      <div class="sidebar-rodape">
        <button onclick="sair()">Sair</button>
      </div>
    </aside>
  `;
}
