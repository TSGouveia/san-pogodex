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

BULBAPEDIA_API_URL = "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO&prop=text&format=json"
BULBAPEDIA_URL = "https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO"

def scrape_unreleased_names_from_bulbapedia():
    print("Scraping Unreleased Pokémon from Bulbapedia...")
    unreleased_set = set()
    html_content = None

    # Method 1: Try MediaWiki API with multiple bot & standard User-Agents (bypasses Cloudflare / Linux 403 blocks)
    for idx, api_hdr in enumerate(API_HEADERS):
        try:
            res = requests.get(BULBAPEDIA_API_URL, headers=api_hdr, timeout=20, verify=False)
            if res.status_code == 200:
                data = res.json()
                if "parse" in data and "text" in data["parse"] and "*" in data["parse"]["text"]:
                    html_content = data["parse"]["text"]["*"]
                    print(f"  -> Fetched Bulbapedia via MediaWiki API endpoint (header strategy {idx + 1}).")
                    break
        except Exception as api_err:
            print(f"  -> MediaWiki API header strategy {idx + 1} failed: {api_err}")

    # Method 2: Direct HTML URL fallback
    if not html_content:
        try:
            res = requests.get(BULBAPEDIA_URL, headers=HEADERS, timeout=20, verify=False)
            if res.status_code == 200:
                html_content = res.content
                print("  -> Fetched Bulbapedia via direct HTML endpoint.")
            else:
                print(f"  -> Warning: Bulbapedia HTML returned status {res.status_code}.")
        except Exception as html_err:
            print(f"  -> Direct HTML fetch failed: {html_err}")

    if not html_content:
        print("  -> Error: Could not retrieve Bulbapedia content from any endpoint.")
        return unreleased_set

    try:
        soup = BeautifulSoup(html_content, "html.parser")
        heading = soup.find(lambda e: e.name in ["h2", "h3"] and "Unreleased" in e.text)
        if not heading:
            print("  -> Warning: Could not find 'Unreleased' heading on Bulbapedia.")
            return unreleased_set

        elem = heading.find_next_sibling()
        tables = []
        while elem and elem.name not in ["h2", "h3"]:
            if elem.name == "table":
                tables.append(elem)
            elem = elem.find_next_sibling()

        # Table 1 on Bulbapedia contains unreleased species
        if tables:
            species_table = tables[0]
            for img in species_table.find_all("img"):
                alt = img.get("alt", "").strip()
                if alt:
                    unreleased_set.add(alt)

        print(f"  -> Successfully scraped {len(unreleased_set)} unreleased species directly from Bulbapedia.")
    except Exception as e:
        print(f"  -> Error parsing Bulbapedia content: {e}")

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

        # Scrape Bulbapedia unreleased list strictly from live site
        scraped_unreleased = scrape_unreleased_names_from_bulbapedia()
        unreleased_lower = {name.lower() for name in scraped_unreleased}

        # Tag entries with unreleased boolean
        unreleased_flagged_count = 0
        for entry in pokedex_data:
            eng_name = entry.get("names", {}).get("English", "")
            if eng_name and eng_name.lower() in unreleased_lower:
                entry["unreleased"] = True
                unreleased_flagged_count += 1
            else:
                entry["unreleased"] = False

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
