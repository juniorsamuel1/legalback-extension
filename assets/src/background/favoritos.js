export async function getFavoritos() {
  const result = await chrome.storage.local.get(['favoritos']);
  return result.favoritos || [];
}

export async function toggleFavorito(apontamento) {
  const favoritos = await getFavoritos();
  const index = favoritos.indexOf(apontamento);

  if (index === -1) {
    favoritos.push(apontamento);
  } else {
    favoritos.splice(index, 1);
  }

  await chrome.storage.local.set({ favoritos });
  return favoritos;
}