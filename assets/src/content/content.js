class InseridorTexto {
  static inserir(elementosFormatados) {
    const selecao = document.getSelection();
    if (!selecao.rangeCount) {
      console.warn('Nenhuma seleção de texto encontrada');
      return false;
    }

    const range = selecao.getRangeAt(0);
    range.deleteContents();

    elementosFormatados.forEach(elemento => {
      if (elemento.tipo === 'PARAGRAFO') {
        const paragrafo = document.createElement('p');
        paragrafo.style.margin = '12px 0';

        elemento.elementos.forEach(parte => {
          const span = document.createElement('span');
          span.textContent = parte.texto;

          if (parte.estilo.negrito) span.style.fontWeight = 'bold';
          if (parte.estilo.italico) span.style.fontStyle = 'italic';
          if (parte.estilo.sublinhado) span.style.textDecoration = 'underline';

          paragrafo.appendChild(span);
        });

        range.insertNode(paragrafo);
      }
    });

    // Move o cursor para o final
    range.setStartAfter(range.endContainer);
    range.collapse(true);
    selecao.removeAllRanges();
    selecao.addRange(range);

    return true;
  }
}

class Sidebar {
  constructor() {
    this.inicializarSidebar();
    this.carregarModelos();
  }

  inicializarSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'legalback-sidebar';
    this.sidebar.style.cssText = `
      position: fixed;
      right: 0;
      top: 0;
      width: 500px;
      height: 100vh;
      background: white;
      z-index: 10000;
      box-shadow: -2px 0 10px rgba(0,0,0,0.1);
      padding: 20px;
      overflow-y: auto;
      font-family: 'Roboto', Arial, sans-serif;
    `;

    document.body.appendChild(this.sidebar);
  }

  async carregarModelos() {
    this.mostrarCarregando();

    try {
      const { modelos, erro } = await chrome.runtime.sendMessage({
        acao: 'obterModelos'
      });

      if (erro) throw new Error(erro);
      this.renderizarModelos(modelos);
    } catch (erro) {
      this.mostrarErro(erro.message);
    }
  }

  renderizarModelos(modelos) {
    this.sidebar.innerHTML = `
      <div class="cabecalho">
        <h2>Legal Back</h2>
        <input type="text" id="busca" placeholder="Buscar modelos...">
      </div>
      <div id="container-modelos"></div>
    `;

    const container = document.getElementById('container-modelos');
    modelos.forEach(modelo => {
      const elementoModelo = document.createElement('div');
      elementoModelo.className = 'modelo';
      elementoModelo.innerHTML = `
        <div class="cabecalho-modelo">
          <h3>${modelo.apontamento}</h3>
          <span class="favorito">${modelo.favorito ? '★' : '☆'}</span>
        </div>
        <div class="metadados">
          <span class="categoria">${modelo.categoria}</span>
          ${modelo.certidao ? `<span class="certidao">${modelo.certidao}</span>` : ''}
        </div>
        <button class="botao-inserir">Inserir</button>
      `;

      // Eventos
      elementoModelo.querySelector('.favorito').addEventListener('click', async (e) => {
        const { favoritos } = await chrome.runtime.sendMessage({
          acao: 'alternarFavorito',
          modeloId: modelo.id
        });
        e.target.textContent = favoritos.includes(modelo.id) ? '★' : '☆';
      });

      elementoModelo.querySelector('.botao-inserir').addEventListener('click', () => {
        InseridorTexto.inserir(modelo.formatado);
      });

      container.appendChild(elementoModelo);
    });

    // Busca
    document.getElementById('busca').addEventListener('input', (e) => {
      const termo = e.target.value.toLowerCase();
      document.querySelectorAll('.modelo').forEach(modelo => {
        modelo.style.display = modelo.textContent.toLowerCase().includes(termo)
          ? 'block'
          : 'none';
      });
    });
  }

  mostrarCarregando() {
    this.sidebar.innerHTML = `
      <div class="carregando">
        <p>Carregando modelos...</p>
      </div>
    `;
  }

  mostrarErro(mensagem) {
    this.sidebar.innerHTML = `
      <div class="erro">
        <p>Erro: ${mensagem}</p>
        <button id="tentar-novamente">Tentar novamente</button>
      </div>
    `;

    document.getElementById('tentar-novamente').addEventListener('click', () => this.carregarModelos());
  }
}

// Inicialização
if (document.readyState === 'complete') {
  new Sidebar();
} else {
  document.addEventListener('DOMContentLoaded', () => new Sidebar());
}