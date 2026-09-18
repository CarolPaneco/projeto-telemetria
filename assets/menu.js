(function(){
  const mount=document.getElementById('appSidebarMount');
  if(!mount)return;
  const path=location.pathname.toLowerCase();
  const isTratos=path.includes('tratos');
  const isColhedora=path.includes('colhedora') || (!isTratos && !path.includes('plantadora') && !path.includes('bases'));
  mount.innerHTML=`
    <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false" onclick="alternarMenuLateral()">☰</button>
    <aside class="app-sidebar" id="appSidebar" aria-label="Menu principal">
      <div class="menu-brand">
        <div class="menu-brand-kicker">Telemetria agrícola</div>
        <div class="menu-brand-title">Central de análise</div>
        <div class="menu-brand-sub">Ocorrências, mapas, produtividade e bases em um só lugar.</div>
      </div>
      <nav class="menu-nav">
        <div class="menu-section-label">Equipamentos</div>
        <a class="menu-link ${isColhedora?'active':''}" href="colhedora.html">
          <span class="menu-icon">🚜</span><span class="menu-link-text">Colhedora<small>Análise de colheita</small></span>
        </a>
        <a class="menu-link ${isTratos?'active':''}" href="tratos.html">
          <span class="menu-icon">🌱</span><span class="menu-link-text">Tratos<small>Análise de tratos</small></span>
        </a>
        <div class="menu-disabled"><span class="menu-icon">🌾</span><span class="menu-link-text">Plantadora<small>Em desenvolvimento</small></span><span class="menu-tag">Em breve</span></div>
        <div class="menu-section-label" style="margin-top:10px">Dados compartilhados</div>
        <div class="menu-disabled"><span class="menu-icon">🗄️</span><span class="menu-link-text">Bases<small>Blocos, produtividade e chuva</small></span><span class="menu-tag">Em breve</span></div>
      </nav>
      <div class="menu-footer">As bases de blocos, produtividade e chuva serão compartilhadas entre os módulos de equipamentos.</div>
    </aside>`;
})();
function alternarMenuLateral(){
  const aberto=document.body.classList.toggle('menu-open');
  const b=document.getElementById('menuToggle');
  if(b){b.setAttribute('aria-expanded',String(aberto));b.setAttribute('aria-label',aberto?'Fechar menu':'Abrir menu');b.textContent=aberto?'×':'☰';}
}
function fecharMenuLateral(){
  document.body.classList.remove('menu-open');
  const b=document.getElementById('menuToggle');
  if(b){b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','Abrir menu');b.textContent='☰';}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharMenuLateral();});
