"""
PvP rankings scraper (Great / Ultra / Master League).

Source: PvPoke's open-source data on GitHub (overall rankings + gamemaster).
The raw files are ~1.2 MB per league, so they are reduced here to what the site
shows: rank, score and recommended moveset per species, grouped by Pokédex number.

Output shape:
{
  "updatedAt": "...",
  "leagues": {"great": {"cap": 1500, "total": 1156}, ...},
  "moves": {"SNARL": ["Snarl", "dark"], ...},
  "species": {
    "625": [ {"id": "bisharp", "name": "Bisharp", "shadow": false,
              "great": [857, 64.2, ["SNARL", "DARK_PULSE", "IRON_HEAD"]], "ultra": [...], "master": [...]} ]
  }
}
"""
import datetime
import requests

BASE = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data"
LEAGUES = {"great": 1500, "ultra": 2500, "master": 10000}
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; pogo-data-scraper)"}


def _get(path):
    r = requests.get(f"{BASE}/{path}", headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def scrape_pvp_rankings():
    print("Scraping PvP rankings from PvPoke...")
    try:
        gm = _get("gamemaster.json")
    except Exception as e:
        print(f"  Could not load PvPoke gamemaster: {e}")
        return {}

    gm_species = {p["speciesId"]: p for p in gm.get("pokemon", [])}
    move_names = {m["moveId"]: [m.get("name", m["moveId"]), m.get("type", "normal")] for m in gm.get("moves", [])}

    species = {}   # speciesId -> entry
    leagues = {}
    used_moves = set()
    for league, cap in LEAGUES.items():
        try:
            rankings = _get(f"rankings/all/overall/rankings-{cap}.json")
        except Exception as e:
            print(f"  Could not load {league} league rankings: {e}")
            continue
        leagues[league] = {"cap": cap, "total": len(rankings)}
        for rank, r in enumerate(rankings, start=1):
            sid = r.get("speciesId", "")
            is_shadow = sid.endswith("_shadow")
            base = gm_species.get(sid) or gm_species.get(sid[:-len("_shadow")] if is_shadow else sid)
            if not base or not base.get("dex"):
                continue
            entry = species.setdefault(sid, {
                "id": sid,
                "dex": base["dex"],
                "name": r.get("speciesName") or base.get("speciesName", sid),
                "shadow": is_shadow,
            })
            moveset = r.get("moveset") or []
            used_moves.update(moveset)
            entry[league] = [rank, r.get("score"), moveset]

    if not leagues:
        return {}

    grouped = {}
    for entry in species.values():
        grouped.setdefault(str(entry.pop("dex")), []).append(entry)
    # best overall placement first within each Pokédex number
    for lst in grouped.values():
        lst.sort(key=lambda e: min((e[l][0] for l in LEAGUES if l in e), default=99999))

    out = {
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "leagues": leagues,
        "moves": {m: move_names.get(m, [m.replace("_", " ").title(), "normal"]) for m in sorted(used_moves)},
        "species": grouped,
    }
    print(f"Successfully scraped PvP rankings for {len(species)} species across {len(leagues)} leagues!")
    return out


if __name__ == "__main__":
    import json
    data = scrape_pvp_rankings()
    print(json.dumps(data.get("species", {}).get("625"), indent=2))
