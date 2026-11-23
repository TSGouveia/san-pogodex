import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_event_raids(url):
    """Raid bosses listed on an event page (e.g. the Mega Raids of Twilight Wishes), grouped by tier heading."""
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, "html.parser")
        header = soup.select_one("h2.event-section-header.raids")
        if not header:
            return []
        tiers, tier = [], None
        for el in header.find_next_siblings():
            if el.name == "h2":
                break
            if el.name == "h3":
                tier = {"tier": el.get_text(" ", strip=True), "bosses": []}
                tiers.append(tier)
            elif tier is not None and el.name == "ul":
                for li in el.select("li.pkmn-list-item"):
                    name_el = li.select_one(".pkmn-name")
                    img_el = li.select_one(".pkmn-list-img img")
                    if name_el and name_el.get_text(strip=True):
                        tier["bosses"].append({
                            "name": name_el.get_text(" ", strip=True),
                            "image": img_el.get("src", "") if img_el else "",
                        })
        return [t for t in tiers if t["bosses"]]
    except Exception as e:
        print(f"  Error fetching event raids {url}: {e}")
        return []

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
                event_dates[event_id] = {"start": start, "end": end, "eventType": item.get("eventType") or ""}
    except Exception as e:
        print(f"Error fetching events feed: {e}")

    try:
        res = requests.get("https://leekduck.com/events/", headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        all_events = []
        seen_event_ids = set()
        categories = ["current", "upcoming"]

        for cat in categories:
            selector = f"div.events-list.{cat}-events a.event-item-link"
            events = soup.select(selector)

            for ev in events:
                href = ev.get("href", "")
                event_id = href.strip("/").split("/")[-1] if href else ""

                if not event_id or event_id in seen_event_ids:
                    continue
                seen_event_ids.add(event_id)

                title_el = ev.select_one("h2")
                title = title_el.text.strip() if title_el else ""

                type_el = ev.select_one(".event-type-tag")
                event_type = type_el.text.strip() if type_el else ""

                img_el = ev.select_one("img")
                raw_image = img_el.get("src", "") if img_el else ""
                # Strip Cloudflare 95px height downscaling to get original HD full-res banner
                image = raw_image.replace("/cdn-cgi/image/fit=scale-down,height=95,quality=100,format=webp/", "/")
                if "/cdn-cgi/image/" in image:
                    import re
                    image = re.sub(r'/cdn-cgi/image/[^/]+/', '/', image)

                dates = event_dates.get(event_id, {})
                start_date = dates.get("start", "")
                end_date = dates.get("end", "")

                # Fallback to HTML data attributes if dates are missing from feeds/events.json
                if not start_date:
                    reveal_el = ev.select_one("[data-reveal-countdown]")
                    if reveal_el and reveal_el.get("data-reveal-countdown"):
                        start_date = reveal_el.get("data-reveal-countdown")
                if not end_date:
                    countdown_el = ev.select_one("[data-countdown]")
                    if countdown_el and countdown_el.get("data-countdown"):
                        end_date = countdown_el.get("data-countdown")

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
                raids = scrape_event_raids(event_data["link"])
                if raids:
                    event_data["raids"] = raids
                all_events.append(event_data)

        # Spotlight Hour: the special bonus is only on the event page ("... and the special bonus is 2× Catch Candy.")
        import re
        for ev_data in all_events:
            etype = event_dates.get(ev_data["eventID"], {}).get("eventType", "")
            if etype != "pokemon-spotlight-hour" and "spotlight" not in ev_data["eventID"]:
                continue
            try:
                page = requests.get(ev_data["link"], headers=HEADERS, timeout=15)
                page.encoding = "utf-8"
                text = re.sub(r"\s+", " ", BeautifulSoup(page.text, "html.parser").get_text(" "))
                m = re.search(r"special bonus is\s+(.+?)\s*\.", text, re.I)
                if m:
                    ev_data["bonus"] = m.group(1).strip()
            except Exception as e:
                print(f"  Could not read bonus for {ev_data['eventID']}: {e}")

        print(f"  -> Saved {len(all_events)} unique events.")
        return all_events
    except Exception as e:
        print(f"Error scraping events: {e}")
        return []

if __name__ == "__main__":
    scrape_events()
