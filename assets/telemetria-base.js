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


  async function listar(tipo) {

    const db = await abrir();

    return new Promise(
      (resolve, reject) => {

        const tx =
          db.transaction(
            STORE,
            'readonly'
          );

        const store =
          tx.objectStore(STORE);

        const index =
          store.index('tipo');

        const req =
          index.getAll(tipo);

        req.onsuccess = () => {

          const dados =
            req.result || [];

          dados.sort(
            (a, b) =>
              (b.ultimaAtualizacao || 0) -
              (a.ultimaAtualizacao || 0)
          );

          resolve(dados);
        };

        req.onerror = () =>
          reject(req.error);

      }
    );
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

        tx.oncomplete = () =>
          resolve();

        tx.onerror = () =>
          reject(tx.error);

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

    const dataMinMs =
      primeiraData || null;

    const dataMaxMs =
      ultimaData || null;

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


  function encontrarData(
    linhas,
    header
  ) {

    for (
      const linha of linhas
    ) {

      if (!linha.trim()) {
        continue;
      }

      const campos =
        linha.split(';');

      for (
        const campo of campos
      ) {

        const ms =
          parseData(campo);

        if (ms) {
          return ms;
        }
      }

      const camposVirgula =
        linha.split(',');

      for (
        const campo of camposVirgula
      ) {

        const ms =
          parseData(campo);

        if (ms) {
          return ms;
        }
      }
    }

    return null;
  }


  async function encontrarUltimaData(
    file,
    header
  ) {

    const chunkSize =
      4 * 1024 * 1024;

    let inicio =
      Math.max(
        0,
        file.size - chunkSize
      );

    const texto =
      await file
        .slice(inicio)
        .text();

    const linhas =
      texto.split(/\r?\n/);

    for (
      let i = linhas.length - 1;
      i >= 0;
      i--
    ) {

      const linha =
        linhas[i];

      if (!linha) continue;

      const campos =
        linha.split(';');

      for (
        let j = campos.length - 1;
        j >= 0;
        j--
      ) {

        const ms =
          parseData(
            campos[j]
          );

        if (ms) {
          return ms;
        }
      }

      const camposVirgula =
        linha.split(',');

      for (
        let j = camposVirgula.length - 1;
        j >= 0;
        j--
      ) {

        const ms =
          parseData(
            camposVirgula[j]
          );

        if (ms) {
          return ms;
        }
      }
    }

    return null;
  }


  function parseData(valor) {

    if (!valor) return null;

    const texto =
      String(valor)
        .trim()
        .replace(/^"|"$/g, '');

    if (!texto) return null;

    const br =
      texto.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
      );

    if (br) {

      const d =
        Number(br[1]);

      const m =
        Number(br[2]) - 1;

      const y =
        Number(br[3]);

      const hh =
        Number(br[4] || 0);

      const mm =
        Number(br[5] || 0);

      const ss =
        Number(br[6] || 0);

      const dt =
        new Date(
          y,
          m,
          d,
          hh,
          mm,
          ss
        );

      const ms =
        dt.getTime();

      if (Number.isFinite(ms)) {
        return ms;
      }
    }

    const iso =
      Date.parse(texto);

    return Number.isFinite(iso)
      ? iso
      : null;
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

    resumo,

    arquivosParaAnalise,

    removerBase,

    fmtBytes,

    fmtDate,

    inputDate,

    garantirPersistencia,

    TIPOS

  };

})();