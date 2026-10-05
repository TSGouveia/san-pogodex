import requests
from bs4 import BeautifulSoup
import re
from scrapers.cp_utils import load_pokedex_map, get_pokedex_stats, get_cp_for_level

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_eggs():
    print("Scraping Egg Hatch Pools directly from LeekDuck HTML...")
    poke_map = load_pokedex_map()
    egg_groups = []

    try:
        url = "https://leekduck.com/eggs/"
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch Egg hatches: HTTP {res.status_code}")
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        headings = soup.select("article h2")

        for h2 in headings:
            egg_title = h2.text.strip()
            if not ("km" in egg_title.lower() or "egg" in egg_title.lower()):
                continue

            # Find following ul.egg-grid
            grid_ul = h2.find_next_sibling("ul", class_="egg-grid")
            if not grid_ul:
                # Might be inside a div or next element
                curr = h2.find_next_sibling()
                while curr and curr.name != "h2":
                    if curr.name == "ul" and "egg-grid" in curr.get("class", []):
                        grid_ul = curr
                        break
                    curr = curr.find_next_sibling()

            if not grid_ul:
                continue

            hatches = []
            cards = grid_ul.select("li.pokemon-card")

            for card in cards:
                name_el = card.select_one(".name")
                if not name_el:
                    continue
                name = name_el.text.strip()

                img_el = card.select_one(".icon img")
                image_url = img_el.get("src", "") if img_el else ""

                shiny = bool(card.select_one(".shiny-icon"))

                rarity_eggs = len(card.select(".rarity svg.mini-egg"))

                cp_el = card.select_one(".cp-range")
                cp_val = cp_el.text.replace("CP", "").strip() if cp_el else None

                stats = get_pokedex_stats(poke_map, name)
                cp_dict = None
                if stats:
                    cp_data = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=20, min_iv=10)
                    cp_dict = {"normal": cp_data}
                    cp_val = cp_val or cp_data["max"]

                hatches.append({
                    "name": name,
                    "image": image_url,
                    "shiny": shiny,
                    "rarityTier": rarity_eggs if rarity_eggs > 0 else 1,
                    "cp": cp_val,
                    "combatPower": cp_dict
                })

            if hatches:
                egg_groups.append({
                    "eggType": egg_title,
                    "pokemon": hatches
                })

        print(f"  -> Successfully scraped {len(egg_groups)} egg categories directly from LeekDuck!")
        return egg_groups

    except Exception as e:
        print(f"Error scraping eggs: {e}")
        return []

if __name__ == "__main__":
    scrape_eggs()
