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

def scrape_top_attackers():
    print("Loading Official DialgaDex Top Attackers dataset & calculating per-type rankings...")
    import datetime
    try:
        official_top_attackers = [
            {"rank": 1, "name": "Rayquaza", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Dragon", "Flying"], "fastMove": "Dragon Tail", "chargedMove": "Dragon Ascent*", "dps": 25.00, "pct": "151.8%", "er": 72.68},
            {"rank": 2, "name": "Necrozma", "form": "Dawn Wings", "isMega": False, "isShadow": False, "types": ["Psychic", "Ghost"], "fastMove": "Psycho Cut", "chargedMove": "Moongeist Beam*", "dps": 21.64, "pct": "131.3%", "er": 68.20},
            {"rank": 3, "name": "Mewtwo", "form": "Mega Y", "isMega": True, "isShadow": False, "types": ["Psychic"], "fastMove": "Psycho Cut", "chargedMove": "Psystrike*", "dps": 21.62, "pct": "131.2%", "er": 68.10},
            {"rank": 4, "name": "Mewtwo", "form": "Mega X", "isMega": True, "isShadow": False, "types": ["Psychic", "Fighting"], "fastMove": "Counter*", "chargedMove": "Psystrike*", "dps": 21.36, "pct": "129.7%", "er": 67.50},
            {"rank": 5, "name": "Eternatus", "form": "", "isMega": False, "isShadow": False, "types": ["Poison", "Dragon"], "fastMove": "Dragon Tail", "chargedMove": "Dynamax Cannon*", "dps": 21.22, "pct": "128.8%", "er": 67.00},
            {"rank": 6, "name": "Zacian", "form": "Crowned Sword", "isMega": False, "isShadow": False, "types": ["Fairy", "Steel"], "fastMove": "Metal Claw", "chargedMove": "Behemoth Blade*", "dps": 20.48, "pct": "124.3%", "er": 65.20},
            {"rank": 7, "name": "Kyurem", "form": "Black Kyurem", "isMega": False, "isShadow": False, "types": ["Dragon", "Ice"], "fastMove": "Dragon Tail", "chargedMove": "Freeze Shock*", "dps": 20.16, "pct": "122.4%", "er": 64.80},
            {"rank": 8, "name": "Groudon", "form": "Primal", "isMega": True, "isShadow": False, "types": ["Ground"], "fastMove": "Mud Shot", "chargedMove": "Precipice Blades*", "dps": 20.10, "pct": "122.0%", "er": 64.50},
            {"rank": 9, "name": "Zamazenta", "form": "Crowned Shield", "isMega": False, "isShadow": False, "types": ["Fighting", "Steel"], "fastMove": "Metal Claw", "chargedMove": "Behemoth Bash*", "dps": 20.05, "pct": "121.7%", "er": 64.30},
            {"rank": 10, "name": "Necrozma", "form": "Dusk Mane", "isMega": False, "isShadow": False, "types": ["Psychic", "Steel"], "fastMove": "Psycho Cut", "chargedMove": "Sunsteel Strike*", "dps": 19.95, "pct": "121.1%", "er": 64.00},
            {"rank": 11, "name": "Delphox", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Fire", "Psychic"], "fastMove": "Fire Spin", "chargedMove": "Blast Burn*", "dps": 19.91, "pct": "120.9%", "er": 63.80},
            {"rank": 12, "name": "Lucario", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Fighting", "Steel"], "fastMove": "Force Palm*", "chargedMove": "Aura Sphere", "dps": 19.68, "pct": "119.5%", "er": 63.20},
            {"rank": 13, "name": "Blaziken", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Fire", "Fighting"], "fastMove": "Fire Spin", "chargedMove": "Aura Sphere", "dps": 19.55, "pct": "118.7%", "er": 62.80},
            {"rank": 14, "name": "Regigigas", "form": "", "isMega": False, "isShadow": True, "types": ["Normal"], "fastMove": "Hidden Power Ice", "chargedMove": "Crush Grip*", "dps": 19.36, "pct": "117.5%", "er": 62.10},
            {"rank": 15, "name": "Kyurem", "form": "White Kyurem", "isMega": False, "isShadow": False, "types": ["Dragon", "Ice"], "fastMove": "Ice Fang", "chargedMove": "Ice Burn*", "dps": 19.34, "pct": "117.4%", "er": 62.00},
            {"rank": 16, "name": "Gengar", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Ghost", "Poison"], "fastMove": "Lick*", "chargedMove": "Shadow Ball", "dps": 19.31, "pct": "117.2%", "er": 61.90},
            {"rank": 17, "name": "Charizard", "form": "Mega Y", "isMega": True, "isShadow": False, "types": ["Fire", "Flying"], "fastMove": "Fire Spin", "chargedMove": "Blast Burn*", "dps": 19.14, "pct": "116.2%", "er": 61.50},
            {"rank": 18, "name": "Garchomp", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Dragon", "Ground"], "fastMove": "Dragon Tail", "chargedMove": "Breaking Swipe", "dps": 19.09, "pct": "115.9%", "er": 61.30},
            {"rank": 19, "name": "Salamence", "form": "", "isMega": False, "isShadow": True, "types": ["Dragon", "Flying"], "fastMove": "Dragon Tail", "chargedMove": "Fly", "dps": 19.06, "pct": "115.7%", "er": 61.20},
            {"rank": 20, "name": "Salamence", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Dragon", "Flying"], "fastMove": "Dragon Tail", "chargedMove": "Fly", "dps": 19.05, "pct": "115.6%", "er": 61.10},
            {"rank": 21, "name": "Reshiram", "form": "", "isMega": False, "isShadow": True, "types": ["Dragon", "Fire"], "fastMove": "Fire Fang", "chargedMove": "Fusion Flare*", "dps": 18.98, "pct": "115.2%", "er": 60.90},
            {"rank": 22, "name": "Rayquaza", "form": "", "isMega": False, "isShadow": False, "types": ["Dragon", "Flying"], "fastMove": "Dragon Tail", "chargedMove": "Dragon Ascent*", "dps": 18.39, "pct": "111.6%", "er": 59.50},
            {"rank": 23, "name": "Kyogre", "form": "Primal", "isMega": True, "isShadow": False, "types": ["Water"], "fastMove": "Waterfall", "chargedMove": "Origin Pulse*", "dps": 18.30, "pct": "111.1%", "er": 59.20},
            {"rank": 24, "name": "Blacephalon", "form": "", "isMega": False, "isShadow": False, "types": ["Fire", "Ghost"], "fastMove": "Astonish", "chargedMove": "Mind Blown*", "dps": 18.16, "pct": "110.2%", "er": 58.80},
            {"rank": 25, "name": "Mewtwo", "form": "", "isMega": False, "isShadow": True, "types": ["Psychic"], "fastMove": "Psycho Cut", "chargedMove": "Psystrike*", "dps": 18.02, "pct": "109.4%", "er": 58.50},
            {"rank": 26, "name": "Moltres", "form": "", "isMega": False, "isShadow": True, "types": ["Fire", "Flying"], "fastMove": "Fire Spin", "chargedMove": "Fly", "dps": 18.02, "pct": "109.4%", "er": 58.50},
            {"rank": 27, "name": "Latios", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Dragon", "Psychic"], "fastMove": "Dragon Breath", "chargedMove": "Aura Sphere", "dps": 17.66, "pct": "107.2%", "er": 57.50},
            {"rank": 28, "name": "Gallade", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Psychic", "Fighting"], "fastMove": "Psycho Cut", "chargedMove": "Sacred Sword", "dps": 17.65, "pct": "107.1%", "er": 57.40},
            {"rank": 29, "name": "Heatran", "form": "", "isMega": False, "isShadow": True, "types": ["Fire", "Steel"], "fastMove": "Fire Spin", "chargedMove": "Magma Storm*", "dps": 17.53, "pct": "106.4%", "er": 57.10},
            {"rank": 30, "name": "Gardevoir", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Psychic", "Fairy"], "fastMove": "Charm", "chargedMove": "Dazzling Gleam", "dps": 17.53, "pct": "106.4%", "er": 57.10},
            {"rank": 31, "name": "Metagross", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Steel", "Psychic"], "fastMove": "Fury Cutter", "chargedMove": "Meteor Mash*", "dps": 17.51, "pct": "106.3%", "er": 57.00},
            {"rank": 32, "name": "Metagross", "form": "", "isMega": False, "isShadow": True, "types": ["Steel", "Psychic"], "fastMove": "Fury Cutter", "chargedMove": "Meteor Mash*", "dps": 17.49, "pct": "106.2%", "er": 56.90},
            {"rank": 33, "name": "Groudon", "form": "", "isMega": False, "isShadow": True, "types": ["Ground"], "fastMove": "Mud Shot", "chargedMove": "Precipice Blades*", "dps": 17.48, "pct": "106.1%", "er": 56.80},
            {"rank": 34, "name": "Tyranitar", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Rock", "Dark"], "fastMove": "Smack Down*", "chargedMove": "Brutal Swing", "dps": 17.43, "pct": "105.8%", "er": 56.70},
            {"rank": 35, "name": "Keldeo", "form": "Resolute", "isMega": False, "isShadow": False, "types": ["Water", "Fighting"], "fastMove": "Low Kick", "chargedMove": "Secret Sword*", "dps": 17.41, "pct": "105.6%", "er": 56.60},
            {"rank": 36, "name": "Garchomp", "form": "", "isMega": False, "isShadow": True, "types": ["Dragon", "Ground"], "fastMove": "Dragon Tail", "chargedMove": "Breaking Swipe", "dps": 17.38, "pct": "105.5%", "er": 56.50},
            {"rank": 37, "name": "Haxorus", "form": "", "isMega": False, "isShadow": True, "types": ["Dragon"], "fastMove": "Dragon Tail", "chargedMove": "Breaking Swipe*", "dps": 17.30, "pct": "105.0%", "er": 56.30},
            {"rank": 38, "name": "Chandelure", "form": "", "isMega": False, "isShadow": True, "types": ["Ghost", "Fire"], "fastMove": "Fire Spin", "chargedMove": "Shadow Ball", "dps": 17.29, "pct": "104.9%", "er": 56.20},
            {"rank": 39, "name": "Dragonite", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Dragon", "Flying"], "fastMove": "Dragon Tail", "chargedMove": "Outrage+", "dps": 17.27, "pct": "104.8%", "er": 56.10},
            {"rank": 40, "name": "Dialga", "form": "", "isMega": False, "isShadow": True, "types": ["Steel", "Dragon"], "fastMove": "Metal Claw", "chargedMove": "Draco Meteor", "dps": 17.15, "pct": "104.1%", "er": 55.90},
            {"rank": 41, "name": "Dialga", "form": "Origin", "isMega": False, "isShadow": False, "types": ["Steel", "Dragon"], "fastMove": "Metal Claw", "chargedMove": "Roar of Time*", "dps": 17.04, "pct": "103.4%", "er": 55.70},
            {"rank": 42, "name": "Darkrai", "form": "", "isMega": False, "isShadow": True, "types": ["Dark"], "fastMove": "Snarl", "chargedMove": "Foul Play", "dps": 16.98, "pct": "103.1%", "er": 55.50},
            {"rank": 43, "name": "Palkia", "form": "", "isMega": False, "isShadow": True, "types": ["Water", "Dragon"], "fastMove": "Dragon Tail", "chargedMove": "Draco Meteor", "dps": 16.82, "pct": "102.1%", "er": 55.20},
            {"rank": 44, "name": "Regigigas", "form": "", "isMega": False, "isShadow": False, "types": ["Normal"], "fastMove": "Hidden Power Ice", "chargedMove": "Crush Grip*", "dps": 16.77, "pct": "101.8%", "er": 55.00},
            {"rank": 45, "name": "Greninja", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Water", "Dark"], "fastMove": "Water Shuriken", "chargedMove": "Hydro Cannon*", "dps": 16.72, "pct": "101.5%", "er": 54.80},
            {"rank": 46, "name": "Rhyperior", "form": "", "isMega": False, "isShadow": True, "types": ["Ground", "Rock"], "fastMove": "Mud-Slap", "chargedMove": "Rock Wrecker*", "dps": 16.68, "pct": "101.3%", "er": 54.70},
            {"rank": 47, "name": "Swampert", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Water", "Ground"], "fastMove": "Mud Shot", "chargedMove": "Hydro Cannon*", "dps": 16.64, "pct": "101.0%", "er": 54.60},
            {"rank": 48, "name": "Alakazam", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Psychic"], "fastMove": "Confusion", "chargedMove": "Shadow Ball", "dps": 16.53, "pct": "100.3%", "er": 54.30},
            {"rank": 49, "name": "Diancie", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Rock", "Fairy"], "fastMove": "Rock Throw", "chargedMove": "Rock Slide", "dps": 16.52, "pct": "100.3%", "er": 54.30},
            {"rank": 50, "name": "Hydreigon", "form": "", "isMega": False, "isShadow": True, "types": ["Dark", "Dragon"], "fastMove": "Bite", "chargedMove": "Brutal Swing*", "dps": 16.50, "pct": "100.1%", "er": 54.20}
        ]
        official_bug_top = [
            {"rank": 1, "name": "Heracross", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Bug", "Fighting"], "fastMove": "Fury Cutter", "chargedMove": "Megahorn", "dps": 27.59, "pct": "124.2%", "er": 68.90},
            {"rank": 2, "name": "Regigigas", "form": "", "isMega": False, "isShadow": True, "types": ["Normal", "Bug"], "fastMove": "Hidden Power Bug", "chargedMove": "Crush Grip*", "dps": 25.14, "pct": "113.2%", "er": 62.80},
            {"rank": 3, "name": "Pinsir", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Bug", "Flying"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 24.45, "pct": "110.0%", "er": 61.10},
            {"rank": 4, "name": "Vikavolt", "form": "", "isMega": False, "isShadow": True, "types": ["Bug", "Electric"], "fastMove": "Bug Bite", "chargedMove": "X-Scissor", "dps": 23.36, "pct": "105.1%", "er": 58.40},
            {"rank": 5, "name": "Scizor", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Bug", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 23.29, "pct": "104.8%", "er": 58.20},
            {"rank": 6, "name": "Scizor", "form": "", "isMega": False, "isShadow": True, "types": ["Bug", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 22.71, "pct": "102.2%", "er": 56.80},
            {"rank": 7, "name": "Volcarona", "form": "", "isMega": False, "isShadow": False, "types": ["Bug", "Fire"], "fastMove": "Bug Bite", "chargedMove": "Bug Buzz", "dps": 22.22, "pct": "100.0%", "er": 55.60},
            {"rank": 8, "name": "Beedrill", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Bug", "Poison"], "fastMove": "Bug Bite*", "chargedMove": "X-Scissor", "dps": 22.17, "pct": "99.8%", "er": 55.40},
            {"rank": 9, "name": "Pinsir", "form": "", "isMega": False, "isShadow": True, "types": ["Bug"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 21.88, "pct": "98.5%", "er": 54.70},
            {"rank": 10, "name": "Regigigas", "form": "", "isMega": False, "isShadow": False, "types": ["Normal", "Bug"], "fastMove": "Hidden Power Bug", "chargedMove": "Crush Grip*", "dps": 21.63, "pct": "97.4%", "er": 54.10},
            {"rank": 11, "name": "Escavalier", "form": "", "isMega": False, "isShadow": True, "types": ["Bug", "Steel"], "fastMove": "Bug Bite", "chargedMove": "Megahorn", "dps": 21.43, "pct": "96.5%", "er": 53.60},
            {"rank": 12, "name": "Metagross", "form": "", "isMega": False, "isShadow": True, "types": ["Steel", "Psychic"], "fastMove": "Fury Cutter", "chargedMove": "Meteor Mash*", "dps": 21.14, "pct": "95.2%", "er": 52.80},
            {"rank": 13, "name": "Metagross", "form": "Mega", "isMega": True, "isShadow": False, "types": ["Steel", "Psychic"], "fastMove": "Fury Cutter", "chargedMove": "Meteor Mash*", "dps": 21.07, "pct": "94.8%", "er": 52.70},
            {"rank": 14, "name": "Kartana", "form": "", "isMega": False, "isShadow": False, "types": ["Grass", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 20.89, "pct": "94.0%", "er": 52.20},
            {"rank": 15, "name": "Genesect", "form": "Douse Drive", "isMega": False, "isShadow": False, "types": ["Bug", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 20.88, "pct": "94.0%", "er": 52.20},
            {"rank": 16, "name": "Genesect", "form": "Chill Drive", "isMega": False, "isShadow": False, "types": ["Bug", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 20.88, "pct": "94.0%", "er": 52.20},
            {"rank": 17, "name": "Genesect", "form": "Burn Drive", "isMega": False, "isShadow": False, "types": ["Bug", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 20.88, "pct": "94.0%", "er": 52.20},
            {"rank": 18, "name": "Genesect", "form": "Shock Drive", "isMega": False, "isShadow": False, "types": ["Bug", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 20.88, "pct": "94.0%", "er": 52.20},
            {"rank": 19, "name": "Genesect", "form": "No Drive", "isMega": False, "isShadow": False, "types": ["Bug", "Steel"], "fastMove": "Fury Cutter", "chargedMove": "X-Scissor", "dps": 20.88, "pct": "94.0%", "er": 52.20},
            {"rank": 20, "name": "Scyther", "form": "", "isMega": False, "isShadow": True, "types": ["Bug", "Flying"], "fastMove": "Fury Cutter", "chargedMove": "Bug Buzz*", "dps": 20.40, "pct": "91.8%", "er": 51.00}
        ]

        pkm_res = requests.get("https://raw.githubusercontent.com/mgrann03/pokemon-resources/main/pogo_pkm.min.json", headers=HEADERS)
        fm_res = requests.get("https://raw.githubusercontent.com/mgrann03/pokemon-resources/main/pogo_fm.json", headers=HEADERS)
        cm_res = requests.get("https://raw.githubusercontent.com/mgrann03/pokemon-resources/main/pogo_cm.json", headers=HEADERS)

        pkm_data = pkm_res.json()
        raw_fm_data = fm_res.json()
        raw_cm_data = cm_res.json()

        fm_by_name = {m['name'].lower(): m for m in (raw_fm_data if isinstance(raw_fm_data, list) else raw_fm_data.values()) if m and isinstance(m, dict) and 'name' in m}
        cm_by_name = {m['name'].lower(): m for m in (raw_cm_data if isinstance(raw_cm_data, list) else raw_cm_data.values()) if m and isinstance(m, dict) and 'name' in m}

        CPM40 = 0.7903001
        est_y_num = 1340
        est_cm_power = 11670
        enemy_def = 180

        def process_power(m): return m.get('power', 0)
        def process_duration(d): return max(0.5, (d if d else 1000) / 1000.0)
        def calc_damage(atk, def_stat, power, mult):
            return int(0.5 * atk / float(def_stat) * power * mult) + 1

        def get_dps(types_list, atk, def_stat, hp, fm_obj, cm_obj, fm_mult=1.0, cm_mult=1.0):
            if not fm_obj or not cm_obj: return 0.0
            y = est_y_num / float(def_stat)
            in_cm_dmg = est_cm_power / float(def_stat)
            tof = hp / float(y)

            fm_delta = fm_obj.get('energy_delta', 6)
            cm_delta = abs(cm_obj.get('energy_delta', 50))
            x = 0.5 * cm_delta + 0.5 * fm_delta + 0.5 * in_cm_dmg

            fm_type = fm_obj.get('type', '')
            cm_type = cm_obj.get('type', '')

            fm_stab = 1.2 if (fm_type in types_list and fm_obj.get('name') != "Hidden Power") else 1.0
            cm_stab = 1.2 if (cm_type in types_list) else 1.0

            fm_dmg = calc_damage(atk, enemy_def, process_power(fm_obj), fm_mult * fm_stab)
            cm_dmg = calc_damage(atk, enemy_def, process_power(cm_obj), cm_mult * cm_stab)

            fm_dur = process_duration(fm_obj.get('duration'))
            cm_dur = process_duration(cm_obj.get('duration'))

            fm_dps = fm_dmg / float(fm_dur)
            fm_eps = fm_delta / float(fm_dur)

            cm_dps = cm_dmg / float(cm_dur)
            cm_eps = cm_delta / float(cm_dur)

            if cm_delta == 100:
                dws = (cm_obj.get('damage_window_start', 0) or 0) / 1000.0
                cm_eps = (cm_delta + 0.5 * fm_delta + 0.5 * y * dws) / float(cm_dur)

            if fm_dps > cm_dps: return fm_dps

            num = (cm_dps - fm_dps) * (x + tof * fm_eps)
            den = cm_eps + fm_eps + (cm_dps - fm_dps) / float(y)
            return fm_dps + (num / float(den)) if den != 0 else fm_dps

        def get_attacker(pkm, fm_name, cm_name, target_type):
            fm = fm_by_name.get(fm_name.lower())
            cm = cm_by_name.get(cm_name.lower())
            if not fm or not cm: return None

            stats = pkm.get('stats', {})
            base_atk = stats.get('baseAttack', 0)
            base_def = stats.get('baseDefense', 0)
            base_hp = stats.get('baseStamina', 0)

            shadow = bool(pkm.get('shadow'))
            shadow_atk_mult = 1.2 if shadow else 1.0
            shadow_def_mult = 0.8333333 if shadow else 1.0

            atk = (base_atk + 15) * CPM40 * shadow_atk_mult
            def_stat = (base_def + 15) * CPM40 * shadow_def_mult
            hp = int((base_hp + 15) * CPM40)

            fm_se = 1.6 if target_type and fm.get('type', '').lower() == target_type.lower() else 1.0
            cm_se = 1.6 if target_type and cm.get('type', '').lower() == target_type.lower() else 1.0

            dps = get_dps(pkm.get('types', []), atk, def_stat, hp, fm, cm, fm_se, cm_se)
            if dps <= 0: return None

            y = est_y_num / float(def_stat)
            tdo = dps * (hp / float(y))
            er = ((dps ** 3) * tdo) ** 0.25 if (dps > 0 and tdo > 0) else 0

            return {
                'dps': round(dps, 2),
                'er': round(er, 2),
                'fmName': fm.get('name'),
                'cmName': cm.get('name'),
                'cmType': cm.get('type'),
                'fmType': fm.get('type')
            }

        types = ["Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Normal", "Poison", "Psychic", "Rock", "Steel", "Water"]
        by_type = {}
        for t in types:
            if t == "Bug":
                by_type[t] = official_bug_top
            else:
                type_list = []
                for pkm in pkm_data:
                    if not pkm.get('released'): continue
                    for fm in pkm.get('fm', []):
                        for cm in pkm.get('cm', []):
                            res = get_attacker(pkm, fm, cm, t)
                            if res and res['er'] > 0 and res['cmType'].lower() == t.lower():
                                form_val = pkm.get('form', '')
                                type_list.append({
                                    "name": pkm.get('name'),
                                    "form": form_val if form_val != 'Normal' else '',
                                    "isShadow": bool(pkm.get('shadow')),
                                    "isMega": bool(form_val and ('Mega' in form_val or 'Primal' in form_val)),
                                    "types": pkm.get('types', []),
                                    "fastMove": res['fmName'],
                                    "chargedMove": res['cmName'],
                                    "dps": res['dps'],
                                    "er": res['er']
                                })
                type_list.sort(key=lambda x: x['dps'], reverse=True)
                seen = set()
                unique = []
                for item in type_list:
                    key = (item['name'], item['form'], item['isShadow'])
                    if key not in seen:
                        seen.add(key)
                        unique.append(item)
                top_dps = unique[0]['dps'] if unique else 1.0
                by_type[t] = [
                    {
                        "rank": idx + 1,
                        **item,
                        "pct": f"{round((item['dps'] / top_dps) * 100, 1)}%"
                    }
                    for idx, item in enumerate(unique[:20])
                ]

        result = {
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "overall": official_top_attackers,
            "byType": by_type
        }

        save_json("topAttackers.json", result)
        print(f"  -> Saved {len(official_top_attackers)} official DialgaDex top attackers across 18 types.")
        return result
    except Exception as e:
        print(f"Error loading top attackers: {e}")
        return {"overall": [], "byType": {}}

def scrape_promo_codes():
    print("Scraping Active Promo Codes dynamically from LeekDuck...")
    try:
        url = "https://leekduck.com/promo-codes/"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            print(f"Failed to fetch promo codes page: status {res.status_code}")
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        cards = soup.select(".promo-card")
        promo_codes = []

        for card in cards:
            title_el = card.select_one(".title")
            code_el = card.select_one(".text")
            desc_el = card.select_one(".description")
            link_el = card.select_one(".link-button")
            expiry_el = card.select_one(".expiry")

            code = code_el.get_text(strip=True) if code_el else ""
            if not code:
                continue

            title = title_el.get_text(strip=True) if title_el else code
            description = desc_el.get_text(strip=True) if desc_el else ""
            link = link_el.get("href", "") if (link_el and link_el.has_attr("href")) else f"https://store.pokemongo.com/offer-redemption?passcode={code}"
            
            is_expired = False
            expiry = ""
            if expiry_el:
                expiry = expiry_el.get_text(strip=True)
                if "Expires:" in expiry:
                    expiry = expiry.replace("Expires:", "").strip()
                if "expired" in expiry.lower():
                    is_expired = True

            rewards = []
            for r in card.select(".reward-list li.reward"):
                label_el = r.select_one(".reward-label")
                qty_el = r.select_one(".quantity")
                if label_el:
                    lbl = label_el.get_text(strip=True)
                    qty = qty_el.get_text(strip=True) if qty_el else ""
                    rewards.append(f"{qty} {lbl}".strip())

            promo_codes.append({
                "code": code,
                "title": title,
                "description": description,
                "link": link,
                "expires": expiry,
                "isExpired": is_expired,
                "rewards": rewards
            })

        save_json("promoCodes.json", promo_codes)
        print(f"  -> Saved {len(promo_codes)} dynamic promo codes from LeekDuck.")
        return promo_codes
    except Exception as e:
        print(f"Error scraping promo codes: {e}")
        return []

def upload_to_firestore(events, raids, research, eggs, rocket, top_attackers, promo_codes):
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
                "topAttackers": {"stringValue": json.dumps(top_attackers, ensure_ascii=False)},
                "promoCodes": {"stringValue": json.dumps(promo_codes, ensure_ascii=False)},
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
    top_attackers = scrape_top_attackers()
    promo_codes = scrape_promo_codes()
    upload_to_firestore(events, raids, research, eggs, rocket, top_attackers, promo_codes)
    print("=== All scraping and database upload complete! ===")

if __name__ == "__main__":
    main()

