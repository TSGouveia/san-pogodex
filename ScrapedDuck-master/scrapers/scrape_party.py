import requests
from bs4 import BeautifulSoup
import json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_party():
    print("Scraping Party Challenges...")
    challenges = [
        {
            "category": "Catching",
            "task": "Catch 25 Pokémon",
            "rewards": [
                {"name": "Mega Venusaur Energy x20", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mega-energy.png"},
                {"name": "Stardust x1,000", "image": "https://raw.githubusercontent.com/pokemon-go-api/assets/main/other/stardust.png"}
            ]
        },
        {
            "category": "Catching",
            "task": "Catch 30 Pokémon with Weather Boost",
            "rewards": [
                {"name": "Mega Charizard Energy x20", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mega-energy.png"},
                {"name": "Ultra Ball x10", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png"}
            ]
        },
        {
            "category": "Raids & Battles",
            "task": "Win 2 Raid Battles",
            "rewards": [
                {"name": "Mega Rayquaza Energy x20", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mega-energy.png"},
                {"name": "Rare Candy x3", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"}
            ]
        },
        {
            "category": "Raids & Battles",
            "task": "Win a Raid in under 60 seconds",
            "rewards": [
                {"name": "Mega Lucario Energy x25", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mega-energy.png"},
                {"name": "Golden Razz Berry x3", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/golden-razz-berry.png"}
            ]
        },
        {
            "category": "Exploration",
            "task": "Spin 20 PokéStops or Gyms",
            "rewards": [
                {"name": "Mega Blastoise Energy x20", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mega-energy.png"},
                {"name": "Hyper Potion x5", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hyper-potion.png"}
            ]
        },
        {
            "category": "Throws",
            "task": "Make 20 Great Throws",
            "rewards": [
                {"name": "Mega Gengar Energy x20", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mega-energy.png"},
                {"name": "Pinap Berry x10", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/pinap-berry.png"}
            ]
        },
        {
            "category": "Throws",
            "task": "Make 10 Excellent Throws",
            "rewards": [
                {"name": "Mega Salamence Energy x25", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mega-energy.png"},
                {"name": "Silver Pinap Berry x3", "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silver-pinap-berry.png"}
            ]
        }
    ]

    try:
        url = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/party.json"
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                print(f"  -> Saved {len(data)} party challenges from live feed.")
                return data
    except Exception as e:
        print(f"Party scraper fallback warning: {e}")

    print(f"  -> Saved {len(challenges)} curated Party Challenges.")
    return challenges

if __name__ == "__main__":
    scrape_party()
