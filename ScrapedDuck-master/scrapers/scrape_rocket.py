import requests
from bs4 import BeautifulSoup
import re
from scrapers.cp_utils import load_pokedex_map, get_pokedex_stats, get_cp_for_level

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_rocket():
    print("Scraping Team GO Rocket Lineups directly from LeekDuck HTML...")
    poke_map = load_pokedex_map()
    rocket_lineups = []

    try:
        url = "https://leekduck.com/rocket-lineups/"
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch Rocket Lineups: HTTP {res.status_code}")
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        profiles = soup.select(".rocket-profile")

        for profile in profiles:
            name_el = profile.select_one(".employee-info .name")
            title_el = profile.select_one(".employee-info .title")
            quote_el = profile.select_one(".employee-info .quote-text")
            photo_el = profile.select_one(".employee-info .photo img")

            name = name_el.text.strip() if name_el else "Rocket Grunt"
            title = title_el.text.strip() if title_el else "Team GO Rocket"
            quote = quote_el.text.strip() if quote_el else ""
            photo = photo_el.get("src", "") if photo_el else ""

            slots_data = []
            slot_elements = profile.select(".lineup-info .slot")

            for slot_idx, slot_el in enumerate(slot_elements, start=1):
                is_encounter = "encounter" in slot_el.get("class", [])
                pokemons_in_slot = []

                shadow_pokes = slot_el.select(".shadow-pokemon")
                for p_el in shadow_pokes:
                    p_name = p_el.get("data-pokemon", "").strip()
                    if not p_name:
                        img_el = p_el.select_one("img.pokemon-image")
                        if img_el:
                            p_name = img_el.get("alt", "").strip()

                    if not p_name:
                        continue

                    shiny = bool(p_el.select_one(".shiny-icon"))
                    type1 = p_el.get("data-type1", "")
                    type2 = p_el.get("data-type2", "")

                    img_el = p_el.select_one("img.pokemon-image")
                    image_url = img_el.get("src", "") if img_el else ""

                    # Calculate Shadow CP at level 8 (normal) and level 13 (weather boosted)
                    stats = get_pokedex_stats(poke_map, p_name)
                    cp_data = None
                    if stats:
                        cp_norm = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=8, min_iv=0)
                        cp_boost = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=13, min_iv=0)
                        cp_data = {
                            "normal": cp_norm,
                            "boosted": cp_boost
                        }

                    pokemons_in_slot.append({
                        "name": p_name,
                        "image": image_url,
                        "shiny": shiny,
                        "type1": type1,
                        "type2": type2,
                        "combatPower": cp_data
                    })

                if pokemons_in_slot:
                    slots_data.append({
                        "slot": slot_idx,
                        "encounter": is_encounter,
                        "pokemons": pokemons_in_slot
                    })

            if slots_data:
                rocket_lineups.append({
                    "name": name,
                    "title": title,
                    "quote": quote,
                    "photo": photo,
                    "lineups": slots_data
                })

        print(f"  -> Successfully scraped {len(rocket_lineups)} Team GO Rocket lineups directly from LeekDuck!")
        return rocket_lineups

    except Exception as e:
        print(f"Error scraping Rocket lineups: {e}")
        return []

if __name__ == "__main__":
    scrape_rocket()
