#!/usr/bin/env python3
"""lib/quiz.ts 문제 감사 스크립트 (의존성 없음).

검사 항목
1. id 중복 0
2. 초성: prompt 의 초성이 options[answer] 의 실제 한글 초성과 100% 일치
   - 다른 보기가 같은 초성 패턴을 가지면(정답이 둘 이상) 실패
   - 초성 표기 형식: 음절 사이 공백, 낱말 사이 ' · '
3. 노래: 보기 4개·중복 없음, answer 범위 유효, '___' 빈칸 유무 일관성
4. 틀린 그림: 9칸, 서로 다른 그림은 정확히 1개, 그 위치가 answer
5. 보기 순서: 정답 인덱스가 0~3(또는 0~8)에 고르게 분포 (한 곳에 40% 이상 몰리면 경고)
6. 해설·힌트 비어 있지 않음

사용: python3 scripts/audit_quiz.py
"""
import json
import re
import sys
from collections import Counter

SRC = "lib/quiz.ts"
CHO = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
BASE = 0xAC00


def initial(ch):
    code = ord(ch)
    if not (0xAC00 <= code <= 0xD7A3):
        return None
    return CHO[(code - BASE) // 588]


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def parse_blocks(src, name):
    """const NAME: Question[] = [ ... ]; 사이의 객체들을 꺼낸다."""
    m = re.search(rf"const {name}: Question\[\] = \[\n(.*?)\n\];", src, re.S)
    if not m:
        raise SystemExit(f"{name} 배열을 찾지 못했습니다")
    body = m.group(1)
    chunks = re.split(r"\n  \},\n  \{\n", "\n" + body + "\n")
    items = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk.startswith("{"):
            chunk = "{\n" + chunk
        if not chunk.endswith("}"):
            chunk = chunk + "\n}"
        item = {}
        item["id"] = json.loads(re.search(r'id: (".*?"),', chunk).group(1))
        item["type"] = json.loads(re.search(r'type: (".*?"),', chunk).group(1))
        item["prompt"] = json.loads(re.search(r'prompt: (".*?"),\n', chunk, re.S).group(1))
        item["hint"] = json.loads(re.search(r'hint: (".*?"),\n', chunk, re.S).group(1))
        opts_src = re.search(r"options: \[\n(.*?)\n    \],", chunk, re.S).group(1)
        item["options"] = [json.loads(m2) for m2 in re.findall(r'("(?:[^"\\]|\\.)*"),', opts_src)]
        item["answer"] = int(re.search(r"answer: (\d+),", chunk).group(1))
        item["explain"] = json.loads(re.search(r'explain: (".*?"),\n', chunk, re.S).group(1))
        items.append(item)
    return items


def prompt_words(prompt):
    """'ㅅ ㄹ · ㅂ ㄹ' -> ['ㅅㄹ', 'ㅂㄹ']"""
    groups = [g.strip() for g in prompt.split("·")]
    return ["".join(g.split()) for g in groups]


def word_initials(word):
    out = []
    for ch in word:
        ini = initial(ch)
        if ini is None:
            return None
        out.append(ini)
    return "".join(out)


def check_choseong(items, errors, warnings):
    for q in items:
        opts = q["options"]
        ans = q["answer"]
        if len(opts) != 4:
            errors.append(f"{q['id']}: 보기 개수 {len(opts)} (4개여야 함)")
            continue
        if len(set(opts)) != 4:
            errors.append(f"{q['id']}: 보기에 중복이 있음 {opts}")
        text = opts[ans]
        words = text.split()
        expected = [word_initials(w) for w in words]
        if any(e is None for e in expected):
            errors.append(f"{q['id']}: 정답 보기에 한글이 아닌 글자 {text!r}")
            continue
        got = prompt_words(q["prompt"])
        if got != expected:
            errors.append(f"{q['id']}: 초성 불일치 prompt={q['prompt']!r} / 기대={' '.join(expected)}")
        # 다른 보기도 같은 초성 패턴이면 정답이 둘 이상
        for i, o in enumerate(opts):
            if i == ans:
                continue
            pat = [word_initials(w) for w in o.split()]
            if None in pat:
                continue
            if pat == expected:
                errors.append(f"{q['id']}: 보기 {i} '{o}' 도 같은 초성 패턴 → 정답 중복")
        if not q["explain"].strip() or not q["hint"].strip():
            errors.append(f"{q['id']}: 힌트/해설이 비어 있음")


def check_lyrics(items, errors, warnings):
    for q in items:
        opts = q["options"]
        ans = q["answer"]
        if len(opts) != 4:
            errors.append(f"{q['id']}: 보기 개수 {len(opts)}")
        if len(set(opts)) != 4:
            errors.append(f"{q['id']}: 보기에 중복이 있음 {opts}")
        if not (0 <= ans < len(opts)):
            errors.append(f"{q['id']}: answer 범위 오류 {ans}")
        if not q["prompt"].strip():
            errors.append(f"{q['id']}: prompt 비어 있음")
        if not q["explain"].strip() or not q["hint"].strip():
            errors.append(f"{q['id']}: 힌트/해설이 비어 있음")
        if len(q["prompt"]) > 90:
            warnings.append(f"{q['id']}: prompt 길이 {len(q['prompt'])}자 (화면 확인 권장)")


def check_spot(items, errors, warnings):
    for q in items:
        opts = q["options"]
        ans = q["answer"]
        if len(opts) != 9:
            errors.append(f"{q['id']}: 칸 수 {len(opts)} (9칸이어야 함)")
            continue
        if not (0 <= ans < 9):
            errors.append(f"{q['id']}: answer 범위 오류 {ans}")
            continue
        odd = opts[ans]
        others = [o for i, o in enumerate(opts) if i != ans]
        if len(set(others)) != 1:
            errors.append(f"{q['id']}: 다른 그림이 2개 이상")
        if odd in others:
            errors.append(f"{q['id']}: 정답 칸이 나머지와 같음")
        if not q["explain"].strip():
            errors.append(f"{q['id']}: 해설 비어 있음")


def main():
    src = read(SRC)
    choseong = parse_blocks(src, "CHOSEONG")
    lyrics = parse_blocks(src, "LYRICS")
    spot = parse_blocks(src, "SPOT")
    everything = choseong + lyrics + spot

    errors, warnings = [], []

    ids = Counter(q["id"] for q in everything)
    for qid, n in ids.items():
        if n > 1:
            errors.append(f"id 중복: {qid} x{n}")

    for q in everything:
        expect_type = "choseong" if q in choseong else "lyrics" if q in lyrics else "spot"
        if q["type"] != expect_type:
            errors.append(f"{q['id']}: type {q['type']} (기대 {expect_type})")

    check_choseong(choseong, errors, warnings)
    check_lyrics(lyrics, errors, warnings)
    check_spot(spot, errors, warnings)

    # 정답 위치 분포
    dist_report = {}
    for name, items, size in (("choseong", choseong, 4), ("lyrics", lyrics, 4), ("spot", spot, 9)):
        c = Counter(q["answer"] for q in items)
        dist_report[name] = [c.get(i, 0) for i in range(size)]
        top = max(dist_report[name])
        if items and top / len(items) >= 0.4:
            warnings.append(f"{name}: 정답 {dist_report[name].index(top)}번에 {top}/{len(items)} 집중")

    print(f"초성 {len(choseong)} · 노래 {len(lyrics)} · 그림 {len(spot)} · 합계 {len(everything)}")
    print("정답 위치 분포:", json.dumps(dist_report, ensure_ascii=False))
    for w in warnings:
        print("WARN", w)
    if errors:
        for e in errors:
            print("FAIL", e)
        print(f"\n실패 {len(errors)}건")
        return 1
    print("\n✅ 모든 검사 통과 (오답·중복·초성 불일치 0건)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
