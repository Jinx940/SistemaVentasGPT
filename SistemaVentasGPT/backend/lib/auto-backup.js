function getTimeZoneDateParts(date = new Date(), timeZone = 'America/Lima') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const find = (type) => parts.find((part) => part.type === type)?.value || '';

  return {
    year: find('year'),
    month: find('month'),
    day: find('day'),
    hour: Number(find('hour') || 0),
    minute: Number(find('minute') || 0),
    second: Number(find('second') || 0),
  };
}

function getTimeZoneDateKey(date = new Date(), timeZone = 'America/Lima') {
  const { year, month, day } = getTimeZoneDateParts(date, timeZone);
  return year && month && day ? `${year}-${month}-${day}` : '';
}

function shouldRunAutomaticBackup({
  now = new Date(),
  timeZone = 'America/Lima',
  targetHour = 3,
  lastLocalDate = '',
} = {}) {
  const localDateKey = getTimeZoneDateKey(now, timeZone);
  const { hour } = getTimeZoneDateParts(now, timeZone);

  return {
    shouldRun: !!localDateKey && hour >= targetHour && localDateKey !== String(lastLocalDate || ''),
    localDateKey,
    localHour: hour,
  };
}

module.exports = {
  getTimeZoneDateParts,
  getTimeZoneDateKey,
  shouldRunAutomaticBackup,
};
