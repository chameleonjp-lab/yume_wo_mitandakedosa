/* No network requests; the user confirms any X post. */
(function (global) {
  'use strict';
  const title = '🌠夢を見たんだけどさ🌠';
  const tags = '#夢を見たんだけどさ #ゲーム制作';
  const copy = {
    ja: ['Xでシェア','流星を避け、赤い流星を壊して🍶を拾うスコアゲーム。','クリア','リタイア','今回のスコア','点'],
    en: ['Share on X','Dodge meteors, break red ones and catch 🍶 in this score game.','Clear','Retired','This score','pts'],
    es: ['Compartir en X','Esquiva meteoros, rompe los rojos y atrapa 🍶 para sumar puntos.','Completado','Abandono','Puntuación actual','ptos'],
    'pt-BR': ['Compartilhar no X','Desvie dos meteoros, destrua os vermelhos e pegue 🍶 para pontuar.','Concluído','Desistência','Pontuação atual','pts'],
    'zh-Hans': ['分享到X','躲避流星、击碎红色流星，接住🍶来得分。','通关','退出','本次分数','分'],
    fr: ['Partager sur X','Évitez les météores, brisez les rouges et attrapez 🍶 pour marquer.','Terminé','Abandon','Score actuel','pts'],
    de: ['Auf X teilen','Weiche Meteoren aus, zerstöre rote Meteore und fange 🍶 für Punkte.','Geschafft','Aufgegeben','Aktuelle Punktzahl','Punkte'],
    ko: ['X에 공유','유성을 피하고 빨간 유성을 부수며 🍶을 받아 점수를 얻으세요.','클리어','중도 종료','이번 점수','점'],
    ru: ['Поделиться в X','Уклоняйтесь от метеоров, разбивайте красные и ловите 🍶 ради очков.','Завершено','Выход','Текущий счёт','очк.'],
    it: ['Condividi su X','Schiva le meteore, distruggi quelle rosse e raccogli 🍶 per fare punti.','Completato','Ritirato','Punteggio attuale','punti'],
    'zh-Hant': ['分享到X','躲避流星、擊碎紅色流星，接住🍶來得分。','過關','退出','本次分數','分'],
    id: ['Bagikan di X','Hindari meteor, hancurkan yang merah, dan tangkap 🍶 untuk meraih skor.','Selesai','Berhenti','Skor kali ini','poin'],
    tr: ['X’te paylaş','Meteorlardan kaç, kırmızıları parçala ve puan için 🍶 yakala.','Tamamlandı','Bırakıldı','Bu oyunun puanı','puan'],
    vi: ['Chia sẻ trên X','Né thiên thạch, phá thiên thạch đỏ và đón 🍶 để ghi điểm.','Hoàn thành','Bỏ cuộc','Điểm lượt này','điểm'],
    th: ['แชร์บน X','หลบอุกกาบาต ทำลายลูกสีแดง และรับ 🍶 เพื่อเก็บคะแนน','ผ่านแล้ว','ออกจากเกม','คะแนนครั้งนี้','แต้ม']
  };
  const text = language => copy[language] || copy.en;
  function makeShareText(language, url, result) {
    const words = text(language);
    const lines = [title];
    if (result) {
      if (!Number.isFinite(result.score) || !['clear','retire'].includes(result.resultType)) throw new TypeError('Unconfirmed result');
      lines.push(result.resultType === 'clear' ? words[2] : words[3]);
      lines.push(words[4] + ': ' + Math.round(result.score) + ' ' + words[5]);
    } else lines.push(words[1]);
    lines.push(tags, url);
    return lines.join('\n');
  }
  let nextOpenAt = -Infinity;
  function openShare(language, url, result, open, fallback, now = Date.now) {
    const body = makeShareText(language, url, result);
    const stamp = now();
    if (stamp < nextOpenAt) return { status: 'suppressed' };
    nextOpenAt = stamp + 500;
    const intent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(body);
    let popup = null;
    try {
      // Obtain an observable handle synchronously, then sever its opener before navigation.
      popup = open('about:blank', '_blank');
      if (!popup) throw new Error('Popup blocked');
      popup.opener = null;
      if (popup.opener !== null) throw new Error('Opener isolation failed');
      const link = popup.document.createElement('a');
      link.href = intent;
      link.target = '_self';
      link.rel = 'noreferrer';
      link.referrerPolicy = 'no-referrer';
      popup.document.body.appendChild(link);
      link.click();
      return { status: 'opened' };
    } catch (_) {
      if (popup) { try { popup.close(); } catch (_) {} }
      fallback(body);
      return { status: 'fallback' };
    }
  }
  global.YumeShare = Object.freeze({ text, makeShareText, openShare });
})(globalThis);
