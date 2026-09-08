import requests
from scrapers.cp_utils import load_pokedex_map, get_pokedex_stats, get_cp_for_level

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_eggs():
    print("Scraping Eggs...")
    poke_map = load_pokedex_map()
    try:
        url = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/eggs.json"
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            eggs = res.json()
            for egg_group in eggs:
                pokemon_list = egg_group.get("pokemon") or egg_group.get("hatches") or []
                if isinstance(pokemon_list, list):
                    for item in pokemon_list:
                        name = item.get("name") or item.get("pokemon") or ""
                        stats = get_pokedex_stats(poke_map, name)
                        if stats:
                            cp_data = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=20, min_iv=10)
                            item["combatPower"] = {
                                "normal": cp_data
                            }
                            item["min_cp"] = cp_data["min"]
                            item["max_cp"] = cp_data["max"]
            print(f"  -> Saved {len(eggs)} egg hatch possibilities with CP calculations.")
            return eggs
    except Exception as e:
        print(f"Error scraping eggs: {e}")
    return []

if __name__ == "__main__":
    scrape_eggs()

