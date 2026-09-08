import os
import json
import math
import re
import requests
import bs4

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

TYPE_WEATHER_MAP = {
    "normal": "partly cloudy",
    "rock": "partly cloudy",
    "fire": "sunny",
    "grass": "sunny",
    "ground": "sunny",
    "water": "rainy",
    "electric": "rainy",
    "bug": "rainy",
    "fighting": "cloudy",
    "poison": "cloudy",
    "fairy": "cloudy",
    "flying": "windy",
    "dragon": "windy",
    "psychic": "windy",
    "ice": "snow",
    "steel": "snow",
    "dark": "fog",
    "ghost": "fog"
}

def load_shiny_set():
    shiny_dexes = set()
    shiny_names = set()
    try:
        res = requests.get("https://pogoapi.net/api/v1/shiny_pokemon.json", headers=HEADERS, timeout=10)
        if res.status_code == 200:
            data = res.json()
            for item in data.values():
                if isinstance(item, dict):
                    if 'id' in item:
                        shiny_dexes.add(item['id'])
                    if 'name' in item:
                        shiny_names.add(item['name'].upper())
    except Exception as e:
        print(f"  Warning loading shiny database: {e}")
    return shiny_dexes, shiny_names

def load_pokedex_map():
    poke_map = {}
    paths = [
        os.path.join(os.path.dirname(__file__), "..", "files", "pokedex.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "files", "pokedex.json"),
        os.path.join("files", "pokedex.json")
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    dex_data = json.load(f)
                    for item in dex_data:
                        pid = str(item.get("id", "")).upper()
                        name_eng = item.get("names", {}).get("English", "").upper()
                        dex_nr = item.get("dexNr")
                        if pid:
                            poke_map[pid] = item
                        if dex_nr:
                            poke_map[dex_nr] = item
                            poke_map[str(dex_nr)] = item
                        if name_eng and name_eng not in poke_map:
                            poke_map[name_eng] = item
                break
            except Exception as e:
                print(f"  Warning loading pokedex for raids: {e}")
    return poke_map

def calculate_cp(base_atk, base_def, base_sta, iv_atk=15, iv_def=15, iv_sta=15, cpm=0.59740001):
    atk = base_atk + iv_atk
    deff = base_def + iv_def
    sta = base_sta + iv_sta
    cp = math.floor((atk * math.sqrt(deff) * math.sqrt(sta) * (cpm ** 2)) / 10.0)
    return max(10, cp)

def get_cp_from_stats(base_atk, base_def, base_sta):
    cpm_l20 = 0.59740001
    cpm_l25 = 0.667934
    return {
        "normal": {
            "min": calculate_cp(base_atk, base_def, base_sta, 10, 10, 10, cpm_l20),
            "max": calculate_cp(base_atk, base_def, base_sta, 15, 15, 15, cpm_l20)
        },
        "boosted": {
            "min": calculate_cp(base_atk, base_def, base_sta, 10, 10, 10, cpm_l25),
            "max": calculate_cp(base_atk, base_def, base_sta, 15, 15, 15, cpm_l25)
        }
    }

def canonicalize_boss_name(name):
    n = name.strip()
    if re.search(r'giratina', n, re.IGNORECASE) and re.search(r'shadow', n, re.IGNORECASE):
        if re.search(r'origin', n, re.IGNORECASE):
            return "Shadow Origin Forme Giratina"
        return "Shadow Altered Forme Giratina"
    if re.search(r'giratina', n, re.IGNORECASE):
        if re.search(r'origin', n, re.IGNORECASE):
            return "Giratina (Origin Forme)"
        return "Giratina (Altered Forme)"
    n = re.sub(r'\s+Raid Guide.*$', '', n, flags=re.IGNORECASE).strip()
    return n

def fetch_guide_details(guide_url, tier="5-Star Raids"):
    details = {
        "cp_normal_min": None, "cp_normal_max": None,
        "cp_boosted_min": None, "cp_boosted_max": None,
        "canBeShiny": False
    }
    if not guide_url:
        return details

    try:
        res = requests.get(guide_url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            soup = bs4.BeautifulSoup(res.text, "html.parser")
            text = soup.get_text()
            clean_text = re.sub(r'\s+', ' ', text)

            text_lower = clean_text.lower()
            if any(k in text_lower for k in ['shiny sprite', 'can be shiny', 'shiny rate', 'shiny version', 'shiny form', 'shiny icon']):
                details["canBeShiny"] = True

            cp_matches = re.findall(r'(\d{3,4})\s*(?:CP\s*to\s*|[\u2013\u2014\-]\s*)(\d{3,4})\s*CP', clean_text, re.IGNORECASE)
            if cp_matches:
                details["cp_normal_min"] = int(cp_matches[0][0])
                details["cp_normal_max"] = int(cp_matches[0][1])
                if len(cp_matches) > 1:
                    details["cp_boosted_min"] = int(cp_matches[1][0])
                    details["cp_boosted_max"] = int(cp_matches[1][1])
    except Exception as e:
        print(f"  Error fetching guide {guide_url}: {e}")

    return details

def build_pokebattler_raid_url(boss_name):
    name = boss_name.strip()
    if name.lower().startswith("mega "):
        base = name[5:].strip().upper().replace(" ", "_")
        slug = f"{base}_MEGA"
    elif name.lower().startswith("shadow "):
        base = name[7:].strip().upper().replace(" ", "_")
        slug = f"SHADOW_{base}"
    else:
        slug = name.upper().replace(" ", "_")
    return f"https://www.pokebattler.com/raids/{slug}"

def build_pokebattler_max_url(boss_name):
    name = boss_name.replace("Dynamax", "").replace("Gigantamax", "").strip().upper().replace(" ", "_")
    return f"https://www.pokebattler.com/max/DYNAMAX_{name}"

def get_boss_image_url(name, dex_nr):
    name_lower = name.lower().strip()
    clean_lower = re.sub(r'^(shadow|dynamax|gigantamax)\s+', '', name_lower).strip()

    # Special legend forms
    if 'dawn wings' in clean_lower or 'dawn_wings' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10156.png"
    if 'dusk mane' in clean_lower or 'dusk_mane' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10155.png"
    if 'black kyurem' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10022.png"
    if 'white kyurem' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10023.png"
    if 'crowned sword' in clean_lower or 'zacian crowned' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10188.png"
    if 'crowned shield' in clean_lower or 'zamazenta crowned' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10189.png"
    if 'giratina' in clean_lower and 'origin' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10007.png"
    if 'giratina' in clean_lower and 'altered' in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/487.png"

    # Megas & Primals
    if clean_lower.startswith('mega ') or clean_lower.startswith('super mega '):
        base = re.sub(r'^(super mega|mega)\s+', '', clean_lower).strip()
        if base.endswith(' x'):
            key = f"{base[:-2].strip()}-mega-x"
        elif base.endswith(' y'):
            key = f"{base[:-2].strip()}-mega-y"
        else:
            key = f"{base}-mega"
        mega_ids = {
            "venusaur-mega": 10033, "charizard-mega-x": 10034, "charizard-mega-y": 10035, "blastoise-mega": 10036,
            "beedrill-mega": 10090, "pidgeot-mega": 10073, "alakazam-mega": 10037, "slowbro-mega": 10071,
            "gengar-mega": 10038, "kangaskhan-mega": 10039, "pinsir-mega": 10040, "gyarados-mega": 10041,
            "aerodactyl-mega": 10042, "mewtwo-mega-x": 10043, "mewtwo-mega-y": 10044, "ampharos-mega": 10045,
            "steelix-mega": 10072, "scizor-mega": 10046, "heracross-mega": 10047, "houndoom-mega": 10048,
            "tyranitar-mega": 10049, "sceptile-mega": 10065, "blaziken-mega": 10050, "swampert-mega": 10064,
            "gardevoir-mega": 10051, "sableye-mega": 10066, "mawile-mega": 10052, "aggron-mega": 10053,
            "medicham-mega": 10054, "manectric-mega": 10055, "sharpedo-mega": 10070, "camerupt-mega": 10087,
            "altaria-mega": 10067, "banette-mega": 10056, "absol-mega": 10057, "glalie-mega": 10074,
            "salamence-mega": 10089, "metagross-mega": 10076, "latias-mega": 10062, "latios-mega": 10063,
            "kyogre-primal": 10077, "groudon-primal": 10078, "rayquaza-mega": 10079, "lopunny-mega": 10088,
            "garchomp-mega": 10058, "lucario-mega": 10059, "abomasnow-mega": 10060, "gallade-mega": 10068,
            "audino-mega": 10069, "diancie-mega": 10075
        }
        if key in mega_ids:
            return f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{mega_ids[key]}.png"

    # Regional forms
    regional_ids = {
        "rattata-alola": 10091, "raticate-alola": 10092, "raichu-alola": 10100, "sandshrew-alola": 10101,
        "sandslash-alola": 10102, "vulpix-alola": 10103, "ninetales-alola": 10104, "diglett-alola": 10105,
        "dugtrio-alola": 10106, "meowth-alola": 10107, "persian-alola": 10108, "geodude-alola": 10109,
        "graveler-alola": 10110, "golem-alola": 10111, "grimer-alola": 10112, "muk-alola": 10113,
        "exeggutor-alola": 10114, "marowak-alola": 10115, "meowth-galar": 10161, "ponyta-galar": 10162,
        "rapidash-galar": 10163, "slowpoke-galar": 10164, "slowbro-galar": 10165, "farfetchd-galar": 10166,
        "weezing-galar": 10167, "mr-mime-galar": 10168, "articuno-galar": 10169, "zapdos-galar": 10170,
        "moltres-galar": 10171, "slowking-galar": 10172, "corsola-galar": 10173, "zigzagoon-galar": 10174,
        "linoone-galar": 10175, "darumaka-galar": 10176, "darmanitan-galar": 10177, "yamask-galar": 10179,
        "stunfisk-galar": 10180, "growlithe-hisui": 10229, "arcanine-hisui": 10230, "voltorb-hisui": 10231,
        "electrode-hisui": 10232, "typhlosion-hisui": 10233, "qwilfish-hisui": 10234, "sneasel-hisui": 10235,
        "samurott-hisui": 10236, "lilligant-hisui": 10237, "zorua-hisui": 10238, "zoroark-hisui": 10239,
        "braviary-hisui": 10240, "sliggoo-hisui": 10241, "goodra-hisui": 10242, "avalugg-hisui": 10243,
        "decidueye-hisui": 10244, "tauros-paldea": 10250, "wooper-paldea": 10253
    }
    for prefix, region in [('alolan ', 'alola'), ('alola ', 'alola'), ('galarian ', 'galar'), ('galar ', 'galar'), ('hisuian ', 'hisui'), ('hisui ', 'hisui'), ('paldean ', 'paldea'), ('paldea ', 'paldea')]:
        if prefix in clean_lower:
            base = clean_lower.replace(prefix, '').strip()
            base = re.sub(r'\s*\([^)]*\)', '', base).strip()
            key = f"{base}-{region}".replace(' ', '-')
            if key in regional_ids:
                return f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{regional_ids[key]}.png"

    return f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{dex_nr}.png" if dex_nr else ""

def scrape_raids():
    print("Scraping Raids from Pokémon GO Hub...")
    bosses = []
    max_battles = []
    poke_map = load_pokedex_map()
    shiny_dexes, shiny_names = load_shiny_set()

    try:
        url = "https://pokemongohub.net/post/guide/current-go-raids/"
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code == 200:
            soup = bs4.BeautifulSoup(res.text, "html.parser")
            post_body = soup.find("div", class_="td-post-content")
            
            if post_body:
                current_tier = None
                bosses_map = {}

                for h in post_body.find_all(['h2', 'h3', 'h4']):
                    htxt = h.get_text(strip=True)
                    htxt_lower = htxt.lower()

                    if "upcoming" in htxt_lower or "faq" in htxt_lower:
                        break

                    if "5-star shadow" in htxt_lower: current_tier = "Shadow 5-Star Raids"
                    elif "3-star shadow" in htxt_lower: current_tier = "Shadow 3-Star Raids"
                    elif "1-star shadow" in htxt_lower: current_tier = "Shadow 1-Star Raids"
                    elif "super mega" in htxt_lower: current_tier = "Super Mega Raids"
                    elif "mega" in htxt_lower: current_tier = "Mega Raids"
                    elif "5-star" in htxt_lower: current_tier = "5-Star Raids"
                    elif "3-star" in htxt_lower: current_tier = "3-Star Raids"
                    elif "1-star" in htxt_lower: current_tier = "1-Star Raids"

                    if not current_tier:
                        continue

                    curr = h.find_next_sibling()
                    while curr and curr.name not in ['h2', 'h3', 'h4']:
                        for a in curr.find_all('a'):
                            name_span = a.find('span', class_='name')
                            name = name_span.get_text(strip=True) if name_span else a.get_text(strip=True)
                            href = a.get('href', '')

                            if not name or name.lower() in ['shadow raids', 'raid guides', 'related guides', 'current pokémon go raid bosses', 'guides']:
                                continue
                            
                            cname = canonicalize_boss_name(name)
                            if not cname:
                                continue

                            key = (current_tier, cname.lower())
                            is_guide_link = 'pokemongohub.net/post/guide/' in href

                            db_dex = None
                            db_m = re.search(r'/pokemon/(\d+)', href)
                            if db_m:
                                db_dex = int(db_m.group(1))

                            if key not in bosses_map:
                                bosses_map[key] = {'name': cname, 'tier': current_tier, 'href': href, 'is_guide': is_guide_link, 'db_dex': db_dex}
                            else:
                                if db_dex and not bosses_map[key].get('db_dex'):
                                    bosses_map[key]['db_dex'] = db_dex
                                if is_guide_link and not bosses_map[key]['is_guide']:
                                    bosses_map[key]['href'] = href
                                    bosses_map[key]['is_guide'] = True

                        curr = curr.find_next_sibling()

                for b in bosses_map.values():
                    clean_name = b['name']
                    current_tier = b['tier']
                    href = b['href']
                    db_dex = b.get('db_dex')

                    print(f"  -> Scraping [{current_tier}] {clean_name}")
                    guide_info = fetch_guide_details(href, current_tier) if 'guide' in href else {
                        "cp_normal_min": None, "cp_normal_max": None,
                        "cp_boosted_min": None, "cp_boosted_max": None,
                        "canBeShiny": False
                    }

                    base_species = re.sub(r'^(Hisuian|Alolan|Galarian|Paldean|Shadow|Mega)\s+', '', clean_name, flags=re.IGNORECASE)
                    base_species = re.sub(r'\s*\([^\)]*\)', '', base_species).strip().upper()

                    dex_entry = (poke_map.get(db_dex) if db_dex else None) or poke_map.get(clean_name.upper()) or poke_map.get(base_species) or {}
                    dex_nr = dex_entry.get("dexNr") or db_dex

                    types = []
                    weather_boosts = []
                    seen_weathers = set()

                    if dex_entry.get("primaryType"):
                        t_name = dex_entry["primaryType"].get("names", {}).get("English", "").lower()
                        if t_name:
                            types.append({"name": t_name, "image": f"https://leekduck.com/assets/img/types/{t_name}.png"})
                            w_name = TYPE_WEATHER_MAP.get(t_name)
                            if w_name and w_name not in seen_weathers:
                                seen_weathers.add(w_name)
                                w_img = w_name.replace(" ", "_")
                                weather_boosts.append({"name": w_name, "image": f"https://leekduck.com/assets/img/weather/{w_img}.png"})

                    if dex_entry.get("secondaryType"):
                        t_name = dex_entry["secondaryType"].get("names", {}).get("English", "").lower()
                        if t_name:
                            types.append({"name": t_name, "image": f"https://leekduck.com/assets/img/types/{t_name}.png"})
                            w_name = TYPE_WEATHER_MAP.get(t_name)
                            if w_name and w_name not in seen_weathers:
                                seen_weathers.add(w_name)
                                w_img = w_name.replace(" ", "_")
                                weather_boosts.append({"name": w_name, "image": f"https://leekduck.com/assets/img/weather/{w_img}.png"})

                    cp_dict = None
                    if dex_entry.get("stats"):
                        stats = dex_entry["stats"]
                        b_atk = stats.get("attack") or stats.get("baseAttack") or stats.get("atk", 0)
                        b_def = stats.get("defense") or stats.get("baseDefense") or stats.get("def", 0)
                        b_sta = stats.get("stamina") or stats.get("baseStamina") or stats.get("sta", 0)
                        if b_atk and b_def and b_sta:
                            cp_dict = get_cp_from_stats(b_atk, b_def, b_sta)

                    if not cp_dict and (guide_info.get("cp_normal_max") or guide_info.get("cp_boosted_max")):
                        cp_dict = {
                            "normal": {
                                "min": guide_info.get("cp_normal_min") or 0,
                                "max": guide_info.get("cp_normal_max") or 0
                            },
                            "boosted": {
                                "min": guide_info.get("cp_boosted_min") or 0,
                                "max": guide_info.get("cp_boosted_max") or 0
                            }
                        }

                    img_url = get_boss_image_url(clean_name, dex_nr)

                    can_be_shiny = bool((dex_nr and dex_nr in shiny_dexes) or (base_species and base_species.upper() in shiny_names) or (clean_name.upper() in shiny_names) or guide_info.get("canBeShiny", False))
                    pb_url = build_pokebattler_raid_url(clean_name)

                    bosses.append({
                        "name": clean_name,
                        "tier": current_tier,
                        "canBeShiny": can_be_shiny,
                        "types": types,
                        "combatPower": cp_dict,
                        "boostedWeather": weather_boosts,
                        "image": img_url,
                        "pokebattlerUrl": pb_url
                    })
    except Exception as e:
        print(f"Error scraping Pokémon GO Hub raids: {e}")

    try:
        pb_url = "https://fight.pokebattler.com/raids"
        res = requests.get(pb_url, headers=HEADERS, timeout=15)
        if res.status_code == 200:
            pb_data = res.json()
            for t in pb_data.get("tiers", []):
                tier_name = t.get("tier", "")
                if "MAX" in tier_name and not ("FUTURE" in tier_name or "LEGACY" in tier_name):
                    tier_clean = tier_name.replace("RAID_LEVEL_", "").replace("_MAX", "").replace("_", " ").title()
                    tier_label = f"Max Battles ({tier_clean} Max)" if tier_clean else "Max Battles"
                    
                    for r in t.get("raids", []):
                        raw_id = r.get("pokemonId") or r.get("pokemon", "")
                        raw_id_upper = raw_id.upper()
                        clean_id = re.sub(r'^(DYNAMAX_|GIGANTAMAX_|MEGA_|SHADOW_)', '', raw_id_upper).strip()
                        p_info = poke_map.get(clean_id) or poke_map.get(raw_id_upper) or {}
                        name_eng = p_info.get("names", {}).get("English") or clean_id.capitalize()
                        if not p_info:
                            p_info = poke_map.get(name_eng.upper()) or {}
                        dex_nr = p_info.get("dexNr")
                        img_url = f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{dex_nr}.png" if dex_nr else "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png"
                        
                        types = []
                        weather_boosts = []
                        seen_weathers = set()

                        if p_info.get("primaryType"):
                            t_name = p_info["primaryType"].get("names", {}).get("English", "").lower()
                            if t_name:
                                types.append({"name": t_name, "image": f"https://leekduck.com/assets/img/types/{t_name}.png"})
                                w_name = TYPE_WEATHER_MAP.get(t_name)
                                if w_name and w_name not in seen_weathers:
                                    seen_weathers.add(w_name)
                                    w_img = w_name.replace(" ", "_")
                                    weather_boosts.append({"name": w_name, "image": f"https://leekduck.com/assets/img/weather/{w_img}.png"})

                        if p_info.get("secondaryType"):
                            t_name = p_info["secondaryType"].get("names", {}).get("English", "").lower()
                            if t_name:
                                types.append({"name": t_name, "image": f"https://leekduck.com/assets/img/types/{t_name}.png"})
                                w_name = TYPE_WEATHER_MAP.get(t_name)
                                if w_name and w_name not in seen_weathers:
                                    seen_weathers.add(w_name)
                                    w_img = w_name.replace(" ", "_")
                                    weather_boosts.append({"name": w_name, "image": f"https://leekduck.com/assets/img/weather/{w_img}.png"})

                        cp_dict = None
                        if p_info.get("stats"):
                            stats = p_info["stats"]
                            b_atk = stats.get("attack") or stats.get("baseAttack") or stats.get("atk", 0)
                            b_def = stats.get("defense") or stats.get("baseDefense") or stats.get("def", 0)
                            b_sta = stats.get("stamina") or stats.get("baseStamina") or stats.get("sta", 0)
                            if b_atk and b_def and b_sta:
                                cp_dict = get_cp_from_stats(b_atk, b_def, b_sta)

                        if not cp_dict:
                            min_c = r.get("minCp") or r.get("cp") or 0
                            max_c = r.get("cp") or 0
                            cp_dict = {
                                "normal": {
                                    "min": min_c,
                                    "max": max_c
                                }
                            }

                        slug = r.get("pokemonId") or r.get("pokemon", "")
                        pb_url_item = f"https://www.pokebattler.com/max/{slug}" if slug.startswith("DYNAMAX_") else build_pokebattler_max_url(name_eng)

                        max_battles.append({
                            "name": f"Dynamax {name_eng}",
                            "tier": tier_label,
                            "canBeShiny": r.get("shiny", False),
                            "pokebattlerUrl": pb_url_item,
                            "types": types,
                            "combatPower": cp_dict,
                            "boostedWeather": weather_boosts,
                            "image": img_url
                        })
    except Exception as e:
        print(f"Error fetching Pokebattler max battles: {e}")

    print(f"  -> Saved {len(bosses)} standard raid bosses from Pokémon GO Hub and {len(max_battles)} max battle bosses.")
    return bosses, max_battles

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    scrape_raids()

