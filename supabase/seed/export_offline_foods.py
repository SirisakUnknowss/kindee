"""Export the curated SQL seed as a compact catalogue bundled with the app."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# The first seed plus every later delta (--since) migration; later files only add names.
SOURCES = [
    ROOT / "supabase/migrations/20260918060000_seed_thai_foods.sql",
    ROOT / "supabase/migrations/20260921060000_add_missing_thai_foods.sql",
    ROOT / "supabase/migrations/20260928090000_add_more_drinks_and_dishes.sql",
    ROOT / "supabase/migrations/20260929090000_add_drink_menu_catalogue.sql",
]
TARGET = ROOT / "kindee-app/src/data/thai-foods.json"


def split_fields(row: str) -> list[str]:
    fields: list[str] = []
    current: list[str] = []
    quoted = False
    depth = 0
    i = 0
    while i < len(row):
        char = row[i]
        if char == "'":
            current.append(char)
            if quoted and i + 1 < len(row) and row[i + 1] == "'":
                current.append("'")
                i += 1
            else:
                quoted = not quoted
        elif not quoted and char == "[":
            depth += 1
            current.append(char)
        elif not quoted and char == "]":
            depth -= 1
            current.append(char)
        elif not quoted and depth == 0 and char == ",":
            fields.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        i += 1
    fields.append("".join(current).strip())
    return fields


def text(value: str) -> str | None:
    if value == "null":
        return None
    return value[1:-1].replace("''", "'")


def read_foods(path: Path, seen: set[str]) -> list[dict]:
    foods = []
    source = path.read_text(encoding="utf-8")
    for match in re.finditer(r"^\s*\('(seed:th:\d+)'(.*?)\),?$", source, re.MULTILINE):
        seed_id, remainder = match.groups()
        row = split_fields("'" + seed_id + "'" + remainder)
        if len(row) != 13:
            raise ValueError(f"Unexpected seed row ({len(row)} fields): {match.group(0)}")
        _, name, name_en, aliases, category, _is_dish, kcal, protein, carb, fat, grams, portion, _popularity = row
        name = text(name)
        if not name or name in seen:
            continue
        seen.add(name)
        category = text(category) or "dish"
        cat = {"drink": "drink", "fruit": "fruit", "sweet": "sweet", "dessert": "sweet", "store": "store"}.get(category, "dish")
        digest = hashlib.md5(name.encode("utf-8")).hexdigest()
        food_id = f"{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:]}"
        foods.append({
            "id": food_id,
            "name": name,
            "nameEn": text(name_en),
            "cat": cat,
            "kcal100g": float(kcal),
            "protein100g": float(protein),
            "carb100g": float(carb),
            "fat100g": float(fat),
            "grams": float(grams),
            "portion": text(portion) or "ที่",
        })
    return foods


def main() -> None:
    seen: set[str] = set()
    foods = [food for path in SOURCES for food in read_foods(path, seen)]
    TARGET.write_text(json.dumps(foods, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(foods)} offline foods to {TARGET}")


if __name__ == "__main__":
    main()
