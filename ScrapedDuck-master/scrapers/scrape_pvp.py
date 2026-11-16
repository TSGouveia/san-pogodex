"""
GO Battle League (PvP) season scraper.

Source: pokemongo.fandom.com (MediaWiki API, wikitext).
The current season is found dynamically: every existing "Season_N" page is listed,
and the highest-numbered one that already has a Pokémon encounter table wins.
"""
import re
import datetime
import requests

try:
    from scrapers.cp_utils import load_pokedex_map
except ImportError:  # run directly
    from cp_utils import load_pokedex_map

API_URL = "https://pokemongo.fandom.com/api.php"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
MAX_SEASON_PROBE = 100

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july",
     "august", "september", "october", "november", "december"], start=1)}

# Fandom "ci=" image suffixes -> display form
FORM_LABELS = {
    "alolan": ("Alolan", True), "galarian": ("Galarian", True),
    "hisuian": ("Hisuian", True), "paldean": ("Paldean", True),
    "origin": ("Origin", False), "altered": ("Altered", False),
    "therian": ("Therian", False), "incarnate": ("Incarnate", False),
    "lowkey": ("Low Key", False), "amped": ("Amped", False),
    "libre": ("Libre", False), "defense": ("Defense", False),
    "attack": ("Attack", False), "speed": ("Speed", False),
    "female": ("Female", False), "male": ("Male", False),
}


def _api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    r = requests.get(API_URL, params=params, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return r.json()


def _existing_seasons():
    nums = list(range(1, MAX_SEASON_PROBE + 1))
    found = []
    for i in range(0, len(nums), 50):  # API limit: 50 titles per query
        chunk = nums[i:i + 50]
        data = _api({"action": "query", "titles": "|".join(f"Season_{n}" for n in chunk)})
        for page in data.get("query", {}).get("pages", []):
            if page.get("missing") or page.get("invalid"):
                continue
            m = re.match(r"Season (\d+)$", page.get("title", ""))
            if m:
                found.append(int(m.group(1)))
    return sorted(set(found), reverse=True)


def _wikitext(title):
    data = _api({"action": "parse", "page": title, "prop": "wikitext", "redirects": "1"})
    return data.get("parse", {}).get("wikitext", "") or ""


def _strip_wiki(text):
    text = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", "", text, flags=re.S)
    text = re.sub(r"\{\{Nth\|(\d+)\}\}", r"\1", text)
    text = re.sub(r"\[\[File:[^\]]*\]\]", "", text)
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", text)
    text = re.sub(r"\{\{I\|([^|}]*)\|([^|}]*)[^}]*\}\}",
                  lambda m: f"{m.group(2)} {m.group(1)}".strip() if m.group(2) else m.group(1), text)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)
    text = re.sub(r"'''?", "", text)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def _parse_date(text):
    text = _strip_wiki(text).replace(",", " ")
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})", text)
    if not m or m.group(1).lower() not in MONTHS:
        return None
    try:
        return datetime.date(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2))).isoformat()
    except ValueError:
        return None


def _section(wikitext, heading, level=None):
    eq = "=" * level if level else "={2,4}"
    m = re.search(rf"^{eq}\s*{re.escape(heading)}\s*{eq}\s*$", wikitext, flags=re.M)
    if not m:
        return ""
    depth = len(re.match(r"=+", wikitext[m.start():]).group(0))
    nxt = re.search(rf"^={{2,{depth}}}[^=]", wikitext[m.end():], flags=re.M)
    return wikitext[m.end(): m.end() + nxt.start()] if nxt else wikitext[m.end():]


def _table_rows(block):
    """Rows of the first wikitable in block -> list of cell lists (header rows skipped)."""
    m = re.search(r"\{\|.*?\n\|\}", block, flags=re.S)
    if not m:
        return []
    rows = []
    for raw in re.split(r"\n\|-+", m.group(0))[1:]:
        cells, cur = [], None
        for line in raw.split("\n"):
            if line.startswith("|}"):
                break
            if line.startswith("|") and not line.startswith("|+"):
                if cur is not None:
                    cells.append(cur)
                cur = line[1:].strip()
            elif cur is not None:
                cur += "\n" + line
        if cur is not None:
            cells.append(cur)
        if cells:
            rows.append([c.strip() for c in cells])
    return rows


def _pokemon_from_templates(text, poke_map):
    out = []
    for m in re.finditer(r"\{\{I\|([^|}]+)((?:\|[^}]*)?)\}\}", text):
        base = m.group(1).strip()
        params = m.group(2)
        ci = re.search(r"\|ci=([^|}]+)", params)
        form_words = []
        if ci:
            rest = ci.group(1).strip()
            if rest.lower().startswith(base.lower()):
                rest = rest[len(base):]
            form_words = [w for w in rest.lower().split() if w]

        prefix, suffix = [], []
        for w in form_words:
            label, is_regional = FORM_LABELS.get(w, (w.title(), False))
            (prefix if is_regional else suffix).append(label)
        if base.lower() == "pikachu" and "Libre" in suffix and "Female" in suffix:
            suffix.remove("Female")  # Pikachu Libre is always female

        name = " ".join(prefix + [base])
        if suffix:
            name += f" ({' '.join(suffix)})"

        entry = poke_map.get(base.upper())
        out.append({
            "name": name,
            "baseName": base,
            "form": " ".join(prefix + suffix) or None,
            "dexNr": entry.get("dexNr") if entry else None,
        })
    return out


def _parse_formats(wikitext):
    rows = _table_rows(_section(wikitext, "Formats"))
    formats = []
    for cells in rows:
        if len(cells) < 3:
            continue
        leagues = [_strip_wiki(p) for p in re.split(r"<br\s*/?>", cells[0])]
        leagues = [l for l in leagues if l]
        start, end = _parse_date(cells[1]), _parse_date(cells[2])
        if leagues and start:
            formats.append({"leagues": leagues, "start": start, "end": end})
    return formats


def _parse_cup_rules(wikitext):
    block = _section(wikitext, "Formats")
    block = re.sub(r"\{\|.*?\n\|\}", "", block, flags=re.S)
    rules = {}
    for m in re.finditer(r"^'''(.+?)''':\s*(.+)$", block, flags=re.M):
        rules[_strip_wiki(m.group(1))] = _strip_wiki(m.group(2))
    return rules


def _parse_ranks(wikitext):
    rows = _table_rows(_section(wikitext, "Ranks and Ratings"))
    return [{"rank": _strip_wiki(c[0]).replace("Rank ", ""), "requirement": _strip_wiki(c[1]) if len(c) > 1 else ""}
            for c in rows if c and _strip_wiki(c[0])]


def _parse_rewards(wikitext):
    block = _section(wikitext, "Rewards", level=2)
    head = re.split(r"^===", block, flags=re.M)[0]
    milestones = []
    for m in re.finditer(r"^\*\s*Rank (\d+):\s*(.+)$", head, flags=re.M):
        milestones.append({"rank": m.group(1), "reward": _strip_wiki(m.group(2))})

    stardust = []
    win_table = next((t for t in re.findall(r"\{\|.*?\n\|\}", head, flags=re.S) if "1st Win" in t), "")
    for cells in _table_rows(win_table):
        if len(cells) >= 5:
            stardust.append({
                "rank": _strip_wiki(cells[0]).replace("\n", " / "),
                "basic": [_strip_wiki(cells[1]), _strip_wiki(cells[2])],
                "premium": [_strip_wiki(cells[3]), _strip_wiki(cells[4])],
            })

    items = []
    items_block = re.search(r"random items can include:(.*?)(?:\n\n|\n[^*\n])", head, flags=re.S)
    if items_block:
        items = [_strip_wiki(l[1:]) for l in items_block.group(1).splitlines() if l.startswith("*")]
    return milestones, stardust, items


def _parse_encounters(wikitext, poke_map):
    block = _section(wikitext, "Pokémon", level=3) or _section(wikitext, "Pokémon")
    note = ""
    pre = block.split("{|")[0]
    if pre.strip():
        note = _strip_wiki(pre)
    tiers = []
    for cells in _table_rows(block):
        if len(cells) < 2:
            continue
        rank = _strip_wiki(cells[0]).replace("Rank ", "")
        guaranteed = _pokemon_from_templates(cells[1], poke_map)
        possible = _pokemon_from_templates(cells[2], poke_map) if len(cells) > 2 else []
        if rank and (guaranteed or possible):
            tiers.append({"rank": rank, "guaranteed": guaranteed, "possible": possible})
    return tiers, note


def _parse_end_rewards(wikitext):
    block = _section(wikitext, "End-of-Season rewards")
    extras = [_strip_wiki(l[1:]) for l in block.split("{|")[0].splitlines() if l.startswith("*")]
    stardust = [{"rank": _strip_wiki(c[0]), "stardust": _strip_wiki(c[1])}
                for c in _table_rows(block) if len(c) >= 2]
    return extras, stardust


def parse_season(number, wikitext, poke_map):
    encounters, note = _parse_encounters(wikitext, poke_map)
    if not encounters:
        return None
    title_m = re.search(r"also called '''(.+?)'''", wikitext)
    formats = _parse_formats(wikitext)
    milestones, win_stardust, random_items = _parse_rewards(wikitext)
    end_extras, end_stardust = _parse_end_rewards(wikitext)
    return {
        "season": number,
        "title": _strip_wiki(title_m.group(1)) if title_m else f"Season {number}",
        "url": f"https://pokemongo.fandom.com/wiki/Season_{number}",
        "start": formats[0]["start"] if formats else None,
        "end": formats[-1]["end"] if formats else None,
        "formats": formats,
        "cupRules": _parse_cup_rules(wikitext),
        "ranks": _parse_ranks(wikitext),
        "rankRewards": milestones,
        "winStardust": win_stardust,
        "randomItems": random_items,
        "encounters": encounters,
        "encounterNote": note,
        "endOfSeason": {"rewards": end_extras, "stardust": end_stardust},
    }


def scrape_pvp():
    print("Scraping GO Battle League season from Pokémon GO Fandom wiki...")
    try:
        poke_map = load_pokedex_map()
        seasons = _existing_seasons()
        print(f"  -> Found season pages up to Season {seasons[0] if seasons else '?'}")
        for n in seasons[:5]:  # newest first; skip pages without Pokémon yet
            season = parse_season(n, _wikitext(f"Season_{n}"), poke_map)
            if season:
                total = sum(len(t["guaranteed"]) + len(t["possible"]) for t in season["encounters"])
                print(f"  -> Season {n} ({season['title']}): {len(season['formats'])} formats, "
                      f"{len(season['encounters'])} rank tiers, {total} encounters")
                return season
            print(f"  -> Season {n} has no Pokémon encounters yet, trying previous")
        print("  -> No season with Pokémon encounters found")
        return {}
    except Exception as e:
        print(f"Error scraping PvP season: {e}")
        return {}


if __name__ == "__main__":
    import json
    print(json.dumps(scrape_pvp(), indent=2, ensure_ascii=False)[:6000])
