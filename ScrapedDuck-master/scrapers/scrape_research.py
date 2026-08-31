import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_research():
    print("Scraping Field Research...")
    try:
        url = "https://leekduck.com/research/"
        res = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        tasks = []

        items = soup.select(".task-item, .research-task")
        for item in items:
            task_name_el = item.select_one(".task-text, .task-name")
            task_name = task_name_el.text.strip() if task_name_el else ""

            reward_name_el = item.select_one(".reward-name, .reward")
            reward_name = reward_name_el.text.strip() if reward_name_el else ""

            img_el = item.select_one("img")
            img = img_el.get("src", "") if img_el else ""

            shiny = bool(item.select_one(".shiny-icon, [alt*='shiny']"))

            if task_name:
                tasks.append({
                    "task": task_name,
                    "reward": reward_name,
                    "img": img,
                    "shiny": shiny
                })

        print(f"  -> Saved {len(tasks)} research tasks.")
        return tasks
    except Exception as e:
        print(f"Error scraping research: {e}")
        return []

if __name__ == "__main__":
    scrape_research()
