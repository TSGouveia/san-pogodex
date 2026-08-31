import os
import json
import re
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def ensure_files_dir():
    if not os.path.exists("files"):
        os.makedirs("files")

def save_json(filename, data):
    ensure_files_dir()
    filepath = os.path.join("files", filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    min_filename = filename.replace(".json", ".min.json")
    min_filepath = os.path.join("files", min_filename)
    with open(min_filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)

def scrape_events():
    print("Scraping Events...")
    event_dates = {}
    try:
        res = requests.get("https://leekduck.com/feeds/events.json", headers=HEADERS)
        if res.status_code == 200:
            feed_json = res.json()
            for item in feed_json:
                event_id = item.get("eventID")
                start = item.get("start")
                end = item.get("end")
                event_dates[event_id] = {"start": start, "end": end}
    except Exception as e:
        print(f"Error fetching events feed: {e}")

    try:
        res = requests.get("https://leekduck.com/events/", headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")

        all_events = []
        categories = ["current", "upcoming"]

        for cat in categories:
            selector = f"div.events-list.{cat}-events a.event-item-link"
            events = soup.select(selector)

            for e in events:
                wrapper = e.find("div", class_="event-item-wrapper")
                heading_el = wrapper.find("p") if wrapper else None
                heading = heading_el.get_text(strip=True) if heading_el else ""

                name_el = wrapper.select_one(".event-text h2") if wrapper else None
                name = name_el.get_text(strip=True) if name_el else ""

                img_el = wrapper.select_one(".event-img-wrapper img") if wrapper else None
                image = img_el["src"] if img_el and "src" in img_el.attrs else ""
                if "cdn-cgi" in image and "/assets/" in image:
                    image = "https://cdn.leekduck.com/assets/" + image.split("/assets/")[1]

                link = e.get("href", "")
                if link and not link.startswith("http"):
                    link = f"https://leekduck.com{link}"

                event_id = link.split("/events/")[1].rstrip("/") if "/events/" in link else ""

                event_type = ""
                if wrapper and wrapper.get("class"):
                    classes = list(wrapper["class"])
                    if "event-item-wrapper" in classes:
                        classes.remove("event-item-wrapper")
                    if "skeleton-loading" in classes:
                        classes.remove("skeleton-loading")
                    event_type = " ".join(classes).replace("é", "e")

                dates = event_dates.get(event_id, {})
                start = dates.get("start")
                end = dates.get("end")

                all_events.append({
                    "eventID": event_id,
                    "name": name,
                    "eventType": event_type,
                    "heading": heading,
                    "link": link,
                    "image": image,
                    "start": start,
                    "end": end,
                    "extraData": None
                })

        save_json("events.json", all_events)
        print(f"  -> Saved {len(all_events)} events.")
        return all_events
    except Exception as e:
        print(f"Error scraping events: {e}")
        return []

def scrape_raids():
    print("Scraping Raids...")
    try:
        res = requests.get("https://leekduck.com/raid-bosses/", headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        bosses = []

        grids = soup.select("div.grid")
        tier_map = {'1': '1-Star Raids', '3': '3-Star Raids', '5': '5-Star Raids', 'mega': 'Mega Raids'}

        for grid in grids:
            header = grid.find_previous(["h2", "div"])
            while header and (header.name != "h2" or not header.get("class") or "header" not in " ".join(header.get("class", []))):
                header = header.find_previous(["h2", "div"])

            current_tier = header.get_text(strip=True) if header else ""
            if not current_tier and header:
                data_tier = header.get("data-tier", "").lower()
                current_tier = tier_map.get(data_tier, data_tier)

            cards = grid.select("div.card")
            for card in cards:
                name_el = card.select_one("p.name") or card.select_one(".identity .name")
                name = name_el.get_text(strip=True) if name_el else ""

                boss_tier = current_tier
                if (name.lower().startswith("shadow ") or "shadow" in boss_tier.lower()) and not boss_tier.startswith("Shadow "):
                    boss_tier = f"Shadow {boss_tier}"

                img_el = card.select_one("div.boss-img img")
                image = img_el["src"] if img_el and "src" in img_el.attrs else ""

                can_be_shiny = bool(card.select_one("div.boss-img .shiny-icon"))

                types = []
                for img in card.select("div.boss-type img, div.boss-type .type img"):
                    type_name = img.get("title") or img.get("alt") or ""
                    if type_name:
                        types.append({
                            "name": type_name.lower(),
                            "image": img.get("src", "")
                        })

                # CP Normal
                cp_el = card.select_one("div.cp-range")
                cp_text = re.sub(r"(?i)^cp\s*", "", cp_el.get_text(strip=True)) if cp_el else ""
                cp_parts = [int(s) for s in re.findall(r"\d+", cp_text)]
                cp_min = cp_parts[0] if len(cp_parts) > 0 else -1
                cp_max = cp_parts[1] if len(cp_parts) > 1 else (cp_min if len(cp_parts) > 0 else -1)

                # CP Boosted
                boosted_el = card.select_one("div.boosted-cp-row .boosted-cp, div.boosted-cp-row span.boosted-cp")
                boosted_text = re.sub(r"(?i)^cp\s*", "", boosted_el.get_text(strip=True)) if boosted_el else ""
                boosted_parts = [int(s) for s in re.findall(r"\d+", boosted_text)]
                boosted_min = boosted_parts[0] if len(boosted_parts) > 0 else -1
                boosted_max = boosted_parts[1] if len(boosted_parts) > 1 else (boosted_min if len(boosted_parts) > 0 else -1)

                # Weather
                weather_container = card.select_one("div.weather-boosted") or card.select_one("div.boss-3")
                boosted_weather = []
                if weather_container:
                    for img in weather_container.select(".boss-weather img, .weather-pill img"):
                        w_name = (img.get("alt") or "").lower()
                        if not w_name and img.get("src"):
                            m = re.search(r"(\w+)\.png$", img["src"])
                            if m:
                                w_name = m.group(1).lower()
                        if w_name:
                            boosted_weather.append({
                                "name": w_name,
                                "image": img.get("src", "")
                            })

                bosses.append({
                    "name": name,
                    "tier": boss_tier,
                    "canBeShiny": can_be_shiny,
                    "types": types,
                    "combatPower": {
                        "normal": {"min": cp_min, "max": cp_max},
                        "boosted": {"min": boosted_min, "max": boosted_max}
                    },
                    "boostedWeather": boosted_weather,
                    "image": image
                })

        save_json("raids.json", bosses)
        print(f"  -> Saved {len(bosses)} raid bosses.")
        return bosses
    except Exception as e:
        print(f"Error scraping raids: {e}")
        return []

def scrape_research():
    print("Scraping Field Research...")
    try:
        res = requests.get("https://leekduck.com/research/", headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")

        task_name_to_id = {
            "Event Tasks": "event",
            "Catching Tasks": "catch",
            "Throwing Tasks": "throw",
            "Battling Tasks": "battle",
            "Exploring Tasks": "explore",
            "Training Tasks": "training",
            "Team GO Rocket Tasks": "rocket",
            "Buddy & Friendship Tasks": "buddy",
            "AR Scanning Tasks": "ar",
            "Sponsored Tasks": "sponsored"
        }

        categories = soup.select(".task-category")
        research_data = []

        for category in categories:
            h2_el = category.find("h2")
            category_name = h2_el.get_text(strip=True) if h2_el else ""
            task_type = task_name_to_id.get(category_name, "other")

            tasks = category.select(".task-item")
            for task in tasks:
                text_el = task.select_one(".task-text")
                text = text_el.get_text(strip=True) if text_el else ""

                rewards = []
                reward_elems = task.select(".reward")
                for r in reward_elems:
                    if r.get("data-reward-type") == "encounter":
                        name_el = r.select_one(".reward-label span")
                        name = name_el.get_text(strip=True) if name_el else ""

                        img_el = r.select_one(".reward-image")
                        image = img_el["src"] if img_el and "src" in img_el.attrs else ""

                        can_be_shiny = r.select_one(".shiny-icon") is not None

                        min_cp_el = r.select_one(".min-cp")
                        max_cp_el = r.select_one(".max-cp")

                        min_cp = -1
                        max_cp = -1
                        if min_cp_el:
                            nums = re.findall(r"\d+", min_cp_el.get_text())
                            if nums:
                                min_cp = int(nums[0])
                        if max_cp_el:
                            nums = re.findall(r"\d+", max_cp_el.get_text())
                            if nums:
                                max_cp = int(nums[0])

                        rewards.append({
                            "name": name,
                            "image": image,
                            "canBeShiny": can_be_shiny,
                            "combatPower": {"min": min_cp, "max": max_cp}
                        })

                research_data.append({
                    "text": text,
                    "type": task_type,
                    "rewards": rewards
                })

        save_json("research.json", research_data)
        print(f"  -> Saved {len(research_data)} research tasks.")
        return research_data
    except Exception as e:
        print(f"Error scraping research: {e}")
        return []

def scrape_eggs():
    print("Scraping Eggs...")
    try:
        res = requests.get("https://leekduck.com/eggs/", headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")

        eggs = []
        egg_containers = soup.select(".egg-grid, .egg-pool")
        if not egg_containers:
            # Try finding headers and grids
            grids = soup.select(".egg-grid")
            for grid in grids:
                header = grid.find_previous("h2")
                h2_text = header.get_text(strip=True) if header else ""
                current_adventure_sync = "(Adventure Sync Rewards)" in h2_text
                current_gift_exchange = "(From Route Gift)" in h2_text
                current_type = h2_text.split(" Eggs")[0]

                cards = grid.select(".pokemon-card, .egg-item")
                for card in cards:
                    name_el = card.select_one(".name")
                    name = name_el.get_text(strip=True) if name_el else ""

                    img_el = card.select_one(".icon img, img")
                    image = img_el["src"] if img_el and "src" in img_el.attrs else ""

                    can_be_shiny = card.select_one(".shiny-icon") is not None
                    is_regional = card.select_one(".regional-icon") is not None

                    cp_el = card.select_one(".cp-range")
                    cp_min, cp_max = -1, -1
                    if cp_el:
                        nums = [int(n) for n in re.findall(r"\d+", cp_el.get_text())]
                        if len(nums) == 1:
                            cp_min, cp_max = nums[0], nums[0]
                        elif len(nums) >= 2:
                            cp_min, cp_max = nums[0], nums[1]

                    eggs.append({
                        "name": name,
                        "eggType": current_type,
                        "isAdventureSync": current_adventure_sync,
                        "image": image,
                        "canBeShiny": can_be_shiny,
                        "combatPower": {"min": cp_min, "max": cp_max},
                        "isRegional": is_regional,
                        "isGiftExchange": current_gift_exchange,
                        "rarity": 0
                    })
        else:
            for grid in egg_containers:
                header = grid.find_previous("h2")
                h2_text = header.get_text(strip=True) if header else ""
                current_adventure_sync = "(Adventure Sync Rewards)" in h2_text
                current_gift_exchange = "(From Route Gift)" in h2_text
                current_type = h2_text.split(" Eggs")[0]

                cards = grid.select(".pokemon-card, .egg-item")
                for card in cards:
                    name_el = card.select_one(".name")
                    name = name_el.get_text(strip=True) if name_el else ""

                    img_el = card.select_one(".icon img, img")
                    image = img_el["src"] if img_el and "src" in img_el.attrs else ""

                    can_be_shiny = card.select_one(".shiny-icon") is not None
                    is_regional = card.select_one(".regional-icon") is not None

                    cp_el = card.select_one(".cp-range")
                    cp_min, cp_max = -1, -1
                    if cp_el:
                        nums = [int(n) for n in re.findall(r"\d+", cp_el.get_text())]
                        if len(nums) == 1:
                            cp_min, cp_max = nums[0], nums[0]
                        elif len(nums) >= 2:
                            cp_min, cp_max = nums[0], nums[1]

                    eggs.append({
                        "name": name,
                        "eggType": current_type,
                        "isAdventureSync": current_adventure_sync,
                        "image": image,
                        "canBeShiny": can_be_shiny,
                        "combatPower": {"min": cp_min, "max": cp_max},
                        "isRegional": is_regional,
                        "isGiftExchange": current_gift_exchange,
                        "rarity": 0
                    })

        save_json("eggs.json", eggs)
        print(f"  -> Saved {len(eggs)} egg hatch possibilities.")
        return eggs
    except Exception as e:
        print(f"Error scraping eggs: {e}")
        return []

def scrape_rocket():
    print("Scraping Team GO Rocket Lineups...")
    try:
        res = requests.get("https://leekduck.com/rocket-lineups/", headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        lineups = []

        profiles = soup.select(".rocket-profile")
        for profile in profiles:
            name_el = profile.select_one(".name")
            title_el = profile.select_one(".title")
            type_el = profile.select_one(".type img")

            name = re.sub(r"\s+", " ", name_el.get_text(strip=True)) if name_el else ""
            title = title_el.get_text(strip=True) if title_el else ""

            rocket_type = ""
            if type_el and "src" in type_el.attrs:
                rocket_type = type_el["src"].split("/")[-1].replace(".png", "").lower()

            lineup = {
                "name": name,
                "title": title,
                "type": rocket_type,
                "firstPokemon": [],
                "secondPokemon": [],
                "thirdPokemon": []
            }

            slots = profile.select(".slot")
            slot_keys = ["firstPokemon", "secondPokemon", "thirdPokemon"]

            for index, slot in enumerate(slots[:3]):
                slot_is_encounter = "encounter" in slot.get("class", []) or slot.select_one(".encounter-icon") is not None
                shadow_pokemons = slot.select(".shadow-pokemon")
                pokemon_list = []
                for shadow in shadow_pokemons:
                    p_name = shadow.get("data-pokemon", "")
                    img_el = shadow.select_one(".pokemon-image")
                    image = img_el["src"] if img_el and "src" in img_el.attrs else ""

                    types = []
                    t1 = shadow.get("data-type1")
                    t2 = shadow.get("data-type2")
                    if t1 and t1 != "None":
                        types.append(t1.lower())
                    if t2 and t2 != "None":
                        types.append(t2.lower())

                    is_encounter = slot_is_encounter or shadow.select_one(".encounter-icon") is not None
                    can_be_shiny = shadow.select_one(".shiny-icon") is not None

                    pokemon_list.append({
                        "name": p_name,
                        "image": image,
                        "types": types,
                        "isEncounter": is_encounter,
                        "canBeShiny": can_be_shiny
                    })

                lineup[slot_keys[index]] = pokemon_list

            lineups.append(lineup)

        save_json("rocketLineups.json", lineups)
        print(f"  -> Saved {len(lineups)} rocket lineups.")
        return lineups
    except Exception as e:
        print(f"Error scraping rocket lineups: {e}")
        return []

def upload_to_firestore(events, raids, research, eggs, rocket):
    print("Uploading scraped data to Firebase Firestore...")
    api_key = os.environ.get("FIREBASE_API_KEY", "AIzaSyAHsUktWNFdK8IiOYSAchnFxR-pqVQZJbU")
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "pogo-website-14a46")
    email = os.environ.get("SCRAPER_EMAIL", "scraper@pogowebsite.local")
    password = os.environ.get("SCRAPER_PASSWORD", "ScraperPassword123!")

    try:
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
        res = requests.post(auth_url, json={"email": email, "password": password, "returnSecureToken": True})
        if res.status_code != 200:
            signup_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"
            res = requests.post(signup_url, json={"email": email, "password": password, "returnSecureToken": True})
        
        if res.status_code != 200:
            print(f"Failed to authenticate with Firebase: {res.text}")
            return False

        auth_data = res.json()
        id_token = auth_data.get("idToken")
        scraper_uid = auth_data.get("localId")

        import datetime
        payload = {
            "fields": {
                "events": {"stringValue": json.dumps(events, ensure_ascii=False)},
                "raids": {"stringValue": json.dumps(raids, ensure_ascii=False)},
                "research": {"stringValue": json.dumps(research, ensure_ascii=False)},
                "eggs": {"stringValue": json.dumps(eggs, ensure_ascii=False)},
                "rocketLineups": {"stringValue": json.dumps(rocket, ensure_ascii=False)},
                "updatedAt": {"stringValue": datetime.datetime.now(datetime.timezone.utc).isoformat()}
            }
        }

        fs_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/users_data/{scraper_uid}"
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
    print("=== Starting Python ScrapedDuck ===")
    events = scrape_events()
    raids = scrape_raids()
    research = scrape_research()
    eggs = scrape_eggs()
    rocket = scrape_rocket()
    upload_to_firestore(events, raids, research, eggs, rocket)
    print("=== All scraping and database upload complete! ===")

if __name__ == "__main__":
    main()

