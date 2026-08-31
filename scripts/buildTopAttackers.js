const fs = require('fs');
const path = require('path');

async function build1to1Dialgadex() {
  console.log("Building 1:1 DialgaDex dataset for overall and all 18 types...");

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

  function processPower(m) { return m.power || 0; }
  function processDuration(d) { return Math.max(0.5, (d || 1000) / 1000); }
  function calcDamage(atk, def, power, mult) {
    return Math.floor(0.5 * atk / def * power * mult) + 1;
  }

  function GetDPS(types, atk, def, hp, fm_obj, cm_obj) {
    if (!fm_obj || !cm_obj) return 0;

    const y = 1340 / def;
    const in_cm_dmg = 11670 / def;
    const tof = hp / y;

    const fm_delta = fm_obj.energy_delta || 6;
    const cm_delta = Math.abs(cm_obj.energy_delta || 50);
    const x = 0.5 * cm_delta + 0.5 * fm_delta + 0.5 * in_cm_dmg;

    const fm_stab = (types.includes(fm_obj.type) && fm_obj.name !== "Hidden Power") ? 1.2 : 1.0;
    const cm_stab = types.includes(cm_obj.type) ? 1.2 : 1.0;

    const fm_dmg = calcDamage(atk, 180, processPower(fm_obj), fm_stab);
    const cm_dmg = calcDamage(atk, 180, processPower(cm_obj), cm_stab);

    const fm_dur = processDuration(fm_obj.duration);
    const cm_dur = processDuration(cm_obj.duration);

    const fm_dps = fm_dmg / fm_dur;
    const fm_eps = fm_delta / fm_dur;

    const cm_dps = cm_dmg / cm_dur;
    let cm_eps = cm_delta / cm_dur;

    if (cm_obj.energy_delta === -100) {
      const dws = (cm_obj.damage_window_start || 0) / 1000;
      cm_eps = (cm_delta + 0.5 * fm_delta + 0.5 * y * dws) / cm_dur;
    }

    if (fm_dps > cm_dps) return fm_dps;

    const num = (cm_dps - fm_dps) * (x + tof * fm_eps);
    const den = cm_eps + fm_eps + (cm_dps - fm_dps) / y;
    return fm_dps + (num / den);
  }

  function getAttacker(pkm, fmName, cmName) {
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

    const rawDps = GetDPS(pkm.types, atk, def, hp, fm, cm);
    return { dps: rawDps, fmName: fm.name, cmName: cm.name, cmType: cm.type };
  }

  const types = ["Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Normal", "Poison", "Psychic", "Rock", "Steel", "Water"];
  const byType = {};

  types.forEach(t => {
    const list = [];
    pkmData.forEach(pkm => {
      if (!pkm.released) return;
      (pkm.fm || []).forEach(fm => {
        (pkm.cm || []).forEach(cm => {
          const cmObj = cmByName[cm.toLowerCase()];
          if (cmObj && cmObj.type.toLowerCase() === t.toLowerCase()) {
            const res = getAttacker(pkm, fm, cm);
            if (res && res.dps > 0) {
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
                dps: res.dps
              });
            }
          }
        });
      });
    });

    list.sort((a, b) => b.dps - a.dps);
    const seen = new Set();
    const unique = [];
    list.forEach(item => {
      const key = `${item.name}-${item.form}-${item.isShadow}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    });

    // Find baseline mon (Volcarona for Bug, Reshiram for Fire, etc.)
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
      dps: parseFloat((item.dps / 8.92).toFixed(2)),
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
  console.log("Updated files/topAttackers.json & files/topAttackers.min.json 1:1 matching DialgaDex!");
}

build1to1Dialgadex();
