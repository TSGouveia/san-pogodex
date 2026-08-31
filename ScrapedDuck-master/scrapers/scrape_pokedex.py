import requests
import json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def format_pokemon(raw_p):
    dex_nr = raw_p.get("dexNr")
    dex_str = str(dex_nr)
    num_str = dex_str.zfill(3)
    
    primary_type = raw_p.get("primaryType", {}).get("names", {}).get("English", "normal").lower()
    sec_type_obj = raw_p.get("secondaryType")
    secondary_type = sec_type_obj.get("names", {}).get("English", "").lower() if sec_type_obj else None
    
    types = [primary_type]
    if secondary_type:
        types.append(secondary_type)

    gen = raw_p.get("generation", 1)
    if 899 <= dex_nr <= 905:
        gen = 8.5
    elif dex_nr in (808, 809):
        gen = 99

    stats_raw = raw_p.get("stats", {})
    stats = {
        "atk": stats_raw.get("attack", 100),
        "def": stats_raw.get("defense", 100),
        "sta": stats_raw.get("stamina", 100)
    }

    img = f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{dex_nr}.png"
    form_id = raw_p.get("formId") or dex_str
    
    return {
        "id": dex_str,
        "idName": form_id,
        "num": num_str,
        "name": raw_p.get("names", {}).get("English", f"Pokemon #{dex_nr}"),
        "gen": gen,
        "types": types,
        "img": img,
        "stats": stats,
        "rawEvolutions": raw_p.get("evolutions", [])
    }

def scrape_pokedex():
    print("Scraping Pokédex Data...")
    try:
        res = requests.get("https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json", headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print("Failed to fetch pokedex.json from primary API")
            return []
        
        raw_list = res.json()
        seen_dex = set()
        pokedex = []

        # 1. Base forms (id === formId)
        for p in raw_list:
            dex_nr = p.get("dexNr")
            form_id = p.get("formId")
            if str(dex_nr) == str(form_id) and dex_nr not in seen_dex:
                seen_dex.add(dex_nr)
                pokedex.append(format_pokemon(p))

        # 2. Normal or default forms
        for p in raw_list:
            dex_nr = p.get("dexNr")
            form_id = str(p.get("formId", ""))
            if dex_nr not in seen_dex and ("_" not in form_id or form_id.endswith("_NORMAL")):
                seen_dex.add(dex_nr)
                pokedex.append(format_pokemon(p))

        # 3. Fallback remaining
        for p in raw_list:
            dex_nr = p.get("dexNr")
            if dex_nr not in seen_dex:
                seen_dex.add(dex_nr)
                pokedex.append(format_pokemon(p))

        # 4. Special manual entries if missing (e.g. Basculegion #902)
        if 902 not in seen_dex:
            pokedex.append({
                "id": "902",
                "idName": "BASCULEGION",
                "num": "902",
                "name": "Basculegion",
                "gen": 8.5,
                "types": ["water", "ghost"],
                "img": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/902.png",
                "stats": {"atk": 247, "def": 146, "sta": 260},
                "rawEvolutions": []
            })

        pokedex.sort(key=lambda x: int(x["id"]))
        print(f"  -> Saved {len(pokedex)} Pokédex entries.")
        return pokedex
    except Exception as e:
        print(f"Error scraping Pokédex: {e}")
        return []

if __name__ == "__main__":
    scrape_pokedex()
