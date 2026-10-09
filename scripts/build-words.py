#!/usr/bin/env python3
"""hunspell-ko 사전에서 2글자 명사 목록을 뽑아 words.js 를 만든다.

사용법: python3 scripts/build-words.py <ko.dic 경로>
사전 출처: https://github.com/spellcheck-ko/hunspell-dict-ko (MPL/GPL/LGPL)
"""
import sys, re, unicodedata, json, os

NOUN_FLAGS = {"10", "25"}                 # 명사 계열 플래그
VERB_FLAGS = {"44", "49", "36", "34"}     # 용언 계열 플래그
# 영상에서 정답으로 인정된 단어 등, 사전에 없지만 허용할 단어
EXTRA = ["유광", "규칙"]

src = sys.argv[1]
words = {}
for line in open(src, encoding="utf8").read().split("\n")[1:]:
    if not line:
        continue
    line = unicodedata.normalize("NFC", line)
    w, _, f = line.partition("/")
    flags = set(f.split(",")) if f else set()
    words.setdefault(w, set()).update(flags)

out = sorted({w for w, f in words.items()
              if re.fullmatch(r"[가-힣]{2}", w) and f & NOUN_FLAGS and not f & VERB_FLAGS} | set(EXTRA))
here = os.path.dirname(os.path.abspath(__file__))
target = os.path.join(here, "..", "words.js")
with open(target, "w", encoding="utf8") as fh:
    fh.write("// 2글자 명사 목록 (hunspell-ko 에서 생성, scripts/build-words.py)\n")
    fh.write("window.WORDS = " + json.dumps(" ".join(out), ensure_ascii=False) + ".split(' ');\n")
print(len(out), "words ->", target)

