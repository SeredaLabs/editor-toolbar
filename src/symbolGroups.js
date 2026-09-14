'use strict';
const KIND_LABEL = {
  procedure:       'Procedure',
  function:        'Function',
  method:          'Method',
  custom:          'Custom',
  'bsl-procedure': 'Procedure',
  'bsl-function':  'Function',
};

// Порядок секцій у згрупованому Quick Pick; секція без жодного символу в файлі
// просто не з'являється — порожніх заголовків не показуємо.
const GROUP_ORDER = ['Procedure', 'Function', 'Method', 'Custom'];
const GROUP_TITLE = { Procedure: 'PROCEDURES', Function: 'FUNCTIONS', Method: 'METHODS', Custom: 'CUSTOM' };

// Чиста функція без залежності від vscode — групує символи за нормалізованим
// kind-лейблом у фіксованому порядку, готова для показу як секції Quick Pick.
function groupByKindLabel(fns) {
  const groups = new Map();
  for (const fn of fns) {
    const label = KIND_LABEL[fn.kind] ?? 'Function';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(fn);
  }
  return GROUP_ORDER
    .map(label => ({ title: GROUP_TITLE[label], items: groups.get(label) ?? [] }))
    .filter(g => g.items.length);
}


module.exports = { KIND_LABEL, groupByKindLabel };
