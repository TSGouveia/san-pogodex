import requests
from bs4 import BeautifulSoup
from scrapers.cp_utils import load_pokedex_map, get_pokedex_stats, get_cp_for_level

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_research():
    print("Scraping Field Research...")
    poke_map = load_pokedex_map()
    try:
        url = "https://leekduck.com/research/"
        res = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        tasks = []

        for item in soup.select("li.task-item, .research-task"):
            task_el = item.select_one(".task-text, .task-name")
            if not task_el:
                continue
            task_text = task_el.text.strip()

            encounter_rewards = []
            for r in item.select("li.reward"):
                if r.get("data-reward-type") != "encounter":
                    continue
                label_el = r.select_one(".reward-label")
                reward_name = label_el.text.strip() if label_el else ""
                img_el = r.select_one(".reward-image")
                img_url = img_el["src"] if img_el and img_el.has_attr("src") else ""
                shiny = bool(r.select_one(".shiny-icon, [alt*='shiny']"))
                
                min_cp_el = r.select_one(".min-cp")
                max_cp_el = r.select_one(".max-cp")
                min_cp = min_cp_el.text.replace("Min CP", "").strip() if min_cp_el else None
                max_cp = max_cp_el.text.replace("Max CP", "").strip() if max_cp_el else None

                stats = get_pokedex_stats(poke_map, reward_name)
                cp_dict = None
                if stats:
                    cp_data = get_cp_for_level(stats["atk"], stats["def"], stats["sta"], level=15, min_iv=10)
                    cp_dict = {"normal": cp_data}
                    min_cp = min_cp or cp_data["min"]
                    max_cp = max_cp or cp_data["max"]

                if reward_name:
                    encounter_rewards.append({
                        "name": reward_name,
                        "image": img_url,
                        "shiny": shiny,
                        "min_cp": min_cp,
                        "max_cp": max_cp,
                        "combatPower": cp_dict
                    })

            if encounter_rewards:
                tasks.append({
                    "task": task_text,
                    "rewards": encounter_rewards
                })

        print(f"  -> Saved {len(tasks)} Pokémon encounter research tasks with CP calculations.")
        return tasks
    except Exception as e:
        print(f"Error scraping research: {e}")
        return []

if __name__ == "__main__":
    scrape_research()


