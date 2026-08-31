import os
import json
import subprocess

def scrape_dialgadex():
    print("Scraping Official DialgaDex Top Attackers directly from DialgaDex DOM via Playwright...")
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        js_script = os.path.join(base_dir, "scripts", "scrapeDialgadexDirectly.js")

        if os.path.exists(js_script):
            print(f"  -> Running Playwright scraper: {js_script}...")
            subprocess.run(["node", js_script], check=True, cwd=base_dir)

        paths_to_check = [
            os.path.join(base_dir, "files", "topAttackers.json"),
            os.path.join(os.path.dirname(__file__), "..", "files", "topAttackers.json"),
            os.path.join("files", "topAttackers.json")
        ]

        for path in paths_to_check:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if data and (data.get('overall') or data.get('byType')):
                        print(f"  -> Successfully loaded live scraped DialgaDex dataset ({len(data.get('overall', []))} overall items).")
                        return data
    except Exception as e:
        print(f"Error executing DialgaDex scraper: {e}")

    return {"overall": [], "byType": {}}

if __name__ == "__main__":
    scrape_dialgadex()
