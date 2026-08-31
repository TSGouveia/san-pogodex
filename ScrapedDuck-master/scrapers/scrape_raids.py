import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_raids():
    print("Scraping Raids...")
    try:
        url = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raids.json"
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            bosses = res.json()
            print(f"  -> Saved {len(bosses)} raid bosses.")
            return bosses
    except Exception as e:
        print(f"Error scraping raids: {e}")
    return []

if __name__ == "__main__":
    scrape_raids()
