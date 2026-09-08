# 🌐 San PoGodex — Website & Scrapers Engine

This repository contains the **Web Platform** and **Python Scrapers Engine** for **San PoGodex**, responsible for collecting real-time data on Pokémon GO rotations and updating the central database in Google Firebase Firestore.

---

## 🏗️ Web Project Structure

```
PoGo_Website/
├── index.html                  # Main user interface (Web Dashboard)
├── app.js                      # Interactive JS logic, renderers, and calculators
├── styles.css                  # Stylesheet and themes
├── firebase.js                 # Firebase Client configuration
├── vercel.json                 # Vercel hosting configuration
└── ScrapedDuck-master/          # Python Scrapers Engine
    ├── scrape.py               # Main script for scraping and Firestore uploading
    └── scrapers/               # Specific scraping modules
        ├── scrape_raids.py     # Raids and Shiny Check (PoGoAPI / Pokémon GO Hub)
        ├── scrape_events.py    # Active and upcoming events
        ├── scrape_research.py  # Field Research tasks
        ├── scrape_eggs.py      # Egg Pool
        ├── scrape_rocket.py    # Team GO Rocket lineups
        ├── scrape_promos.py    # Promo Codes
        ├── scrape_party.py     # Party Play challenges
        ├── scrape_pokedex.py   # Pokédex and Types
        └── scrape_buddy.py     # Buddy Distances
```

---

## ⚙️ How the Scrapers Engine Works

1. **Data Sources**:
   - **PoGoAPI / Pokémon GO Hub**: Shiny & Pokédex database (`pogoapi.net/api/v1/shiny_pokemon.json` & `db.pokemongohub.net`).
   - **Shungo API**: Active Wild Spawns data.
   - **LeekDuck / Feeds**: Events, Eggs, and Field Research.
2. **Firestore Upload**:
   - The `scrape.py` script executes all scrapers and authenticates with Firebase Firestore using the Identity Toolkit API.
   - Saves clean, minimized JSON payloads in the `scraped_data` collection with an `updatedAt` timestamp.
3. **Automation**:
   - The repository runs `scrape.py` automatically via **GitHub Actions** (cron/dispatch workflow) to keep the database up to date.

---

## 🚀 Running Locally

### Front-end Web:
Simply open `index.html` in a web browser or use a local server extension (e.g. VS Code Live Server).

### Python Scrapers:
1. Requires Python 3.10+
2. Install dependencies:
   ```bash
   pip install requests beautifulsoup4
   ```
3. Run scraping and upload:
   ```bash
   python ScrapedDuck-master/scrape.py
   ```

---

## ☁️ Hosting & Deployment
The project is configured for continuous hosting on **Vercel**. Any commit to the `main` branch triggers an automatic redeployment of the web interface.
