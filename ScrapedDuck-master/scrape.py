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
from scrapers.scrape_top_attackers import scrape_top_attackers

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

def upload_to_firestore(events, raids, research, eggs, rocket, top_attackers, promo_codes):
    print("Uploading scraped data to Firebase Firestore...")
    api_key = os.environ.get("FIREBASE_API_KEY", "AIzaSyAHsUktWNFdK8IiOYSAchnFxR-pqVQZJbU")
    project_id = "pogo-website-14a46"
    scraper_uid = "zrWesha0TuXpkC4cskDx9vSdSzT2"

    try:
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
        res = requests.post(auth_url, json={'email': 'scraper@pogowebsite.local', 'password': 'ScraperPassword123!', 'returnSecureToken': True})
        if res.status_code != 200:
            print(f"Failed to authenticate with Firebase: {res.text}")
            return False
        auth_json = res.json()
        id_token = auth_json.get("idToken")
        uid = auth_json.get("localId", scraper_uid)

        payload = {
            "fields": {
                "events": {"stringValue": json.dumps(events, ensure_ascii=False)},
                "raids": {"stringValue": json.dumps(raids, ensure_ascii=False)},
                "research": {"stringValue": json.dumps(research, ensure_ascii=False)},
                "eggs": {"stringValue": json.dumps(eggs, ensure_ascii=False)},
                "rocketLineups": {"stringValue": json.dumps(rocket, ensure_ascii=False)},
                "topAttackers": {"stringValue": json.dumps(top_attackers, ensure_ascii=False)},
                "promoCodes": {"stringValue": json.dumps(promo_codes, ensure_ascii=False)},
                "updatedAt": {"stringValue": datetime.datetime.now(datetime.timezone.utc).isoformat()}
            }
        }

        fs_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/scraped_data/{scraper_uid}"
        headers = {"Authorization": f"Bearer {id_token}"}
        r_patch = requests.patch(fs_url, headers=headers, json=payload)

        if r_patch.status_code == 200:
            print("Successfully uploaded all scraped data to Firestore!")
            return True
        else:
            print(f"Error uploading to Firestore: {r_patch.status_code} - {r_patch.text}")
            return False
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

    # 6. Scrape Top Attackers
    top_attackers = scrape_top_attackers()
    save_json("topAttackers.json", top_attackers)

    # 7. Scrape Promo Codes
    promo_codes = scrape_promo_codes()
    save_json("promoCodes.json", promo_codes)

    # 8. Upload All Aggregated Data to Firestore
    upload_to_firestore(events, raids, research, eggs, rocket, top_attackers, promo_codes)
    print("=== ALL SCRAPING AND FIRESTORE UPLOAD COMPLETE! ===")

if __name__ == "__main__":
    main()
