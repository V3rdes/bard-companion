const LevelView = (() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const number = id => byId(id).value === '' ? null : byId(id).valueAsNumber;

  function create({ modal, esc }) {
    const close = '<button data-close class="btn sm close" aria-label="Cerrar">✕</button>';
    const options = (choices, current) => Object.entries(choices).map(([key, label]) =>
      `<option value="${key}" ${key === current ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const numeric = (id, label, value, min, max) => `
      <div class="field"><label for="${id}">${label}</label>
        <input id="${id}" type="number" step="1" min="${min}" max="${max}" value="${esc(value)}">
      </div>`;

    function show(character, actions, pending = false) {
      const review = character.levelReview;
      const atMaximum = character.level >= 20;
      modal(`${close}
        <h2>Actualizar nivel · ${esc(character.name)}</h2>
        <p>Aplicá el cambio cuando lo indique el DM. Nivel actual · ${character.level}</p>
        ${pending ? `<div class="info-panel" role="status">
          El cambio está en esta ficha y queda pendiente de guardar.
          <div class="row"><button class="btn sm" id="level-retry">Reintentar guardado</button>
          <button class="btn sm" id="level-export">Exportar respaldo</button></div>
        </div>` : ''}
        ${review ? `<details class="sheet-section" open>
          <summary>Última actualización · ${review.fromLevel} → ${review.level}</summary>
          ${review.hp?.maximum != null ? '<p>PG máximos · ' + review.hp.maximum + '</p>' : ''}
          ${review.hp?.components?.length ? '<ul>' + review.hp.components.map(component =>
            '<li>' + esc(component.label) + ' · ' + CombatRules.signed(component.value) + '</li>').join('') + '</ul>' : ''}
        </details>` : ''}
        <section class="sheet-section"><h3>Campos para revisar</h3>
          <ul class="sheet-list">${Object.entries(LevelUp.sections).map(([key, label]) => `
            <li class="level-review-item">
              ${review ? `<label class="combat-check"><input type="checkbox" data-level-check="${key}"
                ${review.checked[key] ? 'checked' : ''}> ${esc(label)}</label>` : `<span>${esc(label)}</span>`}
              <button class="btn sm" data-level-open="${key}">Editar</button>
            </li>`).join('')}</ul>
        </section>
        ${review ? `<div class="field"><label for="level-review-notes">Elecciones y pendientes</label>
          <textarea id="level-review-notes" maxlength="4000">${esc(review.notes)}</textarea>
          <button class="btn sm" id="level-save-notes">Guardar notas</button>
        </div>` : ''}
        ${atMaximum ? '<p class="muted">Podés seguir actualizando la ficha desde los campos de revisión.</p>' :
          '<button class="btn primary" id="level-start">Registrar subida de nivel</button>'}`, 'Actualizar nivel');

      const saveReview = async message => {
        const result = await actions.save(message);
        show(character, actions, !result);
      };
      byId('backdrop').addEventListener('change', event => {
        const key = event.target.dataset.levelCheck;
        if (!key || !review) return;
        review.notes = byId('level-review-notes').value;
        review.checked[key] = event.target.checked;
        saveReview();
      });
      byId('backdrop').addEventListener('click', event => {
        const button = event.target.closest('[data-level-open]');
        if (!button) return;
        const key = button.dataset.levelOpen;
        if (review && byId('level-review-notes').value !== review.notes) {
          review.notes = byId('level-review-notes').value;
          actions.save();
        }
        actions.open(key);
      });
      if (review) byId('level-save-notes').onclick = () => {
        review.notes = byId('level-review-notes').value;
        saveReview('Notas guardadas');
      };
      if (pending) {
        byId('level-retry').onclick = () => saveReview('Cambios guardados');
        byId('level-export').onclick = actions.export;
      }
      if (!atMaximum) byId('level-start').onclick = async () => {
        if (review && byId('level-review-notes').value !== review.notes) {
          review.notes = byId('level-review-notes').value;
          await actions.save();
        }
        form(character, actions);
      };
    }

    function form(character, actions) {
      modal(`${close}<h2>Registrar subida de nivel</h2>
        <form id="level-form">
          ${numeric('level-next', 'Nuevo nivel total', character.level + 1, character.level + 1, 20)}
          <div class="field"><label for="level-class">Clase o clases y niveles después de subir</label>
            <input id="level-class" maxlength="80" value="${esc(character.className)}">
          </div>
          <div class="field"><label for="level-archetypes">Arquetipos y variantes</label>
            <input id="level-archetypes" maxlength="80" value="${esc(character.archetypes)}">
          </div>
          <p class="muted">Revisá las bases de combate y los espacios si cambia la clase o el arquetipo.</p>
          ${numeric('level-constitution', 'Constitución base después de subir', character.constitution, 1, 99)}
          <div class="field"><label for="level-hp-mode">Actualización de PG</label>
            <select id="level-hp-mode">${options(LevelUp.hpModes, 'keep')}</select>
          </div>
          <div id="level-hp-fields" hidden>
            ${numeric('level-before-max', 'PG máximos antes de subir', character.hpMax, 0, 9999)}
            <div id="level-hp-calculation">
              ${numeric('level-before-con', 'Constitución base antes de subir', character.constitution, 1, 99)}
              <p class="muted">Ingresá el resultado de cada dado o el valor acordado para cada nivel. Usá Constitución base para los PG permanentes.</p>
              <div class="sheet-fields" id="level-rolls"></div>
              ${numeric('level-extra-hp', 'Otros ajustes de PG (clase predilecta, dotes, etc.)', 0, -9999, 9999)}
            </div>
            <div id="level-hp-manual">${numeric('level-manual-max', 'Nuevo máximo de PG', null, 0, 9999)}</div>
            <div class="field"><label for="level-current-policy">PG actuales después de subir</label>
              <select id="level-current-policy">${options(LevelUp.currentPolicies, 'keep')}</select>
            </div>
            <p class="info-panel" id="level-hp-preview" role="status"></p>
          </div>
          <div class="field"><label for="level-notes">Elecciones del jugador y pendientes</label>
            <textarea id="level-notes" maxlength="4000"></textarea>
          </div>
          <p class="notice" id="level-error" role="status"></p>
          <div class="row"><button class="btn primary" type="submit" id="level-apply">Aplicar actualización</button>
            <button class="btn" type="button" id="level-back">Volver</button></div>
        </form>`, 'Registrar subida de nivel');
      const nextLevel = byId('level-next');
      const hpMode = byId('level-hp-mode');
      nextLevel.required = true;
      let rowCount = -1;
      let applying = false;

      function read() {
        return {
          level: number('level-next'),
          className: byId('level-class').value.trim(),
          archetypes: byId('level-archetypes').value.trim(),
          constitution: number('level-constitution'),
          hpMode: hpMode.value,
          beforeMaximum: number('level-before-max'),
          beforeConstitution: number('level-before-con'),
          rolls: Array.from(byId('level-rolls').querySelectorAll('input'),
            input => input.value === '' ? null : input.valueAsNumber),
          extra: number('level-extra-hp'),
          manualMaximum: number('level-manual-max'),
          currentPolicy: byId('level-current-policy').value,
          notes: byId('level-notes').value.trim(),
        };
      }

      function refresh() {
        const mode = hpMode.value;
        byId('level-hp-fields').hidden = mode === 'keep';
        byId('level-hp-calculation').hidden = mode !== 'calculate';
        byId('level-hp-manual').hidden = mode !== 'manual';
        byId('level-hp-fields').querySelectorAll('input, select').forEach(input => {
          input.disabled = mode === 'keep' ||
            (mode !== 'calculate' && byId('level-hp-calculation').contains(input)) ||
            (mode !== 'manual' && byId('level-hp-manual').contains(input));
        });
        const count = number('level-next') - character.level;
        if (Number.isInteger(count) && count >= 1 && count <= 20 && count !== rowCount) {
          const previous = Array.from(byId('level-rolls').querySelectorAll('input'), input => input.value);
          byId('level-rolls').innerHTML = Array.from({ length: count }, (_, index) =>
            numeric('level-roll-' + index, 'Resultado para nivel ' + (character.level + index + 1), previous[index], 1, 9999)).join('');
          byId('level-rolls').querySelectorAll('input').forEach(input => { input.disabled = mode !== 'calculate'; });
          rowCount = count;
        }
        if (mode === 'keep') return;
        try {
          const data = LevelUp.hitPoints(character, read());
          const parts = data.components.map(component => component.label + ' ' + CombatRules.signed(component.value));
          byId('level-hp-preview').textContent =
            `Nuevo máximo · ${data.maximum} PG. PG actuales · ${data.current ?? 'sin registrar'}.` +
            (parts.length ? ' ' + parts.join(' · ') : '');
        } catch (error) {
          byId('level-hp-preview').textContent = error.message;
        }
      }
      byId('level-form').addEventListener('input', refresh);
      byId('level-form').addEventListener('change', refresh);
      byId('level-back').onclick = () => show(character, actions);
      byId('level-form').onsubmit = async event => {
        event.preventDefault();
        if (applying) return;
        try {
          const patch = LevelUp.update(character, read());
          applying = true;
          byId('level-apply').disabled = true;
          Object.assign(character, patch);
          const saved = await actions.save('Nivel actualizado');
          show(character, actions, !saved);
        } catch (error) {
          byId('level-error').textContent = error.message;
          applying = false;
          byId('level-apply').disabled = false;
        }
      };
      refresh();
    }

    return { show };
  }

  return { create };
})();
