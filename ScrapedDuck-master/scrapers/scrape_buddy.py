import requests
import json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_buddy_distances():
    print("Scraping Buddy Distances Data...")
    try:
        res = requests.get("https://pogoapi.net/api/v1/pokemon_buddy_distances.json", headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print("Failed to fetch pokemon_buddy_distances.json from pogoapi.net")
            return {}
        
        raw_data = res.json()
        buddy_distances = {}

        if isinstance(raw_data, dict):
            for dist_str, list_items in raw_data.items():
                try:
                    dist_val = float(dist_str)
                    if isinstance(list_items, list):
                        for item in list_items:
                            poke_id = item.get("pokemon_id")
                            poke_name = item.get("pokemon_name")
                            if poke_id is not None:
                                buddy_distances[str(poke_id)] = dist_val
                            if poke_name:
                                buddy_distances[poke_name.lower()] = dist_val
                except Exception as ex:
                    print(f"Error parsing distance key {dist_str}: {ex}")

        print(f"  -> Saved {len(buddy_distances)} Buddy Distance mappings.")
        return buddy_distances
    except Exception as e:
        print(f"Error scraping Buddy Distances: {e}")
        return {}

if __name__ == "__main__":
    scrape_buddy_distances()
