import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_promo_codes():
    print("Scraping Active Promo Codes dynamically from LeekDuck...")
    try:
        url = "https://leekduck.com/promo-codes/"
        res = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(res.text, "html.parser")
        promo_codes = []

        cards = soup.select(".promo-card")
        for card in cards:
            title_el = card.select_one(".title")
            code_el = card.select_one(".text")
            desc_el = card.select_one(".description")

            title = title_el.text.strip() if title_el else ""
            code = code_el.text.strip() if code_el else ""
            desc = desc_el.text.strip() if desc_el else ""

            if code:
                promo_codes.append({
                    "title": title,
                    "code": code,
                    "description": desc,
                    "status": "Active"
                })

        print(f"  -> Saved {len(promo_codes)} dynamic promo codes.")
        return promo_codes
    except Exception as e:
        print(f"Error scraping promo codes: {e}")
        return []

if __name__ == "__main__":
    scrape_promo_codes()
