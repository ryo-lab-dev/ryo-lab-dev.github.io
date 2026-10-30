#!/usr/bin/env python3
"""静的サイトの sitemap と HTML ファイルの整合性を検査する。"""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import sys
from urllib.parse import unquote, urlparse
import xml.etree.ElementTree as ET


SITE_HOST = "ryo-lab.dev"
SITEMAP_NAMESPACE = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


class TitleParser(HTMLParser):
    """HTML から title 要素のテキストを抽出する。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return " ".join(" ".join(self.title_parts).split())


def resolve_site_path(root: Path, url_path: str) -> Path:
    """サイト内 URL のパスを対応するファイルパスに変換する。"""
    decoded_path = unquote(url_path)
    if not decoded_path.startswith("/") or "\\" in decoded_path:
        raise ValueError("URL パスが不正です")

    relative_path = decoded_path.lstrip("/")
    if not relative_path or relative_path.endswith("/"):
        relative_path += "index.html"

    target = (root / relative_path).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError("サイトルート外を参照しています") from exc
    return target


def check_site(root: Path) -> list[str]:
    errors: list[str] = []
    sitemap_path = root / "sitemap.xml"

    if not sitemap_path.is_file():
        return ["sitemap.xml が見つかりません"]

    try:
        sitemap = ET.parse(sitemap_path).getroot()
    except ET.ParseError as exc:
        return [f"sitemap.xml の XML 形式が不正です: {exc}"]

    if sitemap.tag != f"{SITEMAP_NAMESPACE}urlset":
        return ["sitemap.xml のルート要素が urlset ではありません"]

    seen_urls: set[str] = set()
    url_elements = sitemap.findall(f"{SITEMAP_NAMESPACE}url")
    if not url_elements:
        errors.append("sitemap.xml に URL がありません")

    for index, url_element in enumerate(url_elements, start=1):
        loc_element = url_element.find(f"{SITEMAP_NAMESPACE}loc")
        url = (loc_element.text or "").strip() if loc_element is not None else ""
        label = f"sitemap.xml の {index} 件目"

        if not url:
            errors.append(f"{label}: loc がありません")
            continue

        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc != SITE_HOST:
            errors.append(f"{label}: サイト外または HTTPS 以外の URL です: {url}")
            continue
        if parsed.query or parsed.fragment:
            errors.append(f"{label}: loc に query または fragment が含まれています: {url}")

        if url in seen_urls:
            errors.append(f"sitemap.xml に URL が重複しています: {url}")
            continue
        seen_urls.add(url)

        try:
            target = resolve_site_path(root, parsed.path)
        except ValueError as exc:
            errors.append(f"{label}: {url}: {exc}")
            continue

        if not target.is_file():
            errors.append(f"sitemap の URL に対応するファイルがありません: {url} -> {target.relative_to(root)}")
            continue

        if target.suffix.lower() in {".html", ".htm"}:
            try:
                parser = TitleParser()
                parser.feed(target.read_text(encoding="utf-8"))
                parser.close()
            except (OSError, UnicodeError) as exc:
                errors.append(f"HTML を読み取れません: {target.relative_to(root)}: {exc}")
                continue

            if not parser.title:
                errors.append(f"title が空、または存在しません: {target.relative_to(root)}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="sitemap と静的 HTML の整合性を検査します")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1],
                        help="サイトのルートディレクトリ（省略時はリポジトリルート）")
    args = parser.parse_args()

    root = args.root.resolve()
    errors = check_site(root)
    if errors:
        print(f"検査失敗: {len(errors)} 件")
        for error in errors:
            print(f"- {error}")
        return 1

    print("検査成功: sitemap の URL、参照先ファイル、HTML title に問題はありません")
    return 0


if __name__ == "__main__":
    sys.exit(main())
