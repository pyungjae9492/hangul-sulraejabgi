# 자모 점프

두 글자 단어로 자음과 모음을 타고 점프해서 초록 칸에서 깃발까지 가는 한글 퍼즐입니다.
웹 예능 〈네 가지 소원〉 EP.2 3회전 데스매치의 규칙을 바탕으로 만들었습니다.

https://pyungjae9492.github.io/hangul-sulraejabgi/

## 규칙

- 단어의 두 글자를 한 번씩, 순서는 자유롭게 써서 두 번 점프합니다.
- 한 글자는 지금 밟고 있는 칸의 자음이 그 글자에 들어 있을 때만 쓸 수 있습니다.
- 자음 점프: 같은 글자의 다른 자음 칸으로 이동합니다.
- 모음 점프: 모음의 획 방향으로 획 개수만큼 이동합니다. ㅡ ㅣ ㅢ는 모음 점프가 없습니다.
- 조건: 모든 칸 밟기, 모음 점프만.
- 대결: 오답이면 30초 정지, 2점을 먼저 딴 두 명이 생존합니다.

가정(영상 미확인): ㅐ/ㅔ/ㅒ/ㅖ는 ㅏ/ㅓ/ㅑ/ㅕ와 같은 이동, ㅚ/ㅟ/ㅙ/ㅞ는 ㅗ/ㅜ/ㅘ/ㅝ와 같은 이동,
쌍자음은 기본 자음 칸으로 취급. `engine.js`의 `VOWEL_MOVES`, `BASE`에서 고칩니다.

## 실행

```bash
python3 -m http.server 5173   # http://localhost:5173
node --test test/engine.test.js
```

## 단어 목록

`words.js`는 `scripts/build-words.py`로 만듭니다.

- `WORDS` (약 1.5만): 출제와 AI 답에 쓰는 일상 명사. [hunspell-dict-ko](https://github.com/spellcheck-ko/hunspell-dict-ko)(MPL/GPL/LGPL)에서 추출.
- `WORDS_EXTRA` (약 5.7만): 정답 판정에만 쓰는 나머지 2글자 명사. [표준국어대사전 표제어 DB](https://github.com/korean-word-game/db)(2018)에서 추출.
