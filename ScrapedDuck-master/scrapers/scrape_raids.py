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
    
    # 2. Fetch Pokebattler data for Estimators & Max Battles
    pb_map = {}
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

                        max_battles.append({
                            "name": f"Dynamax {name_eng}",
                            "tier": tier_label,
                            "canBeShiny": r.get("shiny", False),
                            "estimatedPlayers": est,
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
                        if poke_name:
                            pb_map[poke_name.upper()] = est
    except Exception as e:
        print(f"Error fetching Pokebattler estimator data: {e}")

    # 3. Enrich base raids with estimatedPlayers
    for r in bosses:
        clean_name = r["name"].replace("Mega ", "").replace("Shadow ", "").strip().upper()
        est = pb_map.get(clean_name) or pb_map.get(r["name"].upper())
        if est:
            r["estimatedPlayers"] = est

    print(f"  -> Saved {len(bosses)} standard raid bosses and {len(max_battles)} max battle bosses.")
    return bosses, max_battles

if __name__ == "__main__":
    scrape_raids()

