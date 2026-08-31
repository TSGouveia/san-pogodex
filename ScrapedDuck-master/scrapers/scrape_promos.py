import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_promo_codes():
    print("Scraping Promo Codes dynamically from LeekDuck...")
    try:
        url = "https://leekduck.com/promo-codes/"
        res = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        promo_codes = []

        cards = soup.select(".promo-card")
        for card in cards:
            title_el = card.select_one(".title")
            code_el = card.select_one(".text")
            desc_el = card.select_one(".description")
            expiry_el = card.select_one(".expiry")

            title = title_el.text.strip() if title_el else ""
            code = code_el.text.strip() if code_el else ""
            desc = desc_el.text.strip() if desc_el else ""
            
            # Extract real status (Active vs Expired)
            card_classes = card.get("class", [])
            is_expired = "expired" in card_classes
            status = "Expired" if is_expired else "Active"

            # Extract real expiry date string
            expiry_text = expiry_el.text.strip() if expiry_el else ""
            if is_expired and expiry_text.startswith("Expires:"):
                expiry_text = expiry_text.replace("Expires:", "Expired:").strip()

            # Extract rewards
            rewards = [r.text.strip() for r in card.select(".reward-label")]

            if code:
                promo_codes.append({
                    "title": title,
                    "code": code,
                    "description": desc,
                    "status": status,
                    "expires": expiry_text,
                    "rewards": rewards
                })

        print(f"  -> Saved {len(promo_codes)} promo codes ({sum(1 for c in promo_codes if c['status'] == 'Active')} Active, {sum(1 for c in promo_codes if c['status'] == 'Expired')} Expired).")
        return promo_codes
    except Exception as e:
        print(f"Error scraping promo codes: {e}")
        return []

if __name__ == "__main__":
    scrape_promo_codes()

