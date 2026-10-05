import requests
from bs4 import BeautifulSoup
import re
from scrapers.cp_utils import load_pokedex_map, get_pokedex_stats, get_cp_for_level

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_party():
    print("Scraping Party Play Challenges directly from LeekDuck HTML...")
    poke_map = load_pokedex_map()
    tasks = []

    try:
        url = "https://leekduck.com/posts/party-play-challenges/"
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch Party Play page: HTTP {res.status_code}")
            return []

        soup = BeautifulSoup(res.text, "html.parser")
        task_items = soup.select(".field-research-wrapper .task-item")

        for item in task_items:
            task_text_el = item.select_one(".task-text")
            if not task_text_el:
                continue
            task_name = task_text_el.text.strip()

            rewards = []
            reward_elements = item.select("li.reward")

            for r in reward_elements:
                reward_type = r.get("data-reward-type", "")
                label_el = r.select_one(".reward-label")
                reward_label = label_el.text.strip() if label_el else ""

                img_el = r.select_one("img.reward-image")
                img_url = img_el.get("src", "") if img_el else ""

                shiny = bool(r.select_one(".shiny-icon, .shiny-badge"))

                min_cp_el = r.select_one(".min-cp")
                max_cp_el = r.select_one(".max-cp")
                min_cp = min_cp_el.text.replace("Min CP", "").strip() if min_cp_el else None
                max_cp = max_cp_el.text.replace("Max CP", "").strip() if max_cp_el else None

                stats = get_pokedex_stats(poke_map, reward_label)
                cp_dict = None
                if stats:
                    cp_data = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=15, min_iv=10)
                    cp_dict = {"normal": cp_data}
                    min_cp = min_cp or cp_data["min"]
                    max_cp = max_cp or cp_data["max"]

                rewards.append({
                    "type": reward_type,
                    "label": reward_label,
                    "image": img_url,
                    "shiny": shiny,
                    "min_cp": min_cp,
                    "max_cp": max_cp,
                    "combatPower": cp_dict
                })

            if rewards:
                tasks.append({
                    "task": task_name,
                    "rewards": rewards
                })

        print(f"  -> Successfully scraped {len(tasks)} Party Play tasks directly from LeekDuck!")
        return tasks

    except Exception as e:
        print(f"Error scraping Party Play challenges: {e}")
        return []

if __name__ == "__main__":
    scrape_party()
