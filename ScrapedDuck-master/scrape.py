import os
import json
import requests
import datetime
import sys

# Ensure scrapers module import path
sys.path.append(os.path.dirname(__file__))

from scrapers.scrape_events import scrape_events
from scrapers.scrape_raids import scrape_raids
from scrapers.scrape_research import scrape_research
from scrapers.scrape_eggs import scrape_eggs
from scrapers.scrape_rocket import scrape_rocket
from scrapers.scrape_promos import scrape_promo_codes
from scrapers.scrape_party import scrape_party
from scrapers.scrape_pokedex import scrape_pokedex, scrape_types
from scrapers.scrape_buddy import scrape_buddy_distances

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def ensure_files_dir():
    paths = [
        os.path.join(os.path.dirname(__file__), "files"),
        os.path.join(os.path.dirname(__file__), "..", "files")
    ]
    for p in paths:
        if not os.path.exists(p):
            os.makedirs(p, exist_ok=True)

def save_json(filename, data):
    ensure_files_dir()
    paths = [
        os.path.join(os.path.dirname(__file__), "files", filename),
        os.path.join(os.path.dirname(__file__), "..", "files", filename)
    ]
    for filepath in paths:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        min_filename = filename.replace(".json", ".min.json")
        min_filepath = filepath.replace(".json", ".min.json")
        with open(min_filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"), ensure_ascii=False)

def upload_to_firestore(events, raids, research, eggs, rocket, promo_codes, party_challenges, buddy_distances, pokedex, types):
    print("Uploading scraped data to Firebase Firestore (scraped_data collection)...")
    api_key = os.environ.get("FIREBASE_API_KEY", "AIzaSyAHsUktWNFdK8IiOYSAchnFxR-pqVQZJbU")
    project_id = "pogo-website-14a46"

    try:
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
        res = requests.post(auth_url, json={'email': 'scraper@pogowebsite.local', 'password': 'ScraperPassword123!', 'returnSecureToken': True})
        if res.status_code != 200:
            print(f"Failed to authenticate with Firebase: {res.text}")
            return False
        auth_json = res.json()
        id_token = auth_json.get("idToken")
        headers = {"Authorization": f"Bearer {id_token}"}

        # Upload individual modules to scraped_data collection
        modules = {
            "events": events,
            "raids": raids,
            "research": research,
            "eggs": eggs,
            "rocketLineups": rocket,
            "promoCodes": promo_codes,
            "partyChallenges": party_challenges,
            "buddyDistances": buddy_distances,
            "pokedex": pokedex,
            "types": types
        }

        success_count = 0
        for doc_name, doc_data in modules.items():
            try:
                mod_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/scraped_data/{doc_name}"
                mod_payload = {
                    "fields": {
                        "data": {"stringValue": json.dumps(doc_data, ensure_ascii=False)},
                        "updatedAt": {"stringValue": datetime.datetime.now(datetime.timezone.utc).isoformat()}
                    }
                }
                r = requests.patch(mod_url, headers=headers, json=mod_payload)
                if r.status_code == 200:
                    success_count += 1
                else:
                    print(f"  [scraped_data/{doc_name}] upload warning: {r.status_code} - {r.text}")
            except Exception as ex:
                print(f"  [scraped_data/{doc_name}] upload exception: {ex}")

        print(f"Successfully uploaded {success_count}/{len(modules)} scraped_data documents to Firestore!")
        return True
    except Exception as e:
        print(f"Exception during Firestore upload: {e}")
        return False

def main():
    print("=== STARTING SCRAPEDDUCK MAIN ORCHESTRATOR ===")
    
    # 1. Scrape Events
    events = scrape_events()
    save_json("events.json", events)

    # 2. Scrape Raids
    raids = scrape_raids()
    save_json("raids.json", raids)

    # 3. Scrape Research
    research = scrape_research()
    save_json("research.json", research)

    # 4. Scrape Eggs
    eggs = scrape_eggs()
    save_json("eggs.json", eggs)

    # 5. Scrape Rocket
    rocket = scrape_rocket()
    save_json("rocketLineups.json", rocket)

    # 6. Scrape Promo Codes
    promo_codes = scrape_promo_codes()
    save_json("promoCodes.json", promo_codes)

    # 7. Scrape Party Challenges
    party_challenges = scrape_party()
    save_json("partyChallenges.json", party_challenges)

    # 8. Scrape Buddy Distances
    buddy_distances = scrape_buddy_distances()
    save_json("buddyDistances.json", buddy_distances)

    # 9. Scrape Pokedex
    pokedex = scrape_pokedex()
    save_json("pokedex.json", pokedex)

    # 10. Scrape Types
    types = scrape_types()
    save_json("types.json", types)

    # 11. Upload All Aggregated Data to Firestore
    upload_to_firestore(events, raids, research, eggs, rocket, promo_codes, party_challenges, buddy_distances, pokedex, types)
    print("=== ALL SCRAPING AND FIRESTORE UPLOAD COMPLETE! ===")

if __name__ == "__main__":
    main()
