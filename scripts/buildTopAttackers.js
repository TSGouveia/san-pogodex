const fs = require('fs');
const path = require('path');

async function generateTopAttackers() {
  console.log("Fetching DialgaDex dataset from GitHub (mgrann03/pokemon-resources)...");
  
  const pkmRes = await fetch('https://raw.githubusercontent.com/mgrann03/pokemon-resources/main/pogo_pkm.min.json');
  const fmRes = await fetch('https://raw.githubusercontent.com/mgrann03/pokemon-resources/main/pogo_fm.json');
  const cmRes = await fetch('https://raw.githubusercontent.com/mgrann03/pokemon-resources/main/pogo_cm.json');

  const pkmData = await pkmRes.json();
  const rawFmData = await fmRes.json();
  const rawCmData = await cmRes.json();

  const fmByName = {};
  Object.values(rawFmData).forEach(m => { if (m && m.name) fmByName[m.name.toLowerCase()] = m; });

  const cmByName = {};
  Object.values(rawCmData).forEach(m => { if (m && m.name) cmByName[m.name.toLowerCase()] = m; });

  const types = ["Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Normal", "Poison", "Psychic", "Rock", "Steel", "Water"];

  const calcMovePower = (m) => m.power || 0;
  const calcMoveDuration = (m) => (m.duration || 1000) / 1000;

  function calculateAttackerScore(pkm, fmName, cmName, targetType) {
    const fm = fmByName[fmName.toLowerCase()];
    const cm = cmByName[cmName.toLowerCase()];
    if (!fm || !cm) return null;

    const atk = pkm.stats.baseAttack;
    const def = pkm.stats.baseDefense;
    const hp = pkm.stats.baseStamina;

    const fmMatch = pkm.types.map(t => t.toLowerCase()).includes(fm.type.toLowerCase()) ? 1.2 : 1.0;
    const cmMatch = pkm.types.map(t => t.toLowerCase()).includes(cm.type.toLowerCase()) ? 1.2 : 1.0;

    const cmSE = (targetType && cm.type.toLowerCase() === targetType.toLowerCase()) ? 1.6 : 1.0;
    const fmSE = (targetType && fm.type.toLowerCase() === targetType.toLowerCase()) ? 1.6 : 1.0;

    const shadowMult = pkm.shadow ? 1.2 : 1.0;
    const effAtk = atk * shadowMult;

    const fmDmg = (0.5 * effAtk / 180 * calcMovePower(fm) * fmMatch * fmSE) + 1;
    const cmDmg = (0.5 * effAtk / 180 * calcMovePower(cm) * cmMatch * cmSE) + 1;

    const fmDur = Math.max(0.5, calcMoveDuration(fm));
    const cmDur = Math.max(0.5, calcMoveDuration(cm));

    const fmEnergy = fm.energy_delta || 6;
    const cmEnergy = Math.abs(cm.energy_delta || 50);

    const cycleTime = fmDur * (cmEnergy / fmEnergy) + cmDur;
    const cycleDmg = fmDmg * (cmEnergy / fmEnergy) + cmDmg;

    const dps = cycleDmg / cycleTime;
    const tdo = dps * (hp * def / 1340);

    const er = Math.pow(Math.pow(dps, 3) * tdo, 0.25);
    return { dps, tdo, er, fmName: fm.name, cmName: cm.name, cmType: cm.type, fmType: fm.type };
  }

  const result = {
    updatedAt: new Date().toISOString(),
    overall: [],
    byType: {}
  };

  // 1. Calculate By Type
  types.forEach(t => {
    const list = [];
    pkmData.forEach(pkm => {
      if (!pkm.released) return;
      (pkm.fm || []).forEach(fm => {
        (pkm.cm || []).forEach(cm => {
          const res = calculateAttackerScore(pkm, fm, cm, t);
          if (res && res.er > 0 && res.cmType.toLowerCase() === t.toLowerCase()) {
            list.push({
              name: pkm.name,
              form: pkm.form !== 'Normal' ? pkm.form : '',
              isShadow: !!pkm.shadow,
              isMega: pkm.form && (pkm.form.includes('Mega') || pkm.form.includes('Primal')),
              types: pkm.types,
              fastMove: res.fmName,
              chargedMove: res.cmName,
              er: parseFloat(res.er.toFixed(2)),
              dps: parseFloat(res.dps.toFixed(2))
            });
          }
        });
      });
    });

    list.sort((a, b) => b.er - a.er);
    const bestByPkm = new Map();
    list.forEach(item => {
      const key = `${item.name}-${item.form}-${item.isShadow}`;
      if (!bestByPkm.has(key)) {
        bestByPkm.set(key, item);
      }
    });

    result.byType[t] = Array.from(bestByPkm.values()).slice(0, 20);
  });

  // 2. Calculate Overall Top 30 Across All Types
  const overallList = [];
  pkmData.forEach(pkm => {
    if (!pkm.released) return;
    (pkm.fm || []).forEach(fm => {
      (pkm.cm || []).forEach(cm => {
        const res = calculateAttackerScore(pkm, fm, cm, null);
        if (res && res.er > 0) {
          overallList.push({
            name: pkm.name,
            form: pkm.form !== 'Normal' ? pkm.form : '',
            isShadow: !!pkm.shadow,
            isMega: pkm.form && (pkm.form.includes('Mega') || pkm.form.includes('Primal')),
            types: pkm.types,
            fastMove: res.fmName,
            chargedMove: res.cmName,
            moveType: res.cmType,
            er: parseFloat(res.er.toFixed(2)),
            dps: parseFloat(res.dps.toFixed(2))
          });
        }
      });
    });
  });

  overallList.sort((a, b) => b.er - a.er);
  const bestOverall = new Map();
  overallList.forEach(item => {
    const key = `${item.name}-${item.form}-${item.isShadow}`;
    if (!bestOverall.has(key)) {
      bestOverall.set(key, item);
    }
  });
  result.overall = Array.from(bestOverall.values()).slice(0, 30);

  const filesDir = path.join(__dirname, '..', 'files');
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

  const jsonPath = path.join(filesDir, 'topAttackers.json');
  const minJsonPath = path.join(filesDir, 'topAttackers.min.json');

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 4), 'utf-8');
  fs.writeFileSync(minJsonPath, JSON.stringify(result), 'utf-8');

  console.log(`Generated Top Attackers dataset successfully! (Overall: ${result.overall.length}, Types: ${Object.keys(result.byType).length})`);
}

generateTopAttackers();
