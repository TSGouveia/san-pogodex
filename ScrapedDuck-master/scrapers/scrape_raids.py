import requests
from bs4 import BeautifulSoup
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_raids():
    print("Scraping Raids...")
    try:
        url = "https://leekduck.com/boss/"
        res = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        bosses = []

        tier_map = {'1': '1-Star Raids', '3': '3-Star Raids', '5': '5-Star Raids', 'mega': 'Mega Raids'}

        cards = soup.select(".boss-item, .raid-boss-item, li.boss-cell")
        for card in cards:
            name_el = card.select_one(".boss-name, .name")
            name = name_el.text.strip() if name_el else ""

            img_el = card.select_one("img")
            img = img_el.get("src", "") if img_el else ""

            cp_el = card.select_one(".boss-cp, .cp")
            cp = cp_el.text.strip() if cp_el else ""

            tier_attr = card.get("data-tier", "") or card.get("data-category", "")
            tier = tier_map.get(str(tier_attr).lower(), "5-Star Raids")

            shiny = bool(card.select_one(".shiny-icon, .is-shiny, [alt*='shiny']"))

            if name:
                bosses.append({
                    "name": name,
                    "img": img,
                    "cp": cp,
                    "tier": tier,
                    "shiny": shiny
                })

        print(f"  -> Saved {len(bosses)} raid bosses.")
        return bosses
    except Exception as e:
        print(f"Error scraping raids: {e}")
        return []

if __name__ == "__main__":
    scrape_raids()
