/* =========================================================
   REGISTROS · COMETAS XVII — app de administración
   ========================================================= */
(function () {
  'use strict';

  var M = window.MARCA || {};
  var LLAVE_PIN = 'cometas.admin.pin';

  var S = {
    pin: '',
    lista: [],
    categorias: [],
    resumen: { total: 0, inscritos: 0, activos: 0, ganadores: 0, porCategoria: {} },
    estado: 'TODOS',
    categoria: 'TODAS',
    texto: '',
    cfg: {}
  };

  /* ---------------- utilidades ---------------- */

  function $(id) { return document.getElementById(id); }
  function soloDigitos(v) { return String(v == null ? '' : v).replace(/\D+/g, ''); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Quita tildes y ñ para que el buscador encuentre igual con o sin ellas. */
  function plano(v) {
    return String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function valDocumento(v) {
    var d = soloDigitos(v);
    if (!d) return 'Escribe el número de documento.';
    if (d.length < 6 || d.length > 10) return 'El documento debe tener entre 6 y 10 dígitos.';
    return '';
  }
  function valWhatsapp(v) { return soloDigitos(v).length === 10 ? '' : 'El WhatsApp debe tener 10 dígitos.'; }

  function toast(txt) {
    var t = $('toast');
    t.textContent = txt; t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('ver'); });
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      t.classList.remove('ver'); setTimeout(function () { t.hidden = true; }, 300);
    }, 3000);
  }
  function cargando(btn, on) { if (!btn) return; btn.classList.toggle('cargando', !!on); btn.disabled = !!on; }

  /**
   * Filtra la lista por ESTADO (tarjetas de arriba), CATEGORIA (pastillas) y texto.
   * Los dos filtros se suman: "activos" + "cometa mas grande" = los activos de esa categoria.
   * Se prueba automaticamente.
   */
  function filtrar(lista, estado, categoria, texto) {
    var t = plano(texto).trim();
    var cat = (categoria === undefined || categoria === null || categoria === '') ? 'TODAS' : categoria;
    return lista.filter(function (r) {
      var pasaEstado =
        estado === 'TODOS' ? true :
        estado === 'GANADOR' ? r.ganador :
        r.estado === estado;
      if (!pasaEstado) return false;
      if (cat !== 'TODAS' && r.categoria !== cat) return false;
      if (!t) return true;
      return plano(r.nombres + ' ' + r.apellidos + ' ' + r.documento + ' ' + r.categoria + ' ' + r.whatsapp).indexOf(t) >= 0;
    });
  }

  /** Cuantos hay con ese estado y esa categoria (sin contar el buscador). */
  function contar(lista, estado, categoria) { return filtrar(lista, estado, categoria, '').length; }

  /* ---------------- servidor ---------------- */

  function api(action, datos) {
    var url = M.API_URL || '';
    if (!url || url.indexOf('PEGA_AQUI') === 0) {
      return Promise.reject(new Error('Falta pegar la URL del backend en marca.js'));
    }
    var cuerpo = Object.assign({ action: action, pin: S.pin }, datos || {});
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (r && r.pinInvalido) { salir(true); throw new Error('El PIN cambió. Vuelve a entrar.'); }
      return r;
    });
  }

  function cargar(btn) {
    cargando(btn, true);
    if (btn) btn.classList.add('girando');
    return api('admin.listar').then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || 'No pudimos traer los registros.');
      S.lista = r.lista || [];
      S.resumen = r.resumen || S.resumen;
      S.categorias = r.categorias || [];
      S.cfg = r.cfg || {};
      pintarTodo();
    }).catch(function (e) { toast(e.message); })
      .then(function () { cargando(btn, false); if (btn) btn.classList.remove('girando'); });
  }

  /* ---------------- pintado ---------------- */

  function pintarTodo() {
    if (S.cfg.EVENTO_NOMBRE) $('tituloEvento').textContent = S.cfg.EVENTO_NOMBRE;
    /* Los cuatro numeros de arriba responden a la categoria elegida. */
    $('nTotal').textContent     = contar(S.lista, 'TODOS', S.categoria);
    $('nInscritos').textContent = contar(S.lista, 'INSCRITO', S.categoria);
    $('nActivos').textContent   = contar(S.lista, 'ACTIVO', S.categoria);
    $('nGanadores').textContent = contar(S.lista, 'GANADOR', S.categoria);
    Array.prototype.forEach.call(document.querySelectorAll('.dato'), function (d) {
      d.classList.toggle('sel', d.dataset.filtro === S.estado);
    });
    pintarFiltros();
    pintarLista();
  }

  function pintarFiltros() {
    var cont = $('filtros');
    /* Las pastillas cuentan DENTRO del estado elegido arriba. */
    var cuentas = S.categorias.map(function (c) { return contar(S.lista, S.estado, c); });
    var firma = S.categorias.join('|') + '::' + S.estado + '::' + S.categoria + '::' + cuentas.join(',');
    if (cont.dataset.firma === firma) return;
    cont.dataset.firma = firma;
    cont.innerHTML = '';

    var todos = document.createElement('button');
    todos.className = 'filtro' + (S.categoria === 'TODAS' ? ' sel' : '');
    todos.innerHTML = 'Todas las categorías<em>' + contar(S.lista, S.estado, 'TODAS') + '</em>';
    todos.addEventListener('click', function () { S.categoria = 'TODAS'; pintarTodo(); });
    cont.appendChild(todos);

    S.categorias.forEach(function (c, i) {
      var n = cuentas[i];
      var b = document.createElement('button');
      b.className = 'filtro' + (S.categoria === c ? ' sel' : '') + (n ? '' : ' sinnada');
      var color = ['var(--coral)', 'var(--sol)', 'var(--agua)', 'var(--verde-2)', 'var(--lila)'][i % 5];
      b.innerHTML = '<i style="background:' + color + '"></i>' + esc(c) + '<em>' + n + '</em>';
      b.addEventListener('click', function () {
        S.categoria = (S.categoria === c) ? 'TODAS' : c;   // volver a tocarla la suelta
        pintarTodo();
      });
      cont.appendChild(b);
    });
  }

  function pintarLista() {
    var vista = filtrar(S.lista, S.estado, S.categoria, S.texto);
    var cont = $('lista');
    cont.innerHTML = '';
    var partes = [];
    if (S.estado !== 'TODOS') partes.push(S.estado === 'GANADOR' ? 'ganadores' : S.estado.toLowerCase() + 's');
    if (S.categoria !== 'TODAS') partes.push(S.categoria.toLowerCase());
    $('conteoVista').textContent = vista.length + (vista.length === 1 ? ' registro' : ' registros') +
      (partes.length ? ' · ' + partes.join(' · ') : '');
    $('vacio').hidden = vista.length > 0;
    if (!vista.length) {
      $('vacioTxt').textContent = S.texto ? 'Nadie coincide con esa búsqueda.' : 'Todavía no hay registros aquí.';
      return;
    }
    vista.forEach(function (r) { cont.appendChild(tarjeta(r)); });
  }

  function tarjeta(r) {
    var i = Math.max(0, S.categorias.indexOf(r.categoria));
    var d = document.createElement('article');
    d.className = 'tarjeta reg cat' + (i % 5);
    d.innerHTML =
      '<div class="reg-top">' +
        '<div>' +
          '<h3>' + esc(r.nombres + ' ' + r.apellidos) + '</h3>' +
          '<p class="meta">CC ' + esc(r.documento) + ' · <a class="wa" target="_blank" rel="noopener" href="https://wa.me/57' + esc(r.whatsapp) + '">' + esc(r.whatsapp) + '</a></p>' +
          '<p class="cat">' + esc(r.categoria) + '</p>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<span class="chip ' + (r.estado === 'ACTIVO' ? 'activo' : 'inscrito') + '">' + esc(r.estado) + '</span>' +
          (r.ganador ? '<span class="chip ganador">GANADOR</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="reg-btns"></div>';

    var btns = d.querySelector('.reg-btns');

    var bEstado = document.createElement('button');
    bEstado.className = 'btn ' + (r.estado === 'ACTIVO' ? 'btn-borde' : 'btn-primario');
    bEstado.textContent = r.estado === 'ACTIVO' ? 'Volver a inscrito' : 'Marcar activo';
    bEstado.addEventListener('click', function () { cambiarEstado(r, bEstado); });
    btns.appendChild(bEstado);

    if (r.estado === 'ACTIVO') {
      var bGan = document.createElement('button');
      bGan.className = 'btn ' + (r.ganador ? 'btn-borde' : 'btn-suave');
      bGan.textContent = r.ganador ? 'Quitar ganador' : 'Marcar ganador';
      bGan.addEventListener('click', function () { marcarGanador(r, bGan); });
      btns.appendChild(bGan);
    }
    return d;
  }

  /* ---------------- acciones ---------------- */

  function cambiarEstado(r, btn) {
    var nuevo = r.estado === 'ACTIVO' ? 'INSCRITO' : 'ACTIVO';
    cargando(btn, true);
    api('admin.estado', { documento: r.documento, estado: nuevo })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'No pudimos cambiar el estado.');
        toast(nuevo === 'ACTIVO' ? 'Participante activo' : 'Vuelve a estar inscrito');
        return cargar();
      })
      .catch(function (e) { toast(e.message); cargando(btn, false); });
  }

  function marcarGanador(r, btn) {
    cargando(btn, true);
    api('admin.ganador', { documento: r.documento, quitar: !!r.ganador })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'No pudimos marcar al ganador.');
        toast(r.ganador ? 'Ganador retirado' : ('¡Ganador de ' + r.categoria + '!'));
        return cargar();
      })
      .catch(function (e) { toast(e.message); cargando(btn, false); });
  }

  /* ---------------- modal ---------------- */

  function abrirModal(titulo, html) {
    $('modalTitulo').textContent = titulo;
    $('modalCuerpo').innerHTML = html;
    $('modal').hidden = false;
  }
  function cerrarModal() { $('modal').hidden = true; $('modalCuerpo').innerHTML = ''; }

  /* --- registrar el día del evento --- */

  function nuevoRegistro() {
    abrirModal('Registrar el día del evento',
      '<p class="aviso">Primero validamos el documento. Si ya está inscrito, solo lo activamos.</p>' +
      '<label class="campo"><span class="etq">Documento</span>' +
      '<input id="nDoc" inputmode="numeric" maxlength="10" placeholder="Documento del adulto responsable"></label>' +
      '<p class="error" id="nErr" hidden></p>' +
      '<button class="btn btn-primario" id="nSeguir">Validar documento</button>');

    $('nDoc').focus();
    $('nDoc').addEventListener('input', function () { this.value = soloDigitos(this.value).slice(0, 10); });
    $('nDoc').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('nSeguir').click(); });
    $('nSeguir').addEventListener('click', function () {
      var btn = this;
      var doc = soloDigitos($('nDoc').value);
      var err = valDocumento(doc);
      if (err) { $('nErr').textContent = err; $('nErr').hidden = false; return; }
      $('nErr').hidden = true;
      cargando(btn, true);

      api('consultarDocumento', { documento: doc }).then(function (r) {
        cargando(btn, false);
        if (!r || !r.ok) throw new Error((r && r.error) || 'No pudimos consultar.');
        if (r.existe) return yaExiste(r.registro);
        formularioNuevo(doc);
      }).catch(function (e) { cargando(btn, false); $('nErr').textContent = e.message; $('nErr').hidden = false; });
    });
  }

  function yaExiste(reg) {
    var activo = reg.estado === 'ACTIVO';
    abrirModal('Ese documento ya está registrado',
      '<p class="aviso"><b>' + esc(reg.nombres + ' ' + reg.apellidos) + '</b><br>' +
      esc(reg.categoria) + ' · estado ' + esc(reg.estado) + '</p>' +
      (activo ? '<p class="aviso">Ya está activo, no hay que hacer nada más.</p>'
              : '<button class="btn btn-primario" id="yActivar">Marcarlo activo</button>'));
    if (!activo) {
      $('yActivar').addEventListener('click', function () {
        var b = this; cargando(b, true);
        api('admin.estado', { documento: reg.documento, estado: 'ACTIVO' }).then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || 'No pudimos activarlo.');
          cerrarModal(); toast('Participante activo'); return cargar();
        }).catch(function (e) { cargando(b, false); toast(e.message); });
      });
    }
  }

  function formularioNuevo(doc) {
    var ops = S.categorias.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
    abrirModal('Nuevo participante',
      '<p class="aviso">Documento <b>' + esc(doc) + '</b> · quedará <b>ACTIVO</b>.</p>' +
      '<label class="campo"><span class="etq">Nombres</span><input id="fNom" maxlength="60" placeholder="Nombres del adulto responsable"></label>' +
      '<label class="campo"><span class="etq">Apellidos</span><input id="fApe" maxlength="60" placeholder="Apellidos del adulto responsable"></label>' +
      '<label class="campo"><span class="etq">WhatsApp</span><input id="fWa" inputmode="numeric" maxlength="10" placeholder="3001234567"></label>' +
      '<label class="campo"><span class="etq">Categoría</span><select id="fCat"><option value="">Selecciona una categoría</option>' + ops + '</select></label>' +
      '<p class="error" id="fErr" hidden></p>' +
      '<button class="btn btn-primario" id="fGuardar">Guardar y activar</button>');

    $('fNom').focus();
    $('fWa').addEventListener('input', function () { this.value = soloDigitos(this.value).slice(0, 10); });
    $('fGuardar').addEventListener('click', function () {
      var btn = this;
      var datos = {
        documento: doc,
        nombres: $('fNom').value.trim(),
        apellidos: $('fApe').value.trim(),
        whatsapp: soloDigitos($('fWa').value),
        categoria: $('fCat').value
      };
      var err = '';
      if (datos.nombres.length < 2) err = 'Escribe los nombres.';
      else if (datos.apellidos.length < 2) err = 'Escribe los apellidos.';
      else if (valWhatsapp(datos.whatsapp)) err = valWhatsapp(datos.whatsapp);
      else if (!datos.categoria) err = 'Selecciona una categoría.';
      if (err) { $('fErr').textContent = err; $('fErr').hidden = false; return; }
      $('fErr').hidden = true;
      cargando(btn, true);
      api('admin.crear', datos).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'No pudimos guardar.');
        cerrarModal(); toast('Participante registrado y activo'); return cargar();
      }).catch(function (e) { cargando(btn, false); $('fErr').textContent = e.message; $('fErr').hidden = false; });
    });
  }

  /* ---------------- PDF ---------------- */

  function menuPdf() {
    abrirModal('Descargar PDF',
      '<div class="opciones">' +
      '<button class="opcion" data-tipo="INSCRITO">Inscritos <b id="pInscritos"></b></button>' +
      '<button class="opcion" data-tipo="ACTIVO">Activos <b id="pActivos"></b></button>' +
      '<button class="opcion" data-tipo="GANADOR">Ganadores por categoría <b id="pGanadores"></b></button>' +
      '<button class="opcion" data-tipo="TODOS">Listado completo <b id="pTodos"></b></button>' +
      '</div>');
    $('pInscritos').textContent = S.resumen.inscritos || 0;
    $('pActivos').textContent = S.resumen.activos || 0;
    $('pGanadores').textContent = S.resumen.ganadores || 0;
    $('pTodos').textContent = S.resumen.total || 0;
    Array.prototype.forEach.call($('modalCuerpo').querySelectorAll('.opcion'), function (b) {
      b.addEventListener('click', function () { generarPdf(b.dataset.tipo); });
    });
  }

  var TITULOS = {
    INSCRITO: 'Participantes inscritos',
    ACTIVO: 'Participantes activos',
    GANADOR: 'Ganadores por categoría',
    TODOS: 'Listado completo de participantes'
  };

  /** Arma las filas de la tabla del PDF. Se prueba automáticamente. */
  function filasPdf(lista, tipo) {
    return filtrar(lista, tipo, 'TODAS', '').map(function (r, i) {
      return [String(i + 1), r.documento, (r.nombres + ' ' + r.apellidos).trim(), r.whatsapp,
              r.categoria, r.estado + (r.ganador ? ' · GANADOR' : '')];
    });
  }

  function generarPdf(tipo) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('Conéctate a internet para armar el PDF'); return; }
    var filas = filasPdf(S.lista, tipo);
    if (!filas.length) { toast('No hay registros para ese PDF'); return; }

    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var W = doc.internal.pageSize.getWidth();
    var verde = [2, 90, 47];

    /* Encabezado con una cometa dibujada, no una imagen pesada */
    doc.setFillColor(verde[0], verde[1], verde[2]);
    doc.rect(0, 0, W, 96, 'F');
    doc.setFillColor(245, 185, 46); doc.triangle(46, 30, 70, 48, 46, 66, 'F');
    doc.setFillColor(242, 104, 92); doc.triangle(46, 30, 22, 48, 46, 66, 'F');
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(1);
    doc.line(46, 24, 46, 72); doc.line(20, 48, 72, 48);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(String(S.cfg.EVENTO_NOMBRE || M.EVENTO_NOMBRE || 'FESTIVAL DE COMETAS'), 92, 42, { maxWidth: W - 130 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(TITULOS[tipo] || 'Participantes', 92, 62);
    doc.setFontSize(8);
    doc.text('Generado el ' + new Date().toLocaleString('es-CO'), 92, 78);

    doc.setTextColor(75, 97, 87); doc.setFontSize(9);
    doc.text((S.cfg.EVENTO_LUGAR || M.EVENTO_LUGAR || '') + '  ·  ' + filas.length + ' registro(s)', 46, 118);

    doc.autoTable({
      startY: 132,
      head: [['#', 'Documento', 'Adulto responsable', 'WhatsApp', 'Categoría', 'Estado']],
      body: filas,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: [18, 51, 38], lineColor: [221, 231, 225], lineWidth: .5 },
      headStyles: { fillColor: verde, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [242, 249, 245] },
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 72 }, 3: { cellWidth: 70 }, 5: { cellWidth: 86 } },
      margin: { left: 40, right: 40 },
      didDrawPage: function (d) {
        var p = doc.internal.getNumberOfPages();
        doc.setFontSize(8); doc.setTextColor(120, 135, 128);
        doc.text('Alcaldía de Flandes · Secretaría de Educación, Desarrollo Económico y Social',
                 40, doc.internal.pageSize.getHeight() - 24);
        doc.text('Página ' + p, W - 40, doc.internal.pageSize.getHeight() - 24, { align: 'right' });
        void d;
      }
    });

    var nombre = 'cometas-' + tipo.toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    doc.save(nombre);
    cerrarModal();
    toast('PDF descargado');
  }

  /* ---------------- puerta ---------------- */

  function entrar() {
    var btn = $('btnEntrar');
    var pin = soloDigitos($('inPin').value);
    if (!pin) { $('errPin').textContent = 'Escribe el PIN.'; $('errPin').hidden = false; return; }
    $('errPin').hidden = true;
    cargando(btn, true);
    S.pin = pin;
    api('admin.login', { pin: pin }).then(function (r) {
      cargando(btn, false);
      if (!r || !r.ok || !r.pin) {
        S.pin = '';
        $('errPin').textContent = 'PIN incorrecto.'; $('errPin').hidden = false;
        return;
      }
      try { localStorage.setItem(LLAVE_PIN, pin); } catch (e) {}
      abrirApp();
    }).catch(function (e) {
      cargando(btn, false); S.pin = '';
      $('errPin').textContent = e.message; $('errPin').hidden = false;
    });
  }

  function abrirApp() {
    $('puerta').hidden = true;
    $('app').hidden = false;
    cargar($('btnRefrescar'));
  }

  function salir(silencioso) {
    S.pin = '';
    try { localStorage.removeItem(LLAVE_PIN); } catch (e) {}
    $('app').hidden = true;
    $('puerta').hidden = false;
    $('inPin').value = '';
    if (!silencioso) toast('Sesión cerrada');
  }

  /* ---------------- versión: que todos vean los cambios ----------------
     version.js es el único archivo que se toca al publicar. La app pregunta
     por él cada tanto; si el número cambió, borra SU caché y se recarga sola. */

  var V = self.APP_VERSION || '';
  var TENIA_SW = false;
  var MARCA_CACHE = 'cometas-adm-';

  function recargar() {
    if (recargar._ya) return;
    recargar._ya = true;
    try { location.reload(); } catch (e) {}
  }

  /** Borra SOLO los cachés de esta app (el dominio lo comparten otras apps). */
  function limpiarCache() {
    if (!window.caches || !caches.keys) return Promise.resolve();
    return caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf(MARCA_CACHE) === 0; })
                           .map(function (k) { return caches.delete(k); }));
    }).catch(function () {});
  }

  function actualizarApp() {
    if (actualizarApp._ya) return;
    if (!$('modal').hidden) return;        // no interrumpir un registro a medio llenar
    actualizarApp._ya = true;
    toast('Hay una versión nueva · actualizando…');
    var tareas = [limpiarCache()];
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
      tareas.push(navigator.serviceWorker.getRegistration()
        .then(function (reg) { return reg && reg.update(); }).catch(function () {}));
    }
    Promise.all(tareas).catch(function () {}).then(function () { setTimeout(recargar, 1200); });
  }

  /** Lee version.js de la red (sin caché) y compara. Se prueba automáticamente. */
  function versionDeTexto(txt) {
    var m = String(txt || '').match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    return m ? m[1] : '';
  }

  function comprobarVersion() {
    if (!V || !window.fetch) return Promise.resolve('');
    return fetch('version.js?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var nueva = versionDeTexto(txt);
        if (nueva && nueva !== V) actualizarApp();
        return nueva;
      }).catch(function () { return ''; });
  }

  function vigilarVersion() {
    setTimeout(comprobarVersion, 4000);                 // al abrir
    setInterval(comprobarVersion, 5 * 60 * 1000);       // cada 5 minutos
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) comprobarVersion();         // al volver a la app
    });
  }

  /* ---------------- arranque ---------------- */

  function arrancar() {
    if (M.EVENTO_NOMBRE) $('tituloEvento').textContent = M.EVENTO_NOMBRE;

    $('btnEntrar').addEventListener('click', entrar);
    $('inPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrar(); });
    $('btnRefrescar').addEventListener('click', function () { cargar(this); });
    $('btnSalir').addEventListener('click', function () { salir(false); });
    $('btnNuevo').addEventListener('click', nuevoRegistro);
    $('btnPdf').addEventListener('click', menuPdf);
    $('modalX').addEventListener('click', cerrarModal);
    $('modal').addEventListener('click', function (e) { if (e.target === this) cerrarModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('modal').hidden) cerrarModal(); });
    $('inBuscar').addEventListener('input', function () { S.texto = this.value; pintarLista(); });
    Array.prototype.forEach.call(document.querySelectorAll('.dato'), function (d) {
      d.addEventListener('click', function () {
        S.estado = (S.estado === d.dataset.filtro) ? 'TODOS' : d.dataset.filtro;
        pintarTodo();
      });
    });

    var guardado = '';
    try { guardado = localStorage.getItem(LLAVE_PIN) || ''; } catch (e) {}

    setTimeout(function () {
      $('loader').style.display = 'none';
      if (guardado) { S.pin = guardado; abrirApp(); }
      else { $('puerta').hidden = false; $('inPin').focus(); }
    }, 800);

    $('verApp').textContent = V ? 'v ' + V : '';

    if ('serviceWorker' in navigator) {
      TENIA_SW = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(function () {});
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (TENIA_SW) recargar();          // ya había versión instalada: entró una nueva
      });
    }
    vigilarVersion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* Se exponen para las pruebas automáticas */
  window.ADM = { filtrar: filtrar, contar: contar, versionDeTexto: versionDeTexto,
                 comprobarVersion: comprobarVersion, limpiarCache: limpiarCache, V: V, filasPdf: filasPdf, plano: plano, valDocumento: valDocumento,
                 valWhatsapp: valWhatsapp, soloDigitos: soloDigitos, S: S };
})();
