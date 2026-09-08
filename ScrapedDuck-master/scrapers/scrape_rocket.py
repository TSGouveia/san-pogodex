import requests
from scrapers.cp_utils import load_pokedex_map, get_pokedex_stats, get_cp_for_level

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_rocket():
    print("Scraping Team GO Rocket Lineups...")
    poke_map = load_pokedex_map()
    try:
        url = "https://raw.githubusercontent.com/zhenga8533/leak-duck/data/rocket_lineups.json"
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            rocket = res.json()
            for gr in rocket:
                lineups = gr.get("lineups") or gr.get("pokemons") or []
                if isinstance(lineups, list):
                    for slot in lineups:
                        p_list = slot.get("pokemons") or slot.get("pokemon") or []
                        if isinstance(p_list, list):
                            for p in p_list:
                                name = p.get("name") or p.get("pokemon") or ""
                                stats = get_pokedex_stats(poke_map, name)
                                if stats:
                                    # Shadow catch: Lvl 8 min IV 0, Boosted: Lvl 13 min IV 0
                                    cp_norm = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=8, min_iv=0)
                                    cp_boost = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=13, min_iv=0)
                                    p["combatPower"] = {
                                        "normal": cp_norm,
                                        "boosted": cp_boost
                                    }
            print(f"  -> Saved {len(rocket)} rocket lineups with CP calculations.")
            return rocket
    except Exception as e:
        print(f"Error scraping rocket: {e}")
    return []

if __name__ == "__main__":
    scrape_rocket()

