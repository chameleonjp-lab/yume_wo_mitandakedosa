/* Client-only result retention; not a server identity or a retry queue. */
(function (global) {
  'use strict';
  const RESULT_KEY = 'yume_mitandakedosa_result_v1';
  const normalizeName = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 16) : '';
  function snapshotParticipation(value) {
    const name = normalizeName(value);
    return Object.freeze({ name, participates: name.length > 0 });
  }
  function retainResult(storage, result, participation, delivery) {
    let record = null;
    try {
      record = {
      version: 1,
      result: JSON.parse(JSON.stringify(result)),
      participation: { name: participation.name, participates: participation.participates },
      delivery,
      };
      const serialized = JSON.stringify(record);
      const previous = storage.getItem(RESULT_KEY);
      // Preserve any older or malformed record before replacing the latest pointer.
      // Archive sequence is local storage bookkeeping, never a participant/play identity.
      if (previous !== null && previous !== serialized) {
        let archiveKey = null;
        for (let n = 1; n <= 10000; n += 1) {
          const candidate = RESULT_KEY + '_archive_' + n;
          if (storage.getItem(candidate) === null) { archiveKey = candidate; break; }
        }
        if (!archiveKey) return { saved: false, record };
        storage.setItem(archiveKey, previous);
        if (storage.getItem(archiveKey) !== previous) return { saved: false, record };
      }
      storage.setItem(RESULT_KEY, serialized);
      return { saved: storage.getItem(RESULT_KEY) === serialized, record };
    } catch (_) {
      return { saved: false, record };
    }
  }
  function readRetainedResult(storage) {
    try {
      const raw = storage.getItem(RESULT_KEY);
      if (!raw) return { status: 'empty' };
      const record = JSON.parse(raw);
      if (record.version !== 1 || !record.result || !['clear', 'retire'].includes(record.result.resultType) ||
          !Number.isSafeInteger(record.result.score) || !Number.isFinite(record.result.elapsed) || record.result.elapsed < 0 ||
          !Number.isFinite(record.result.timeLeft) || !Number.isSafeInteger(record.result.survivalSeconds) || record.result.survivalSeconds < 0 ||
          !Number.isSafeInteger(record.result.survivalScore) || record.result.survivalScore < 0 ||
          !record.result.stats || !['blueHits','redDestroyed','redMissed','redHits','satelliteTapped','satelliteMissed','sakeCaught','sakeMissed'].every(key => Number.isSafeInteger(record.result.stats[key]) && record.result.stats[key] >= 0) ||
          !record.participation || typeof record.participation.name !== 'string' ||
          typeof record.participation.participates !== 'boolean' ||
          !['not-participating', 'not-eligible', 'pending', 'uncertain', 'failed', 'accepted'].includes(record.delivery)) {
        return { status: 'invalid' };
      }
      return { status: 'available', record };
    } catch (_) {
      return { status: 'unavailable' };
    }
  }
  global.YumeCommonState = Object.freeze({ normalizeName, snapshotParticipation, retainResult, readRetainedResult });
})(globalThis);
