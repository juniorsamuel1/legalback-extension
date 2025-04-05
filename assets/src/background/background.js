// src/background/background.js

class GerenciadorModelos {
  constructor() {
    this.modelos = [];
    this.carregarModelos();
  }

  async carregarModelos() {
    try {
      // Carrega do arquivo local
      const resposta = await fetch(chrome.runtime.getURL('assets/modelos.json'));
      this.modelos = await resposta.json();

      // Carrega favoritos do armazenamento local
      await this.carregarFavoritos();

      return this.modelos;
    } catch (erro) {
      console.error('Erro ao carregar modelos:', erro);
      return [];
    }
  }

  async carregarFavoritos() {
    const { favoritos = [] } = await chrome.storage.local.get(['favoritos']);
    this.modelos.forEach(modelo => {
      modelo.favorito = favoritos.includes(modelo.id);
    });
    return favoritos;
  }

  async alternarFavorito(modeloId) {
    let { favoritos = [] } = await chrome.storage.local.get(['favoritos']);

    if (favoritos.includes(modeloId)) {
      favoritos = favoritos.filter(id => id !== modeloId);
    } else {
      favoritos.push(modeloId);
    }

    await chrome.storage.local.set({ favoritos });
    await this.carregarFavoritos(); // Atualiza os modelos com os favoritos
    return favoritos;
  }

  async obterModelosFiltrados(filtros = {}) {
    await this.carregarModelos(); // Garante que temos os dados mais recentes

    return this.modelos.filter(modelo => {
      // Filtro por aba
      if (filtros.aba === 'favoritos' && !modelo.favorito) {
        return false;
      }

      // Filtro por categoria
      if (filtros.categoria && modelo.categoria !== filtros.categoria) {
        return false;
      }

      // Filtro por certidão
      if (filtros.certidao && modelo.certidao !== filtros.certidao) {
        return false;
      }

      // Filtro por busca
      if (filtros.busca) {
        const termo = filtros.busca.toLowerCase();
        if (!modelo.apontamento.toLowerCase().includes(termo) &&
            !modelo.texto.toLowerCase().includes(termo) &&
            !modelo.categoria.toLowerCase().includes(termo) &&
            !modelo.certidao.toLowerCase().includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }
}

const gerenciadorModelos = new GerenciadorModelos();

// Listener para mensagens da extensão
chrome.runtime.onMessage.addListener((requisicao, remetente, responder) => {
  switch (requisicao.acao) {
    case 'obterModelos':
      gerenciadorModelos.obterModelosFiltrados(requisicao.filtros)
        .then(modelos => responder({ modelos }))
        .catch(erro => responder({ erro: erro.message }));
      return true; // Indica que responderemos assincronamente

    case 'obterFavoritos':
      chrome.storage.local.get(['favoritos'], (resultado) => {
        responder({ favoritos: resultado.favoritos || [] });
      });
      return true;

    case 'alternarFavorito':
      gerenciadorModelos.alternarFavorito(requisicao.modeloId)
        .then(favoritos => responder({ favoritos }))
        .catch(erro => responder({ erro: erro.message }));
      return true;

    case 'obterCategorias':
      const categorias = [...new Set(gerenciadorModelos.modelos.map(m => m.categoria))].sort();
      responder({ categorias });
      return true;

    case 'obterCertidoes':
      const certidoes = [...new Set(gerenciadorModelos.modelos.map(m => m.certidao))].sort();
      responder({ certidoes });
      return true;

    case 'inserirModelo':
      chrome.tabs.query({ active: true, currentWindow: true }, (abas) => {
        if (!abas[0]) {
          responder({ erro: 'Nenhuma aba ativa encontrada' });
          return;
        }

        chrome.tabs.sendMessage(
          abas[0].id,
          {
            acao: 'inserirTextoFormatado',
            elementos: requisicao.elementos
          },
          responder
        );
      });
      return true;

    default:
      responder({ erro: 'Ação não reconhecida' });
  }
});

// Inicialização da extensão
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extensão Legal Back instalada');

  // Configura valores padrão
  chrome.storage.local.get(['favoritos'], (resultado) => {
    if (!resultado.favoritos) {
      chrome.storage.local.set({ favoritos: [] });
    }
  });
});

// Atualiza a UI quando o documento é atualizado
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('docs.google.com/document')) {
    chrome.tabs.sendMessage(tabId, { acao: 'atualizarUI' });
  }
});