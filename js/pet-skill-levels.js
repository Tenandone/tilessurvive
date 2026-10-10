/* Level descriptions come directly from the page's reviewed skill data. No effects are calculated. */
(function () {
  'use strict';
  var sections = document.querySelectorAll('[data-pet-skill-levels]');
  sections.forEach(function (section) {
    var source = section.querySelector('script[data-pet-skill-levels-data]');
    if (!source) return;
    var data;
    try { data = JSON.parse(source.textContent); } catch (_) { return; }
    if (!data || !Array.isArray(data.skills) || !data.copy) return;
    var format = function (template, level) { return template.replace('{level}', String(level)); };
    data.skills.forEach(function (skill) {
      var card = section.querySelector('[data-pet-skill-slot="' + skill.slot + '"]');
      if (!card || !Array.isArray(skill.levels) || !skill.levels.length) return;
      var select = card.querySelector('[data-skill-level]');
      if (!select) return;
      var comparisonSelect = card.querySelector('[data-skill-compare-level]');
      var comparisonToggle = card.querySelector('[data-skill-compare-toggle]');
      var comparison = card.querySelector('[data-skill-comparison]');
      var find = function (value) { return skill.levels.find(function (entry) { return String(entry.level) === value; }); };
      function update() {
        var selected = find(select.value);
        if (!selected) return;
        card.querySelector('[data-skill-effect]').textContent = selected.description;
        card.querySelector('[data-skill-level-label]').textContent = format(data.copy.selected, selected.level);
        var training = card.querySelector('[data-skill-training]');
        if (training && Number.isInteger(selected.trainingStage)) {
          training.textContent = data.copy.training + ': ' + selected.trainingStage;
          training.hidden = false;
        } else if (training) training.hidden = true;
        if (!comparison || !comparisonToggle || !comparisonSelect) return;
        comparison.hidden = !comparisonToggle.checked;
        comparisonSelect.disabled = !comparisonToggle.checked;
        card.querySelector('[data-skill-effects]').classList.toggle('is-comparing', comparisonToggle.checked);
        var compared = find(comparisonSelect.value);
        if (!compared) return;
        card.querySelector('[data-skill-comparison-effect]').textContent = compared.description;
        card.querySelector('[data-skill-comparison-label]').textContent = format(data.copy.comparison, compared.level);
        var otherTraining = card.querySelector('[data-skill-comparison-training]');
        if (otherTraining && Number.isInteger(compared.trainingStage)) {
          otherTraining.textContent = data.copy.training + ': ' + compared.trainingStage;
          otherTraining.hidden = false;
        } else if (otherTraining) otherTraining.hidden = true;
      }
      select.addEventListener('change', update);
      comparisonSelect?.addEventListener('change', update);
      comparisonToggle?.addEventListener('change', update);
      card.querySelector('[data-skill-controls]').hidden = false;
      update();
    });
  });
}());
