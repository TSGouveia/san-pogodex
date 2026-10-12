import os
import json
import requests
import datetime
import sys

# Ensure scrapers module import path
sys.path.append(os.path.dirname(__file__))

from scrapers.scrape_events import scrape_events
from scrapers.scrape_raids import scrape_raids
from scrapers.scrape_research import scrape_research
from scrapers.scrape_eggs import scrape_eggs
from scrapers.scrape_rocket import scrape_rocket
from scrapers.scrape_promos import scrape_promo_codes
from scrapers.scrape_party import scrape_party
from scrapers.scrape_pokedex import scrape_pokedex, scrape_types
from scrapers.scrape_buddy import scrape_buddy_distances
from scrapers.cp_utils import load_pokedex_map, get_pokedex_stats, get_cp_for_level

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def ensure_files_dir():
    paths = [
        os.path.join(os.path.dirname(__file__), "files"),
        os.path.join(os.path.dirname(__file__), "..", "files")
    ]
    for p in paths:
        if not os.path.exists(p):
            os.makedirs(p, exist_ok=True)

def save_json(filename, data):
    ensure_files_dir()
    paths = [
        os.path.join(os.path.dirname(__file__), "files", filename),
        os.path.join(os.path.dirname(__file__), "..", "files", filename)
    ]
    for filepath in paths:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        min_filename = filename.replace(".json", ".min.json")
        min_filepath = filepath.replace(".json", ".min.json")
        with open(min_filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"), ensure_ascii=False)

def scrape_spawns():
    print("Scraping Wild Spawns from shungo.app...")
    url = "https://shungo.app/api/shungo/data/spawns"
    poke_map = load_pokedex_map()
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            data = r.json()
            items = data.get("result", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            spawns = []
            for item in items:
                if isinstance(item, list) and len(item) >= 4:
                    dex_nr = item[0]
                    spawn_obj = {
                        "dexNr": dex_nr,
                        "internalFormId": item[1],
                        "spawnRate": item[2],
                        "canBeShiny": bool(item[3])
                    }
                    stats = get_pokedex_stats(poke_map, dex_nr)
                    if stats:
                        cp_norm = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=30, min_iv=0)
                        spawn_obj["combatPower"] = {"normal": cp_norm}
                    spawns.append(spawn_obj)
            print(f"Successfully scraped {len(spawns)} wild spawns with CP calculations!")
            return spawns
        else:
            print(f"Failed to fetch spawns: {r.status_code}")
            return []
    except Exception as e:
        print(f"Error scraping spawns: {e}")
        return []



def main():
    print("=== STARTING SCRAPEDDUCK MAIN ORCHESTRATOR ===")
    
    # 1. Scrape Pokedex & Types FIRST so pokedex.json exists for cp_utils
    pokedex = scrape_pokedex()
    save_json("pokedex.json", pokedex)

    types = scrape_types()
    save_json("types.json", types)

    # 2. Scrape Events
    events = scrape_events()
    save_json("events.json", events)

    # 3. Scrape Raids & Max Battles
    raids, max_battles = scrape_raids()
    save_json("raids.json", raids)
    save_json("maxBattles.json", max_battles)

    # 4. Scrape Research
    research = scrape_research()
    save_json("research.json", research)

    # 5. Scrape Eggs
    eggs = scrape_eggs()
    save_json("eggs.json", eggs)

    # 6. Scrape Rocket
    rocket = scrape_rocket()
    save_json("rocketLineups.json", rocket)

    # 7. Scrape Promo Codes
    promo_codes = scrape_promo_codes()
    save_json("promoCodes.json", promo_codes)

    # 8. Scrape Party Challenges
    party_challenges = scrape_party()
    save_json("partyChallenges.json", party_challenges)

    # 9. Scrape Buddy Distances
    buddy_distances = scrape_buddy_distances()
    save_json("buddyDistances.json", buddy_distances)

    # 10. Scrape Wild Spawns
    spawns = scrape_spawns()
    save_json("spawns.json", spawns)

    # Save metadata with timestamp so the client knows when data was updated
    metadata = {
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    save_json("metadata.json", metadata)

    print("=== SCRAPE COMPLETE ===")

if __name__ == "__main__":
    main()
