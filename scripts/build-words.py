#!/usr/bin/env python3
"""두 사전에서 2글자 명사 목록을 만들어 words.js 를 생성한다.

사용법: python3 scripts/build-words.py <hunspell ko.dic> <kr_korean.csv>

- 출제용(WORDS): hunspell-ko 의 2글자 명사. 일상에서 자주 쓰는 단어 위주라 문제와 AI 답에 쓴다.
- 판정용(WORDS_EXTRA): 표준국어대사전 표제어 중 2글자 명사에서 출제용을 뺀 나머지.
  플레이어가 낸 단어가 사전에 있는지 판정할 때 출제용과 합쳐서 쓴다.

출처
- hunspell-dict-ko: https://github.com/spellcheck-ko/hunspell-dict-ko (MPL/GPL/LGPL)
- 표준국어대사전 표제어 DB(2018): https://github.com/korean-word-game/db
"""
import sys, re, csv, unicodedata, json, os

NOUN_FLAGS = {"10", "25"}
VERB_FLAGS = {"44", "49", "36", "34"}
SKIP_PARTS = {"", "방언", "북한어", "옛말", "어미", "접사", "조사", "동사", "형용사", "부사",
              "감탄사", "관형사", "수사", "보조동사", "보조형용사", "부사·감탄사"}
TWO = re.compile(r"[가-힣]{2}")


def hunspell_nouns(path):
    words = {}
    for line in open(path, encoding="utf8").read().split("\n")[1:]:
        if not line:
            continue
        line = unicodedata.normalize("NFC", line)
        w, _, f = line.partition("/")
        words.setdefault(w, set()).update(f.split(",") if f else [])
    return {w for w, f in words.items() if TWO.fullmatch(w) and f & NOUN_FLAGS and not f & VERB_FLAGS}


def stdict_nouns(path):
    out = set()
    for row in csv.reader(open(path, encoding="utf-8-sig")):
        if len(row) < 2:
            continue
        w = unicodedata.normalize("NFC", re.sub(r"[-^ ]", "", row[0]))
        part = row[1].strip()
        if not TWO.fullmatch(w):
            continue
        if "명사" in part or part not in SKIP_PARTS:
            out.add(w)
    return out


common = hunspell_nouns(sys.argv[1])
everything = stdict_nouns(sys.argv[2]) | common
extra = sorted(everything - common)
common = sorted(common)

here = os.path.dirname(os.path.abspath(__file__))
target = os.path.join(here, "..", "words.js")
with open(target, "w", encoding="utf8") as fh:
    fh.write("// 2글자 명사 목록. scripts/build-words.py 로 생성.\n")
    fh.write("window.WORDS = " + json.dumps(" ".join(common), ensure_ascii=False) + ".split(' ');\n")
    fh.write("window.WORDS_EXTRA = " + json.dumps(" ".join(extra), ensure_ascii=False) + ".split(' ');\n")
print("common", len(common), "extra", len(extra), "->", target)

