# 한글 술래잡기

네 가지 소원 EP.2 3회전의 응용 데스매치 〈미니 숨바꼭질〉을 웹게임으로 만든 프로젝트입니다.

## 실행

```bash
python3 -m http.server 5173   # 이후 http://localhost:5173 접속
node --test test/engine.test.js
```

## 구성

- `engine.js` 규칙 엔진: 자모 분해, 자음/모음 능력, 경로 탐색, 추가 조건, 문제 생성
- `app.js`, `index.html`, `style.css` 화면
- `words.js` 2글자 명사 14,541개 (hunspell-ko에서 생성, `scripts/build-words.py`)

## 영상에서 확인한 규칙과 가정

영상 확인: 자음 능력(같은 글자 안의 다른 자음 칸으로 이동), 모음 능력(튀어나온 획의 방향·획 수만큼 이동),
ㅡ/ㅣ는 모음 능력 없음, 받침이 없거나 자음이 한 종류면 자음 능력 없음, 칸이 없으면 이동 불가,
두 글자 코드네임, 추가 조건 2종, 오답 30초 정지, 2점 선취.
예시 `규칙`(출발 ㅊ)은 테스트로 고정되어 있습니다.

가정(영상 장면 미확인): ㅐ/ㅔ/ㅒ/ㅖ는 ㅏ/ㅓ/ㅑ/ㅕ와 같은 이동, ㅚ/ㅟ/ㅙ/ㅞ는 ㅗ/ㅜ/ㅘ/ㅝ와 같은 이동,
ㅢ는 모음 능력 없음, 쌍자음(ㄲ ㄸ ㅃ ㅆ ㅉ)은 기본 자음(ㄱ ㄷ ㅂ ㅅ ㅈ) 칸으로 취급.
이 값은 `engine.js`의 `VOWEL_MOVES`, `BASE`에서 고칩니다.

## 사전 출처

단어 목록은 [hunspell-dict-ko](https://github.com/spellcheck-ko/hunspell-dict-ko)(MPL 1.1 / GPL 2+ / LGPL 2.1+)에서 2글자 명사만 추출한 것입니다.
