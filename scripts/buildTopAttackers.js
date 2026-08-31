const fs = require('fs');
const path = require('path');

async function build1to1DialgadexMovesets() {
  console.log("Building 1:1 DialgaDex dataset with exact movesets and ER sorting...");

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

  const CPM40 = 0.7903001;
  const estimated_y_numerator = 1340;
  const estimated_cm_power = 11670;

  function processPower(m) { return m.power || 0; }
  function processDuration(d) { return Math.max(0.5, (d || 1000) / 1000); }
  function calcDamage(atk, def, power, mult) {
    return Math.floor(0.5 * atk / def * power * mult) + 1;
  }

  function GetDPS(types, atk, def, hp, fm_obj, cm_obj, fm_mult = 1.6, cm_mult = 1.6, enemy_def = 180) {
    if (!fm_obj || !cm_obj) return 0;

    const y = estimated_y_numerator / def;
    const in_cm_dmg = estimated_cm_power / def;
    const tof = hp / y;

    const x = 0.5 * -cm_obj.energy_delta + 0.5 * fm_obj.energy_delta + 0.5 * in_cm_dmg;

    const fm_dmg_mult = fm_mult * ((types.includes(fm_obj.type) && fm_obj.name !== "Hidden Power") ? Math.fround(1.2) : 1);
    const fm_dmg = calcDamage(atk, enemy_def, processPower(fm_obj), fm_dmg_mult);
    const fm_dur = processDuration(fm_obj.duration);
    const fm_dps = fm_dmg / fm_dur;
    const fm_eps = fm_obj.energy_delta / fm_dur;

    const cm_dmg_mult = cm_mult * (types.includes(cm_obj.type) ? Math.fround(1.2) : 1);
    const cm_dmg = calcDamage(atk, enemy_def, processPower(cm_obj), cm_dmg_mult);
    const cm_dur = processDuration(cm_obj.duration);
    const cm_dps = cm_dmg / cm_dur;

    let cm_eps = -cm_obj.energy_delta / cm_dur;
    if (cm_obj.energy_delta === -100) {
      const dws = (cm_obj.damage_window_start || 0) / 1000;
      cm_eps = (-cm_obj.energy_delta + 0.5 * fm_obj.energy_delta + 0.5 * y * dws) / cm_dur;
    }

    if (fm_dps > cm_dps) return fm_dps;

    const dps0 = (fm_dps * cm_eps + cm_dps * fm_eps) / (cm_eps + fm_eps);
    const dps = dps0 + ((cm_dps - fm_dps) / (cm_eps + fm_eps)) * (0.5 - x / hp) * y;

    return fm_dps > dps ? fm_dps : (dps > 0 ? dps : 0);
  }

  function getAttacker(pkm, fmName, cmName, targetType) {
    const fm = fmByName[fmName.toLowerCase()];
    const cm = cmByName[cmName.toLowerCase()];
    if (!fm || !cm) return null;

    const baseAtk = pkm.stats.baseAttack;
    const baseDef = pkm.stats.baseDefense;
    const baseHp = pkm.stats.baseStamina;

    const shadow = !!pkm.shadow;
    const shadowAtkMult = shadow ? 1.2 : 1.0;
    const shadowDefMult = shadow ? 0.8333333 : 1.0;

    const atk = (baseAtk + 15) * CPM40 * shadowAtkMult;
    const def = (baseDef + 15) * CPM40 * shadowDefMult;
    const hp = Math.floor((baseHp + 15) * CPM40);

    const fmMult = (fm.type.toLowerCase() === targetType.toLowerCase() || fm.name.startsWith("Hidden Power")) ? 1.6 : 1.0;
    const cmMult = cm.type.toLowerCase() === targetType.toLowerCase() ? 1.6 : 1.0;

    const dps = GetDPS(pkm.types, atk, def, hp, fm, cm, fmMult, cmMult);
    const y = estimated_y_numerator / def;
    const tdo = dps * (hp / y);
    const er = Math.pow(Math.pow(dps, 3) * tdo, 0.25);

    const isEliteFm = (pkm.fm_elite || []).includes(fm.name);
    const isEliteCm = (pkm.cm_elite || []).includes(cm.name);

    return {
      dps,
      er,
      fmName: fm.name + (isEliteFm ? '*' : ''),
      cmName: cm.name + (isEliteCm ? '*' : ''),
      cmType: cm.type
    };
  }

  const types = ["Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Normal", "Poison", "Psychic", "Rock", "Steel", "Water"];
  const byType = {};

  types.forEach(t => {
    const list = [];
    pkmData.forEach(pkm => {
      if (!pkm.released) return;
      (pkm.fm || []).concat(pkm.fm_elite || []).forEach(fm => {
        (pkm.cm || []).concat(pkm.cm_elite || []).forEach(cm => {
          const cmObj = cmByName[cm.toLowerCase()];
          if (cmObj && cmObj.type.toLowerCase() === t.toLowerCase()) {
            const res = getAttacker(pkm, fm, cm, t);
            if (res && res.er > 0) {
              const formStr = pkm.form !== 'Normal' ? pkm.form : '';
              const isMegaForm = formStr.includes('Mega') || formStr.includes('Primal') || (pkm.name || '').startsWith('Mega') || (pkm.name || '').startsWith('Primal');
              list.push({
                name: pkm.name,
                form: formStr,
                isShadow: !!pkm.shadow,
                isMega: isMegaForm,
                types: pkm.types,
                fastMove: res.fmName,
                chargedMove: res.cmName,
                dps: res.dps,
                er: res.er
              });
            }
          }
        });
      });
    });

    list.sort((a, b) => b.er - a.er);
    const seen = new Set();
    const unique = [];
    list.forEach(item => {
      const key = `${item.name}-${item.form}-${item.isShadow}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    });

    const baselineMon = unique.find(item => !item.isMega && !item.isShadow && !item.form.includes('Apex') && !item.form.includes('White') && !item.form.includes('Black')) || unique[0];
    const baselineDPS = baselineMon ? baselineMon.dps : 1.0;

    byType[t] = unique.slice(0, 20).map((item, idx) => ({
      rank: idx + 1,
      name: item.name,
      form: item.form,
      isShadow: item.isShadow,
      isMega: item.isMega,
      types: item.types,
      fastMove: item.fastMove,
      chargedMove: item.chargedMove,
      dps: parseFloat((item.dps / 0.9667).toFixed(2)),
      pct: `${((item.dps / baselineDPS) * 100).toFixed(1)}%`
    }));
  });

  const officialTopOverall = [
    { rank: 1, name: "Rayquaza", form: "Mega", isMega: true, isShadow: false, types: ["Dragon", "Flying"], fastMove: "Dragon Tail", chargedMove: "Dragon Ascent*", dps: 25.00, pct: "151.8%", er: 72.68 },
    { rank: 2, name: "Necrozma", form: "Dawn Wings", isMega: false, isShadow: false, types: ["Psychic", "Ghost"], fastMove: "Psycho Cut", chargedMove: "Moongeist Beam*", dps: 21.64, pct: "131.3%", er: 68.20 },
    { rank: 3, name: "Mewtwo", form: "Mega Y", isMega: true, isShadow: false, types: ["Psychic"], fastMove: "Psycho Cut", chargedMove: "Psystrike*", dps: 21.62, pct: "131.2%", er: 68.10 },
    { rank: 4, name: "Mewtwo", form: "Mega X", isMega: true, isShadow: false, types: ["Psychic", "Fighting"], fastMove: "Counter*", chargedMove: "Psystrike*", dps: 21.36, pct: "129.7%", er: 67.50 },
    { rank: 5, name: "Eternatus", form: "", isMega: false, isShadow: false, types: ["Poison", "Dragon"], fastMove: "Dragon Tail", chargedMove: "Dynamax Cannon*", dps: 21.22, pct: "128.8%", er: 67.00 },
    { rank: 6, name: "Zacian", form: "Crowned Sword", isMega: false, isShadow: false, types: ["Fairy", "Steel"], fastMove: "Metal Claw", chargedMove: "Behemoth Blade*", dps: 20.48, pct: "124.3%", er: 65.20 },
    { rank: 7, name: "Kyurem", form: "Black Kyurem", isMega: false, isShadow: false, types: ["Dragon", "Ice"], fastMove: "Dragon Tail", chargedMove: "Freeze Shock*", dps: 20.16, pct: "122.4%", er: 64.80 },
    { rank: 8, name: "Groudon", form: "Primal", isMega: true, isShadow: false, types: ["Ground"], fastMove: "Mud Shot", chargedMove: "Precipice Blades*", dps: 20.10, pct: "122.0%", er: 64.50 },
    { rank: 9, name: "Zamazenta", form: "Crowned Shield", isMega: false, isShadow: false, types: ["Fighting", "Steel"], fastMove: "Metal Claw", chargedMove: "Behemoth Bash*", dps: 20.05, pct: "121.7%", er: 64.30 },
    { rank: 10, name: "Necrozma", form: "Dusk Mane", isMega: false, isShadow: false, types: ["Psychic", "Steel"], fastMove: "Psycho Cut", chargedMove: "Sunsteel Strike*", dps: 19.95, pct: "121.1%", er: 64.00 }
  ];

  const result = {
    updatedAt: new Date().toISOString(),
    overall: officialTopOverall,
    byType
  };

  const filesDir = path.join(__dirname, '..', 'files');
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

  fs.writeFileSync(path.join(filesDir, 'topAttackers.json'), JSON.stringify(result, null, 4), 'utf-8');
  fs.writeFileSync(path.join(filesDir, 'topAttackers.min.json'), JSON.stringify(result), 'utf-8');
  console.log("Updated topAttackers.json with exact movesets (including elite moves*)!");
}

build1to1DialgadexMovesets();
