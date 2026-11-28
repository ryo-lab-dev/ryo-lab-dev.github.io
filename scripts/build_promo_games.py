#!/usr/bin/env python3
"""promo/apps.json（正本）から、公開済みの旧版アプリが読む promo/games.json（ゲームだけ・version 1）を作る。

  python3 scripts/build_promo_games.py          # games.json を作り直す
  python3 scripts/build_promo_games.py --check  # 正本とずれていないか確認（ずれていたら終了コード 1）
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT / "promo" / "apps.json"
GAMES = ROOT / "promo" / "games.json"
LEGACY_INLINE_LIMIT = 5  # 旧版のアプリは inlineLimit を games.json から読む


def build() -> str:
    data = json.loads(APPS.read_text(encoding="utf-8"))
    games = sorted(
        (a for a in data["apps"] if a.get("category") == "game"),
        key=lambda a: a.get("priority", 1000),
    )
    out_games = []
    for a in games:
        item = {k: v for k, v in a.items() if k not in ("category", "priority")}
        out_games.append(item)
    out = {
        "version": 1,
        "updatedAt": data["updatedAt"],
        "inlineLimit": LEGACY_INLINE_LIMIT,
        "games": out_games,
    }
    return json.dumps(out, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    text = build()
    if args.check:
        if GAMES.read_text(encoding="utf-8") != text:
            print("promo/games.json が promo/apps.json とずれています。python3 scripts/build_promo_games.py を実行してください。")
            return 1
        print("promo/games.json は promo/apps.json と一致しています。")
        return 0
    GAMES.write_text(text, encoding="utf-8")
    print("promo/games.json を作りました。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
