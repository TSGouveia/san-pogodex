import requests
import json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_pokedex():
    print("Scraping Raw Pokédex Data...")
    try:
        res = requests.get("https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json", headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch pokedex.json: Status {res.status_code}")
            return []
        pokedex_data = res.json()
        print(f"  -> Saved {len(pokedex_data)} raw Pokédex entries.")
        return pokedex_data
    except Exception as e:
        print(f"Error scraping Pokédex: {e}")
        return []

def scrape_types():
    print("Scraping Types Data...")
    try:
        res = requests.get("https://pokemon-go-api.github.io/pokemon-go-api/api/types.json", headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch types.json: Status {res.status_code}")
            return []
        types_data = res.json()
        print(f"  -> Saved {len(types_data)} Type definitions.")
        return types_data
    except Exception as e:
        print(f"Error scraping Types: {e}")
        return []

if __name__ == "__main__":
    scrape_pokedex()
    scrape_types()
