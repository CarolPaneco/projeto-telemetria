/* =========================================================
   TELEMETRIA - CACHE DE ANÁLISE PERSISTIDA
   Mantém a análise atual disponível mesmo ao atualizar a página (F5)
   ou ao navegar entre diferentes módulos do sistema.
   ========================================================= */
(function () {
  'use strict';

  const DB_NOME = 'telemetria_cache_analise_db';
  const DB_VERSAO = 1;
  const STORE = 'analises';

  function abrirDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOME, DB_VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'modulo' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function salvar(modulo, dados) {
    if (!modulo || !dados) return;
    try {
      const db = await abrirDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);

        const registro = {
          modulo,
          timestamp: Date.now(),
          dataHoraSalvo: new Date().toISOString(),
          nomeArquivo: dados.nomeArquivo || 'Arquivo de telemetria',
          periodo: dados.periodo || null,
          filtros: dados.filtros || null,
          qualidade: dados.qualidade || {},
          resultados: dados.resultados || []
        };

        store.put(registro);
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    } catch (err) {
      console.warn('Não foi possível salvar cache da análise:', err);
    }
  }

  async function carregar(modulo) {
    if (!modulo) return null;
    try {
      const db = await abrirDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req = store.get(modulo);
        req.onsuccess = () => {
          db.close();
          const res = req.result;
          if (!res || !Array.isArray(res.resultados) || !res.resultados.length) {
            resolve(null);
            return;
          }

          // Reconverte strings de data para objetos Date nativos
          res.resultados.forEach(r => {
            if (r.data) r.data = new Date(r.data);
            if (r.inicio) r.inicio = new Date(r.inicio);
            if (r.fim) r.fim = new Date(r.fim);
          });

          resolve(res);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      });
    } catch (err) {
      console.warn('Não foi possível carregar cache da análise:', err);
      return null;
    }
  }

  async function limpar(modulo) {
    if (!modulo) return;
    try {
      const db = await abrirDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.delete(modulo);
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    } catch (err) {
      console.warn('Não foi possível limpar cache da análise:', err);
    }
  }

  window.telemetriaAnaliseCache = {
    salvar,
    carregar,
    limpar
  };
})();

