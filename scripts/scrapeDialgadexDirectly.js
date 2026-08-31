const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function scrapeDialgadexDirectly() {
  console.log("=== SCRAPING LIVE DIALGADEX TABLES DIRECTLY VIA PLAYWRIGHT ===");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const types = ["Overall", "Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Normal", "Poison", "Psychic", "Rock", "Steel", "Water"];
  const resultData = { updatedAt: new Date().toISOString(), overall: [], byType: {} };

  for (const t of types) {
    const url = (t === "Overall")
      ? "https://www.dialgadex.com/"
      : `https://www.dialgadex.com/?strongest=&t=${t}`;

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    const rows = await page.evaluate(() => {
      const tableRows = Array.from(document.querySelectorAll('table tbody tr, table tr'));
      const parsed = [];

      tableRows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        if (cells.length >= 4) {
          const rankText = cells[0] || '';
          const nameText = cells[1] || '';
          const fastMoveText = cells[2] || '';
          const chargedMoveText = cells[3] || '';
          const dpsText = cells[4] || '';
          const pctText = cells[5] || '';

          parsed.push({
            cells,
            rankText,
            nameText,
            fastMoveText,
            chargedMoveText,
            dpsText,
            pctText
          });
        }
      });

      return parsed;
    });

    console.log(`  -> Extracted ${rows.length} rows for ${t}`);

    const structuredRows = rows.map((r, idx) => {
      const fullLine = r.cells.join(" | ");
      const rankNum = parseInt(r.rankText) || (idx + 1);

      const rawName = r.nameText.split('\n')[0] || r.nameText;
      let name = rawName;
      let form = '';
      let isMega = false;
      let isShadow = false;

      if (rawName.includes("Mega ")) {
        isMega = true;
        name = rawName.replace("Mega ", "").trim();
        form = "Mega";
      } else if (rawName.includes("Primal ")) {
        isMega = true;
        name = rawName.replace("Primal ", "").trim();
        form = "Primal";
      } else if (rawName.includes("Shadow ")) {
        isShadow = true;
        name = rawName.replace("Shadow ", "").trim();
      }

      const parenMatch = rawName.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        form = parenMatch[2].trim();
        if (name.startsWith("Mega ")) {
          isMega = true;
          name = name.replace("Mega ", "").trim();
        }
      }

      const dpsMatch = (r.dpsText || fullLine).match(/eDPS\s*([\d.]+)/i);
      const dpsVal = dpsMatch ? parseFloat(dpsMatch[1]) : 0;

      const pctMatch = (r.pctText || fullLine).match(/([\d.]+)%/);
      const pctVal = pctMatch ? `${pctMatch[1]}%` : "100.0%";

      return {
        rank: rankNum,
        name: name || rawName,
        form,
        isMega,
        isShadow,
        fastMove: r.fastMoveText || '',
        chargedMove: r.chargedMoveText || '',
        dps: dpsVal,
        pct: pctVal,
        fullLine
      };
    });

    if (t === "Overall") {
      resultData.overall = structuredRows;
    } else {
      resultData.byType[t] = structuredRows;
    }
  }

  await browser.close();

  const filesDir = path.join(__dirname, '..', 'files');
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

  const scrapedDuckFilesDir = path.join(__dirname, '..', 'ScrapedDuck-master', 'files');
  if (!fs.existsSync(scrapedDuckFilesDir)) fs.mkdirSync(scrapedDuckFilesDir, { recursive: true });

  const jsonStr = JSON.stringify(resultData, null, 4);
  const minJsonStr = JSON.stringify(resultData);

  fs.writeFileSync(path.join(filesDir, 'topAttackers.json'), jsonStr, 'utf-8');
  fs.writeFileSync(path.join(filesDir, 'topAttackers.min.json'), minJsonStr, 'utf-8');

  fs.writeFileSync(path.join(scrapedDuckFilesDir, 'topAttackers.json'), jsonStr, 'utf-8');
  fs.writeFileSync(path.join(scrapedDuckFilesDir, 'topAttackers.min.json'), minJsonStr, 'utf-8');

  console.log("=== SUCCESSFULLY SCRAPED AND SAVED ALL DIALGADEX TABLES DIRECTLY ===");
}

scrapeDialgadexDirectly();
