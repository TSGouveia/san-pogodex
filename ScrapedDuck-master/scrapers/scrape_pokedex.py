import requests
import json
import urllib3
from bs4 import BeautifulSoup

# Suppress insecure HTTPS request warnings if SSL verification is disabled
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Accept": "application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
}

API_HEADERS = [
    {"User-Agent": "SanDexScraper/1.0 (https://pogowebsite.local)"},
    {"User-Agent": "MediaWiki/1.39.0 (https://bulbapedia.bulbagarden.net)"},
    {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"}
]

BULBAPEDIA_RAW_URL = "https://bulbapedia.bulbagarden.net/w/index.php?title=List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO&action=raw"
BULBAPEDIA_REVISIONS_API = "https://bulbapedia.bulbagarden.net/w/api.php?action=query&prop=revisions&titles=List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO&rvslots=*&rvprop=content&format=json"
BULBAPEDIA_PARSE_WIKITEXT_API = "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO&prop=wikitext&format=json"
BULBAPEDIA_API_URL = "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO&prop=text&format=json"
BULBAPEDIA_URL = "https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO"

def parse_unreleased_from_wikitext(text):
    import re
    m = re.search(r'==+\s*Unreleased.*?\n(.*?)(?=\n==+|$)', text, re.DOTALL | re.IGNORECASE)
    if not m:
        return set()
    part = m.group(1)
    tables = part.split('{|')
    if len(tables) > 1:
        species_table = tables[1]
        names = re.findall(r'\{\{MSP(?:/GO)?\|[^|}]+\|([^}|]+)', species_table)
        return {n.strip() for n in names if n.strip()}
    return set()

def parse_unreleased_from_html(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    heading = soup.find(lambda e: e.name in ["h2", "h3"] and "Unreleased" in e.text)
    if not heading:
        return set()
    elem = heading.find_next_sibling()
    tables = []
    while elem and elem.name not in ["h2", "h3"]:
        if elem.name == "table":
            tables.append(elem)
        elem = elem.find_next_sibling()
    unreleased_set = set()
    if tables:
        species_table = tables[0]
        for img in species_table.find_all("img"):
            alt = img.get("alt", "").strip()
            if alt:
                unreleased_set.add(alt)
    return unreleased_set

def scrape_unreleased_names_from_bulbapedia():
    print("Scraping Unreleased Pokémon from Bulbapedia...")
    unreleased_set = set()

    # Strategy 1: Direct Raw Wikitext endpoint (fastest, ~150KB, minimal bot-block risk)
    for idx, hdr in enumerate(API_HEADERS + [HEADERS]):
        try:
            res = requests.get(BULBAPEDIA_RAW_URL, headers=hdr, timeout=15, verify=False)
            if res.status_code == 200 and "Unreleased" in res.text:
                names = parse_unreleased_from_wikitext(res.text)
                if names:
                    print(f"  -> Successfully fetched {len(names)} unreleased species via raw wikitext (header {idx + 1}).")
                    return names
        except Exception as e:
            print(f"  -> Raw wikitext strategy {idx + 1} attempt failed: {e}")

    # Strategy 2: MediaWiki Query Revisions API (official JSON content endpoint)
    for idx, hdr in enumerate(API_HEADERS):
        try:
            res = requests.get(BULBAPEDIA_REVISIONS_API, headers=hdr, timeout=15, verify=False)
            if res.status_code == 200:
                data = res.json()
                pages = data.get("query", {}).get("pages", {})
                for pid, page in pages.items():
                    revs = page.get("revisions", [])
                    if revs:
                        wikitext = revs[0].get("slots", {}).get("main", {}).get("*", "")
                        if wikitext and "Unreleased" in wikitext:
                            names = parse_unreleased_from_wikitext(wikitext)
                            if names:
                                print(f"  -> Successfully fetched {len(names)} unreleased species via revisions API (header {idx + 1}).")
                                return names
        except Exception as e:
            print(f"  -> Revisions API strategy {idx + 1} attempt failed: {e}")

    # Strategy 3: MediaWiki Parse Wikitext API
    for idx, hdr in enumerate(API_HEADERS):
        try:
            res = requests.get(BULBAPEDIA_PARSE_WIKITEXT_API, headers=hdr, timeout=15, verify=False)
            if res.status_code == 200:
                data = res.json()
                wikitext = data.get("parse", {}).get("wikitext", {}).get("*", "")
                if wikitext and "Unreleased" in wikitext:
                    names = parse_unreleased_from_wikitext(wikitext)
                    if names:
                        print(f"  -> Successfully fetched {len(names)} unreleased species via parse wikitext API.")
                        return names
        except Exception as e:
            print(f"  -> Parse wikitext API attempt failed: {e}")

    # Strategy 4: MediaWiki Parse HTML API
    for idx, api_hdr in enumerate(API_HEADERS):
        try:
            res = requests.get(BULBAPEDIA_API_URL, headers=api_hdr, timeout=20, verify=False)
            if res.status_code == 200:
                data = res.json()
                if "parse" in data and "text" in data["parse"] and "*" in data["parse"]["text"]:
                    html_content = data["parse"]["text"]["*"]
                    names = parse_unreleased_from_html(html_content)
                    if names:
                        print(f"  -> Successfully fetched {len(names)} unreleased species via MediaWiki parse HTML endpoint.")
                        return names
        except Exception as api_err:
            print(f"  -> MediaWiki API parse HTML header strategy {idx + 1} failed: {api_err}")

    # Strategy 5: Direct HTML Webpage URL
    try:
        res = requests.get(BULBAPEDIA_URL, headers=HEADERS, timeout=20, verify=False)
        if res.status_code == 200:
            names = parse_unreleased_from_html(res.content)
            if names:
                print(f"  -> Successfully fetched {len(names)} unreleased species via direct HTML webpage.")
                return names
        else:
            print(f"  -> Warning: Bulbapedia HTML returned status {res.status_code}.")
    except Exception as html_err:
        print(f"  -> Direct HTML fetch failed: {html_err}")

    print("  -> Error: Could not retrieve Bulbapedia content from any endpoint.")
    return unreleased_set

def scrape_pokedex():
    print("Scraping Raw Pokédex Data...")
    try:
        res = requests.get("https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json", headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch pokedex.json: Status {res.status_code}")
            return []
        pokedex_data = res.json()
        print(f"  -> Saved {len(pokedex_data)} raw Pokédex entries.")

        # Inject missing Basculegion (#902) directly into scraped pokedex data if missing
        has_basculegion = any(entry.get("dexNr") == 902 for entry in pokedex_data)
        if not has_basculegion:
            basculegion_entry = {
                "id": "BASCULEGION",
                "formId": "BASCULEGION",
                "dexNr": 902,
                "generation": 8.5,
                "names": {
                    "English": "Basculegion",
                    "German": "Salamanster",
                    "French": "Paragruel",
                    "Italian": "Basculegion",
                    "Japanese": "イダイトウ",
                    "Korean": "대어꼬리",
                    "Spanish": "Basculegion"
                },
                "stats": {
                    "stamina": 260,
                    "attack": 247,
                    "defense": 146
                },
                "primaryType": {
                    "type": "POKEMON_TYPE_WATER",
                    "names": { "English": "Water" }
                },
                "secondaryType": {
                    "type": "POKEMON_TYPE_GHOST",
                    "names": { "English": "Ghost" }
                },
                "pokemonClass": None,
                "quickMoves": {},
                "cinematicMoves": {},
                "assets": None,
                "regionForms": None,
                "evolutions": []
            }
            pokedex_data.append(basculegion_entry)
            print("  -> Injected missing #902 Basculegion into Pokédex dataset.")

        # Scrape Bulbapedia unreleased list
        scraped_unreleased = scrape_unreleased_names_from_bulbapedia()

        # Fallback handling: if Bulbapedia was blocked (e.g. Cloudflare 403 on CI) or returned empty, load from cache/pokedex.json
        import os
        cache_paths = [
            os.path.join(os.path.dirname(__file__), "unreleased_fallback.json"),
            os.path.join(os.path.dirname(__file__), "..", "files", "unreleased_cache.json"),
            os.path.join(os.path.dirname(__file__), "..", "..", "files", "unreleased_cache.json"),
            os.path.join(os.path.dirname(__file__), "..", "files", "pokedex.json"),
            os.path.join(os.path.dirname(__file__), "..", "..", "files", "pokedex.json"),
        ]

        if not scraped_unreleased:
            print("  -> Bulbapedia scrape returned 0 unreleased. Attempting fallback from local cache/pokedex...")
            for cp in cache_paths:
                if os.path.exists(cp):
                    try:
                        with open(cp, "r", encoding="utf-8") as f:
                            cached_data = json.load(f)
                            if isinstance(cached_data, list):
                                if cached_data and isinstance(cached_data[0], str):
                                    scraped_unreleased = set(cached_data)
                                elif cached_data and isinstance(cached_data[0], dict):
                                    fallback_names = {p.get("names", {}).get("English") for p in cached_data if p.get("unreleased") and p.get("names", {}).get("English")}
                                    if fallback_names:
                                        scraped_unreleased = fallback_names
                            if scraped_unreleased:
                                print(f"  -> Successfully restored {len(scraped_unreleased)} unreleased species from fallback: {cp}")
                                break
                    except Exception as e:
                        print(f"  -> Error reading fallback {cp}: {e}")
        else:
            try:
                for cp in cache_paths[:2]:
                    os.makedirs(os.path.dirname(cp), exist_ok=True)
                    with open(cp, "w", encoding="utf-8") as f:
                        json.dump(sorted(list(scraped_unreleased)), f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"  -> Warning: Could not save unreleased cache: {e}")

        unreleased_lower = {name.lower() for name in scraped_unreleased}

        # Tag entries with unreleased boolean and calculate standard CP benchmarks
        unreleased_flagged_count = 0
        from scrapers.cp_utils import calculate_cp, CPM_MAP

        for entry in pokedex_data:
            eng_name = entry.get("names", {}).get("English", "")
            if eng_name and eng_name.lower() in unreleased_lower:
                entry["unreleased"] = True
                unreleased_flagged_count += 1
            else:
                entry["unreleased"] = False

            # Calculate standard Combat Power values if stats exist
            stats = entry.get("stats")
            if stats and "attack" in stats and "defense" in stats and "stamina" in stats:
                b_atk = stats["attack"]
                b_def = stats["defense"]
                b_sta = stats["stamina"]

                cpm_l50 = CPM_MAP.get(50, 0.84030000)
                cpm_l25 = CPM_MAP.get(25, 0.66793400)
                cpm_l20 = CPM_MAP.get(20, 0.59740001)
                cpm_l15 = CPM_MAP.get(15, 0.51739399)

                entry["combatPower"] = {
                    "maxL50": calculate_cp(b_atk, b_def, b_sta, 15, 15, 15, cpm_l50),
                    "researchL15": {
                        "min": calculate_cp(b_atk, b_def, b_sta, 10, 10, 10, cpm_l15),
                        "max": calculate_cp(b_atk, b_def, b_sta, 15, 15, 15, cpm_l15)
                    },
                    "eggsL20": {
                        "min": calculate_cp(b_atk, b_def, b_sta, 10, 10, 10, cpm_l20),
                        "max": calculate_cp(b_atk, b_def, b_sta, 15, 15, 15, cpm_l20)
                    },
                    "raidsL20": {
                        "min": calculate_cp(b_atk, b_def, b_sta, 10, 10, 10, cpm_l20),
                        "max": calculate_cp(b_atk, b_def, b_sta, 15, 15, 15, cpm_l20)
                    },
                    "raidsWbL25": {
                        "min": calculate_cp(b_atk, b_def, b_sta, 10, 10, 10, cpm_l25),
                        "max": calculate_cp(b_atk, b_def, b_sta, 15, 15, 15, cpm_l25)
                    }
                }

        print(f"  -> Flagged {unreleased_flagged_count} Pokédex entries as unreleased.")
        return pokedex_data
    except Exception as e:
        print(f"Error scraping Pokédex: {e}")
        return []

def scrape_types():
    print("Scraping Types Data...")
    try:
        res = requests.get("https://pokemon-go-api.github.io/pokemon-go-api/api/types.json", headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch types.json: Status {res.status_code}")
            return []
        types_data = res.json()
        print(f"  -> Saved {len(types_data)} Type definitions.")
        return types_data
    except Exception as e:
        print(f"Error scraping Types: {e}")
        return []

if __name__ == "__main__":
    scrape_pokedex()
    scrape_types()
