import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_eggs():
    print("Scraping Eggs...")
    try:
        url = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/eggs.json"
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            eggs = res.json()
            print(f"  -> Saved {len(eggs)} egg hatch possibilities.")
            return eggs
    except Exception as e:
        print(f"Error scraping eggs: {e}")
    return []

if __name__ == "__main__":
    scrape_eggs()
