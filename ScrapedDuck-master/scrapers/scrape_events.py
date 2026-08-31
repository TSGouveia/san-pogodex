import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_events():
    print("Scraping Events...")
    event_dates = {}
    try:
        res = requests.get("https://leekduck.com/feeds/events.json", headers=HEADERS)
        if res.status_code == 200:
            feed_json = res.json()
            for item in feed_json:
                event_id = item.get("eventID")
                start = item.get("start")
                end = item.get("end")
                event_dates[event_id] = {"start": start, "end": end}
    except Exception as e:
        print(f"Error fetching events feed: {e}")

    try:
        res = requests.get("https://leekduck.com/events/", headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        all_events = []
        categories = ["current", "upcoming"]

        for cat in categories:
            selector = f"div.events-list.{cat}-events a.event-item-link"
            events = soup.select(selector)

            for ev in events:
                href = ev.get("href", "")
                event_id = href.strip("/").split("/")[-1] if href else ""

                title_el = ev.select_one("h2")
                title = title_el.text.strip() if title_el else ""

                type_el = ev.select_one(".event-type-tag")
                event_type = type_el.text.strip() if type_el else ""

                img_el = ev.select_one("img")
                image = img_el.get("src", "") if img_el else ""

                dates = event_dates.get(event_id, {})
                start_date = dates.get("start", "")
                end_date = dates.get("end", "")

                event_data = {
                    "eventID": event_id,
                    "title": title,
                    "type": event_type,
                    "category": cat,
                    "image": image,
                    "link": f"https://leekduck.com{href}",
                    "start": start_date,
                    "end": end_date
                }
                all_events.append(event_data)

        print(f"  -> Saved {len(all_events)} events.")
        return all_events
    except Exception as e:
        print(f"Error scraping events: {e}")
        return []

if __name__ == "__main__":
    scrape_events()
