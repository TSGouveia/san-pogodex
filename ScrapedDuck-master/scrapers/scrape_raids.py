import os
import json
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
                        pid = item.get("id", "").upper()
                        if pid and pid not in poke_map:
                            poke_map[pid] = item
                break
            except Exception as e:
                print(f"  Warning loading pokedex for raids: {e}")
    return poke_map

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

def fetch_exact_pokebattler_estimator(poke_id, tier_name="RAID_LEVEL_5"):
    """Fetch exact simulation estimator for a specific boss from Pokebattler API."""
    try:
        url = f"https://fight.pokebattler.com/raids/defenders/{poke_id}/levels/{tier_name}/attackers/levels/40/strategies/CINEMATIC_ATTACK_WHEN_POSSIBLE/DEFENSE_RANDOM_MC?sort=ESTIMATOR&numCounters=1"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code == 200:
            data = res.json()
            attackers = data.get("attackers", [])
            if attackers:
                total = attackers[0].get("total", {})
                est = total.get("estimator")
                if est and isinstance(est, (int, float)):
                    return round(float(est))
    except Exception as e:
        pass
    return None

def scrape_raids():
    print("Scraping Raids & Pokebattler Estimators...")
    bosses = []
    
    # 1. Fetch ScrapedDuck base raids
    try:
        url = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raids.json"
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code == 200:
            bosses = res.json()
    except Exception as e:
        print(f"Error scraping base raids: {e}")
    
    # 2. Fetch Pokebattler data for Estimators & Max Battles & exact Slugs
    pb_map = {}
    pb_slug_map = {}
    pb_tier_map = {}
    max_battles = []
    poke_map = load_pokedex_map()

    try:
        pb_url = "https://fight.pokebattler.com/raids"
        res = requests.get(pb_url, headers=HEADERS, timeout=15)
        if res.status_code == 200:
            pb_data = res.json()
            for t in pb_data.get("tiers", []):
                tier_name = t.get("tier", "")
                if "FUTURE" in tier_name or "LEGACY" in tier_name:
                    continue
                est = t.get("info", {}).get("estimatedPlayers", 1)
                
                # If tier is a MAX tier, build Max Battle entries
                if "MAX" in tier_name:
                    tier_clean = tier_name.replace("RAID_LEVEL_", "").replace("_MAX", "").replace("_", " ").title()
                    tier_label = f"Max Battles ({tier_clean} Max)" if tier_clean else "Max Battles"
                    
                    for r in t.get("raids", []):
                        raw_id = r.get("pokemonId") or r.get("pokemon", "")
                        raw_id_upper = raw_id.upper()
                        p_info = poke_map.get(raw_id_upper, {})
                        dex_nr = p_info.get("dexNr")
                        name_eng = p_info.get("names", {}).get("English") or r.get("pokemon", "").capitalize()
                        
                        img_url = f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{dex_nr}.png" if dex_nr else f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png"
                        
                        types = []
                        if p_info.get("primaryType"):
                            t_name = p_info["primaryType"].get("names", {}).get("English", "").lower()
                            if t_name:
                                types.append({"name": t_name, "image": f"https://leekduck.com/assets/img/types/{t_name}.png"})
                        if p_info.get("secondaryType"):
                            t_name = p_info["secondaryType"].get("names", {}).get("English", "").lower()
                            if t_name:
                                types.append({"name": t_name, "image": f"https://leekduck.com/assets/img/types/{t_name}.png"})

                        slug = r.get("pokemonId") or r.get("pokemon", "")
                        pb_url_item = f"https://www.pokebattler.com/max/{slug}" if slug.startswith("DYNAMAX_") else build_pokebattler_max_url(name_eng)

                        # Try fetching exact simulation estimator for max battle boss
                        exact_est = fetch_exact_pokebattler_estimator(slug, tier_name) or est

                        max_battles.append({
                            "name": f"Dynamax {name_eng}",
                            "tier": tier_label,
                            "canBeShiny": r.get("shiny", False),
                            "estimatedPlayers": exact_est,
                            "pokebattlerUrl": pb_url_item,
                            "types": types,
                            "combatPower": {
                                "normal": {
                                    "min": r.get("minCp", r.get("cp", 0)),
                                    "max": r.get("cp", 0)
                                }
                            },
                            "image": img_url
                        })
                else:
                    for r in t.get("raids", []):
                        poke_name = r.get("pokemon", "")
                        poke_id = r.get("pokemonId") or poke_name
                        if poke_name:
                            pb_map[poke_name.upper()] = est
                            pb_slug_map[poke_name.upper()] = poke_id
                            pb_tier_map[poke_name.upper()] = tier_name
                        if poke_id:
                            pb_map[poke_id.upper()] = est
                            pb_slug_map[poke_id.upper()] = poke_id
                            pb_tier_map[poke_id.upper()] = tier_name
    except Exception as e:
        print(f"Error fetching Pokebattler estimator data: {e}")

    # Helper mapping for specific forms
    form_slug_map = {
        "ARMORED MEWTWO": ("MEWTWO_A_FORM", "RAID_LEVEL_5"),
        "MEWTWO (ARMORED)": ("MEWTWO_A_FORM", "RAID_LEVEL_5"),
        "MEGA MEWTWO Y": ("MEWTWO_MEGA_Y_FORM", "RAID_LEVEL_5_MEGA_ENHANCED"),
        "MEGA MEWTWO X": ("MEWTWO_MEGA_X_FORM", "RAID_LEVEL_5_MEGA_ENHANCED"),
        "MEGA AGGRON": ("AGGRON_MEGA", "RAID_LEVEL_MEGA"),
    }

    # 3. Enrich base raids with estimatedPlayers and pokebattlerUrl
    for r in bosses:
        boss_name_upper = r["name"].strip().upper()
        clean_name = boss_name_upper.replace("MEGA ", "").replace("SHADOW ", "").strip()
        
        form_info = form_slug_map.get(boss_name_upper)
        custom_slug = form_info[0] if form_info else None
        custom_tier = form_info[1] if form_info else None
        
        exact_slug = custom_slug or pb_slug_map.get(boss_name_upper) or pb_slug_map.get(clean_name)
        exact_tier = custom_tier or pb_tier_map.get(boss_name_upper) or pb_tier_map.get(clean_name) or "RAID_LEVEL_5"

        est = None
        if exact_slug:
            est = fetch_exact_pokebattler_estimator(exact_slug, exact_tier)
            
        if not est:
            est = pb_map.get(boss_name_upper) or pb_map.get(clean_name)
            if custom_slug and not est:
                est = pb_map.get(custom_slug)
            
        if est:
            r["estimatedPlayers"] = est
        
        if exact_slug:
            r["pokebattlerUrl"] = f"https://www.pokebattler.com/raids/{exact_slug}"
        else:
            r["pokebattlerUrl"] = build_pokebattler_raid_url(r["name"])

    print(f"  -> Saved {len(bosses)} standard raid bosses and {len(max_battles)} max battle bosses.")
    return bosses, max_battles

if __name__ == "__main__":
    scrape_raids()

