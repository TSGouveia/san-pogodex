import os
import json
import math

# CPM Values for Pokemon GO levels
CPM_MAP = {
    8: 0.37570300,   # GO Rocket Shadow (Normal)
    13: 0.48168495,  # GO Rocket Shadow (Purified/Boosted)
    15: 0.51739399,  # Field Research / Party Play / Special Research
    20: 0.59740001,  # Raids / Max Battles / Eggs / PvP Rewards (Normal)
    25: 0.66793400,  # Raids / Max Battles (Weather Boosted)
}

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
                print(f"  Warning loading pokedex for cp utils: {e}")
    return poke_map

def calculate_cp(base_atk, base_def, base_sta, iv_atk=15, iv_def=15, iv_sta=15, cpm=0.59740001):
    atk = base_atk + iv_atk
    deff = base_def + iv_def
    sta = base_sta + iv_sta
    cp = math.floor((atk * math.sqrt(deff) * math.sqrt(sta) * (cpm ** 2)) / 10.0)
    return max(10, cp)

def get_cp_for_level(base_atk, base_def, base_sta, level=20, min_iv=10):
    cpm = CPM_MAP.get(level, 0.59740001)
    return {
        "min": calculate_cp(base_atk, base_def, base_sta, min_iv, min_iv, min_iv, cpm),
        "max": calculate_cp(base_atk, base_def, base_sta, 15, 15, 15, cpm)
    }

def get_pokedex_stats(poke_map, identifier):
    if not identifier:
        return None
    key = str(identifier).upper().strip()
    p_info = poke_map.get(key)
    if not p_info:
        import re
        clean_key = re.sub(r'^(SHADOW|ALOLAN|HISUIAN|GALARIAN|PALDEAN|MEGA)\s+', '', key, flags=re.IGNORECASE).strip()
        p_info = poke_map.get(clean_key)
    
    if p_info and p_info.get("stats"):
        stats = p_info["stats"]
        b_atk = stats.get("attack") or stats.get("baseAttack") or stats.get("atk", 0)
        b_def = stats.get("defense") or stats.get("baseDefense") or stats.get("def", 0)
        b_sta = stats.get("stamina") or stats.get("baseStamina") or stats.get("sta", 0)
        if b_atk and b_def and b_sta:
            return {"atk": b_atk, "def": b_def, "sta": b_sta, "dexNr": p_info.get("dexNr")}
    return None
