(function () {
  const mount = document.getElementById('appSidebarMount');

  if (!mount) return;

  const path = location.pathname.toLowerCase();

  const isTratos = path.includes('tratos');
  const isPlantadora = path.includes('plantadora');
  const isBases = path.includes('bases');

  const isColhedora =
    path.includes('colhedora') ||
    (!isTratos && !isPlantadora && !isBases);

  mount.innerHTML = `
    <button
      class="menu-toggle"
      id="menuToggle"
      type="button"
      aria-label="Recolher menu"
      aria-expanded="true"
      onclick="alternarMenuLateral()"
    >
      <i data-lucide="panel-left-close"></i>
    </button>

    <aside
      class="app-sidebar"
      id="appSidebar"
      aria-label="Menu principal"
    >

      <!-- MARCA -->
      <div class="menu-brand">

        <div class="menu-brand-mark">
          <i data-lucide="sprout"></i>
        </div>

        <div class="menu-brand-copy">
          <div class="menu-brand-kicker">
            AGROVISION
          </div>

          <div class="menu-brand-title">
            Intelligence
          </div>
        </div>

      </div>

      <div class="menu-brand-sub">
        Telemetria agrícola, ocorrências, mapas e bases em um só lugar.
      </div>


      <!-- NAVEGAÇÃO -->
      <nav class="menu-nav">

        <div class="menu-section-label">
          Equipamentos
        </div>


        <!-- COLHEDORA -->
        <a
          class="menu-link ${isColhedora ? 'active' : ''}"
          href="colhedora.html"
          title="Colhedora"
        >
          <span class="menu-icon">
            <i data-lucide="tractor"></i>
          </span>

          <span class="menu-link-text">
            Colhedora
            <small>Análise de colheita</small>
          </span>
        </a>


        <!-- TRATOS -->
        <a
          class="menu-link ${isTratos ? 'active' : ''}"
          href="tratos.html"
          title="Tratos"
        >
          <span class="menu-icon">
            <i data-lucide="sprout"></i>
          </span>

          <span class="menu-link-text">
            Tratos
            <small>Análise de tratos</small>
          </span>
        </a>


        <!-- PLANTADORA -->
                <a
          class="menu-link ${isPlantadora ? 'active' : ''}"
          href="plantadora.html"
          title="Plantadora"
        >
          <span class="menu-icon">
            <i data-lucide="wheat"></i>
          </span>

          <span class="menu-link-text">
            Plantadora
            <small>Análise de plantio</small>
          </span>
        </a>


        <!-- DADOS -->
        <div class="menu-section-label menu-section-spaced">
          Dados compartilhados
        </div>


        <!-- BASES -->
        <a
          class="menu-link ${isBases ? 'active' : ''}"
          href="bases.html"
          title="Bases"
        >
          <span class="menu-icon">
            <i data-lucide="database"></i>
          </span>

          <span class="menu-link-text">
            Bases
            <small>Blocos, produtividade e chuva</small>
          </span>
        </a>

      </nav>


      <!-- FOOTER -->
      <div class="menu-footer">

        <div class="menu-footer-icon">
          <i data-lucide="layers-3"></i>
        </div>

        <div class="menu-footer-copy">
          <strong>Dados integrados</strong>

          <span>
            As bases compartilhadas alimentam os módulos de equipamentos.
          </span>
        </div>

      </div>

    </aside>
  `;

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Recupera o estado salvo do menu
  const menuFechado =
    localStorage.getItem('agrovision_menu_fechado') === 'true';

  if (menuFechado) {
    fecharMenuLateral(false);
  }

})();


/**
 * Alterna entre menu aberto e menu recolhido
 */
function alternarMenuLateral() {

  const fechado =
    document.body.classList.toggle('menu-collapsed');

  const botao =
    document.getElementById('menuToggle');

  if (!botao) return;

  botao.setAttribute(
    'aria-expanded',
    String(!fechado)
  );

  botao.setAttribute(
    'aria-label',
    fechado
      ? 'Expandir menu'
      : 'Recolher menu'
  );

  botao.innerHTML = `
    <i data-lucide="${fechado ? 'panel-left-open' : 'panel-left-close'}"></i>
  `;

  localStorage.setItem(
    'agrovision_menu_fechado',
    String(fechado)
  );

  if (window.lucide) {
    window.lucide.createIcons();
  }
}


/**
 * Fecha/recolhe o menu
 *
 * salvar = true
 * Mantém a preferência do usuário.
 */
function fecharMenuLateral(salvar = true) {

  document.body.classList.add('menu-collapsed');

  const botao =
    document.getElementById('menuToggle');

  if (botao) {

    botao.setAttribute(
      'aria-expanded',
      'false'
    );

    botao.setAttribute(
      'aria-label',
      'Expandir menu'
    );

    botao.innerHTML = `
      <i data-lucide="panel-left-open"></i>
    `;

  }

  if (salvar) {

    localStorage.setItem(
      'agrovision_menu_fechado',
      'true'
    );

  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}


/**
 * Abre/expande o menu
 */
function abrirMenuLateral() {

  document.body.classList.remove(
    'menu-collapsed'
  );

  const botao =
    document.getElementById('menuToggle');

  if (botao) {

    botao.setAttribute(
      'aria-expanded',
      'true'
    );

    botao.setAttribute(
      'aria-label',
      'Recolher menu'
    );

    botao.innerHTML = `
      <i data-lucide="panel-left-close"></i>
    `;

  }

  localStorage.setItem(
    'agrovision_menu_fechado',
    'false'
  );

  if (window.lucide) {
    window.lucide.createIcons();
  }
}


/**
 * ESC
 */
document.addEventListener(
  'keydown',
  function (e) {

    if (e.key === 'Escape') {
      fecharMenuLateral();
    }

  }
);