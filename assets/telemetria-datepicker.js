(function () {
  'use strict';

  /**
   * Inicializa o seletor de intervalo de datas (Flatpickr com rangePlugin)
   * em português, com máscara DD/MM/AAAA, visualização colorida dos dias
   * selecionados e impedindo selecionar data final anterior à data inicial.
   */
  function criarRangePicker(cfg) {
    const {
      inputInicioId,
      inputFimId,
      btnInicioId,
      btnFimId,
      minDate,
      maxDate,
      defaultDates,
      onChange,
      onClose
    } = cfg;

    const elInicio = typeof inputInicioId === 'string' ? document.getElementById(inputInicioId) : inputInicioId;
    const elFim = typeof inputFimId === 'string' ? document.getElementById(inputFimId) : inputFimId;
    if (!elInicio || !elFim) return null;

    if (typeof flatpickr === 'undefined' || typeof rangePlugin === 'undefined') {
      console.warn('Flatpickr ou rangePlugin não estão disponíveis.');
      return null;
    }

    const options = {
      locale: (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.pt) ? window.flatpickr.l10ns.pt : 'pt',
      dateFormat: 'd/m/Y',
      allowInput: true,
      monthSelectorType: 'static',
      plugins: [new rangePlugin({ input: elFim })],
      onChange: function (selectedDates, dateStr, instance) {
        if (typeof onChange === 'function') {
          onChange(selectedDates, dateStr, instance);
        }
      },
      onClose: function (selectedDates, dateStr, instance) {
        if (typeof onClose === 'function') {
          onClose(selectedDates, dateStr, instance);
        }
      }
    };

    if (minDate) options.minDate = minDate;
    if (maxDate) options.maxDate = maxDate;
    if (defaultDates && defaultDates.length) options.defaultDate = defaultDates;

    const fp = flatpickr(elInicio, options);

    const btnIni = btnInicioId ? document.getElementById(btnInicioId) : null;
    const btnF = btnFimId ? document.getElementById(btnFimId) : null;

    if (btnIni) {
      btnIni.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fp.open();
      });
    }

    if (btnF) {
      btnF.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fp.open();
      });
    }

    return fp;
  }

  window.telemetriaDatePicker = {
    criarRangePicker
  };
})();

