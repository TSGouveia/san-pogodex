import concurrent.futures
import os
import json
import math
import re
import datetime
import requests
import bs4
from .cp_utils import get_pokedex_stats, get_cp_for_level

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
    if re.search(r'giratina', n, re.IGNORECASE):
        if re.search(r'origin', n, re.IGNORECASE):
            return "Giratina (Origin Forme)"
        return "Giratina (Altered Forme)"
    n = re.sub(r'\s+Raid Guide.*$', '', n, flags=re.IGNORECASE).strip()
    
    # Normalize Antique / Phony Sinistea and Polteageist
    n = re.sub(r'\bAntique\s+Sinistea\b', 'Sinistea', n, flags=re.IGNORECASE)
    n = re.sub(r'\bPhony\s+Sinistea\b', 'Sinistea', n, flags=re.IGNORECASE)
    n = re.sub(r'\bSinistea\s*\(?(Antique|Phony)(\s*Forme?)?\)?', 'Sinistea', n, flags=re.IGNORECASE)
    n = re.sub(r'\bAntique\s+Polteageist\b', 'Polteageist', n, flags=re.IGNORECASE)
    n = re.sub(r'\bPhony\s+Polteageist\b', 'Polteageist', n, flags=re.IGNORECASE)
    n = re.sub(r'\bPolteageist\s*\(?(Antique|Phony)(\s*Forme?)?\)?', 'Polteageist', n, flags=re.IGNORECASE)

    # Standardize regional names to proper adjectives
    n = re.sub(r'\bAlola\b', 'Alolan', n, flags=re.IGNORECASE)
    n = re.sub(r'\bHisui\b', 'Hisuian', n, flags=re.IGNORECASE)
    n = re.sub(r'\bGalar\b', 'Galarian', n, flags=re.IGNORECASE)
    n = re.sub(r'\bPaldea\b', 'Paldean', n, flags=re.IGNORECASE)

    # Standardize Mega naming: 'Mega X Charizard' -> 'Mega Charizard X', 'Mega Y Charizard' -> 'Mega Charizard Y'
    m_mega = re.match(r'^Mega\s+([XY])\s+(.+)$', n, flags=re.IGNORECASE)
    if m_mega:
        n = f"Mega {m_mega.group(2)} {m_mega.group(1).upper()}"
    
    # Remove redundant word 'Shadow' from boss name (tier / badge already specifies Shadow)
    n = re.sub(r'\bShadow\b', '', n, flags=re.IGNORECASE)
    n = re.sub(r'\s+', ' ', n).strip()
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

_POKEBATTLER_IDS = None

def load_pokebattler_ids():
    global _POKEBATTLER_IDS
    if _POKEBATTLER_IDS is not None:
        return _POKEBATTLER_IDS
    paths = [
        os.path.join(os.path.dirname(__file__), "..", "files", "pokebattler_ids.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "files", "pokebattler_ids.json"),
        os.path.join("files", "pokebattler_ids.json")
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    _POKEBATTLER_IDS = set(json.load(f))
                    return _POKEBATTLER_IDS
            except Exception as e:
                print(f"  Warning loading pokebattler_ids: {e}")
    _POKEBATTLER_IDS = set()
    return _POKEBATTLER_IDS

def compute_trainer_boxes(estimator):
    if estimator is None or estimator <= 0:
        return None
    E = float(estimator)
    # First number of trainers where status is EASY (ratio <= 2/3, i.e. N >= 1.5 * E)
    trainers_needed = max(1, int(-(- (E * 1.5) // 1)))
    
    if E <= 1.0:
        verdict = "SOLOABLE"
    elif E <= 1.5:
        verdict = "EASY DUO"
    elif E <= 2.0:
        verdict = "EASY TRIO"
    elif E <= 3.0:
        verdict = "MODERATE"
    elif E <= 5.0:
        verdict = "HARD"
    else:
        verdict = "EXTREME"
        
    boxes = []
    for N in [1, 2, 3, 4, 5, 6]:
        ratio = E / float(N)
        label_n = f"{N}+" if N == 6 else str(N)
        if ratio <= (2.0 / 3.0):
            status = "EASY"
        elif ratio <= 1.0:
            status = "TIGHT"
        elif ratio <= 1.5:
            status = "HARD"
        else:
            status = "EXTREME"
        boxes.append({
            "trainers": label_n,
            "status": status,
            "ratio": round(ratio, 2)
        })
        
    return {
        "verdict": verdict,
        "trainersNeeded": trainers_needed,
        "boxes": boxes
    }

def build_pokebattler_slug(boss_name, tier=None):
    if not boss_name:
        return ""
    n = boss_name.strip()
    nl = n.lower()
    is_shadow = "shadow" in nl or (tier and "shadow" in str(tier).lower())
    
    suffix = None
    m_suf = re.search(r'\bmega\s+([xy])\s+(.*)', nl)
    if m_suf:
        suffix = m_suf.group(1).upper()
        nl = f"mega {m_suf.group(2)} {suffix}"
    else:
        m_suf2 = re.search(r'\b(?:mega\s+)?(.*?)(?:_|\s+)mega(?:_|\s+)?([xy])\b', nl)
        if m_suf2:
            suffix = m_suf2.group(2).upper()
            nl = f"mega {m_suf2.group(1)} {suffix}"
        else:
            m_suf3 = re.search(r'\bmega\s+(.*?)\s+([xy])\b', nl)
            if m_suf3:
                suffix = m_suf3.group(2).upper()
                nl = f"mega {m_suf3.group(1)} {suffix}"

    is_mega = "mega" in nl or (tier and "mega" in str(tier).lower())

    region = None
    if "alola" in nl or "alolan" in nl: region = "ALOLA"
    elif "galar" in nl or "galarian" in nl: region = "GALAR"
    elif "hisui" in nl or "hisuian" in nl: region = "HISUI"
    elif "paldea" in nl or "paldean" in nl: region = "PALDEA"

    form = None
    if "hero" in nl: form = "HERO"
    elif "incarnate" in nl: form = "INCARNATE"
    elif "therian" in nl: form = "THERIAN"
    elif "origin" in nl: form = "ORIGIN"
    elif "altered" in nl: form = "ALTERED"

    base = re.sub(r'\b(shadow|mega|[xy]|alola|alolan|galar|galarian|hisui|hisuian|paldea|paldean|hero|incarnate|therian|origin|altered|forme|form)\b', '', nl, flags=re.IGNORECASE).strip().upper()
    base = re.sub(r'[^A-Z0-9]+', '_', base).strip('_')

    candidates = []
    if is_mega and suffix:
        candidates.append(f"{base}_MEGA_{suffix}")
    elif is_mega:
        candidates.append(f"{base}_MEGA")
    if region and is_shadow:
        candidates.append(f"{base}_{region}_SHADOW_FORM")
        candidates.append(f"SHADOW_{base}_{region}_FORM")
    elif region:
        candidates.append(f"{base}_{region}_FORM")
    elif form and is_shadow:
        candidates.append(f"{base}_{form}_SHADOW_FORM")
        candidates.append(f"{base}_SHADOW_FORM")
        candidates.append(f"SHADOW_{base}_{form}_FORM")
    elif form:
        candidates.append(f"{base}_{form}_FORM")
    elif is_shadow:
        candidates.append(f"{base}_SHADOW_FORM")
        candidates.append(f"SHADOW_{base}")
    
    candidates.append(base)

    pids = load_pokebattler_ids()
    if pids:
        for c in candidates:
            if c in pids:
                return c

    return candidates[0]

def build_pokebattler_raid_url(boss_name, tier=None):
    slug = build_pokebattler_slug(boss_name, tier)
    return f"https://www.pokebattler.com/raids/{slug}" if slug else "https://www.pokebattler.com/raids"

def scrape_pokebattler_estimator(slug, tier=None):
    if not slug:
        return None
    url = f"https://www.pokebattler.com/raids/{slug}"
    try:
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code == 200:
            soup = bs4.BeautifulSoup(res.text, "html.parser")
            table = soup.find("table")
            if table:
                rows = table.find_all("tr")[1:]
                for r in rows:
                    tds = [td.get_text(strip=True) for td in r.find_all(["th", "td"])]
                    if len(tds) >= 5:
                        try:
                            return float(tds[4])
                        except Exception:
                            pass
    except Exception as e:
        print(f"  Warning scraping HTML estimator for {slug}: {e}")

    # Fallback to PokeBattler Fight API if HTML has no table (e.g. single-page app render)
    tier_map = {
        "1-Star Raids": "RAID_LEVEL_1",
        "3-Star Raids": "RAID_LEVEL_3",
        "5-Star Raids": "RAID_LEVEL_5",
        "Mega Raids": "RAID_LEVEL_MEGA",
        "Shadow 1-Star Raids": "RAID_LEVEL_1_SHADOW",
        "Shadow 3-Star Raids": "RAID_LEVEL_3_SHADOW",
        "Shadow 5-Star Raids": "RAID_LEVEL_5_SHADOW",
    }
    tier_code = tier_map.get(tier)
    if not tier_code:
        if "MEGA" in slug:
            tier_code = "RAID_LEVEL_MEGA"
        else:
            tier_code = "RAID_LEVEL_5"

    try:
        api_url = f"https://fight.pokebattler.com/raids/defenders/{slug}/levels/{tier_code}/attackers/levels/40/strategies/CINEMATIC_ATTACK_WHEN_POSSIBLE/DEFENSE_RANDOM"
        api_res = requests.get(api_url, headers=HEADERS, timeout=8)
        if api_res.status_code == 200:
            api_data = api_res.json()
            attackers = api_data.get("attackers", [])
            if attackers:
                first = attackers[0]
                by_move = first.get("byMove", [])
                from collections import defaultdict
                poke_ests = defaultdict(list)
                for m in by_move:
                    for d_entry in m.get("defenders", []):
                        pid = d_entry.get("pokemonId")
                        est = d_entry.get("total", {}).get("estimator")
                        if est:
                            poke_ests[pid].append(est)
                if poke_ests:
                    avg_ests = {pid: sum(ests) / len(ests) for pid, ests in poke_ests.items()}
                    best_poke, best_val = min(avg_ests.items(), key=lambda x: x[1])
                    return round(float(best_val), 2)
    except Exception as e:
        print(f"  Warning fetching API estimator for {slug} ({tier_code}): {e}")

    return None

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
        "decidueye-hisui": 10244, "tauros-paldea": 10250, "tauros-paldea-combat-breed": 10250,
        "tauros-paldea-blaze-breed": 10251, "tauros-paldea-aqua-breed": 10252,
        "wooper-paldea": 10253, "basculin-white-striped": 10247, "farfetch-d-galar": 10166
    }
    # Direct checks for Tauros breeds and Basculin
    if "combat breed" in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10250.png"
    if "blaze breed" in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10251.png"
    if "aqua breed" in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10252.png"
    if "white-striped" in clean_lower or "white striped" in clean_lower:
        return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10247.png"

    for prefix, region in [('alolan ', 'alola'), ('alola ', 'alola'), ('galarian ', 'galar'), ('galar ', 'galar'), ('hisuian ', 'hisui'), ('hisui ', 'hisui'), ('paldean ', 'paldea'), ('paldea ', 'paldea')]:
        if prefix in clean_lower:
            base = clean_lower.replace(prefix, '').strip()
            base = re.sub(r'\s*\([^)]*\)', '', base).strip()
            base = base.replace("'", "").replace("’", "")
            key = f"{base}-{region}".replace(' ', '-')
            if key in regional_ids:
                return f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{regional_ids[key]}.png"

    return f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{dex_nr}.png" if dex_nr else ""

def scrape_raids():
    print("Scraping Raids directly from PokéBattler API...")
    bosses = []
    schedule_entries = []
    max_battles = []
    poke_map = load_pokedex_map()
    shiny_dexes, shiny_names = load_shiny_set()

    id_name_map = {
        'ZACIAN_CROWNED_SWORD_FORM': 'Crowned Sword Zacian',
        'ZAMAZENTA_CROWNED_SHIELD_FORM': 'Crowned Shield Zamazenta',
        'KYUREM_BLACK_FORM': 'Black Kyurem',
        'KYUREM_WHITE_FORM': 'White Kyurem',
        'BANETTE_MEGA': 'Mega Banette',
        'TORNADUS_SHADOW_FORM': 'Shadow Incarnate Tornadus',
        'PILOSWINE_SHADOW_FORM': 'Shadow Piloswine',
        'POLIWHIRL_SHADOW_FORM': 'Shadow Poliwhirl',
        'PRINPLUP_SHADOW_FORM': 'Shadow Prinplup',
        'CRANIDOS_SHADOW_FORM': 'Shadow Cranidos',
        'LARVITAR_SHADOW_FORM': 'Shadow Larvitar',
        'MAKUHITA_SHADOW_FORM': 'Shadow Makuhita',
        'MUDKIP_SHADOW_FORM': 'Shadow Mudkip'
    }

    def format_boss_name(pid, p_name):
        if pid in id_name_map: return id_name_map[pid]
        clean = (p_name or pid).replace('_FORM', '').replace('_', ' ').title()
        if 'Mega' in clean and not clean.startswith('Mega '): clean = 'Mega ' + clean.replace(' Mega', '')
        if 'Shadow' in clean and not clean.startswith('Shadow '): clean = 'Shadow ' + clean.replace(' Shadow', '')
        return clean

    # 1. Fetch live Raids and Upcoming Schedule directly from PokéBattler API
    try:
        pb_url = "https://fight.pokebattler.com/raids"
        res = requests.get(pb_url, headers=HEADERS, timeout=15)
        if res.status_code == 200:
            pb_data = res.json()
            target_tiers = {
                'RAID_LEVEL_1': '1-Star Raids',
                'RAID_LEVEL_3': '3-Star Raids',
                'RAID_LEVEL_5': '5-Star Raids',
                'RAID_LEVEL_MEGA': 'Mega Raids',
                'RAID_LEVEL_1_SHADOW': 'Shadow 1-Star Raids',
                'RAID_LEVEL_3_SHADOW': 'Shadow 3-Star Raids',
                'RAID_LEVEL_5_SHADOW': 'Shadow 5-Star Raids'
            }

            for t in pb_data.get('tiers', []):
                t_key = t.get('tier', '')
                if t_key in target_tiers:
                    tier_label = target_tiers[t_key]
                    for r in t.get('raids', []):
                        pid = r.get('pokemonId') or r.get('pokemon', '')
                        clean_name = format_boss_name(pid, r.get('pokemon', ''))

                        # Dex lookup & CP calculation (with robust base species fallback)
                        dex_nr = None
                        stats = get_pokedex_stats(poke_map, clean_name)
                        if stats and stats.get('dexNr'):
                            dex_nr = stats.get('dexNr')
                        else:
                            import re
                            cleaned_candidate = clean_name
                            for p in ['Shadow ', 'Mega ', 'Primal ', 'Crowned Sword ', 'Crowned Shield ', 'White ', 'Black ', 'Dawn Wings ', 'Dusk Mane ', 'Origin ', 'Altered ', 'Therian ', 'Incarnate ']:
                                cleaned_candidate = re.sub(re.escape(p), '', cleaned_candidate, flags=re.IGNORECASE)
                            cleaned_candidate = cleaned_candidate.strip()
                            stats_base = get_pokedex_stats(poke_map, cleaned_candidate)
                            if stats_base:
                                stats = stats_base
                                dex_nr = stats_base.get('dexNr')
                            else:
                                for word in clean_name.split():
                                    if len(word) > 3 and word.lower() not in ['mega', 'shadow', 'crowned', 'sword', 'shield', 'form', 'forme', 'white', 'black', 'incarnate', 'therian']:
                                        stats_word = get_pokedex_stats(poke_map, word)
                                        if stats_word:
                                            stats = stats_word
                                            dex_nr = stats_word.get('dexNr')
                                            break

                        # CP calculation
                        cp_dict = None
                        if stats:
                            cp_norm = get_cp_for_level(stats['atk'], stats['def'], stats['sta'], level=20, min_iv=10)
                            cp_boost = get_cp_for_level(stats['atk'], stats['def'], stats['sta'], level=25, min_iv=10)
                            cp_dict = {'normal': cp_norm, 'boosted': cp_boost}

                        # Types and weather
                        type_names = []
                        p_val = None
                        for v in poke_map.values():
                            if isinstance(v, dict) and (v.get('dexNr') == dex_nr or v.get('names', {}).get('English', '').lower() == clean_name.lower()):
                                p_val = v
                                break
                        if p_val:
                            t1 = (p_val.get('primaryType') or {}).get('names', {}).get('English', '').lower()
                            t2 = (p_val.get('secondaryType') or {}).get('names', {}).get('English', '').lower()
                            if t1: type_names.append(t1)
                            if t2: type_names.append(t2)

                        types = [{'name': type_n, 'image': f'https://leekduck.com/assets/img/types/{type_n}.png'} for type_n in type_names]
                        weather_boosts = []
                        seen_weathers = set()
                        for type_n in type_names:
                            w_name = TYPE_WEATHER_MAP.get(type_n)
                            if w_name and w_name not in seen_weathers:
                                seen_weathers.add(w_name)
                                w_img = w_name.replace(' ', '_')
                                weather_boosts.append({'name': w_name, 'image': f'https://leekduck.com/assets/img/weather/{w_img}.png'})

                        img_url = get_boss_image_url(clean_name, dex_nr)
                        can_be_shiny = bool(r.get('shiny', False) or (dex_nr and dex_nr in shiny_dexes) or (clean_name.upper() in shiny_names))
                        pb_slug = pid
                        pb_url_item = f'https://www.pokebattler.com/raids/{pb_slug}'

                        start_ms = r.get('startDate')
                        start_iso = datetime.datetime.fromtimestamp(start_ms/1000.0, datetime.timezone.utc).isoformat() if start_ms else None
                        article_url = r.get('article', {}).get('articleURL') if r.get('article') else None

                        boss_item = {
                            'name': clean_name,
                            'tier': tier_label,
                            'canBeShiny': can_be_shiny,
                            'types': types,
                            'combatPower': cp_dict,
                            'boostedWeather': weather_boosts,
                            'image': img_url,
                            'pokebattlerUrl': pb_url_item,
                            'pokebattlerSlug': pb_slug,
                            'startDate': start_iso,
                            'guideUrl': article_url,
                            'estimator': None
                        }

                        if r.get('upcoming'):
                            schedule_entries.append(boss_item)
                        else:
                            bosses.append(boss_item)
                
                # Max Battles extraction
                elif "MAX" in t_key and not ("FUTURE" in t_key or "LEGACY" in t_key):
                    tier_clean = t_key.replace("RAID_LEVEL_", "").replace("_MAX", "").replace("_", " ").title()
                    tier_label = f"Max Battles ({tier_clean} Max)" if tier_clean else "Max Battles"
                    for r in t.get("raids", []):
                        pid = r.get("pokemonId") or r.get("pokemon", "")
                        clean_id = pid.replace("_MAX", "").replace("_FORM", "").replace("_GIGANTAMAX", "")
                        is_gigantamax = "_GIGANTAMAX" in pid or (r.get("pokemon") and "_GIGANTAMAX" in r.get("pokemon"))

                        p_info = poke_map.get(clean_id) or {}
                        dex_nr = p_info.get("dexNr") if p_info else None
                        name_eng = p_info.get("names", {}).get("English", clean_id.title()) if p_info else clean_id.title()

                        type_names = []
                        if p_info.get("primaryType"):
                            t1 = p_info["primaryType"].get("names", {}).get("English", "").lower()
                            if t1: type_names.append(t1)
                        if p_info.get("secondaryType"):
                            t2 = p_info["secondaryType"].get("names", {}).get("English", "").lower()
                            if t2: type_names.append(t2)

                        types = [{"name": type_n, "image": f"https://leekduck.com/assets/img/types/{type_n}.png"} for type_n in type_names]

                        weather_boosts = []
                        seen_w = set()
                        for type_n in type_names:
                            w = TYPE_WEATHER_MAP.get(type_n)
                            if w and w not in seen_w:
                                seen_w.add(w)
                                w_img = w.replace(" ", "_")
                                weather_boosts.append({"name": w, "image": f"https://leekduck.com/assets/img/weather/{w_img}.png"})

                        img_url = get_boss_image_url(f"Gigantamax {name_eng}" if is_gigantamax else f"Dynamax {name_eng}", dex_nr)
                        
                        cp_dict = None
                        if p_info.get("stats"):
                            stats = p_info["stats"]
                            b_atk = stats.get("attack") or stats.get("baseAttack") or stats.get("atk", 0)
                            b_def = stats.get("defense") or stats.get("baseDefense") or stats.get("def", 0)
                            b_sta = stats.get("stamina") or stats.get("baseStamina") or stats.get("sta", 0)
                            if b_atk and b_def and b_sta:
                                cp_dict = get_cp_from_stats(b_atk, b_def, b_sta)

                        slug = r.get("pokemonId") or r.get("pokemon", "")
                        if is_gigantamax:
                            boss_display_name = f"Gigantamax {name_eng}"
                            pb_slug = slug if slug else f"{clean_id.upper()}_GIGANTAMAX"
                        else:
                            boss_display_name = f"Dynamax {name_eng}"
                            pb_slug = slug if slug.startswith("DYNAMAX_") else f"DYNAMAX_{clean_id.upper()}"
                        
                        pb_url_item = f"https://www.pokebattler.com/max/{pb_slug}"

                        max_battles.append({
                            "name": boss_display_name,
                            "tier": tier_label,
                            "canBeShiny": r.get("shiny", False),
                            "pokebattlerUrl": pb_url_item,
                            "types": types,
                            "combatPower": cp_dict,
                            "boostedWeather": weather_boosts,
                            "image": img_url
                        })
    except Exception as e:
        print(f"Error fetching from PokéBattler API: {e}")

    # Fetch Pokebattler estimators in parallel for standard raid bosses and schedule entries
    all_targets_for_estimator = bosses + schedule_entries
    print(f"  -> Fetching Pokebattler estimators for {len(all_targets_for_estimator)} raid targets...")
    # Map (slug, tier) pairs so the API fallback has the exact tier
    unique_boss_keys = list({(b.get("pokebattlerSlug"), b.get("tier")) for b in all_targets_for_estimator if b.get("pokebattlerSlug")})
    slug_tier_to_estimator = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        future_to_key = {executor.submit(scrape_pokebattler_estimator, s, t): (s, t) for s, t in unique_boss_keys}
        for future in concurrent.futures.as_completed(future_to_key):
            s, t = future_to_key[future]
            try:
                est = future.result()
                if est is not None:
                    slug_tier_to_estimator[(s, t)] = est
            except Exception as e:
                print(f"  Error fetching estimator for {s}: {e}")

    for b in all_targets_for_estimator:
        s = b.get("pokebattlerSlug")
        t = b.get("tier")
        if s and (s, t) in slug_tier_to_estimator:
            est_val = slug_tier_to_estimator[(s, t)]
            b["estimator"] = est_val
            b["estimatedPlayers"] = est_val
            diff_info = compute_trainer_boxes(est_val)
            if diff_info:
                b["verdict"] = diff_info["verdict"]
                b["trainersNeeded"] = diff_info["trainersNeeded"]
                b["trainerBoxes"] = diff_info["boxes"]

    # Wrap result into rich payload containing current bosses and schedule calendar
    raid_payload = {
        "current": bosses,
        "schedule": schedule_entries
    }

    print(f"  -> Saved {len(bosses)} active raid bosses and {len(schedule_entries)} scheduled rotations from Pokémon GO Hub, plus {len(max_battles)} max battle bosses.")
    return raid_payload, max_battles

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    scrape_raids()

