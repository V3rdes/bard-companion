const LevelUp = (() => {
  'use strict';

  const sections = {
    profile: 'Atributos, clase y arquetipos',
    combat: 'Ataque base y salvaciones',
    entries: 'Habilidades, dotes y rasgos',
    spells: 'Conjuros y espacios',
    equipment: 'Equipo y efectos',
  };
  const hpModes = { keep: 'Mantener PG registrados', calculate: 'Calcular con los resultados ingresados', manual: 'Ingresar nuevo máximo manualmente' };
  const currentPolicies = { keep: 'Mantener PG actuales', add: 'Sumar la diferencia de máximos', full: 'Establecer al nuevo máximo' };
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const modifier = score => Math.floor((score - 10) / 2);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function validateReview(review) {
    return review == null || (record(review) && integer(review.level, 1, 20) &&
      integer(review.fromLevel, 1, 20) && typeof review.notes === 'string' &&
      record(review.checked) && Object.values(review.checked).every(value => typeof value === 'boolean') &&
      (review.hp == null || (record(review.hp) && Object.hasOwn(hpModes, review.hp.mode) &&
        Object.hasOwn(currentPolicies, review.hp.currentPolicy) &&
        (review.hp.maximum == null || integer(review.hp.maximum, 0, 9999)) &&
        (review.hp.current == null || integer(review.hp.current, -9999, 9999)) &&
        (review.hp.components == null || (Array.isArray(review.hp.components) && review.hp.components.every(component =>
          record(component) && typeof component.label === 'string' && Number.isSafeInteger(component.value)))))));
  }

  function hitPoints(character, input) {
    if (!Object.hasOwn(hpModes, input.hpMode) || !Object.hasOwn(currentPolicies, input.currentPolicy)) {
      throw new Error('Revisá cómo actualizar los PG.');
    }
    if (input.hpMode === 'keep') return null;
    let maximum = input.manualMaximum;
    const components = [];
    const originalMaximum = input.beforeMaximum;
    if (input.hpMode === 'calculate') {
      if (!integer(originalMaximum, 0, 9999)) throw new Error('Ingresá los PG máximos anteriores.');
      if (!integer(input.beforeConstitution, 1, 99) || !integer(input.constitution, 1, 99)) {
        throw new Error('Ingresá la Constitución anterior y la nueva para calcular los PG.');
      }
      if (!Array.isArray(input.rolls) || input.rolls.length !== input.level - character.level ||
        input.rolls.some(value => !integer(value, 1, 9999))) {
        throw new Error('Ingresá el resultado del dado o el valor acordado para cada nivel añadido.');
      }
      if (!integer(input.extra, -9999, 9999)) throw new Error('Revisá los otros ajustes de PG.');
      const previousModifier = modifier(input.beforeConstitution);
      const constitutionModifier = modifier(input.constitution);
      components.push({ label: 'PG máximos anteriores', value: originalMaximum });
      components.push({
        label: 'Cambio de Constitución en ' + character.level + ' niveles previos',
        value: character.level * (constitutionModifier - previousModifier),
      });
      input.rolls.forEach((roll, index) => {
        const result = Math.max(1, roll + constitutionModifier);
        components.push({
          label: 'Nivel ' + (character.level + index + 1) + ' · ' + roll + ' + (' + constitutionModifier + ') · mínimo 1',
          value: result,
        });
      });
      components.push({ label: 'Otros ajustes de PG', value: input.extra });
      maximum = components.reduce((total, component) => total + component.value, 0);
    }
    if (!integer(maximum, 0, 9999)) throw new Error('Los PG máximos deben ser un entero entre 0 y 9999.');
    let current = character.hpCurrent;
    if (input.currentPolicy === 'add') {
      if (!integer(originalMaximum, 0, 9999) || !integer(current, -9999, 9999)) {
        throw new Error('Para sumar la diferencia, cargá los PG máximos anteriores y los PG actuales.');
      }
      current += maximum - originalMaximum;
    }
    if (input.currentPolicy === 'full') current = maximum;
    if (current != null && !integer(current, -9999, 9999)) throw new Error('Revisá el nuevo valor de PG actuales.');
    return { maximum, current, components };
  }

  function update(character, input) {
    if (!integer(input.level, character.level + 1, 20)) {
      throw new Error('El nuevo nivel debe ser mayor que el actual y llegar como máximo a 20.');
    }
    if (input.constitution != null && !integer(input.constitution, 1, 99)) {
      throw new Error('Revisá el valor de Constitución.');
    }
    if (typeof input.className !== 'string' || typeof input.archetypes !== 'string' || typeof input.notes !== 'string') {
      throw new Error('Revisá los datos de la actualización.');
    }
    const hp = hitPoints(character, input);
    const patch = {
      level: input.level,
      className: input.className,
      archetypes: input.archetypes,
      constitution: input.constitution,
      levelReview: {
        fromLevel: character.level,
        level: input.level,
        notes: input.notes,
        checked: {},
        hp: { mode: input.hpMode, currentPolicy: input.currentPolicy, ...hp },
      },
    };
    if (hp) {
      patch.hpMax = hp.maximum;
      if (hp.current !== undefined) patch.hpCurrent = hp.current;
    }
    return patch;
  }

  return { sections, hpModes, currentPolicies, validateReview, hitPoints, update };
})();
