/*
 * 게임 안 한글 키패드 (두벌식)
 * 휴대폰에서 시스템 키패드를 띄우면 Safari가 주소 줄과 이동·확인 줄을 붙이고 화면을 밀어 올린다.
 * 그래서 터치 기기에서는 이 키패드로 입력한다. 키 입력 목록을 그대로 한글로 조합한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JamoKeypad = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const V2 = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
  const J2 = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
  const isVowel = (k) => JUNG.includes(k);
  const canJong = (k) => JONG.includes(k);

  // 키 입력 목록 → 글자. cur는 조합 중인 글자 {cho, jung:[..], jong:[..]}
  function compose(keys) {
    let out = '';
    let cur = null;
    const text = (c) => {
      if (!c) return '';
      const jung = c.jung.length ? V2[c.jung.join('')] || c.jung[0] : null;
      const jong = c.jong.length ? J2[c.jong.join('')] || c.jong[0] : '';
      if (c.cho && jung) return String.fromCharCode(0xac00 + (CHO.indexOf(c.cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong));
      return (c.cho || '') + (jung || '');
    };
    const flush = (next) => { out += text(cur); cur = next; };
    for (const k of keys) {
      if (isVowel(k)) {
        if (cur && cur.jong.length) {
          const moved = cur.jong.pop();
          flush({ cho: moved, jung: [k], jong: [] });
        } else if (cur && cur.jung.length) {
          if (cur.jung.length === 1 && V2[cur.jung[0] + k]) cur.jung.push(k);
          else flush({ cho: null, jung: [k], jong: [] });
        } else if (cur && cur.cho) cur.jung.push(k);
        else flush({ cho: null, jung: [k], jong: [] });
      } else {
        if (cur && cur.cho && cur.jung.length && !cur.jong.length && canJong(k)) cur.jong.push(k);
        else if (cur && cur.cho && cur.jong.length === 1 && J2[cur.jong[0] + k]) cur.jong.push(k);
        else flush({ cho: k, jung: [], jong: [] });
      }
    }
    return out + text(cur);
  }

  // 글자 → 키 입력 목록 (밖에서 값을 바꿨을 때 다시 맞추기 위해)
  const SPLIT_V = Object.fromEntries(Object.entries(V2).map(([k, v]) => [v, [...k]]));
  const SPLIT_J = Object.fromEntries(Object.entries(J2).map(([k, v]) => [v, [...k]]));
  function toKeys(str) {
    const keys = [];
    for (const ch of str) {
      const code = ch.charCodeAt(0) - 0xac00;
      if (code < 0 || code > 11171) { keys.push(ch); continue; }
      const cho = CHO[Math.floor(code / 588)];
      const jung = JUNG[Math.floor((code % 588) / 28)];
      const jong = JONG[code % 28];
      keys.push(cho, ...(SPLIT_V[jung] || [jung]));
      if (jong) keys.push(...(SPLIT_J[jong] || [jong]));
    }
    return keys;
  }

  const ROWS = [
    ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
    ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
    ['shift', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', 'back'],
  ];
  const SHIFT = { 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' };

  return { compose, toKeys, ROWS, SHIFT, isVowel };
});

