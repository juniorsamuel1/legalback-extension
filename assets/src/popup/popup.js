class GerenciadorPopup {
  constructor() {
    this.modelos = [];
    this.favoritos = [];
    this.abaAtiva = 'todos';
    this.inicializar();
  }

  async inicializar() {
    this.registrarEventos();
    await this.carregarModelos();
    this.atualizarUI();
  }

  registrarEventos() {
    // Busca
    document.getElementById('campo-busca').addEventListener('input', (e) => {
      this.filtrarModelos();
    });

    // Filtros
    document.getElementById('filtro-categoria').addEventListener('change', () => {
      this.filtrarModelos();
    });

    document.getElementById('filtro-certidao').addEventListener('change', () => {
      this.filtrarModelos();
    });

    // Abas
    document.querySelectorAll('.aba').forEach(aba => {
      aba.addEventListener('click', (e) => {
        document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
        e.target.classList.add('ativa');
        this.abaAtiva = e.target.dataset.aba;
        this.filtrarModelos();
      });
    });
  }

  async carregarModelos() {
    this.mostrarStatus('Carregando modelos...');

    try {
      const resposta = await chrome.runtime.sendMessage({ acao: 'obterModelos' });

      if (resposta.erro) {
        throw new Error(resposta.erro);
      }

      this.modelos = resposta.modelos;
      this.favoritos = await this.obterFavoritos();
      this.preencherFiltros();
      this.mostrarStatus('');
    } catch (erro) {
      console.error('Erro ao carregar modelos:', erro);
      this.mostrarStatus(`Erro: ${erro.message}`);
    }
  }

  async obterFavoritos() {
    const resposta = await chrome.runtime.sendMessage({ acao: 'obterFavoritos' });
    return resposta.favoritos || [];
  }

  preencherFiltros() {
    const categorias = new Set();
    const certidoes = new Set();

    this.modelos.forEach(modelo => {
      if (modelo.categoria) categorias.add(modelo.categoria);
      if (modelo.certidao) certidoes.add(modelo.certidao);
    });

    this.preencherSelect('filtro-categoria', Array.from(categorias).sort());
    this.preencherSelect('filtro-certidao', Array.from(certidoes).sort());
  }

  preencherSelect(id, valores) {
    const select = document.getElementById(id);
    select.innerHTML = id.includes('categoria')
      ? '<option value="">Todas categorias</option>'
      : '<option value="">Todas certidões</option>';

    valores.forEach(valor => {
      const option = document.createElement('option');
      option.value = valor;
      option.textContent = valor;
      select.appendChild(option);
    });
  }

  filtrarModelos() {
    const termoBusca = document.getElementById('campo-busca').value.toLowerCase();
    const categoria = document.getElementById('filtro-categoria').value;
    const certidao = document.getElementById('filtro-certidao').value;

    const modelosFiltrados = this.modelos.filter(modelo => {
      // Filtro por aba
      if (this.abaAtiva === 'favoritos' && !this.favoritos.includes(modelo.id)) {
        return false;
      }

      // Filtro por categoria e certidão
      const matchCategoria = !categoria || modelo.categoria === categoria;
      const matchCertidao = !certidao || modelo.certidao === certidao;

      // Filtro por busca
      const matchBusca = !termoBusca ||
        modelo.apontamento.toLowerCase().includes(termoBusca) ||
        modelo.texto.toLowerCase().includes(termoBusca) ||
        modelo.categoria.toLowerCase().includes(termoBusca) ||
        modelo.certidao.toLowerCase().includes(termoBusca);

      return matchCategoria && matchCertidao && matchBusca;
    });

    this.renderizarModelos(modelosFiltrados);
  }

  renderizarModelos(modelos) {
    const container = document.getElementById('lista-modelos');

    if (modelos.length === 0) {
      container.innerHTML = '<p class="sem-resultados">Nenhum modelo encontrado</p>';
      return;
    }

    container.innerHTML = modelos.map(modelo => `
      <div class="modelo-card" data-id="${modelo.id}">
        <h3>
          ${modelo.apontamento}
          <span class="favorito">${this.favoritos.includes(modelo.id) ? '★' : '☆'}</span>
        </h3>
        <div class="metadados">
          <span class="categoria">${modelo.categoria}</span>
          ${modelo.certidao ? `<span class="certidao"> • ${modelo.certidao}</span>` : ''}
        </div>
        <div class="acoes">
          <button class="botao-inserir">Inserir no documento</button>
        </div>
      </div>
    `).join('');

    // Adiciona eventos aos cards
    document.querySelectorAll('.modelo-card').forEach(card => {
      // Inserir modelo
      card.querySelector('.botao-inserir').addEventListener('click', async (e) => {
        e.stopPropagation();
        const modeloId = card.dataset.id;
        const modelo = this.modelos.find(m => m.id === modeloId);

        try {
          await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
              acao: 'inserirModelo',
              modelo: modelo.formatado
            });
          });
          this.mostrarStatus('Modelo inserido com sucesso!', true);
        } catch (erro) {
          this.mostrarStatus('Erro ao inserir modelo', false);
        }
      });

      // Favoritar
      card.querySelector('.favorito').addEventListener('click', async (e) => {
        e.stopPropagation();
        const modeloId = card.dataset.id;
        const { favoritos } = await chrome.runtime.sendMessage({
          acao: 'alternarFavorito',
          modeloId
        });
        this.favoritos = favoritos;
        e.target.textContent = favoritos.includes(modeloId) ? '★' : '☆';
      });
    });
  }

  mostrarStatus(mensagem, sucesso = false) {
    const elemento = document.getElementById('status');
    elemento.innerHTML = mensagem ? `<p class="${sucesso ? 'sucesso' : ''}">${mensagem}</p>` : '';
  }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  new GerenciadorPopup();
});