import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_eggs():
    print("Scraping Eggs...")
    try:
        url = "https://leekduck.com/eggs/"
        res = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        eggs = []

        cards = soup.select(".egg-item, .egg-cell")
        for card in cards:
            name_el = card.select_one(".name, .egg-name")
            name = name_el.text.strip() if name_el else ""

            type_el = card.select_one(".egg-type, .distance")
            egg_type = type_el.text.strip() if type_el else "2 km"

            img_el = card.select_one("img")
            img = img_el.get("src", "") if img_el else ""

            shiny = bool(card.select_one(".shiny-icon, [alt*='shiny']"))

            if name:
                eggs.append({
                    "name": name,
                    "eggType": egg_type,
                    "img": img,
                    "shiny": shiny
                })

        print(f"  -> Saved {len(eggs)} egg hatch possibilities.")
        return eggs
    except Exception as e:
        print(f"Error scraping eggs: {e}")
        return []

if __name__ == "__main__":
    scrape_eggs()
