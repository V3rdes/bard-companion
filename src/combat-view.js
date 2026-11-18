const CombatView = (() => {
  'use strict';

  const Rules = CombatRules;
  const byId = id => document.getElementById(id);
  const number = (name, label, min = 0, max = 99, options = {}) => ({ name, label, type: 'number', min, max, ...options });
  const input = (name, label, options = {}) => ({ name, label, type: 'text', ...options });
  const check = (name, label) => ({ name, label, type: 'checkbox' });
  const select = (name, label, choices) => ({ name, label, type: 'select', choices });
  const documentation = {
    combat: 'https://www.d20pfsrd.com/gamemastering/combat/',
    armor: 'https://www.d20pfsrd.com/equipment/armor/',
    weapons: 'https://www.d20pfsrd.com/equipment/weapons/',
    load: 'https://www.d20pfsrd.com/alignment-description/carrying-capacity/',
    equipment: 'https://www.d20pfsrd.com/equipment/',
    classes: 'https://www.d20pfsrd.com/classes/core-classes/',
    effects: 'https://www.d20pfsrd.com/basics-ability-scores/glossary/',
  };
  const amount = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
  const common = [
    input('name', 'Nombre', { required: true }), select('kind', 'Categoría', Rules.categories),
    number('quantity', 'Cantidad', 1, 999999, { required: true }),
    number('weight', 'Peso por unidad (lb)', 0, 1e9, { step: 'any' }),
    number('price', 'Precio por unidad (po)', 0, 1e9, { step: 'any' }),
    input('slot', 'Espacio o ubicación'),
    number('charges', 'Cargas restantes (vacío si no aplica)', 0, 9999),
    number('chargesMax', 'Cargas máximas', 0, 9999),
    check('carried', 'Está en la carga'), check('equipped', 'Equipado'),
  ];
  const weaponFields = [
    select('mode', 'Tipo de ataque', Rules.modes),
    select('attackAbility', 'Atributo de ataque', { '': 'Según tipo de ataque', ...Rules.attributes }),
    input('damageDice', 'Expresión de daño (p. ej. 1d8 + 1d6 de fuego)', { maxLength: 300 }),
    select('damageMode', 'Aporte del atributo al daño', { '': 'Según tipo de ataque', ...Rules.damageModes }),
    select('damageAbility', 'Atributo de daño', { '': 'Fuerza', ...Rules.attributes }),
    number('damageCap', 'Tope positivo para arco compuesto'),
    number('enhancement', 'Mejora mágica'), check('masterwork', 'Gran calidad'), check('proficient', 'Tiene competencia'),
    input('damageType', 'Tipo de daño'), number('range', 'Incremento de alcance (pies)', 0, 9999),
    check('fixedRange', 'El alcance es máximo fijo, sin incrementos'),
    number('reach', 'Alcance cuerpo a cuerpo (pies)', 0, 9999),
    check('touchAttack', 'Ataque contra CA de toque'), check('criticalDisabled', 'No admite críticos'),
    input('ammunition', 'Munición'), number('critMin', 'Amenaza de crítico desde', 1, 20),
    number('critMultiplier', 'Multiplicador de crítico', 2, 9),
    number('attackAdjustment', 'Ajuste de ataque', -99, 99), number('damageAdjustment', 'Ajuste de daño', -99, 99),
    check('singleAttack', 'Sin ataques iterativos con esta arma'),
    check('standardActionAttack', 'Cada ataque requiere una acción estándar (no admite ataque completo)'),
  ];
  const armorFields = [
    select('armorCategory', 'Tipo de armadura', { '': 'Sin transcribir', light: 'Ligera', medium: 'Media', heavy: 'Pesada' }),
    number('acBonus', 'Bonificador base a CA'), number('enhancement', 'Mejora mágica'),
    number('dexCap', 'Máximo de Destreza (vacío si no aplica)'),
    number('checkPenalty', 'Penalizador de armadura (valor negativo)', -99, 0),
    number('arcaneFailure', 'Fallo de conjuro arcano (%)', 0, 100),
    check('proficient', 'Tiene competencia'),
  ];
  const references = [
    input('url', 'URL de referencia', { type: 'url', maxLength: 2048 }),
    input('notes', 'Notas', { type: 'textarea', maxLength: 4000 }),
  ];

  function create({ modal, esc }) {
    const close = '<button data-close class="btn sm close" aria-label="Cerrar">✕</button>';
    const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
    const sourceLink = entry => link(Rules.ruleLink(entry), entry.apiSourceUrl ? 'Fuente API' : 'd20PFSRD');
    const optionList = (choices, current) => Object.entries(choices).map(([value, label]) =>
      `<option value="${esc(value)}" ${String(current ?? '') === value ? 'selected' : ''}>${esc(label)}</option>`).join('');

    function field(spec, value, prefix = 'combat') {
      const id = prefix + '-' + spec.name;
      const commonAttributes = `id="${id}" name="${spec.name}"`;
      if (spec.type === 'checkbox') {
        return `<label class="combat-check"><input ${commonAttributes} type="checkbox" ${value ? 'checked' : ''}> ${spec.label}</label>`;
      }
      let control;
      if (spec.type === 'select') {
        control = `<select ${commonAttributes}>${optionList(spec.choices, value)}</select>`;
      } else if (spec.type === 'textarea') {
        control = `<textarea ${commonAttributes} maxlength="${spec.maxLength}">${esc(value)}</textarea>`;
      } else {
        const rules = spec.type === 'number' ? `min="${spec.min}" max="${spec.max}" step="${spec.step ?? 1}"`
          : `maxlength="${spec.maxLength ?? 120}"`;
        control = `<input ${commonAttributes} type="${spec.type}" ${rules} value="${esc(value)}" ${spec.required ? 'required' : ''}>`;
      }
      return `<div class="field"><label for="${id}">${spec.label}</label>${control}</div>`;
    }

    const fields = (specs, values, prefix) => specs.map(spec => field(spec, values[spec.name], prefix)).join('');

    function read(specs, form) {
      return Object.fromEntries(specs.map(spec => {
        const element = form.elements.namedItem(spec.name);
        const value = spec.type === 'checkbox' ? element.checked : spec.type === 'number'
          ? (element.value === '' ? null : element.valueAsNumber)
          : element.value.trim();
        return [spec.name, spec.type === 'select' && value === '' ? null : value];
      }));
    }

    function result(label, calculated, { roll, display } = {}) {
      const value = display ?? (roll ? Rules.expression(roll, calculated.total) : calculated.total ?? '—');
      const details = calculated.applied.map(item => `
        <li><span>${esc(item.label)}${item.type ? ' · ' + esc(Rules.types[item.type]) : ''}</span>
          <span>${item.value == null ? 'Sin cargar' : Rules.signed(item.value)}</span></li>`).join('');
      const ignored = calculated.ignored.map(item => `
        <li class="muted"><span>${esc(item.label)} · ${esc(Rules.types[item.type])} · No se acumula</span>
          <span>${Rules.signed(item.value)}</span></li>`).join('');
      return `<details class="combat-result">
        <summary><span>${esc(label)}</span> <strong>${esc(value)}</strong></summary>
        <ul>${details}${ignored}</ul>
      </details>`;
    }

    function profileSettings(character, onChange, back) {
      const specs = [
        select('progression', 'Base para los cálculos', { manual: 'Transcribir bases de la hoja', class: 'Calcular según clase base y nivel' }),
        number('bab', 'Ataque base manual'),
        ...Object.entries(Rules.savingThrows).map(([name, label]) => number(name, label + ' base manual')),
        number('landSpeed', 'Velocidad base (pies)', 0, 9999),
        check('ignoreSpeed', 'Ignora la reducción de velocidad por armadura o carga'),
        check('quadruped', 'Usa capacidad de carga de cuadrúpedo'),
      ];
      modal(`${close}<h2>Bases de combate</h2>
        <p class="muted">Copiá el ataque base y las bases de salvación de la hoja. También podés calcular la progresión de una clase base. Los campos cargados manualmente tienen prioridad.</p>
        <form id="combat-settings"><div class="sheet-fields">${fields(specs, { progression: 'class', ...character.combat })}</div>
          <div class="row"><button type="submit" class="btn primary">Guardar</button><button type="button" class="btn" id="combat-back">Volver</button></div>
        </form><p>${link(documentation.classes, 'Progresiones de clase en d20PFSRD')}</p>`, 'Bases de combate');
      byId('combat-back').onclick = back;
      byId('combat-settings').onsubmit = event => {
        event.preventDefault();
        character.combat = { ...character.combat, ...read(specs, event.currentTarget) };
        onChange('Bases de combate guardadas');
        back();
      };
    }

    function weaponPanel(stats, item) {
      const data = Rules.weapon(stats, item);
      const critical = item.criticalDisabled ? 'No aplica' : item.critMin == null && item.critMultiplier == null ? '' :
        (item.critMin && item.critMin < 20 ? item.critMin + '–20' : '20') + ' / ×' + (item.critMultiplier ?? 2);
      const information = [critical && 'Crítico ' + critical, item.damageType,
        item.range ? (item.fixedRange ? 'Alcance máximo ' : 'Incremento ') + item.range + ' pies' : '',
        item.reach ? 'Alcance cuerpo a cuerpo ' + item.reach + ' pies' : '',
        item.touchAttack ? 'Contra CA de toque' : '',
        item.standardActionAttack ? 'Acción estándar por ataque' : '',
        item.charges != null ? 'Cargas ' + item.charges + (item.chargesMax != null ? ' / ' + item.chargesMax : '') : '',
        item.ammunition && 'Munición ' + item.ammunition].filter(Boolean);
      return `<div class="sheet-section">
        <div class="headrow"><h3>${esc(item.name)}</h3>${sourceLink(item)}</div>
        ${information.length ? '<p class="muted">' + esc(information.join(' · ')) + '</p>' : ''}
        ${result('Ataque', data.attack, { roll: 'd20' })}
        ${data.attacks.length > 1 ? '<p class="muted">Ataque completo · ' + esc(data.attacks.join(' / ')) + '</p>' : ''}
        ${data.extra.total > 0 ? result('Ataques adicionales al máximo', data.extra) : ''}
        ${result('Daño', data.damage, { display: data.damageExpression })}
        ${item.notes ? '<p class="rule-text">' + esc(item.notes) + '</p>' : ''}
      </div>`;
    }

    function overview(character, onChange) {
      const stats = Rules.sheet(character);
      const { defense, maneuvers, worn, carried, saving } = stats;
      const weapons = (character.inventory ?? []).filter(item => item.kind === 'weapon');
      const differences = Rules.compareWithSheet(character, stats).filter(row => row.difference != null && row.difference !== 0);
      modal(`${close}<h2>Combate · ${esc(character.name)}</h2>
        <div class="headrow"><span class="muted">Usá «Editar perfil» para cargar los atributos o el tamaño.</span>
          <div class="row"><button class="btn sm" id="combat-compare">Revisar con la hoja</button>
          <button class="btn sm" id="combat-bases">Bases y ajustes</button></div></div>
        <p><strong>PG ${character.hpCurrent ?? '—'} / ${character.hpMax ?? '—'}</strong></p>
        ${differences.length ? '<p class="notice">Hay diferencias con la hoja: ' + esc(differences.map(row => row.label + ' ' + row.recorded + ' → cálculo ' + row.total).join(' · ')) + '. Revisá los componentes en «Revisar con la hoja».</p>' : ''}
        <div class="combat-stats">
          ${Object.entries(stats.scores).map(([name, score]) => result(Rules.attributes[name], score, {
            display: score.total == null ? '—' : score.total + ' (' + Rules.signed(stats.ability(name).value) + ')',
          })).join('')}
        </div>
        <h3>Defensa e iniciativa</h3>
        <div class="combat-stats">
          ${result('CA', defense.ac)}${result('Toque', defense.touch)}${result('Desprevenido', defense.flat)}
          ${result('Iniciativa', stats.initiative, { roll: 'd20' })}
          ${Object.entries(saving).map(([name, value]) => result(Rules.savingThrows[name], value, { roll: 'd20' })).join('')}
        </div>
        <h3>Ataque y maniobras</h3>
        <div class="combat-stats">
          ${result('Ataque base', Rules.apply([stats.baseAttack]))}
          ${result('BMC', maneuvers.cmb, { roll: 'd20' })}${result('DMC', maneuvers.cmd)}
        </div>
        <p class="muted">Velocidad ${stats.movement == null ? 'sin cargar' : stats.movement + ' pies'}${stats.speed != null && stats.speed !== stats.movement ? ' de ' + stats.speed + ' pies base' : ''} · Penalizador de pruebas ${Rules.signed(Math.min(worn.checkPenalty, carried.checkPenalty))} · Fallo arcano para estos conjuros ${Math.min(100, worn.castingFailure)}% (equipo: ${Math.min(100, worn.failure)}%)</p>
        ${worn.unknownArmor ? '<p class="notice">Falta transcribir el tipo de armadura para aplicar la exención del bardo al fallo arcano.</p>' : ''}
        ${carried.missingWeights.length ? '<p class="notice">Carga calculada con los pesos conocidos. Hay ' + carried.missingWeights.length + ' objetos con peso pendiente de cargar.</p>' : ''}
        <h3>Armas y ataques registrados</h3>
        ${weapons.length ? weapons.map(item => '<p class="smalllabel">' + (item.equipped ? 'Equipada' : item.carried ? 'En la carga · equipar para usar' : 'Guardada') + '</p>' + weaponPanel(stats, item)).join('') : '<p class="muted">Cargá tus armas desde «Equipo» para consultar sus tiradas.</p>'}
        <p>${link(documentation.combat, 'Reglas de combate en d20PFSRD')}</p>`, 'Combate');
      byId('combat-bases').onclick = () => profileSettings(character, onChange, () => overview(character, onChange));
      byId('combat-compare').onclick = () => comparison(character, onChange);
    }

    function comparison(character, onChange) {
      const rows = Rules.compareWithSheet(character);
      const references = rows.map(row => number(row.key, row.label + ' anotada', -9999, 9999));
      modal(`${close}<h2>Revisar con la hoja · ${esc(character.name)}</h2>
        <p class="muted">Copiá los totales de la hoja para compararlos con la ficha calculada. Podés revisar cada diferencia en el desglose.</p>
        ${character.sheetSource ? '<p class="muted">Referencia · ' + esc(character.sheetSource) + '</p>' : ''}
        <div class="comparison-table">
          <table><thead><tr><th>Valor</th><th>Hoja</th><th>App</th><th>Diferencia</th></tr></thead>
          <tbody>${rows.map(row => `<tr>
            <th scope="row">${esc(row.label)}</th>
            <td>${row.recorded ?? '—'}</td><td>${row.total ?? '—'}</td>
            <td>${row.difference == null ? 'Sin comparar' : row.difference === 0 ? 'Coincide' : Rules.signed(row.difference)}</td>
          </tr>`).join('')}</tbody></table>
        </div>
        <details class="sheet-section"><summary>Totales de referencia</summary>
          <form id="combat-reference-form"><div class="sheet-fields">
            ${fields(references, character.combat?.referenceTotals ?? {}, 'sheet-reference')}
          </div><button type="submit" class="btn primary">Guardar referencia</button></form>
        </details>
        <h3>Desgloses</h3>
        ${rows.filter(row => row.recorded != null).map(row => result(row.label, row.calculation)).join('')}
        ${character.sheetNotes ? '<h3>Notas de transcripción</h3><p class="rule-text">' + esc(character.sheetNotes) + '</p>' : ''}
        <button class="btn" id="combat-back">Volver a combate</button>`, 'Comparar con la hoja');
      byId('combat-reference-form').onsubmit = event => {
        event.preventDefault();
        character.combat = { ...character.combat, referenceTotals: read(references, event.currentTarget) };
        onChange('Totales de referencia guardados');
        comparison(character, onChange);
      };
      byId('combat-back').onclick = () => overview(character, onChange);
    }

    function changeList(character, key, index, item) {
      const next = (character[key] ?? []).slice();
      if (item) next[index] = item;
      else next.splice(index, 1);
      character[key] = next;
    }

    function equipmentForm(character, item, onChange) {
      const record = item ?? { kind: 'equipment', quantity: 1, carried: true, proficient: true };
      const extraFor = kind => kind === 'weapon' ? weaponFields : kind === 'shield' ? armorFields :
        kind === 'armor' ? [...armorFields, check('slows', 'Reduce la velocidad (armadura media o pesada)')] : [];
      modal(`${close}<h2>${item ? 'Editar equipo' : 'Agregar equipo'}</h2>
        <form id="combat-equipment"><div class="sheet-fields">${fields(common, record)}</div>
          <div class="sheet-fields" id="equipment-fields"></div>
          <p class="muted" id="equipment-damage-help" hidden>Si copiás el daño con atributo y mejora incluidos, elegí «Total de la hoja». Los efectos activos registrados se suman después.</p>
          ${fields(references, record)}
          <div class="row"><button type="submit" class="btn primary">Guardar</button>
            <button type="button" id="combat-back" class="btn">Volver</button>
            ${item ? '<button type="button" id="combat-remove" class="btn bad">Quitar del inventario</button>' : ''}</div>
        </form>`, 'Equipo');
      const category = byId('combat-kind');
      const update = () => {
        byId('equipment-fields').innerHTML = fields(extraFor(category.value), { ...record, mode: record.mode ?? 'melee' });
        byId('equipment-damage-help').hidden = category.value !== 'weapon';
      };
      category.onchange = update;
      byId('combat-back').onclick = () => inventory(character, onChange);
      update();
      byId('combat-equipment').onsubmit = event => {
        event.preventDefault();
        const next = { ...item, id: item?.id ?? Party.newId(), ...read([...common, ...extraFor(category.value), ...references], event.currentTarget) };
        if (!next.name) return;
        if (next.charges != null && next.chargesMax != null && next.charges > next.chargesMax) {
          alert('Las cargas restantes no pueden superar las máximas.');
          return;
        }
        if (next.equipped) next.carried = true;
        CombatData.putItem(character, next);
        onChange('Equipo guardado');
        inventory(character, onChange);
      };
      if (item) byId('combat-remove').onclick = () => {
        if (!confirm('¿Quitar ' + item.name + ' del inventario de ' + character.name + '?')) return;
        character.inventory = character.inventory.filter(entry => entry.id !== item.id);
        onChange('Objeto quitado');
        inventory(character, onChange);
      };
    }

    function moneyForm(character, onChange) {
      const specs = Object.entries(Rules.coins).map(([name, label]) => number(name, label, 0, 99999999));
      const value = { ...character.combat?.money, coinsCarried: character.combat?.coinsCarried !== false };
      modal(`${close}<h2>Monedas</h2>
        <form id="combat-money"><div class="sheet-fields">${fields(specs, value)}</div>
          ${field(check('coinsCarried', 'Contar las monedas en el peso llevado'), value.coinsCarried)}
          <div class="row"><button type="submit" class="btn primary">Guardar</button><button id="combat-back" class="btn" type="button">Volver</button></div>
        </form>`, 'Monedas');
      byId('combat-back').onclick = () => inventory(character, onChange);
      byId('combat-money').onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        character.combat = { ...character.combat, money: read(specs, form), coinsCarried: form.elements.coinsCarried.checked };
        onChange('Monedas guardadas');
        inventory(character, onChange);
      };
    }

    function inventory(character, onChange) {
      const { carried } = Rules.sheet(character);
      const items = character.inventory ?? [];
      const limits = carried.limits ? `
        <p class="muted">Ligera hasta ${amount.format(carried.limits[0])} lb · Media hasta ${amount.format(carried.limits[1])} lb · Pesada hasta ${amount.format(carried.limits[2])} lb</p>
        <p class="muted">Capacidad según Fuerza ${carried.strength} × ${amount.format(carried.factor)} por tamaño y forma</p>`
        : '<p class="muted">Cargá Fuerza y un tamaño válido en el perfil para calcular la capacidad.</p>';
      const loadLines = carried.weightParts.filter(item => item.value).map(item =>
        `<li>${esc(item.label)} · ${amount.format(item.value)} lb</li>`).join('');
      modal(`${close}<h2>Equipo · ${esc(character.name)}</h2>
        <div class="headrow"><button class="btn primary" id="equipment-add">Agregar objeto</button>
          <button class="btn sm" id="equipment-search-api">Buscar en catálogo PF1e</button>
          <button class="btn sm" id="equipment-money">Editar monedas</button></div>
        <p><strong>${amount.format(carried.weight)} lb</strong>${carried.missingWeights.length ? ' de peso conocido' : ''} · Carga ${esc(carried.tier.toLowerCase())}${carried.missingWeights.length ? ' mínima' : ''}</p>
        ${carried.missingWeights.length ? '<details><summary>Pesos por completar (' + carried.missingWeights.length + ')</summary><ul>' +
          carried.missingWeights.map(name => '<li>' + esc(name) + '</li>').join('') + '</ul></details>' : ''}
        ${limits}
        ${loadLines ? '<details><summary>Peso por objeto</summary><ul>' + loadLines + '</ul></details>' : ''}
        <p class="muted">${Object.entries(Rules.coins).map(([key, label]) =>
          label + ' ' + amount.format(character.combat?.money?.[key] ?? 0)).join(' · ')}</p>
        <ul class="sheet-list">${items.map((item, index) => `
          <li>
            <div class="headrow"><strong>${esc(item.name)}</strong>${sourceLink(item)}</div>
            <div class="muted">${Rules.categories[item.kind]} ×${item.quantity} · ${item.weight == null ? 'Peso pendiente' : amount.format(item.weight) + ' lb/u'}
              ${item.price == null ? '' : ' · ' + amount.format(item.price) + ' po/u'}${item.slot ? ' · ' + esc(item.slot) : ''}
              · ${item.equipped ? 'Equipado' : item.carried ? 'En la carga' : 'Guardado'}
              ${item.charges != null ? ' · Cargas ' + item.charges + (item.chargesMax != null ? ' / ' + item.chargesMax : '') : ''}
            </div>
            ${item.kind === 'armor' || item.kind === 'shield' ? '<p class="muted">CA +' + ((item.acBonus ?? 0) + (item.enhancement ?? 0)) +
              ' · Máximo Des ' + (item.dexCap == null ? 'sin transcribir' : '+' + item.dexCap) +
              ' · Penalizador ' + Rules.signed(item.checkPenalty ?? 0) + ' · Fallo arcano ' + (item.arcaneFailure ?? 0) + '%</p>' : ''}
            ${item.notes ? '<p class="rule-text">' + esc(item.notes) + '</p>' : ''}
            <div class="row sheet-actions">
              <button class="btn sm" data-item="${index}" data-item-action="edit">Editar</button>
              <button class="btn sm" data-item="${index}" data-item-action="equip">${item.equipped ? 'Desequipar' : 'Equipar'}</button>
            </div>
          </li>`).join('')}</ul>
        <div class="row">${link(documentation.equipment, 'Equipo')}${link(documentation.weapons, 'Armas')}${link(documentation.armor, 'Armaduras')}${link(documentation.load, 'Carga')}</div>`, 'Equipo');
      byId('equipment-add').onclick = () => equipmentForm(character, null, onChange);
      byId('equipment-search-api').onclick = () => equipmentSearch(character, onChange);
      byId('equipment-money').onclick = () => moneyForm(character, onChange);
      byId('backdrop').addEventListener('click', event => {
        const button = event.target.closest('[data-item]');
        if (!button) return;
        const item = items[Number(button.dataset.item)];
        if (button.dataset.itemAction === 'edit') equipmentForm(character, item, onChange);
        else {
          CombatData.putItem(character, { ...item, equipped: !item.equipped, carried: true });
          onChange(item.equipped ? 'Objeto desequipado' : 'Objeto equipado');
          inventory(character, onChange);
        }
      });
    }

    function equipmentSearch(character, onChange) {
      modal(`${close}<h2>Buscar equipo</h2>
        <p class="muted">Buscá armas, armaduras, objetos y consumibles en la API Pathfinder 1e. Los bonificadores de objetos mágicos quedan como notas para revisión y no modifican los cálculos automáticamente.</p>
        <div class="field"><label for="api-item-query">Nombre del objeto</label><div class="row"><input id="api-item-query" maxlength="100" placeholder="Arma, armadura u objeto"><button type="button" class="btn sm" id="api-item-search">Buscar</button></div></div>
        <ul class="sheet-list" id="api-item-results"></ul>
        <button type="button" class="btn" id="api-item-back">Volver al inventario</button>`, 'Buscar equipo en Pathfinder 1e');
      let results = [];
      byId('api-item-back').onclick = () => inventory(character, onChange);
      byId('api-item-search').onclick = async () => {
        const target = byId('api-item-results');
        const query = byId('api-item-query').value.trim();
        if (!query) { target.textContent = 'Escribí un nombre para buscar.'; return; }
        target.textContent = 'Buscando…';
        try {
          const response = await PathfinderApi.searchItems(query);
          results = response.data;
          target.innerHTML = results.length ? results.map((item, index) => `<li><strong>${esc(item.name)}</strong><div class="muted">${esc(item.type)}${item.subtype ? ' · ' + esc(item.subtype) : ''}${Number.isFinite(item.price_gp) ? ' · ' + item.price_gp + ' po' : ''}${Number.isFinite(item.weight) ? ' · ' + item.weight + ' lb' : ''}</div><button type="button" class="btn sm" data-api-item="${index}">Agregar al inventario</button></li>`).join('') : '<li>No se encontraron objetos.</li>';
        } catch (error) { target.textContent = error.message || 'No se pudo consultar la API.'; }
      };
      byId('api-item-results').addEventListener('click', event => {
        const button = event.target.closest('[data-api-item]');
        if (!button) return;
        const item = PathfinderApi.itemRecord(results[Number(button.dataset.apiItem)]);
        CombatData.putItem(character, item);
        onChange('Objeto agregado desde catálogo Pathfinder 1e; revisá sus notas y bonificadores.');
        inventory(character, onChange);
      });
    }

    const availableTargets = character => ({
      ...Rules.targets,
      ...Object.fromEntries((character.skills ?? []).map(skill => [Rules.skillTarget(skill.name), 'Habilidad · ' + skill.name])),
    });

    function effectForm(character, effect, index, onChange) {
      const record = effect ?? { sourceKind: 'spell', active: true, modifiers: [{}] };
      const entries = character.inventory ?? [];
      const gear = Object.fromEntries(entries.map(item => [item.id, item.name]));
      if (record.equipmentId && gear[record.equipmentId] === undefined) gear[record.equipmentId] = 'Objeto retirado';
      const specs = [
        input('name', 'Nombre del efecto', { required: true }), select('sourceKind', 'Origen', CombatData.sources),
        input('source', 'Fuente para el apilamiento (p. ej. Heroísmo)'),
        input('duration', 'Duración (p. ej. 4 asaltos)'),
        select('equipmentId', 'Requiere un objeto equipado', { '': 'Ninguno', ...gear }),
        check('active', 'Activo'),
      ];
      const targetOptions = availableTargets(character);
      for (const modifier of record.modifiers) {
        if (modifier.target && targetOptions[modifier.target] === undefined) {
          targetOptions[modifier.target] = 'Habilidad · ' + modifier.target.slice(6);
        }
      }
      const modifierSpecs = [
        select('target', 'Se aplica a', targetOptions),
        select('type', 'Tipo de bonificador', Rules.types),
        number('value', 'Valor', -99, 99, { required: true }),
      ];
      let rows = 0;
      const renderModifier = modifier => `<fieldset class="effect-modifier">
        <legend>Modificador</legend><div class="sheet-fields">${fields(modifierSpecs, modifier, 'effect-row-' + rows++)}</div>
        <button type="button" class="btn sm" data-remove-modifier>Quitar modificador</button>
      </fieldset>`;
      modal(`${close}<h2>${effect ? 'Editar efecto' : 'Agregar efecto'}</h2>
        <form id="combat-effect">
          <div class="sheet-fields">${fields(specs, record)}</div>
          <p class="muted">Usá la misma fuente para efectos repetidos. Activá o desactivá el efecto al comienzo o al final de su duración.</p>
          <div id="effect-modifiers">${record.modifiers.map(renderModifier).join('')}</div>
          <button type="button" class="btn sm" id="effect-add-modifier">Añadir modificador</button>
          ${fields(references, record)}
          <div class="row"><button type="submit" class="btn primary">Guardar</button><button type="button" id="combat-back" class="btn">Volver</button>
            ${effect ? '<button type="button" id="combat-remove" class="btn bad">Borrar efecto</button>' : ''}</div>
        </form>`, 'Efectos');
      const group = byId('effect-modifiers');
      byId('effect-add-modifier').onclick = () => group.insertAdjacentHTML('beforeend', renderModifier({}));
      group.addEventListener('click', event => event.target.closest('[data-remove-modifier]')?.closest('fieldset')?.remove());
      byId('combat-back').onclick = () => effects(character, onChange);
      byId('combat-effect').onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        const changed = read([...specs, ...references], form);
        if (!changed.name) return;
        changed.modifiers = Array.from(group.querySelectorAll('fieldset'), row => read(modifierSpecs, row));
        changeList(character, 'effects', index, changed);
        onChange('Efecto guardado');
        effects(character, onChange);
      };
      if (effect) byId('combat-remove').onclick = () => {
        if (!confirm('¿Borrar ' + effect.name + '?')) return;
        changeList(character, 'effects', index, null);
        onChange('Efecto borrado');
        effects(character, onChange);
      };
    }

    function effects(character, onChange) {
      const entries = character.effects ?? [];
      const knownTargets = availableTargets(character);
      const equipment = character.inventory ?? [];
      modal(`${close}<h2>Efectos · ${esc(character.name)}</h2>
        <button class="btn primary" id="effects-add">Agregar efecto</button>
        <ul class="sheet-list">${entries.map((effect, index) => {
          const worn = equipment.find(item => item.id === effect.equipmentId);
          const status = !effect.active ? 'Inactivo' : effect.equipmentId && !worn?.equipped ? 'Pendiente de equipar' : 'Activo';
          return `<li><div class="headrow"><strong>${esc(effect.name)}</strong>${sourceLink(effect)}</div>
            <div class="muted">${[
              status, CombatData.sources[effect.sourceKind], effect.source, worn?.name, effect.duration,
            ].filter(Boolean).map(esc).join(' · ')}</div>
            ${effect.modifiers.length ? '<ul>' + effect.modifiers.map(modifier => `
              <li>${Rules.signed(modifier.value)} ${esc(Rules.types[modifier.type])} · ${esc(knownTargets[modifier.target] ?? modifier.target.slice(6))}</li>`).join('') + '</ul>' : ''}
            ${effect.notes ? '<p class="rule-text">' + esc(effect.notes) + '</p>' : ''}
            <div class="row sheet-actions">
              <button class="btn sm" data-effect="${index}" data-effect-action="toggle">${effect.active ? 'Desactivar' : 'Activar'}</button>
              <button class="btn sm" data-effect="${index}" data-effect-action="edit">Editar</button></div>
          </li>`;
        }).join('')}</ul>
        <p>${link(documentation.effects, 'Tipos de bonificadores y apilamiento en d20PFSRD')}</p>`, 'Efectos activos');
      byId('effects-add').onclick = () => effectForm(character, null, entries.length, onChange);
      byId('backdrop').addEventListener('click', event => {
        const button = event.target.closest('[data-effect]');
        if (!button) return;
        const index = Number(button.dataset.effect);
        const effect = entries[index];
        if (button.dataset.effectAction === 'edit') effectForm(character, effect, index, onChange);
        else {
          changeList(character, 'effects', index, { ...effect, active: !effect.active });
          onChange(effect.active ? 'Efecto desactivado' : 'Efecto activado');
          effects(character, onChange);
        }
      });
    }

    return { overview, inventory, effects, result };
  }

  return { create };
})();
