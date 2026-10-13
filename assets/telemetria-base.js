(function () {

  'use strict';

  const DB = 'telemetria_agricola_db';
  const VERSION = 1;
  const STORE = 'arquivos';

  const TIPOS = {
    colhedora: 'Colhedora',
    tratos: 'Tratos',
    plantadora: 'Plantadora'
  };


  function abrir() {

    return new Promise((resolve, reject) => {

      const req =
        indexedDB.open(DB, VERSION);

      req.onupgradeneeded = () => {

        const db = req.result;

        if (!db.objectStoreNames.contains(STORE)) {

          const s =
            db.createObjectStore(
              STORE,
              { keyPath: 'id' }
            );

          s.createIndex(
            'tipo',
            'tipo',
            { unique: false }
          );

          s.createIndex(
            'tipo_data',
            'tipo_data',
            { unique: false }
          );
        }
      };

      req.onsuccess = () =>
        resolve(req.result);

      req.onerror = () =>
        reject(req.error);

    });
  }


  function idArquivo(
    tipo,
    dataMinMs,
    nome
  ) {

    const d =
      new Date(dataMinMs);

    const dia =
      `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

    return `${tipo}|${dia}|${nome}`;
  }


  async function repararRegistroSeNecessario(reg) {
    if (!reg) return reg;
    let minValido = dataValida(reg.dataMinMs);
    let maxValido = dataValida(reg.dataMaxMs);

    if (minValido && maxValido) {
      if (reg.dataMinMs > reg.dataMaxMs) {
        const tmp = reg.dataMinMs;
        reg.dataMinMs = reg.dataMaxMs;
        reg.dataMaxMs = tmp;
        reg.tipo_data = `${reg.tipo}|${reg.dataMinMs}`;
        try { await salvar(reg); } catch(e){}
      }
      return reg;
    }

    try {
      if (reg.body && reg.header && typeof reg.body.slice === 'function') {
        const textoIni = await reg.body.slice(0, Math.min(reg.body.size, 2 * 1024 * 1024)).text();
        const linhas = textoIni.split(/\r?\n/);
        const novoMin = encontrarData(linhas, reg.header);
        const novoMax = await encontrarUltimaData(reg.body, reg.header);
        let dMin = novoMin || (minValido ? reg.dataMinMs : null);
        let dMax = novoMax || (maxValido ? reg.dataMaxMs : null);
        if (dMin && dMax && dMin > dMax) {
          const tmp = dMin;
          dMin = dMax;
          dMax = tmp;
        }
        if (dMin) reg.dataMinMs = dMin;
        if (dMax) reg.dataMaxMs = dMax;
        if (reg.dataMinMs) {
          reg.tipo_data = `${reg.tipo}|${reg.dataMinMs}`;
        }
        await salvar(reg);
      }
    } catch(e) {
      console.warn('Falha ao auto-reparar registro de telemetria:', e);
    }
    return reg;
  }

  async function listar(tipo) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const index = store.index('tipo');
      const req = index.getAll(tipo);

      req.onsuccess = async () => {
        const dados = req.result || [];
        for (let i = 0; i < dados.length; i++) {
          dados[i] = await repararRegistroSeNecessario(dados[i]);
        }
        dados.sort((a, b) => (b.ultimaAtualizacao || 0) - (a.ultimaAtualizacao || 0));
        resolve(dados);
      };

      req.onerror = () => reject(req.error);
    });
  }


  async function ler(id) {

    const db = await abrir();

    return new Promise(
      (resolve, reject) => {

        const tx =
          db.transaction(
            STORE,
            'readonly'
          );

        const req =
          tx.objectStore(STORE)
            .get(id);

        req.onsuccess = () =>
          resolve(req.result);

        req.onerror = () =>
          reject(req.error);

      }
    );
  }


  async function salvar(reg) {

    const db = await abrir();

    return new Promise(
      (resolve, reject) => {

        const tx =
          db.transaction(
            STORE,
            'readwrite'
          );

        tx.objectStore(STORE)
          .put(reg);

        tx.oncomplete = () =>
          resolve(reg);

        tx.onerror = () =>
          reject(tx.error);

      }
    );
  }


  async function remover(id) {
    const db = await abrir();
    return new Promise(
      (resolve, reject) => {
        const tx =
          db.transaction(
            STORE,
            'readwrite'
          );
        tx.objectStore(STORE)
          .delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }
    );
  }

  async function limparTipo(tipo) {
    const lista = await listar(tipo);
    const db = await abrir();
    return new Promise(
      (resolve, reject) => {
        const tx =
          db.transaction(
            STORE,
            'readwrite'
          );
        const store = tx.objectStore(STORE);
        for (const item of lista) {
          store.delete(item.id);
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }
    );
  }


  function fmtBytes(n) {

    if (!Number.isFinite(n) || n <= 0) {
      return '0 B';
    }

    const unidades = [
      'B',
      'KB',
      'MB',
      'GB',
      'TB'
    ];

    let i = 0;
    let valor = n;

    while (
      valor >= 1024 &&
      i < unidades.length - 1
    ) {

      valor /= 1024;
      i++;
    }

    return `${valor.toLocaleString(
      'pt-BR',
      {
        maximumFractionDigits:
          valor >= 100
            ? 0
            : valor >= 10
              ? 1
              : 2
      }
    )} ${unidades[i]}`;
  }


  function fmtDate(ms) {

    if (!ms) return '—';

    return new Date(ms)
      .toLocaleString(
        'pt-BR',
        {
          dateStyle: 'short',
          timeStyle: 'short'
        }
      );
  }


  function inputDate(ms) {

    if (!ms) return '';

    const d =
      new Date(ms);

    const y =
      d.getFullYear();

    const m =
      String(
        d.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        d.getDate()
      ).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }


  function inputDateBR(ms) {
    if (!ms || isNaN(ms)) return '';
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${m}/${y}`;
  }


  function parseDateBR(str) {
    if (!str) return null;
    str = String(str).trim();
    if (str.includes(' to ')) str = str.split(' to ')[0].trim();
    if (str.includes(' até ')) str = str.split(' até ')[0].trim();
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mon = parseInt(m[2], 10) - 1;
      const y = parseInt(m[3], 10);
      const dt = new Date(y, mon, d, 0, 0, 0);
      if (dt.getFullYear() === y && dt.getMonth() === mon && dt.getDate() === d) return dt;
    }
    const iso = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (iso) {
      const y = parseInt(iso[1], 10);
      const mon = parseInt(iso[2], 10) - 1;
      const d = parseInt(iso[3], 10);
      const dt = new Date(y, mon, d, 0, 0, 0);
      if (dt.getFullYear() === y && dt.getMonth() === mon && dt.getDate() === d) return dt;
    }
    const ts = Date.parse(str);
    if (!isNaN(ts)) {
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) return dt;
    }
    return null;
  }



  async function primeiraLinha(file) {

    const slice =
      file.slice(
        0,
        Math.min(
          file.size,
          2 * 1024 * 1024
        )
      );

    const text =
      await slice.text();

    const linhas =
      text.split(/\r?\n/);

    return linhas[0] || '';
  }


  async function metadata(file) {

    const nome =
      file.name || 'arquivo';

    const tamanho =
      file.size || 0;

    const ultimaAtualizacao =
      Date.now();

    const header =
      await primeiraLinha(file);

    return {
      nome,
      tamanho,
      ultimaAtualizacao,
      header
    };
  }


  async function adicionar(
    tipo,
    file,
    onProgress
  ) {

    if (!TIPOS[tipo]) {

      throw new Error(
        `Tipo de telemetria inválido: ${tipo}`
      );
    }

    if (!file) {
      throw new Error(
        'Arquivo não informado.'
      );
    }

    const meta =
      await metadata(file);

    const textoInicial =
      await file
        .slice(
          0,
          Math.min(
            file.size,
            8 * 1024 * 1024
          )
        )
        .text();

    const linhas =
      textoInicial.split(/\r?\n/);

    const header =
      linhas.shift() || '';

    const primeiraData =
      encontrarData(
        linhas,
        header
      );

    const ultimaData =
      await encontrarUltimaData(
        file,
        header
      );

    let dMin = primeiraData;
    let dMax = ultimaData;
    if (dMin && dMax && dMin > dMax) {
      const tmp = dMin;
      dMin = dMax;
      dMax = tmp;
    }

    const dataMinMs =
      dMin || null;

    const dataMaxMs =
      dMax || null;

    const id =
      idArquivo(
        tipo,
        dataMinMs ||
          meta.ultimaAtualizacao,
        meta.nome
      );

    const reg = {

      id,

      tipo,

      tipo_data:
        `${tipo}|${
          dataMinMs || 0
        }`,

      nome:
        meta.nome,

      tamanho:
        meta.tamanho,

      ultimaAtualizacao:
        meta.ultimaAtualizacao,

      dataMinMs,

      dataMaxMs,

      registros:
        Math.max(
          0,
          await contarLinhas(file) - 1
        ),

      header,

      body:
        file.slice(
          header.length + 1
        )
    };

    await salvar(reg);

    if (onProgress) {
      onProgress(100);
    }

    return reg;
  }


  function detectarSeparadorHeader(linha) {
    if (!linha) return ';';
    const candidatos = [';', '\t', ',', '|'];
    return candidatos.sort((a,b) => (linha.split(b).length - linha.split(a).length))[0];
  }

  function acharIndiceData(header, sep) {
    if (!header) return -1;
    const colunas = header.split(sep).map(c => 
      c.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    let idx = colunas.findIndex(c => (c.includes('data') && c.includes('hora')) || c === 'data hora' || c === 'data/hora' || c === 'data_hora');
    if (idx >= 0) return idx;
    idx = colunas.findIndex(c => c === 'data' || c === 'date' || c === 'datetime' || c === 'timestamp');
    if (idx >= 0) return idx;
    idx = colunas.findIndex(c => c.includes('data') || c.includes('date') || c.startsWith('dh_') || c === 'dh');
    return idx;
  }

  function dataValida(ms) {
    if (!ms || !Number.isFinite(ms)) return false;
    const y = new Date(ms).getFullYear();
    return y >= 1990 && y <= 2100;
  }

  function parseData(valor) {
    if (!valor) return null;
    const texto = String(valor).trim().replace(/^["']|["']$/g, '');
    if (!texto) return null;

    if (/^\d{1,8}$/.test(texto)) return null;

    const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
    if (br) {
      const d = Number(br[1]);
      const m = Number(br[2]) - 1;
      const y = Number(br[3]);
      const hh = Number(br[4] || 0);
      const mm = Number(br[5] || 0);
      const ss = Number(br[6] || 0);
      if (y >= 1990 && y <= 2100 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        const dt = new Date(y, m, d, hh, mm, ss);
        const ms = dt.getTime();
        if (Number.isFinite(ms)) return ms;
      }
    }

    const isoMatch = texto.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]) - 1;
      const d = Number(isoMatch[3]);
      const hh = Number(isoMatch[4] || 0);
      const mm = Number(isoMatch[5] || 0);
      const ss = Number(isoMatch[6] || 0);
      if (y >= 1990 && y <= 2100 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        const dt = new Date(y, m, d, hh, mm, ss);
        const ms = dt.getTime();
        if (Number.isFinite(ms)) return ms;
      }
    }

    if (/^\d{10,13}$/.test(texto)) {
      const num = Number(texto);
      const ms = texto.length === 10 ? num * 1000 : num;
      if (dataValida(ms)) return ms;
    }

    return null;
  }

  function encontrarData(linhas, header) {
    const sep = detectarSeparadorHeader(header || (linhas.length ? linhas[0] : ''));
    const idx = acharIndiceData(header, sep);

    for (const linha of linhas) {
      if (!linha || !linha.trim()) continue;
      const campos = linha.split(sep);
      if (idx >= 0 && idx < campos.length) {
        const ms = parseData(campos[idx]);
        if (ms) return ms;
      }
      for (const campo of campos) {
        const ms = parseData(campo);
        if (ms) return ms;
      }
    }

    return null;
  }

  async function encontrarUltimaData(file, header) {
    const chunkSize = 4 * 1024 * 1024;
    const tamanho = file.size || 0;
    const inicio = Math.max(0, tamanho - chunkSize);
    const texto = await file.slice(inicio).text();
    const linhas = texto.split(/\r?\n/);

    const sep = detectarSeparadorHeader(header || (linhas.length ? linhas[0] : ''));
    const idx = acharIndiceData(header, sep);

    for (let i = linhas.length - 1; i >= 0; i--) {
      const linha = linhas[i];
      if (!linha || !linha.trim()) continue;
      const campos = linha.split(sep);
      if (idx >= 0 && idx < campos.length) {
        const ms = parseData(campos[idx]);
        if (ms) return ms;
      }
      for (let j = campos.length - 1; j >= 0; j--) {
        const ms = parseData(campos[j]);
        if (ms) return ms;
      }
    }

    return null;
  }


  async function contarLinhas(file) {

    const chunkSize =
      4 * 1024 * 1024;

    let offset = 0;
    let total = 0;

    while (
      offset < file.size
    ) {

      const chunk =
        await file
          .slice(
            offset,
            Math.min(
              file.size,
              offset + chunkSize
            )
          )
          .text();

      total +=
        (chunk.match(/\n/g) || [])
          .length;

      offset +=
        chunkSize;
    }

    if (
      file.size &&
      !String(
        await file.slice(
          Math.max(
            0,
            file.size - 1
          )
        ).text()
      ).endsWith('\n')
    ) {
      total++;
    }

    return total;
  }


  async function removerBase(
    tipo,
    id
  ) {

    if (!TIPOS[tipo]) {
      throw new Error(
        `Tipo inválido: ${tipo}`
      );
    }

    return remover(id);
  }


  async function arquivosParaAnalise(
    tipo,
    inicio,
    fim
  ) {

    const lista =
      await listar(tipo);

    const inicioMs =
      inicio instanceof Date
        ? inicio.getTime()
        : Number(inicio);

    const fimMs =
      fim instanceof Date
        ? fim.getTime()
        : Number(fim);

    const selecionados =
      lista.filter(reg => {

        const min =
          reg.dataMinMs ??
          -Infinity;

        const max =
          reg.dataMaxMs ??
          Infinity;

        return (
          min <= fimMs &&
          max >= inicioMs
        );
      });

    return selecionados.map(
      reg => {

        const header =
          reg.header || '';

        const body =
          reg.body || '';

        return new File(
          [
            header,
            '\n',
            body
          ],
          reg.nome,
          {
            type:
              'text/plain'
          }
        );
      }
    );
  }


  async function resumo(tipo) {

    const lista =
      await listar(tipo);

    return {

      tipo,

      nome:
        TIPOS[tipo] || tipo,

      arquivos:
        lista.length,

      tamanho:
        lista.reduce(
          (total, item) =>
            total +
            Number(
              item.tamanho || 0
            ),
          0
        ),

      registros:
        lista.reduce(
          (total, item) =>
            total +
            Number(
              item.registros || 0
            ),
          0
        ),

      dataMinMs:
        lista.reduce(
          (min, item) => {

            if (
              !item.dataMinMs
            ) {
              return min;
            }

            return min === null
              ? item.dataMinMs
              : Math.min(
                  min,
                  item.dataMinMs
                );
          },
          null
        ),

      dataMaxMs:
        lista.reduce(
          (max, item) => {

            if (
              !item.dataMaxMs
            ) {
              return max;
            }

            return max === null
              ? item.dataMaxMs
              : Math.max(
                  max,
                  item.dataMaxMs
                );
          },
          null
        )
    };
  }


  async function garantirPersistencia() {

    try {

      if (
        navigator.storage &&
        navigator.storage.persist
      ) {

        return await
          navigator.storage.persist();

      }

    } catch (e) {

      console.warn(
        'Não foi possível solicitar persistência:',
        e
      );
    }

    return false;
  }


  window.telemetriaBase = {

    DB,

    adicionar,

    listar,

    ler,

    remover,

    limparTipo,

    resumo,

    arquivosParaAnalise,

    removerBase,

    fmtBytes,

    fmtDate,

    inputDate,

    inputDateBR,

    parseDateBR,

    garantirPersistencia,

    TIPOS

  };

})();