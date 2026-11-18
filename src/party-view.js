const PartyView = (() => {
  'use strict';

  const groups = {
    skills: { title: 'Habilidades', singular: 'habilidad', reference: 'skills' },
    feats: { title: 'Dotes', singular: 'dote', reference: 'feats' },
    traits: { title: 'Rasgos y aptitudes especiales', singular: 'rasgo o aptitud', reference: 'traits' },
  };
  const readNumber = input => input.value === '' ? null : input.valueAsNumber;
  const byId = id => document.getElementById(id);
  const profileText = [
    ['className', 'Clase o clases y niveles'], ['archetypes', 'Arquetipos y variantes'],
    ['ancestry', 'Ascendencia'], ['alignment', 'Alineamiento'],
    ['size', 'Tamaño'], ['speed', 'Velocidad'],
  ];
  const profileNumbers = [
    ['level', 'Nivel', 1, 20], ['hpCurrent', 'PG actuales', -9999, 9999], ['hpMax', 'PG máximos', 0, 9999],
    ...Party.attributes.map(([field, label]) => [field, label, 1, 99]),
  ];

  function create({ modal, esc, combatResult }) {
    const numberInput = (id, label, value, min, max, required = false) => `
      <div class="field"><label for="${id}">${label}</label>
        <input id="${id}" type="number" min="${min}" max="${max}" value="${esc(value)}" ${required ? 'required' : ''}>
      </div>`;

    function profile(character, onSave) {
      const c = character ?? { spellMode: 'manual' };
      const slotInputs = Party.spellLevels.map(level =>
        numberInput('char-slot-' + level, 'Nivel ' + level, c.slotTotals?.[level], 0, 99)).join('');
      modal(`
        <button data-close class="btn sm close" aria-label="Cerrar">✕</button>
        <h2>${character ? 'Editar perfil' : 'Incorporar ficha'}</h2>
        ${character ? '' : '<p class="muted">Copiá los datos de la hoja o su foto. Podés completar y corregir el resto desde la ficha.</p>'}
        <form id="profile-form">
          <div class="field"><label for="char-name">Nombre</label>
            <input id="char-name" required maxlength="60" value="${esc(c.name)}">
          </div>
          <div class="sheet-fields">${profileText.map(([field, label]) => `
            <div class="field"><label for="char-${field}">${label}</label>
              <input id="char-${field}" maxlength="80" value="${esc(c[field])}">
            </div>`).join('')}
            ${profileNumbers.map(([field, label, min, max]) =>
              numberInput('char-' + field, label, c[field], min, max, field === 'level' || field === 'cha')).join('')}
          </div>
          <h3>Conjuros y espacios</h3>
          <div class="field"><label for="char-spell-mode">Progresión de conjuros</label>
            <select id="char-spell-mode">
              <option value="bard" ${c.spellMode !== 'manual' ? 'selected' : ''}>Bardo base</option>
              <option value="manual" ${c.spellMode === 'manual' ? 'selected' : ''}>Manual</option>
            </select>
          </div>
          <div id="char-manual-casting">
            <div class="field"><label for="char-casting-ability">Atributo de lanzamiento</label>
              <select id="char-casting-ability"><option value="">Modificador manual</option>
                ${Party.attributes.map(([key, label]) =>
                  `<option value="${key}" ${c.castingAbility === key ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </div>
            ${numberInput('char-casting-modifier', 'Modificador manual para la CD', c.castingModifier, -99, 99)}
          </div>
          <label class="row"><input type="checkbox" id="char-focus" ${c.spellFocusEnchantment ? 'checked' : ''}>
            Spell Focus (Encantamiento)
          </label>
          <details ${Object.keys(c.slotTotals ?? {}).length ? 'open' : ''}>
            <summary>Editar espacios por nivel</summary>
            <p class="muted">Dejá un espacio en blanco para usar la progresión elegida. En modo manual, los campos vacíos equivalen a 0.</p>
            <div class="sheet-fields">${slotInputs}</div>
          </details>
          <div class="field"><label for="char-sheet-source">Referencia de la hoja o foto</label>
            <input id="char-sheet-source" maxlength="300" value="${esc(c.sheetSource)}">
          </div>
          <div class="field"><label for="char-sheet-notes">Notas de transcripción y datos por revisar</label>
            <textarea id="char-sheet-notes" maxlength="4000">${esc(c.sheetNotes)}</textarea>
          </div>
          <button type="submit" class="btn primary">Guardar ficha</button>
        </form>`, character ? 'Editar perfil' : 'Incorporar ficha');
      const mode = byId('char-spell-mode');
      const castingAbility = byId('char-casting-ability');
      const showModifier = () => {
        byId('char-manual-casting').hidden = mode.value !== 'manual';
        byId('char-casting-modifier').disabled = mode.value !== 'manual' || Boolean(castingAbility.value);
      };
      mode.onchange = showModifier;
      castingAbility.onchange = showModifier;
      showModifier();
      byId('profile-form').onsubmit = event => {
        event.preventDefault();
        const name = byId('char-name').value.trim();
        if (!name) return;
        const details = { name };
        for (const [field] of profileText) details[field] = byId('char-' + field).value.trim();
        for (const [field] of profileNumbers) details[field] = readNumber(byId('char-' + field));
        const slotTotals = {};
        for (const level of Party.spellLevels) {
          const total = readNumber(byId('char-slot-' + level));
          if (total !== null) slotTotals[level] = total;
        }
        onSave({
          ...details,
          className: details.className || (mode.value === 'bard' ? 'Bardo' : ''),
          spellMode: mode.value,
          castingAbility: castingAbility.value || null,
          castingModifier: readNumber(byId('char-casting-modifier')),
          spellFocusEnchantment: byId('char-focus').checked,
          sheetSource: byId('char-sheet-source').value.trim(),
          sheetNotes: byId('char-sheet-notes').value.trim(),
          slotTotals,
        });
      };
    }

    function manage(state, onAction) {
      modal(`
        <button data-close class="btn sm close" aria-label="Cerrar">✕</button>
        <h2>Administrar personajes</h2>
        <ul class="sheet-list">${state.characters.map(character => `
          <li>
            <strong>${esc(character.name)}</strong>
            <span class="muted">${character.archived ? 'Archivado' : 'Nivel ' + character.level}</span>
            <div class="row sheet-actions" data-character="${esc(character.id)}">
              ${character.archived
                ? '<button class="btn sm" data-action="restore">Desarchivar</button>'
                : '<button class="btn sm" data-action="select">Abrir</button><button class="btn sm" data-action="archive">Archivar</button>'}
              <button class="btn sm" data-action="edit">Editar</button>
              <button class="btn sm" data-action="copy">Duplicar</button>
              <button class="btn sm" data-action="export">Exportar ficha</button>
              <button class="btn sm bad" data-action="remove">Borrar</button>
            </div>
          </li>`).join('')}</ul>
        <button class="btn primary" id="manage-create">Incorporar ficha</button>`, 'Administrar personajes');
      byId('manage-create').onclick = () => onAction('create');
      byId('backdrop').addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (button) onAction(button.dataset.action, button.closest('[data-character]').dataset.character);
      });
    }

    function entryEditor(group, entry, onSave, onRemove, onBack) {
      const labels = groups[group];
      const record = entry ?? {};
      const skill = group === 'skills';
      modal(`
        <button data-close class="btn sm close" aria-label="Cerrar">✕</button>
        <h2>${entry ? 'Editar' : 'Agregar'} ${labels.singular}</h2>
        <form id="entry-form">
          <div class="field"><label for="entry-name">Nombre</label>
            <input id="entry-name" required maxlength="120" value="${esc(record.name)}">
          </div>
          <div class="sheet-fields">
            ${numberInput('entry-level', 'Nivel', record.level, 0, 99)}
            ${numberInput('entry-ranks', 'Rangos', record.ranks, 0, 99)}
            ${numberInput('entry-modifier', skill ? 'Ajuste o total manual' : 'Modificador', record.modifier, -99, 99)}
          </div>
          ${skill ? `
            <div class="field"><label for="entry-ability">Atributo para calcular la tirada</label>
              <select id="entry-ability"><option value="">Usar total manual</option>
                ${Party.attributes.map(([key, label]) =>
                  `<option value="${key}" ${record.ability === key ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </div>
            <p class="muted">Con atributo, el valor manual se suma a rangos, atributo y ajustes. En modo manual, cargá ahí el modificador total de la habilidad.</p>
            <label class="combat-check"><input type="checkbox" id="entry-class-skill" ${record.classSkill ? 'checked' : ''}> Habilidad de clase</label>
            <label class="combat-check"><input type="checkbox" id="entry-trained" ${record.trainedOnly ? 'checked' : ''}> Requiere entrenamiento</label>
            <label class="combat-check"><input type="checkbox" id="entry-ignore-armor" ${record.ignoreArmor ? 'checked' : ''}> Ignora el penalizador de armadura y carga</label>
          ` : ''}
          ${group === 'feats' && !entry ? `<div class="field"><label for="api-feat-query">Buscar dote en catálogo Pathfinder 1e</label><div class="row"><input id="api-feat-query" maxlength="100" placeholder="Nombre de la dote"><button type="button" class="btn sm" id="api-feat-search">Buscar</button></div><div id="api-feat-results" class="sheet-list"></div></div>` : ''}
          <div class="field"><label for="entry-url">URL de referencia</label>
            <input id="entry-url" type="url" maxlength="2048" value="${esc(record.url)}">
          </div>
          <div class="field"><label for="entry-notes">Notas</label>
            <textarea id="entry-notes" maxlength="3000">${esc(record.notes)}</textarea>
          </div>
          <div class="row">
            <button type="submit" class="btn primary">Guardar</button>
            <button type="button" class="btn" id="entry-back">Volver</button>
            ${entry ? '<button type="button" class="btn bad" id="entry-remove">Borrar</button>' : ''}
          </div>
        </form>`, labels.title);
      byId('entry-form').onsubmit = event => {
        event.preventDefault();
        const name = byId('entry-name').value.trim();
        if (!name) return;
        onSave({
          ...record,
          name,
          level: readNumber(byId('entry-level')),
          ranks: readNumber(byId('entry-ranks')),
          modifier: readNumber(byId('entry-modifier')),
          notes: byId('entry-notes').value,
          url: byId('entry-url').value.trim(),
          ...(skill ? {
            ability: byId('entry-ability').value || null,
            classSkill: byId('entry-class-skill').checked,
            trainedOnly: byId('entry-trained').checked,
            ignoreArmor: byId('entry-ignore-armor').checked,
          } : {}),
        });
      };
      byId('entry-back').onclick = onBack;
      if (entry) byId('entry-remove').onclick = onRemove;
      if (group === 'feats' && !entry) {
        let results = [];
        byId('api-feat-search').onclick = async () => {
          const target = byId('api-feat-results');
          const query = byId('api-feat-query').value.trim();
          if (!query) { target.textContent = 'Escribí un nombre para buscar.'; return; }
          target.textContent = 'Buscando…';
          try {
            const response = await PathfinderApi.searchFeats(query);
            results = response.data;
            target.innerHTML = results.length ? results.map((feat, index) => `<button type="button" class="btn sm" data-api-feat="${index}">${esc(feat.name)}</button>`).join(' ') : 'No se encontraron dotes.';
          } catch (error) { target.textContent = error.message || 'No se pudo consultar la API.'; }
        };
        byId('api-feat-results').addEventListener('click', event => {
          const button = event.target.closest('[data-api-feat]');
          if (!button) return;
          const feat = PathfinderApi.featRecord(results[Number(button.dataset.apiFeat)]);
          byId('entry-name').value = feat.name;
          byId('entry-url').value = feat.url;
          byId('entry-notes').value = feat.notes;
        });
      }
    }

    function entries(character, onChange) {
      const skills = CombatRules.sheet(character).skills;
      modal(`
        <button data-close class="btn sm close" aria-label="Cerrar">✕</button>
        <h2>${esc(character.name)}</h2>
        ${Object.entries(groups).map(([group, labels]) => `
          <section class="sheet-section">
            <div class="headrow"><h3>${labels.title}</h3>
              <button class="btn sm" data-entry-group="${group}">Agregar ${labels.singular}</button>
            </div>
            <ul class="sheet-list">${(character[group] ?? []).map((entry, index) => `
              <li><strong>${esc(entry.name)}</strong>
                <p class="muted">${[
                  entry.level == null ? '' : 'Nivel ' + entry.level,
                  entry.ranks == null ? '' : 'Rangos ' + entry.ranks,
                  group === 'skills' || entry.modifier == null ? '' : 'Modificador ' + CombatRules.signed(entry.modifier),
                ].filter(Boolean).join(' · ')}</p>
                ${group === 'skills' ? combatResult('Tirada', skills[index], {
                  roll: 'd20', display: entry.trainedOnly && !(entry.ranks > 0) ? 'Requiere rangos' : undefined,
                }) : ''}
                ${entry.notes ? `<div class="rule-text">${esc(entry.notes)}</div>` : ''}
                <div class="row"><button class="btn sm" data-entry-group="${group}" data-entry-index="${index}">Editar</button>
                  <a href="${esc(CombatRules.ruleLink(entry))}" target="_blank" rel="noopener noreferrer">d20PFSRD ↗</a></div>
              </li>`).join('')}</ul>
            <a href="https://www.d20pfsrd.com/${labels.reference}/" target="_blank" rel="noopener noreferrer">Consultar en d20PFSRD ↗</a>
          </section>`).join('')}`, 'Habilidades, dotes y rasgos');
      byId('backdrop').addEventListener('click', event => {
        const button = event.target.closest('button[data-entry-group]');
        if (!button) return;
        const { entryGroup: group, entryIndex } = button.dataset;
        const records = character[group] ?? [];
        const index = entryIndex === undefined ? records.length : Number(entryIndex);
        const current = records[index];
        const back = () => entries(character, onChange);
        const update = (next, message) => {
          character[group] = next;
          onChange(message);
          back();
        };
        entryEditor(group, current, record => {
          const next = records.slice();
          next[index] = record;
          if (group === 'skills' && current && character.effects?.length) {
            const previous = CombatRules.skillTarget(current.name);
            const renamed = CombatRules.skillTarget(record.name);
            if (previous !== renamed && !records.some((entry, i) => i !== index && CombatRules.skillTarget(entry.name) === previous)) {
              character.effects = character.effects.map(effect => ({
                ...effect,
                modifiers: effect.modifiers.map(modifier => modifier.target === previous ? { ...modifier, target: renamed } : modifier),
              }));
            }
          }
          update(next, 'Ficha actualizada');
        }, () => {
          if (confirm('¿Borrar ' + current.name + ' de esta ficha?')) {
            update(records.filter((_, i) => i !== index), 'Registro borrado');
          }
        }, back);
      });
    }

    return { profile, manage, entries };
  }

  return { create };
})();
