'use strict';
const copy = require('../../data/foundation-40/explorer-copy');

module.exports = function itemUseText(item, language) {
  const text = copy[language];
  if (item.use !== 'queue-time') return text[item.use];
  if (!Number.isSafeInteger(item.minutes) || item.minutes <= 0) throw new Error('Missing speedup duration: ' + item.id);
  const hours = item.minutes % 60 === 0;
  return (hours ? text['queue-time-hours'] : text['queue-time']).replace(
    hours ? '{hours}' : '{minutes}',
    new Intl.NumberFormat(language).format(hours ? item.minutes / 60 : item.minutes)
  );
};
