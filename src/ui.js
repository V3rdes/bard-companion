const BardUI = (() => {
  'use strict';

  const { CATALOG, bardSpellListUrl, spellSource, diceGuide } = SpellCatalog;
  const { totalSlots, remainingSlots, pendingSpells, formatDice } = BardRules;
  const byId = id => document.getElementById(id);
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => escapes[char]);
  const levels = [0, ...Party.spellLevels];

  function toast(message) {
    byId('toast')?.remove();
    const notice = document.createElement('div');
    notice.id = 'toast';
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 3200);
  }

  function showStorageWarning(message) {
    const warning = byId('storage-warning');
    warning.textContent = message;
    warning.classList.toggle('hidden', !message);
  }

  function download(json, prefix) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = prefix + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function closeModal() {
    byId('modal-root').innerHTML = '';
  }

  function modal(html, label = 'Detalle del conjuro') {
    byId('modal-root').innerHTML = `<div class="backdrop" id="backdrop"><section role="dialog" aria-modal="true" aria-label="${esc(label)}" class="modal">${html}</section></div>`;
    const backdrop = byId('backdrop');
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) closeModal();
    });
    backdrop.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeModal));
  }

  function mount(repository, { campaignState } = {}) {
    const combatView = CombatView.create({ modal, esc });
    const partyView = PartyView.create({ modal, esc, combatResult: combatView.result });
    const levelView = LevelView.create({ modal, esc });
    let state;
    let filter = 'all';
    let query = '';
    let importingAsNew = false;
    const shared = campaignState !== undefined;
    let writing = false;
    let unsaved = false;

    try {
      state = campaignState ?? repository.load() ?? SaveState.fresh();
    } catch {
      state = SaveState.fresh();
      showStorageWarning('No se pudo abrir el guardado local. Esta ficha es temporal. Podés restaurar un respaldo JSON.');
    }

    const character = () => SaveState.activeCharacter(state);
    const canCast = spell => spell.l === 0 || remainingSlots(character(), spell.l) > 0;

    function updateLegacyWarning() {
      try {
        byId('legacy-warning').classList.toggle('hidden', (repository.pendingLegacy?.() ?? null) === null);
      } catch {
        byId('legacy-warning').classList.add('hidden');
      }
    }

    function setWriting(busy) {
      if (!shared) return;
      writing = busy;
      byId('app-workspace').inert = busy;
      byId('modal-root').inert = busy;
      byId('app-workspace').setAttribute('aria-busy', String(busy));
    }

    function setUnsaved(value) {
      if (!shared) return;
      unsaved = value;
      byId('retry-campaign').classList.toggle('hidden', !value);
    }

    async function save(message, candidate = state, recoveredLegacy) {
      setWriting(true);
      try {
        const result = repository.save(candidate, recoveredLegacy);
        if (shared ? await result : result) {
          setUnsaved(false);
          showStorageWarning('');
          if (message) toast(message);
          return true;
        }
        showStorageWarning(shared
          ? 'Otro dispositivo cambió estas fichas. Exportá tus cambios y actualizá las fichas.'
          : 'El guardado local cambió o no se pudo abrir. Exportá la ficha antes de recargar.');
      } catch {
        showStorageWarning(shared
          ? 'No se pudo guardar en la campaña. Podés reintentar o exportar un respaldo.'
          : 'No se pudo guardar localmente. Exportá un respaldo.');
      } finally {
        setWriting(false);
        updateLegacyWarning();
      }
      if (candidate === state) setUnsaved(true);
      return false;
    }

    function setSpent(level, delta, message) {
      SaveState.changeSpent(character(), level, delta);
      save(message);
      render();
    }

    function cast(id) {
      const spell = character().spells.find(item => item.id === id);
      if (!spell) return;
      if (spell.l === 0) {
        toast('Truco: no consume espacios');
        return;
      }
      if (!canCast(spell)) {
        toast('No quedan espacios de nivel ' + spell.l);
        return;
      }
      setSpent(spell.l, 1, `Lanzaste ${spell.name} · nivel ${spell.l} −1 espacio`);
    }

    function render() {
      const c = character();
      const selector = byId('character-select');
      selector.innerHTML = state.characters.filter(item => !item.archived)
        .map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
      if (!c) selector.innerHTML = '<option>Sin personaje activo</option>';
      else selector.value = c.id;
      selector.disabled = !c;
      byId('character-content').classList.toggle('hidden', !c);
      byId('empty-party').classList.toggle('hidden', Boolean(c));
      if (!c) {
        byId('hero-subtitle').textContent = '';
        return;
      }
      const slotLevels = Party.spellLevels.filter(level => totalSlots(c, level) > 0 || c.spent[level] > 0);
      const effectiveCharisma = CombatRules.sheet(c).scores.cha.total;
      byId('hero-subtitle').textContent = `${c.name} · Nivel ${c.level} · Carisma ${effectiveCharisma}`;
      byId('summary-level').textContent = c.level;
      byId('summary-class').textContent = [c.className, c.ancestry].filter(Boolean).join(' · ');
      byId('summary-known').textContent = c.spells.length;
      byId('summary-cha').textContent = effectiveCharisma;
      byId('summary-left').textContent = slotLevels.reduce((sum, level) => sum + remainingSlots(c, level), 0);
      const restDate = c.lastRest ? new Date(c.lastRest) : null;
      byId('last-rest').textContent = restDate && !Number.isNaN(restDate.valueOf())
        ? 'Último descanso · ' + restDate.toLocaleString('es-AR')
        : 'Último descanso sin registrar';

      const missing = [];
      for (const level of levels) {
        const count = pendingSpells(c, level);
        if (count) missing.push(`Nivel ${level}: ${count} por elegir`);
      }
      const q = query.trim().toLowerCase();
      const items = c.spells
        .filter(spell => (filter === 'all' || String(spell.l) === filter) &&
          (!q || [spell.name, spell.es, spell.school, spell.desc].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => a.l - b.l || a.name.localeCompare(b.name));

      byId('slot-grid').innerHTML = slotLevels.map(level => {
        const total = totalSlots(c, level);
        const remaining = remainingSlots(c, level);
        const pips = Array.from({ length: total }, (_, i) => `<span class="pip ${i < remaining ? 'on' : ''}"></span>`);
        return `<article class="slot">
          <div class="smalllabel">Nivel ${level}</div>
          <div class="metric">${remaining}<em> / ${total}</em></div>
          <div class="pips">${pips.join('')}</div>
          <div class="slot-actions">
            <button class="btn sm" data-restore="${level}" ${c.spent[level] > 0 ? '' : 'disabled'}>＋ recuperar</button>
            <button class="btn sm primary" data-spend="${level}" ${remaining === 0 ? 'disabled' : ''}>− usar</button>
          </div>
        </article>`;
      }).join('');

      const reminder = byId('level-reminder');
      reminder.classList.toggle('hidden', !missing.length);
      reminder.innerHTML = `<div><strong>📜 Conjuros pendientes</strong><div class="muted">${missing.join(' · ')}</div></div>
        <button class="btn sm" data-openadd="true">Agregar ahora</button>`;

      const visible = levels.filter(level => level === 0 || slotLevels.includes(level) || c.spells.some(spell => spell.l === level));
      byId('filters').innerHTML = ['all', ...visible].map(level =>
        `<button class="filter ${filter === String(level) ? 'active' : ''}" data-filter="${level}">${level === 'all' ? 'Todos' : 'Nivel ' + level}</button>`
      ).join('');

      byId('spell-list').innerHTML = items.length
        ? items.map(s => `<article class="spell">
          <div>
            <h3>${esc(s.name)} <span class="level-badge">${s.l === 0 ? 'Truco' : 'N' + s.l}</span></h3>
            <small>${esc(s.es || s.name)} · ${esc(s.school || 'Sin escuela')}</small>
            <div class="spell-summary">${esc((s.desc || 'Abrí su ficha para ver la descripción').slice(0, 155))}${(s.desc || '').length > 155 ? '…' : ''}</div>
          </div>
          <div class="spell-actions">
            <button class="btn sm" data-detail="${esc(s.id)}">Detalles</button>
            <button class="btn sm primary" data-cast="${esc(s.id)}" ${canCast(s) ? '' : 'disabled'}>${s.l === 0 ? 'Usar' : 'Lanzar'}</button>
          </div>
        </article>`).join('')
        : '<div class="empty">No hay conjuros en esta vista. Probá otro filtro o agregá uno nuevo.</div>';
    }

    function detail(id) {
      const c = character();
      const s = c.spells.find(spell => spell.id === id);
      if (!s) return;
      const dc = CombatRules.spellDC(c, s);
      modal(`<button data-close class="btn sm close" aria-label="Cerrar">✕</button>
        <div class="eyebrow">CONJURO DE NIVEL ${s.l}</div>
        <h2>${esc(s.name)}</h2>
        <p class="muted">${esc(s.es||'')} · ${esc(s.school||'Sin escuela especificada')}</p>
        <div class="detail-grid"><div class="detail-cell"><b>Lanzamiento</b>${esc(s.cast||'Consultar reglas')}</div><div class="detail-cell"><b>Componentes</b>${esc(s.components||'Consultar reglas')}</div><div class="detail-cell"><b>Alcance</b>${esc(s.range||'Consultar reglas')}</div><div class="detail-cell"><b>Duración</b>${esc(s.duration||'Consultar reglas')}</div><div class="detail-cell"><b>Salvación</b>${esc(s.save||'Consultar reglas')}</div><div class="detail-cell">${dc ? combatView.result('CD de salvación', dc) : '<b>CD de salvación</b>—'}</div></div>
        <h3>Dados y progresión</h3>
        <div class="info-panel">${esc(formatDice(c, diceGuide(s)))}</div>
        <h3>Cómo funciona</h3>
        <div class="rule-text">${esc(s.desc||'Aún no se añadió una explicación. Podés editar el conjuro e incorporarla.')}</div>${s.tip?`<div class="info-panel"><b>Consejo para tu bardo</b><div>${esc(s.tip)}</div></div>`:''}<p class="muted" style="font-size:12px">Resumen explicativo propio. Para matices y excepciones, consultá la ficha enlazada de d20PFSRD.</p>
        <div class="detail-foot"><a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(spellSource(s))}">Ver fuente de referencia ↗</a>
        <button class="btn" id="edit-spell">Editar</button>
        <button class="btn primary" id="cast-detail" ${canCast(s)?'':'disabled'}>${s.l===0?'Usar truco':'Lanzar · consume nivel '+s.l}</button></div>`);
      byId('edit-spell').onclick = () => addModal(s.id);
      byId('cast-detail').onclick = () => {
        cast(s.id);
        detail(s.id);
      };
    }

    function addModal(editId) {
      const c = character();
      const editing = c.spells.find(spell => spell.id === editId);
      let apiSelected = editing?.sourceSite === 'API Pathfinder 1e' ? editing : null;
      let apiResults = [];
      const catalogCandidates = CATALOG.filter(entry => !c.spells.some(spell =>
        spell.name.toLowerCase() === entry.name.toLowerCase() && spell.l === entry.l));
      let html = `<button data-close class="btn sm close">✕</button><div class="eyebrow">${editing?'EDITAR CONJURO':'NUEVA INCORPORACIÓN'}</div><h2>${editing?'Editar conjuro':'Agregar conjuro'}</h2><p class="muted">La selección rápida es breve. Para consultar todos los conjuros de bardo, abrí el listado completo de <a href="${bardSpellListUrl}" target="_blank" rel="noopener noreferrer">d20PFSRD</a>; después cargá el nombre aquí. Solo afecta al personaje actual.</p>`;
      if (!editing) html += `<div class="field"><label for="catalog-spell">Selección rápida (muestra)</label><select id="catalog-spell"><option value="">— Personalizado / elegir —</option>${catalogCandidates.map(s=>`<option value="${esc(s.id)}">Nivel ${s.l} · ${esc(s.name)}</option>`).join('')}</select></div>`;
      if (!editing) html += `<div class="field"><label for="api-spell-query">Buscar en catálogo Pathfinder 1e</label><div class="row"><input id="api-spell-query" maxlength="100" placeholder="Nombre del conjuro"><button type="button" class="btn sm" id="api-spell-search">Buscar</button></div><div id="api-spell-results" class="sheet-list"></div></div>`;
      html += `<form id="spell-form">
        <div class="two">
        <div class="field">
        <label for="spell-name">Nombre del conjuro</label>
        <input required maxlength="100" id="spell-name" value="${esc(editing?.name||'')}" placeholder="Haste" /></div>
        <div class="field">
        <label for="spell-level">Nivel del conjuro</label>
        <select id="spell-level">${levels.map(l=>`<option value="${l}" ${editing?.l===l?'selected':''}>${l}</option>`).join('')}</select></div></div>
        <div class="two">
        <div class="field">
        <label for="spell-es">Nombre en español</label>
        <input id="spell-es" value="${esc(editing?.es||'')}" /></div>
        <div class="field">
        <label for="spell-school">Escuela</label>
        <select id="spell-school">${['Sin especificar','Abjuración','Adivinación','Conjuración','Encantamiento','Evocación','Ilusión','Nigromancia','Transmutación'].map(v=>`<option ${editing?.school===v?'selected':''}>${v}</option>`).join('')}</select></div></div>
        <div class="two">
        <div class="field">
        <label for="spell-cast">Tiempo de lanzamiento</label>
        <input id="spell-cast" value="${esc(editing?.cast||'')}" /></div>
        <div class="field">
        <label for="spell-range">Alcance</label>
        <input id="spell-range" value="${esc(editing?.range||'')}" /></div></div>
        <div class="two">
        <div class="field">
        <label for="spell-duration">Duración</label>
        <input id="spell-duration" value="${esc(editing?.duration||'')}" /></div>
        <div class="field">
        <label for="spell-save">Salvación</label>
        <input id="spell-save" value="${esc(editing?.save||'Ninguna')}" /></div></div>
        <div class="field">
        <label for="spell-dice">Dados y progresión</label>
        <textarea id="spell-dice" placeholder="Ej.: 1d6 por nivel (máximo 5d6); Fortaleza 1d20 + bonificador vs CD…">${esc(editing ? diceGuide(editing) : '')}</textarea></div>
        <div class="field">
        <label for="spell-desc">Explicación / reglas de funcionamiento</label>
        <textarea id="spell-desc" placeholder="Cómo funciona, qué tiradas se hacen y qué excepciones hay…">${esc(editing?.desc||'')}</textarea></div>
        <div class="field">
        <label for="spell-tip">Notas o estrategia</label>
        <textarea id="spell-tip" style="min-height:55px">${esc(editing?.tip||'')}</textarea></div>
        <div class="field">
        <label for="spell-source">URL de referencia (opcional)</label>
        <input id="spell-source" type="url" value="${esc(editing ? spellSource(editing) : '')}" placeholder="https://www.d20pfsrd.com/…" /></div>
        <div class="detail-foot">
        <button class="btn primary" type="submit">${editing?'Guardar cambios':'Agregar al grimorio'}</button>${editing?'<button class="btn bad" type="button" id="delete-spell">Eliminar</button>':''}</div>
        </form>`;
      modal(html);
      if (!editing) {
        byId('catalog-spell').onchange = event => {
          apiSelected = null;
          const spell = CATALOG.find(entry => entry.id === event.target.value);
          if (!spell) return;
          const fields = ['name', 'level', 'es', 'school', 'cast', 'range', 'duration', 'save', 'dice', 'desc', 'tip', 'source'];
          fields.forEach(field => {
            byId('spell-' + field).value = spell[field === 'level' ? 'l' : field] ?? '';
          });
        };
        byId('api-spell-search').onclick = async () => {
          const results = byId('api-spell-results');
          const query = byId('api-spell-query').value.trim();
          if (!query) { results.textContent = 'Escribí un nombre para buscar.'; return; }
          results.textContent = 'Buscando…';
          try {
            const response = await PathfinderApi.searchSpells(query, c);
            apiResults = response.data;
            results.innerHTML = apiResults.length ? apiResults.map((spell, index) => {
              const level = PathfinderApi.spellRecord(spell, c).l;
              return `<button type="button" class="btn sm" data-api-spell="${index}">Nivel ${level} · ${esc(spell.name)}${spell.name_es ? ' / ' + esc(spell.name_es) : ''}</button>`;
            }).join(' ') : 'No se encontraron conjuros.';
          } catch (error) { results.textContent = error.message || 'No se pudo consultar la API.'; }
        };
        byId('api-spell-results').addEventListener('click', event => {
          const button = event.target.closest('[data-api-spell]');
          if (!button) return;
          const spell = PathfinderApi.spellRecord(apiResults[Number(button.dataset.apiSpell)], c);
          apiSelected = spell;
          const values = { name: spell.name, level: spell.l, es: spell.es, school: spell.school,
            cast: spell.cast, range: spell.range, duration: spell.duration, save: spell.save,
            dice: spell.dice, desc: spell.desc, tip: spell.tip, source: spell.source };
          Object.entries(values).forEach(([field, value]) => {
            const control = byId('spell-' + field);
            if (control) control.value = value ?? '';
          });
          toast('Conjuro importado como borrador; revisá nivel, traducción y reglas antes de guardar.');
        });
      }

      byId('spell-form').onsubmit = event => {
        event.preventDefault();
        const fieldValue = field => byId('spell-' + field).value;
        const name = fieldValue('name').trim();
        const level = Number(fieldValue('level'));
        if (!name) return;
        const duplicate = c.spells.some(spell =>
          spell.name.toLowerCase() === name.toLowerCase() && spell.l === level && spell.id !== editId);
        if (duplicate) {
          toast('Ese conjuro ya está en tu grimorio');
          return;
        }

        const spell = {
          id: editing?.id || name.toLowerCase().replace(/[^a-z0-9]/g, '') + level + '-' + Date.now().toString(36),
          l: level,
          name,
          es: fieldValue('es'),
          school: fieldValue('school'),
          cast: fieldValue('cast'),
          range: fieldValue('range'),
          duration: fieldValue('duration'),
          save: fieldValue('save'),
          dice: fieldValue('dice').trim() || 'Consultá la ficha de d20PFSRD para resolver las tiradas.',
          desc: fieldValue('desc'),
          tip: fieldValue('tip'),
          source: apiSelected ? apiSelected.source : spellSource({ name, source: fieldValue('source') }),
          components: 'Consultar reglas',
          sourceSite: apiSelected ? 'API Pathfinder 1e' : 'd20PFSRD',
          ...(apiSelected ? { apiSource: apiSelected.apiSource, apiOrigin: apiSelected.apiOrigin } : {}),
        };
        if (editing) Object.assign(editing, spell);
        else c.spells.push(spell);
        save(editing ? 'Conjuro actualizado' : 'Conjuro agregado');
        closeModal();
        filter = 'all';
        query = '';
        byId('search').value = '';
        render();
      };

      if (editing) {
        byId('delete-spell').onclick = () => {
          if (!confirm('¿Quitar ' + editing.name + ' del grimorio?')) return;
          c.spells = c.spells.filter(spell => spell.id !== editing.id);
          save('Conjuro eliminado');
          closeModal();
          render();
        };
      }
    }

    function resetView() {
      closeModal();
      filter = 'all';
      query = '';
      byId('search').value = '';
      render();
    }

    function editProfile(profile) {
      partyView.profile(profile, details => {
        if (profile) Object.assign(profile, details);
        else Party.add(state, { ...details, combat: { progression: 'manual' } });
        save(profile ? 'Perfil actualizado' : 'Ficha incorporada');
        resetView();
      });
    }

    function manageAction(action, id) {
      if (action === 'create') {
        editProfile();
        return;
      }

      const selected = state.characters.find(item => item.id === id);
      if (!selected) return;
      switch (action) {
        case 'edit':
          editProfile(selected);
          return;
        case 'export':
          download(SaveState.serializeBackup({
            schema: state.schema,
            activeCharacter: selected.archived ? null : selected.id,
            characters: [selected],
          }), 'bard-companion-ficha-');
          return;
        case 'select':
          Party.select(state, id);
          break;
        case 'archive':
        case 'restore':
          Party.archive(state, selected, action === 'archive');
          break;
        case 'copy':
          Party.copy(state, selected, ' (copia)');
          break;
        case 'remove':
          if (!confirm('¿Borrar definitivamente a ' + selected.name + ' y su progreso local?')) return;
          Party.remove(state, id);
          break;
        default:
          return;
      }
      save();
      resetView();
    }

    async function appendBackup(restored, message, legacyRaw) {
      if (!restored.characters.length) throw new Error('El respaldo no contiene fichas.');
      const candidate = { ...state, characters: state.characters.slice() };
      for (const source of restored.characters) {
        const added = Party.copy(candidate, source, legacyRaw === undefined ? '' : ' (guardado anterior)', false);
        if (legacyRaw === undefined && source.id === restored.activeCharacter) Party.select(candidate, added.id);
      }
      candidate.activeCharacter = Party.active(candidate)?.id ?? null;
      if (await save(message, candidate, legacyRaw)) {
        state = candidate;
        resetView();
      }
    }

    byId('character-select').addEventListener('change', event => {
      if (!Party.select(state, event.target.value)) return;
      save();
      resetView();
    });
    byId('manage-party').onclick = () => partyView.manage(state, manageAction);

    byId('slot-grid').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.spend) setSpent(Number(button.dataset.spend), 1);
      if (button.dataset.restore) setSpent(Number(button.dataset.restore), -1);
    });
    byId('spell-list').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.cast) cast(button.dataset.cast);
      if (button.dataset.detail) detail(button.dataset.detail);
    });
    byId('filters').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      filter = button.dataset.filter;
      render();
    });
    byId('level-reminder').addEventListener('click', event => {
      if (event.target.closest('[data-openadd]')) addModal();
    });
    byId('search').addEventListener('input', event => {
      query = event.target.value;
      render();
    });
    byId('rest').addEventListener('click', () => {
      if (!confirm('¿Confirmás un descanso diario? Se restaurarán todos los espacios de conjuro usados.')) return;
      SaveState.rest(character());
      save('Espacios diarios restaurados');
      render();
    });
    byId('add-spell').onclick = () => addModal();
    byId('edit-profile').onclick = () => editProfile(character());
    function saveSheet(message) {
      const pending = save(message);
      render();
      return pending;
    }
    byId('edit-sheet').onclick = () => partyView.entries(character(), saveSheet);
    byId('show-combat').onclick = () => combatView.overview(character(), saveSheet);
    byId('show-weapons').onclick = () => combatView.weapons(character(), saveSheet);
    byId('show-inventory').onclick = () => combatView.inventory(character(), saveSheet);
    byId('show-effects').onclick = () => combatView.effects(character(), saveSheet);
    byId('update-level').onclick = () => {
      const selected = character();
      levelView.show(selected, {
        save: async message => {
          const result = await save(message);
          render();
          return result;
        },
        export: () => download(SaveState.serializeBackup(state), 'bard-companion-respaldo-'),
        open: section => {
          switch (section) {
            case 'profile': editProfile(selected); break;
            case 'combat': combatView.overview(selected, message => save(message)); break;
            case 'entries': partyView.entries(selected, message => save(message)); break;
            case 'spells':
              modal(`<button data-close class="btn sm close" aria-label="Cerrar">✕</button>
                <h2>Conjuros y espacios</h2><div class="row">
                  <button class="btn" id="level-edit-slots">Editar espacios</button>
                  <button class="btn" id="level-add-spell">Agregar conjuro</button>
                  <button class="btn" id="level-show-book">Consultar grimorio</button>
                </div>`, 'Conjuros y espacios');
              byId('level-edit-slots').onclick = () => editProfile(selected);
              byId('level-add-spell').onclick = () => addModal();
              byId('level-show-book').onclick = () => {
                resetView();
                byId('search').scrollIntoView({ block: 'center' });
              };
              break;
            case 'equipment': combatView.inventory(selected, message => save(message)); break;
          }
        },
      });
    };
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal();
    });

    window.addEventListener('storage', updateLegacyWarning);
    byId('export-legacy').onclick = () => {
      try {
        const raw = repository.pendingLegacy();
        if (raw !== null) download(raw, 'bard-companion-guardado-anterior-');
      } catch {
        showStorageWarning('No se pudo abrir el guardado anterior.');
      }
    };
    byId('recover-legacy').onclick = async () => {
      try {
        const raw = repository.pendingLegacy();
        if (raw === null) return;
        const restored = SaveState.parseBackup(raw);
        await appendBackup(restored, 'Guardado anterior recuperado', raw);
      } catch (error) {
        alert('No se pudo recuperar el guardado anterior: ' + error.message);
      }
    };
    byId('export-data').onclick = () => download(SaveState.serializeBackup(state), 'bard-companion-respaldo-');
    function openImport(asNew) {
      importingAsNew = asNew;
      byId('import-file').click();
    }
    byId('import-data').onclick = () => openImport(false);
    byId('import-new').onclick = () => openImport(true);
    byId('import-file').addEventListener('change', async event => {
      const input = event.target;
      const file = input.files[0];
      if (!file) return;
      if (writing) {
        input.value = '';
        return;
      }
      const asNew = importingAsNew;
      setWriting(true);
      try {
        const restored = SaveState.parseBackup(await file.text());
        if (asNew) {
          await appendBackup(restored, 'Fichas importadas');
          return;
        }
        if (!confirm(shared
          ? '¿Reemplazar las fichas de toda la mesa por este respaldo?'
          : '¿Reemplazar el progreso actual por este respaldo?')) return;
        if (await repository.replace(restored) === false) {
          throw new Error('Otro dispositivo cambió la campaña. Actualizá las fichas antes de restaurar.');
        }
        state = restored;
        setUnsaved(false);
        showStorageWarning('');
        updateLegacyWarning();
        resetView();
        toast('Respaldo importado');
      } catch (error) {
        alert('No se pudo importar: ' + error.message);
      } finally {
        setWriting(false);
        input.value = '';
      }
    });

    updateLegacyWarning();
    render();
    if (shared) {
      byId('retry-campaign').onclick = () => save('Cambios guardados');
      window.addEventListener('beforeunload', event => {
        if (writing || unsaved) event.preventDefault();
      });
    }
    return {
      canLeave: () => !writing && (!unsaved || confirm('¿Salir con cambios pendientes? Podés exportarlos antes de salir.')),
      allowNavigation: () => setUnsaved(false),
    };
  }

  return { mount };
})();
