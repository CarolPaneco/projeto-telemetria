/* =========================================================
   BASES COMPARTILHADAS - Telemetria Agrícola
   Blocos + Produtividade + Chuva
   Os dados são armazenados no IndexedDB deste navegador.
   ========================================================= */
(function(){
  'use strict';

  const DB_NAME = 'telemetria_blocos_db';
  const DB_VERSION = 4;
  const STORES = { blocos:'blocos', produtividade:'produtividade', chuva:'chuva' };

  window.blocos = window.blocos || [];
  window.produtividade = window.produtividade || [];
  window.chuva = window.chuva || [];

  function normalizar(v){
    return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  }
  function chave(v){ return normalizar(v).replace(/\s+/g,''); }
  function numero(v){
    if(v===null || v===undefined || String(v).trim()==='') return NaN;
    let s=String(v).trim().replace(/\s/g,'');
    if(s.includes(',') && s.includes('.')){
      if(s.lastIndexOf(',') > s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.');
      else s=s.replace(/,/g,'');
    }else if(s.includes(',')) s=s.replace(',','.');
    const n=Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function campo(obj,names){
    for(const n of names){
      const alvo=normalizar(n).replace(/\s+/g,'');
      for(const k of Object.keys(obj||{})){
        if(normalizar(k).replace(/\s+/g,'')===alvo) return obj[k];
      }
    }
    return undefined;
  }

  function abrirDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        Object.values(STORES).forEach(store=>{
          if(!db.objectStoreNames.contains(store)) db.createObjectStore(store);
        });
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function ler(store){
    const db=await abrirDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly');
      const req=tx.objectStore(store).get('atual');
      req.onsuccess=()=>{db.close();resolve(req.result||null);};
      req.onerror=()=>{db.close();reject(req.error);};
    });
  }
  async function salvar(store,data){
    const db=await abrirDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.objectStore(store).put(data,'atual');
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }
  async function limpar(store){
    const db=await abrirDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.objectStore(store).delete('atual');
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }

  /* ---------- CSV / JSON ---------- */
  function dividirLinha(linha,sep){
    const out=[]; let atual='',aspas=false;
    for(let i=0;i<linha.length;i++){
      const c=linha[i];
      if(c==='"'){
        if(aspas && linha[i+1]==='"'){atual+='"';i++;}
        else aspas=!aspas;
      }else if(c===sep && !aspas){out.push(atual.trim());atual='';}
      else atual+=c;
    }
    out.push(atual.trim());
    return out;
  }
  function separador(linha){
    const candidatos=[';','\t',','];
    return candidatos.sort((a,b)=>dividirLinha(linha,b).length-dividirLinha(linha,a).length)[0];
  }
  function csv(texto){
    const linhas=texto.split(/\r?\n/).filter(l=>l.trim()!=='');
    if(linhas.length<2) return [];
    const sep=separador(linhas[0]);
    const headers=dividirLinha(linhas[0],sep).map(x=>normalizar(x).replace(/\s+/g,''));
    return linhas.slice(1).map(l=>{
      const row=dividirLinha(l,sep),o={};
      headers.forEach((h,i)=>o[h]=row[i]??'');
      return o;
    });
  }
  function json(texto){
    const dado=JSON.parse(texto);
    const lista=Array.isArray(dado)?dado:(dado.features||dado.rows||dado.data||[dado]);
    return lista.map(item=>{
      if(item && item.type==='Feature'){
        const o={geometry:item.geometry};
        Object.keys(item.properties||{}).forEach(k=>o[normalizar(k).replace(/\s+/g,'')]=item.properties[k]);
        return o;
      }
      const o={}; Object.keys(item||{}).forEach(k=>o[normalizar(k).replace(/\s+/g,'')]=item[k]); return o;
    });
  }
  function lerArquivo(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result));
      r.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));
      r.readAsText(file,'UTF-8');
    });
  }

  /* ---------- Geometria dos blocos ---------- */
  function pares(txt,dim){
    const nums=(String(txt).match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)||[]).map(Number);
    const passo=dim||2, out=[];
    for(let i=0;i+1<nums.length;i+=passo) out.push([nums[i],nums[i+1]]);
    return out;
  }
  function aneis(corpo,dim){
    const out=[]; let prof=0,atual='';
    for(const c of corpo){
      if(c==='('){prof++;if(prof===1){atual='';continue;}atual+=c;continue;}
      if(c===')'){prof--;if(prof===0){out.push(pares(atual,dim));continue;}atual+=c;continue;}
      if(prof>0) atual+=c;
    }
    if(!out.length && corpo.trim()) out.push(pares(corpo,dim));
    return out;
  }
  function wkt(txt){
    const s=String(txt).trim().replace(/^SRID=\d+;/i,'');
    const m=s.match(/^\s*(MULTIPOLYGON|POLYGON)\s*([ZM]{1,2})?\s*\(/i);
    if(!m) return [];
    const tipo=m[1].toUpperCase(),dim=2+(m[2]?m[2].length:0);
    if(tipo==='POLYGON') return [aneis(s.slice(s.indexOf('(')+1,s.lastIndexOf(')')),dim)];
    const corpo=s.slice(s.indexOf('(')+1,s.lastIndexOf(')')); const pol=[];let prof=0,atual='';
    for(const c of corpo){
      if(c==='('){if(prof>0)atual+=c;prof++;if(prof===1)atual='';continue;}
      if(c===')'){prof--;if(prof===0){pol.push(atual);continue;}atual+=c;continue;}
      if(prof>0)atual+=c;
    }
    return pol.map(p=>aneis(p,dim));
  }
  function geo(g){
    if(!g) return [];
    if(g.type==='Feature') return geo(g.geometry);
    if(g.type==='FeatureCollection') return (g.features||[]).flatMap(f=>geo(f.geometry));
    if(g.type==='Polygon') return [g.coordinates];
    if(g.type==='MultiPolygon') return g.coordinates;
    return [];
  }
  function geometria(v){
    if(v===null||v===undefined) return [];
    if(typeof v==='object') return geo(v);
    const s=String(v).trim(); if(!s)return [];
    if(s.startsWith('{')||s.startsWith('[')){try{return geo(JSON.parse(s));}catch(e){return [];}}
    if(/^(SRID=\d+;)?\s*(POLYGON|MULTIPOLYGON)/i.test(s)) return wkt(s);
    return [];
  }
  function bbox(polys){
    let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
    for(const poly of polys) for(const ring of poly) for(const p of ring){
      minLon=Math.min(minLon,p[0]);maxLon=Math.max(maxLon,p[0]);minLat=Math.min(minLat,p[1]);maxLat=Math.max(maxLat,p[1]);
    }
    return {minLon,maxLon,minLat,maxLat};
  }
  function dentroAnel(lon,lat,anel){
    let dentro=false;
    for(let i=0,j=anel.length-1;i<anel.length;j=i++){
      const [xi,yi]=anel[i],[xj,yj]=anel[j];
      const hit=((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi);
      if(hit)dentro=!dentro;
    }
    return dentro;
  }
  function dentroPoly(lon,lat,poly){
    if(!poly.length||!dentroAnel(lon,lat,poly[0]))return false;
    for(let i=1;i<poly.length;i++)if(dentroAnel(lon,lat,poly[i]))return false;
    return true;
  }
  function montarBlocos(linhas){
    return linhas.map(o=>{
      const polygons=geometria(campo(o,['geometry','geom','the_geom']));
      if(!polygons.length)return null;
      const anoSafra=campo(o,['ano_safra','anosafra','safra']);
      const bloco=campo(o,['bloco']),gleba=campo(o,['gleba']),talhao=campo(o,['talhao']),unidade=campo(o,['unidade']);
      const area=numero(campo(o,['areaha','area_ha','area','area(ha)']));
      return {label:[unidade,gleba,bloco,talhao].filter(Boolean).join(' / ')||'Bloco sem identificação',anoSafra,bloco,gleba,talhao,unidade,areaHa:Number.isFinite(area)?area:null,polygons,bbox:bbox(polygons)};
    }).filter(Boolean);
  }

  window.encontrarBloco=function(lon,lat){
    if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;
    for(const b of window.blocos){
      const bb=b.bbox;if(lon<bb.minLon||lon>bb.maxLon||lat<bb.minLat||lat>bb.maxLat)continue;
      for(const poly of b.polygons)if(dentroPoly(lon,lat,poly))return b;
    }
    return null;
  };

  /* ---------- Chuva ---------- */
  function dataDia(v){
    const d=v instanceof Date?v:new Date(v); if(isNaN(d))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function dataChuva(v){
    const s=String(v??'').trim();
    const m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:'';
  }
  function chaveChuva(unidade,bloco,dia){return `${chave(unidade)}|${chave(bloco)}|${dia}`;}
  window.obterChuvaDaOcorrencia=function(r){
    if(!window.chuva.length||!r)return null;
    const alvo=chaveChuva(r.unidade,r.bloco,dataDia(r.data));
    let arr=window.chuva.filter(x=>chaveChuva(x.cd_unidade,x.cd_bloco,x.dataChuva)===alvo);
    if(!arr.length&&r.blocoLabel)arr=window.chuva.filter(x=>chaveChuva(x.cd_unidade,x.cd_bloco,x.dataChuva)===chaveChuva(r.unidade,r.blocoLabel,dataDia(r.data)));
    if(!arr.length)return null;
    return {totalChuvaDia:arr.reduce((s,x)=>s+(Number(x.totalChuvaDia)||0),0),safra:arr[0].safra||'',registros:arr.length};
  };
  window.formatarChuvaCelula=function(r){const c=window.obterChuvaDaOcorrencia(r);return c?`<span class="chuva-badge">🌧️ ${Number(c.totalChuvaDia||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} mm</span>`:'<span class="chuva-sem-dado">—</span>';};

  /* ---------- Produtividade ---------- */
  function normalizarProd(obj){
    return {...obj,
      sk_estimativas:campo(obj,['sk_estimativas','sk_estimativa']),ds_ano_safra:campo(obj,['ds_ano_safra','ano_safra','anosafra','safra']),
      ds_gleba:campo(obj,['ds_gleba','gleba']),ds_bloco:campo(obj,['ds_bloco','bloco']),ds_talhao:campo(obj,['ds_talhao','talhao']),
      vl_area:campo(obj,['vl_area','area','area_ha','areaha','area(ha)']),vl_espacamento_talhao:campo(obj,['vl_espacamento_talhao','espacamento_talhao','espacamento']),
      vl_produtividade:campo(obj,['vl_produtividade','produtividade']),vl_producao_estimada:campo(obj,['vl_producao_estimada','producao_estimada','producao']),
      vl_producao_estimada_bloco:campo(obj,['vl_producao_estimada_bloco','producao_estimada_bloco','producao_bloco']),vl_colheita_area_moagem:campo(obj,['vl_colheita_area_moagem','colheita_area_moagem']),
      vl_tch_bloco:campo(obj,['vl_tch_bloco','tch_bloco']),cd_status:campo(obj,['cd_status','status']),ds_grupo_estimativa:campo(obj,['ds_grupo_estimativa','grupo_estimativa']),dh_data_estimativa:campo(obj,['dh_data_estimativa','data_estimativa'])
    };
  }
  function numProd(v){const n=numero(v);return Number.isFinite(n)?n:0;}
  function numeroProdutividade(v){
    if(v===null || v===undefined || v==='') return NaN;
    return numero(v);
  }
  function normalizarChaveRelacionamento(v){
    if(v===null || v===undefined) return '';
    return String(v).trim().replace(/\s+/g,'').toUpperCase();
  }
  window.normalizarChaveRelacionamento=normalizarChaveRelacionamento;
  window.numeroProdutividade=numeroProdutividade;

  window.obterProdutividadeDoBloco=function(bloco){
    if(!bloco || !window.produtividade.length) return null;

    const ano=normalizarChaveRelacionamento(bloco.anoSafra);
    const gleba=normalizarChaveRelacionamento(bloco.gleba);
    const codBloco=normalizarChaveRelacionamento(bloco.bloco);
    if(!gleba || !codBloco) return {
      producaoEstimada:0, producaoEstimadaBloco:0, areaBlocoHa:0, metrosEquivalentes:0,
      quantidadeTalhoes:0, registros:[], motivo:'Bloco sem GLEBA/BLOCO para relacionamento'
    };

    const registros=window.produtividade.map((p,idx)=>({
      p, idx,
      ano:normalizarChaveRelacionamento(campo(p,['ds_ano_safra','ano_safra','anosafra','safra'])),
      gleba:normalizarChaveRelacionamento(campo(p,['ds_gleba','gleba'])),
      bloco:normalizarChaveRelacionamento(campo(p,['ds_bloco','bloco'])),
      talhao:normalizarChaveRelacionamento(campo(p,['ds_talhao','talhao'])),
      area:numeroProdutividade(campo(p,['vl_area','area','area_ha','areaha','area(ha)'])),
      espacamento:numeroProdutividade(campo(p,['vl_espacamento_talhao','espacamento_talhao','espacamento'])),
      producao:numeroProdutividade(campo(p,['vl_producao_estimada','producao_estimada','producao'])),
      producaoBloco:numeroProdutividade(campo(p,['vl_producao_estimada_bloco','producao_estimada_bloco','producao_bloco'])),
      tchBloco:numeroProdutividade(campo(p,['vl_tch_bloco','tch_bloco'])),
      areaMoagem:numeroProdutividade(campo(p,['vl_colheita_area_moagem','colheita_area_moagem'])),
      status:String(campo(p,['cd_status','status']) ?? '').trim().toUpperCase()
    }));

    let candidatos=ano
      ? registros.filter(x=>x.gleba===gleba && x.bloco===codBloco && x.ano===ano)
      : registros.filter(x=>x.gleba===gleba && x.bloco===codBloco);

    const ativos=candidatos.filter(x=>['1','S','SIM','ATIVO','ATIVA','VALIDO','VÁLIDO'].includes(x.status));
    if(ativos.length) candidatos=ativos;

    const producaoValidos=candidatos.filter(x=>Number.isFinite(x.producao) && x.producao>0);
    const areaValidos=candidatos.filter(x=>Number.isFinite(x.area) && x.area>0);
    const espacamentoValidos=areaValidos.filter(x=>Number.isFinite(x.espacamento) && x.espacamento>0);
    const blocoValidos=candidatos.filter(x=>Number.isFinite(x.producaoBloco) && x.producaoBloco>0);
    const valoresBloco=blocoValidos.map(x=>x.producaoBloco).sort((a,b)=>a-b);
    const producaoEstimadaBloco=valoresBloco.length ? valoresBloco[valoresBloco.length-1] : 0;
    const producaoEstimada=producaoValidos.reduce((a,x)=>a+x.producao,0);
    const areaBlocoHa=areaValidos.reduce((a,x)=>a+x.area,0);
    const metrosEquivalentes=espacamentoValidos.reduce((a,x)=>a+(x.area*10000)/x.espacamento,0);
    const producaoBase=producaoEstimadaBloco>0 ? producaoEstimadaBloco : producaoEstimada;

    let motivo='';
    if(!candidatos.length) motivo='Nenhuma linha da estimativa bateu GLEBA + BLOCO (e SAFRA quando disponível).';
    else if(!producaoBase) motivo='Encontrou o bloco, mas não há produção estimada positiva no bloco/talhão.';
    else if(!metrosEquivalentes) motivo='Produção encontrada, porém não há espaçamento > 0 para calcular os metros equivalentes do bloco.';

    return {
      producaoEstimada:producaoBase,
      producaoEstimadaBloco,
      producaoEstimadaTalhoes:producaoEstimada,
      areaBlocoHa,
      metrosEquivalentes,
      espacamentoM:metrosEquivalentes>0 ? (areaBlocoHa*10000)/metrosEquivalentes : NaN,
      quantidadeTalhoes:candidatos.length,
      quantidadeComProducao:producaoValidos.length,
      quantidadeComProducaoBloco:blocoValidos.length,
      quantidadeComEspacamento:espacamentoValidos.length,
      registros:candidatos.map(x=>x.p),
      candidatos,
      motivo,
      fonteProducao:producaoEstimadaBloco>0 ? 'VL_PRODUCAO_ESTIMADA_BLOCO' : 'VL_PRODUCAO_ESTIMADA'
    };
  };

  window.calcularToneladasEstimadas=function(metros,bloco,metrosBlocoFallback=0){
    const info=window.obterProdutividadeDoBloco(bloco);
    if(!info) return {toneladas:0,percentualBloco:0,metrosBloco:0,info:null,metodo:'sem estimativa'};
    if(!Number.isFinite(metros)||metros<=0) return {toneladas:0,percentualBloco:0,metrosBloco:0,info,metodo:'sem metros'};
    let metrosBloco=Number.isFinite(info.metrosEquivalentes)&&info.metrosEquivalentes>0?info.metrosEquivalentes:0;
    let metodo=metrosBloco>0?'área ÷ espaçamento':'';
    if(!(metrosBloco>0)&&Number.isFinite(metrosBlocoFallback)&&metrosBlocoFallback>0){metrosBloco=metrosBlocoFallback;metodo='metros reais da telemetria no bloco';}
    if(!(info.producaoEstimada>0)) return {toneladas:0,percentualBloco:0,metrosBloco,info,metodo:'sem produção estimada'};
    if(!(metrosBloco>0)) return {toneladas:0,percentualBloco:0,metrosBloco:0,info,metodo:'sem referência de metros'};
    const percentualBloco=metros/metrosBloco, toneladas=info.producaoEstimada*percentualBloco;
    return {toneladas,percentualBloco,metrosBloco,info,metodo,fonteProducao:info.fonteProducao||'VL_PRODUCAO_ESTIMADA'};
  };

  /* ---------- UI da página Bases ---------- */
  function status(id,txt,cls){const el=document.getElementById(id);if(el){el.textContent=txt;el.className='badge '+(cls||'');}}
  function atualizarUI(){
    const b=window.blocos.length,p=window.produtividade.length,c=window.chuva.length;
    status('statusBlocos',b?`${b.toLocaleString('pt-BR')} bloco(s) salvo(s) neste navegador`:'Nenhuma base de blocos carregada',b?'ok':'');
    status('statusProdutividade',p?`${p.toLocaleString('pt-BR')} registro(s) salvo(s) neste navegador`:'Nenhuma base de produtividade carregada',p?'ok':'');
    status('statusChuva',c?`${c.toLocaleString('pt-BR')} registro(s) salvo(s) neste navegador`:'Nenhuma base de chuva carregada',c?'ok':'');
    const total=b+p+c;
    status('statusGeral',total?`Bases disponíveis: ${b.toLocaleString('pt-BR')} blocos · ${p.toLocaleString('pt-BR')} registros de produtividade · ${c.toLocaleString('pt-BR')} registros de chuva`:'Nenhuma base compartilhada carregada',total?'ok':'');
  }

  async function carregarTudo(){
    try{window.blocos=(await ler(STORES.blocos))||[];}catch(e){window.blocos=[];}
    try{window.produtividade=((await ler(STORES.produtividade))||[]).map(normalizarProd);}catch(e){window.produtividade=[];}
    try{window.chuva=(await ler(STORES.chuva))||[];}catch(e){window.chuva=[];}
    atualizarUI();
  }

  window.inicializarBasesCompartilhadas=carregarTudo;
  window.carregarBlocosDB=()=>ler(STORES.blocos);
  window.carregarProdutividadeDB=()=>ler(STORES.produtividade);
  window.carregarChuvaDB=()=>ler(STORES.chuva);
  window.salvarBlocosDB=d=>salvar(STORES.blocos,d);
  window.salvarProdutividadeDB=d=>salvar(STORES.produtividade,d);
  window.salvarChuvaDB=d=>salvar(STORES.chuva,d);
  window.limparBlocosDB=()=>limpar(STORES.blocos);
  window.limparProdutividadeDB=()=>limpar(STORES.produtividade);
  window.limparChuvaDB=()=>limpar(STORES.chuva);

  async function importar(tipo,input){
    const file=input.files&&input.files[0];if(!file)return;
    const st={blocos:'statusBlocos',produtividade:'statusProdutividade',chuva:'statusChuva'}[tipo];
    status(st,'Lendo arquivo...','warn');
    try{
      const texto=await lerArquivo(file), t=texto.trim();
      const linhas=(t.startsWith('{')||t.startsWith('[')||/\.json$/i.test(file.name))?json(t):csv(t);
      if(!linhas.length)throw new Error('Nenhum registro encontrado.');
      if(tipo==='blocos'){
        const arr=montarBlocos(linhas);if(!arr.length)throw new Error('Nenhum bloco com geometria válida foi encontrado.');
        window.blocos=arr;await salvar(STORES.blocos,arr);
      }else if(tipo==='produtividade'){
        window.produtividade=linhas.map(normalizarProd);await salvar(STORES.produtividade,window.produtividade);
      }else{
        window.chuva=linhas.map(o=>({cd_unidade:String(campo(o,['cd_unidade','unidade'])??'').trim(),cd_bloco:String(campo(o,['cd_bloco','bloco'])??'').trim(),dataChuva:dataChuva(campo(o,['data_chuva','datachuva'])),safra:String(campo(o,['safra','ano_safra','ds_ano_safra'])??'').trim(),totalChuvaDia:numProd(campo(o,['total_chuva_dia','totalchuviadia','chuva_dia','chuva']))})).filter(x=>x.dataChuva&&x.cd_unidade&&x.cd_bloco);
        if(!window.chuva.length)throw new Error('Nenhum registro de chuva válido foi encontrado.');
        await salvar(STORES.chuva,window.chuva);
      }
      atualizarUI();
    }catch(e){alert(`Não foi possível carregar a base de ${tipo}: ${e.message||e}`);atualizarUI();}
    input.value='';
  }

  window.carregarBaseBlocos=()=>importar('blocos',document.getElementById('arquivoBlocos'));
  window.carregarBaseProdutividade=()=>importar('produtividade',document.getElementById('arquivoProdutividade'));
  window.carregarBaseChuva=()=>importar('chuva',document.getElementById('arquivoChuva'));
  window.removerBaseBlocos=async()=>{if(confirm('Remover a base de blocos salva deste navegador?')){window.blocos=[];await limpar(STORES.blocos);atualizarUI();}};
  window.removerBaseProdutividade=async()=>{if(confirm('Remover a base de produtividade salva deste navegador?')){window.produtividade=[];await limpar(STORES.produtividade);atualizarUI();}};
  window.removerBaseChuva=async()=>{if(confirm('Remover a base de chuva salva deste navegador?')){window.chuva=[];await limpar(STORES.chuva);atualizarUI();}};

  window.addEventListener('load',carregarTudo);
})();
