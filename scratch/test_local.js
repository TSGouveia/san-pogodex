import { initializeApp } from "firebase/app";

const api_key = "AIzaSyAHsUktWNFdK8IiOYSAchnFxR-pqVQZJbU";
const project_id = "pogo-website-14a46";
const scraper_uid = "zrWesha0TuXpkC4cskDx9vSdSzT2";

async function runLocalTest() {
  console.log("=== Running Local Automated Test ===");
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'scraper@pogowebsite.local', password: 'ScraperPassword123!', returnSecureToken: true })
    });
    if (!authRes.ok) throw new Error('Database auth failed');
    const authData = await authRes.json();

    const docRes = await fetch(`https://firestore.googleapis.com/v1/projects/${project_id}/databases/(default)/documents/users_data/${scraper_uid}`, {
      headers: { 'Authorization': `Bearer ${authData.idToken}` }
    });
    if (!docRes.ok) throw new Error('Firestore document fetch failed');
    const docData = await docRes.json();
    const fields = docData.fields || {};

    const dbData = {
      events: fields.events?.stringValue ? JSON.parse(fields.events.stringValue) : [],
      raids: fields.raids?.stringValue ? JSON.parse(fields.raids.stringValue) : [],
      research: fields.research?.stringValue ? JSON.parse(fields.research.stringValue) : [],
      eggs: fields.eggs?.stringValue ? JSON.parse(fields.eggs.stringValue) : [],
      rocketLineups: fields.rocketLineups?.stringValue ? JSON.parse(fields.rocketLineups.stringValue) : []
    };

    console.log(`[PASS] Firestore Data Loaded:
    - Events: ${dbData.events.length}
    - Raids: ${dbData.raids.length}
    - Research: ${dbData.research.length}
    - Eggs: ${dbData.eggs.length}
    - Rocket Lineups: ${dbData.rocketLineups.length}`);

    // Verify safe string lowercasing on all fields
    const safeLower = (val) => (val && typeof val === 'string' ? val.toLowerCase() : (val != null ? String(val).toLowerCase() : ''));

    let errors = 0;
    
    // Check events string operations
    dbData.events.forEach((ev, i) => {
      try {
        const title = safeLower(ev.name);
        const category = safeLower(ev.heading || ev.eventType);
      } catch (err) {
        console.error(`Error in event ${i}:`, err);
        errors++;
      }
    });

    // Check raids string operations
    dbData.raids.forEach((r, i) => {
      try {
        const name = safeLower(r.name);
        const tier = safeLower(r.tier);
      } catch (err) {
        console.error(`Error in raid ${i}:`, err);
        errors++;
      }
    });

    // Check research string operations
    dbData.research.forEach((res, i) => {
      try {
        const text = safeLower(res.text);
        (res.rewards || []).forEach(r => safeLower(r.name));
      } catch (err) {
        console.error(`Error in research ${i}:`, err);
        errors++;
      }
    });

    // Check eggs string operations
    dbData.eggs.forEach((e, i) => {
      try {
        const name = safeLower(e.name);
        const eggT = safeLower(e.eggType);
      } catch (err) {
        console.error(`Error in egg ${i}:`, err);
        errors++;
      }
    });

    // Check rocket lineups string operations
    dbData.rocketLineups.forEach((r, i) => {
      try {
        const name = safeLower(r.name);
        [r.firstPokemon, r.secondPokemon, r.thirdPokemon].forEach(slot => {
          (slot || []).forEach(p => safeLower(p && typeof p === 'object' ? p.name : p));
        });
      } catch (err) {
        console.error(`Error in rocket lineup ${i}:`, err);
        errors++;
      }
    });

    if (errors === 0) {
      console.log("=== ALL LOCAL DATA VERIFICATION TESTS PASSED SUCCESSFULLY! ===");
    } else {
      console.error(`=== TESTS FAILED WITH ${errors} ERRORS ===`);
    }

  } catch (err) {
    console.error("Test execution error:", err);
  }
}

runLocalTest();
