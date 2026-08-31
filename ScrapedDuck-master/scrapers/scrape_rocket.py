import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_rocket():
    print("Scraping Team GO Rocket Lineups...")
    try:
        url = "https://raw.githubusercontent.com/zhenga8533/leak-duck/data/rocket_lineups.json"
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            rocket = res.json()
            print(f"  -> Saved {len(rocket)} rocket lineups.")
            return rocket
    except Exception as e:
        print(f"Error scraping rocket: {e}")
    return []

if __name__ == "__main__":
    scrape_rocket()
