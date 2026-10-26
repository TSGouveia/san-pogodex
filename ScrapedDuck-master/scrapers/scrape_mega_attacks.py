import os
import re
import json
import requests

HEADERS = {
    "User-Agent": "SanPogodexBot/1.0 (contact@sanpogodex.com)"
}

def scrape_mega_attacks():
    print("Scraping Mega Evolution Attacks from Bulbapedia MediaWiki API...")
    url = "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=Mega_Evolution_(GO)&prop=wikitext&format=json"
    try:
        res = requests.get(url, headers=HEADERS, timeout=20)
        if res.status_code != 200:
            print(f"  Warning: Bulbapedia API returned status {res.status_code}")
            return {}
        
        data = res.json()
        text = data.get("parse", {}).get("wikitext", {}).get("*", "")
        if not text:
            print("  Warning: Empty wikitext returned from Bulbapedia API.")
            return {}
        
        idx_start = text.find("==List of Mega Evolutions==")
        if idx_start == -1:
            idx_start = text.find("List of Mega Evolutions")
        idx_end = text.find("\n==", idx_start + 10)
        section = text[idx_start:idx_end] if idx_end != -1 else text[idx_start:]

        # Remove HTML comments FIRST so commented-out/unreleased megas are excluded
        section_clean = re.sub(r'<!--.*?-->', '', section, flags=re.DOTALL)

        rows = re.split(r'\|\-(?:[^\n]*)?\n', section_clean)
        curr_dex = None
        results = {}

        for r in rows:
            m_dex = re.search(r'#(\d{3,4})', r)
            if m_dex:
                curr_dex = int(m_dex.group(1))

            m_name = re.search(r'Mega\s+\{\{GO\|([^\|\}]+)(?:\|([^\|\}]+))?\}\}', r)
            prefix = "Mega"
            if not m_name:
                m_name = re.search(r'Primal\s+\{\{GO\|([^\|\}]+)(?:\|([^\|\}]+))?\}\}', r)
                prefix = "Primal"

            if m_name:
                base_name = m_name.group(1).strip()
                variant = m_name.group(2).strip() if m_name.group(2) else ""
                full_name = f"{prefix} {variant}" if variant else f"{prefix} {base_name}"

                has_attack = False
                attack_name = "N/A"

                m_move = re.search(r'\{\{m\|[^\|\}]+\|([^\|\}]+\+)\}\}', r)
                if m_move:
                    has_attack = True
                    attack_name = m_move.group(1).replace("*", "").strip()

                suffix = None
                m_suf = re.search(r'\b([XY])\b', full_name)
                if m_suf:
                    suffix = m_suf.group(1).upper()

                form_state_id = f"{curr_dex}_MEGA_{suffix}" if suffix else str(curr_dex)

                entry = {
                    "dex": curr_dex,
                    "name": full_name,
                    "suffix": suffix,
                    "formStateId": form_state_id,
                    "attack": attack_name,
                    "hasAttack": has_attack,
                    "isAttackNA": (attack_name == "N/A" or not has_attack)
                }

                results[form_state_id] = entry
                clean_key = re.sub(r'[^A-Z0-9]+', '_', full_name.upper()).strip('_')
                results[clean_key] = entry

        print(f"  -> Successfully scraped {len(results)} Mega Evolution Attack mappings from Bulbapedia.")
        return results
    except Exception as e:
        print(f"Error scraping Mega Evolution attacks: {e}")
        return {}

if __name__ == "__main__":
    res = scrape_mega_attacks()
    print("Found count:", len(res))
    sample_key = "6_MEGA_Y"
    print(sample_key, "->", res.get(sample_key))
