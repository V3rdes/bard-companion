const SyncState = (() => {
  'use strict';
  const object = value => value != null && typeof value === 'object' && !Array.isArray(value);
  const equal = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((value, index) => equal(value, b[index]))
    : object(a) && object(b) && Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(key => Object.hasOwn(b, key) && equal(a[key], b[key])));
  const labels = {
    ...Object.fromEntries(Party.attributes), name: 'Nombre', className: 'Clase', level: 'Nivel',
    hpCurrent: 'PG actuales', hpMax: 'PG máximos', alignment: 'Alineamiento', ancestry: 'Ascendencia',
    archetypes: 'Arquetipos', size: 'Tamaño', speed: 'Velocidad', spells: 'Grimorio', spent: 'Espacios usados',
    slotTotals: 'Espacios diarios', lastRest: 'Último descanso', inventory: 'Equipo', effects: 'Efectos',
    skills: 'Habilidades', feats: 'Dotes', traits: 'Rasgos', combat: 'Combate', money: 'Monedas',
    pp: 'Platino', gp: 'Oro', sp: 'Plata', cp: 'Cobre', bab: 'Ataque base', landSpeed: 'Velocidad',
    fortitude: 'Fortaleza', reflex: 'Reflejos', will: 'Voluntad', referenceTotals: 'Totales de la hoja',
    ac: 'CA', touch: 'Toque', flat: 'Desprevenido', initiative: 'Iniciativa', cmb: 'BMC', cmd: 'DMC',
    sheetSource: 'Origen de la hoja', sheetNotes: 'Notas de la hoja', archived: 'Archivo de la ficha',
    castingAbility: 'Atributo de lanzamiento', castingModifier: 'Ajuste de lanzamiento', spellMode: 'Progresión de conjuros',
    spellFocusEnchantment: 'Spell Focus', levelReview: 'Revisión de nivel',
  };

  // Mezcla solo cambios independientes. Una misma propiedad editada en ambos lados
  // requiere una elección explícita; una ausencia también representa un borrado.
  function merge(base, local, remote, { preferLocal = false } = {}) {
    const conflicts = [];
    function combine(before, ours, theirs, path) {
      if (equal(ours, before)) return theirs;
      if (equal(theirs, before) || equal(ours, theirs)) return ours;
      const keyed = value => Array.isArray(value) && value.every(entry => object(entry) && typeof entry.id === 'string') &&
        new Set(value.map(entry => entry.id)).size === value.length;
      if ((before === undefined || keyed(before)) && keyed(ours) && keyed(theirs)) {
        const maps = [before ?? [], ours, theirs].map(entries => new Map(entries.map(entry => [entry.id, entry])));
        const [b, l, r] = maps;
        return [...new Set([...r.keys(), ...l.keys(), ...b.keys()])].map(id => combine(b.get(id), l.get(id), r.get(id),
          path.concat(l.get(id)?.name ?? r.get(id)?.name ?? 'Registro'))).filter(value => value !== undefined);
      }
      if ((before === undefined || object(before)) && object(ours) && object(theirs)) {
        return Object.fromEntries([...new Set([...Object.keys(before ?? {}), ...Object.keys(ours), ...Object.keys(theirs)])]
          .map(key => [key, combine(before?.[key], ours[key], theirs[key], path.concat(labels[key] ?? (/^\d+$/.test(key) ? 'Nivel ' + key : 'Dato de la ficha')))])
          .filter(([, value]) => value !== undefined));
      }
      if (!preferLocal) conflicts.push(path.join(' · '));
      return ours;
    }
    const map = state => new Map((state.characters ?? []).map(c => [c.id, c]));
    const [before, ours, theirs] = [base, local, remote].map(map);
    const ids = [...new Set([...theirs.keys(), ...ours.keys(), ...before.keys()])];
    const characters = ids.map(id => combine(before.get(id), ours.get(id), theirs.get(id),
      [ours.get(id)?.name ?? theirs.get(id)?.name ?? id])).filter(Boolean);
    const state = { ...remote, characters, activeCharacter: local.activeCharacter };
    state.activeCharacter = Party.active(state)?.id ?? null;
    return { state, conflicts };
  }

  return { merge };
})();
