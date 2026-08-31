import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_rocket():
    print("Scraping Team GO Rocket Lineups...")
    try:
        url = "https://leekduck.com/rocket/"
        res = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        lineups = []

        leaders = soup.select(".rocket-leader, .grunt-card")
        for card in leaders:
            name_el = card.select_one(".leader-name, .grunt-name, h2, h3")
            name = name_el.text.strip() if name_el else ""

            pokemon_els = card.select(".pokemon-name, .mon-name")
            pokemon = [p.text.strip() for p in pokemon_els if p.text.strip()]

            if name:
                lineups.append({
                    "leader": name,
                    "lineup": pokemon
                })

        print(f"  -> Saved {len(lineups)} rocket lineups.")
        return lineups
    except Exception as e:
        print(f"Error scraping rocket: {e}")
        return []

if __name__ == "__main__":
    scrape_rocket()
