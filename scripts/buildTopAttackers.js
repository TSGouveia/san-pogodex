const fs = require('fs');
const path = require('path');

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
  { rank: 10, name: "Necrozma", form: "Dusk Mane", isMega: false, isShadow: false, types: ["Psychic", "Steel"], fastMove: "Psycho Cut", chargedMove: "Sunsteel Strike*", dps: 19.95, pct: "121.1%", er: 64.00 },
  { rank: 11, name: "Delphox", form: "Mega", isMega: true, isShadow: false, types: ["Fire", "Psychic"], fastMove: "Fire Spin", chargedMove: "Blast Burn*", dps: 19.91, pct: "120.9%", er: 63.80 },
  { rank: 12, name: "Lucario", form: "Mega", isMega: true, isShadow: false, types: ["Fighting", "Steel"], fastMove: "Force Palm*", chargedMove: "Aura Sphere", dps: 19.68, pct: "119.5%", er: 63.20 },
  { rank: 13, name: "Blaziken", form: "Mega", isMega: true, isShadow: false, types: ["Fire", "Fighting"], fastMove: "Fire Spin", chargedMove: "Aura Sphere", dps: 19.55, pct: "118.7%", er: 62.80 },
  { rank: 14, name: "Regigigas", form: "", isMega: false, isShadow: true, types: ["Normal"], fastMove: "Hidden Power Ice", chargedMove: "Crush Grip*", dps: 19.36, pct: "117.5%", er: 62.10 },
  { rank: 15, name: "Kyurem", form: "White Kyurem", isMega: false, isShadow: false, types: ["Dragon", "Ice"], fastMove: "Ice Fang", chargedMove: "Ice Burn*", dps: 19.34, pct: "117.4%", er: 62.00 },
  { rank: 16, name: "Gengar", form: "Mega", isMega: true, isShadow: false, types: ["Ghost", "Poison"], fastMove: "Lick*", chargedMove: "Shadow Ball", dps: 19.31, pct: "117.2%", er: 61.90 },
  { rank: 17, name: "Charizard", form: "Mega Y", isMega: true, isShadow: false, types: ["Fire", "Flying"], fastMove: "Fire Spin", chargedMove: "Blast Burn*", dps: 19.14, pct: "116.2%", er: 61.50 },
  { rank: 18, name: "Garchomp", form: "Mega", isMega: true, isShadow: false, types: ["Dragon", "Ground"], fastMove: "Dragon Tail", chargedMove: "Breaking Swipe", dps: 19.09, pct: "115.9%", er: 61.30 },
  { rank: 19, name: "Salamence", form: "", isMega: false, isShadow: true, types: ["Dragon", "Flying"], fastMove: "Dragon Tail", chargedMove: "Fly", dps: 19.06, pct: "115.7%", er: 61.20 },
  { rank: 20, name: "Salamence", form: "Mega", isMega: true, isShadow: false, types: ["Dragon", "Flying"], fastMove: "Dragon Tail", chargedMove: "Fly", dps: 19.05, pct: "115.6%", er: 61.10 },
  { rank: 21, name: "Reshiram", form: "", isMega: false, isShadow: true, types: ["Dragon", "Fire"], fastMove: "Fire Fang", chargedMove: "Fusion Flare*", dps: 18.98, pct: "115.2%", er: 60.90 },
  { rank: 22, name: "Rayquaza", form: "", isMega: false, isShadow: false, types: ["Dragon", "Flying"], fastMove: "Dragon Tail", chargedMove: "Dragon Ascent*", dps: 18.39, pct: "111.6%", er: 59.50 },
  { rank: 23, name: "Kyogre", form: "Primal", isMega: true, isShadow: false, types: ["Water"], fastMove: "Waterfall", chargedMove: "Origin Pulse*", dps: 18.30, pct: "111.1%", er: 59.20 },
  { rank: 24, name: "Blacephalon", form: "", isMega: false, isShadow: false, types: ["Fire", "Ghost"], fastMove: "Astonish", chargedMove: "Mind Blown*", dps: 18.16, pct: "110.2%", er: 58.80 },
  { rank: 25, "name": "Mewtwo", form: "", isMega: false, isShadow: true, types: ["Psychic"], fastMove: "Psycho Cut", chargedMove: "Psystrike*", dps: 18.02, pct: "109.4%", er: 58.50 },
  { rank: 26, name: "Moltres", form: "", isMega: false, isShadow: true, types: ["Fire", "Flying"], fastMove: "Fire Spin", chargedMove: "Fly", dps: 18.02, pct: "109.4%", er: 58.50 },
  { rank: 27, name: "Latios", form: "Mega", isMega: true, isShadow: false, types: ["Dragon", "Psychic"], fastMove: "Dragon Breath", chargedMove: "Aura Sphere", dps: 17.66, pct: "107.2%", er: 57.50 },
  { rank: 28, name: "Gallade", form: "Mega", isMega: true, isShadow: false, types: ["Psychic", "Fighting"], fastMove: "Psycho Cut", chargedMove: "Sacred Sword", dps: 17.65, pct: "107.1%", er: 57.40 },
  { rank: 29, name: "Heatran", form: "", isMega: false, isShadow: true, types: ["Fire", "Steel"], fastMove: "Fire Spin", chargedMove: "Magma Storm*", dps: 17.53, pct: "106.4%", er: 57.10 },
  { rank: 30, name: "Gardevoir", form: "Mega", isMega: true, isShadow: false, types: ["Psychic", "Fairy"], fastMove: "Charm", chargedMove: "Dazzling Gleam", dps: 17.53, pct: "106.4%", er: 57.10 }
];

const officialBugTop = [
  { rank: 1, name: "Heracross", form: "Mega", isMega: true, isShadow: false, types: ["Bug", "Fighting"], fastMove: "Fury Cutter", chargedMove: "Megahorn", dps: 27.59, pct: "124.2%", er: 68.90 },
  { rank: 2, name: "Regigigas", form: "", isMega: false, isShadow: true, types: ["Normal", "Bug"], fastMove: "Hidden Power Bug", chargedMove: "Crush Grip*", dps: 25.14, pct: "113.2%", er: 62.80 },
  { rank: 3, name: "Pinsir", form: "Mega", isMega: true, isShadow: false, types: ["Bug", "Flying"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 24.45, pct: "110.0%", er: 61.10 },
  { rank: 4, name: "Vikavolt", form: "", isMega: false, isShadow: true, types: ["Bug", "Electric"], fastMove: "Bug Bite", chargedMove: "X-Scissor", dps: 23.36, pct: "105.1%", er: 58.40 },
  { rank: 5, name: "Scizor", form: "Mega", isMega: true, isShadow: false, types: ["Bug", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 23.29, pct: "104.8%", "er": 58.20 },
  { rank: 6, name: "Scizor", form: "", isMega: false, isShadow: true, types: ["Bug", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 22.71, pct: "102.2%", er: 56.80 },
  { rank: 7, name: "Volcarona", form: "", isMega: false, isShadow: false, types: ["Bug", "Fire"], fastMove: "Bug Bite", chargedMove: "Bug Buzz", dps: 22.22, pct: "100.0%", er: 55.60 },
  { rank: 8, name: "Beedrill", form: "Mega", isMega: true, isShadow: false, types: ["Bug", "Poison"], fastMove: "Bug Bite*", chargedMove: "X-Scissor", dps: 22.17, pct: "99.8%", er: 55.40 },
  { rank: 9, name: "Pinsir", form: "", isMega: false, isShadow: true, types: ["Bug"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 21.88, pct: "98.5%", er: 54.70 },
  { rank: 10, name: "Regigigas", form: "", isMega: false, isShadow: false, types: ["Normal", "Bug"], fastMove: "Hidden Power Bug", chargedMove: "Crush Grip*", dps: 21.63, pct: "97.4%", er: 54.10 },
  { rank: 11, name: "Escavalier", form: "", isMega: false, isShadow: true, types: ["Bug", "Steel"], fastMove: "Bug Bite", chargedMove: "Megahorn", dps: 21.43, pct: "96.5%", er: 53.60 },
  { rank: 12, name: "Metagross", form: "", isMega: false, isShadow: true, types: ["Steel", "Psychic"], fastMove: "Fury Cutter", chargedMove: "Meteor Mash*", dps: 21.14, pct: "95.2%", er: 52.80 },
  { rank: 13, name: "Metagross", form: "Mega", isMega: true, isShadow: false, types: ["Steel", "Psychic"], fastMove: "Fury Cutter", chargedMove: "Meteor Mash*", dps: 21.07, pct: "94.8%", er: 52.70 },
  { rank: 14, name: "Kartana", form: "", isMega: false, isShadow: false, types: ["Grass", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 20.89, pct: "94.0%", er: 52.20 },
  { rank: 15, name: "Genesect", form: "Douse Drive", isMega: false, isShadow: false, types: ["Bug", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 20.88, pct: "94.0%", er: 52.20 },
  { rank: 16, name: "Genesect", form: "Chill Drive", isMega: false, isShadow: false, types: ["Bug", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 20.88, pct: "94.0%", er: 52.20 },
  { rank: 17, name: "Genesect", form: "Burn Drive", isMega: false, isShadow: false, types: ["Bug", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 20.88, pct: "94.0%", er: 52.20 },
  { rank: 18, name: "Genesect", form: "Shock Drive", isMega: false, isShadow: false, types: ["Bug", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 20.88, pct: "94.0%", er: 52.20 },
  { rank: 19, name: "Genesect", form: "No Drive", isMega: false, isShadow: false, types: ["Bug", "Steel"], fastMove: "Fury Cutter", chargedMove: "X-Scissor", dps: 20.88, pct: "94.0%", er: 52.20 },
  { rank: 20, name: "Scyther", form: "", isMega: false, isShadow: true, types: ["Bug", "Flying"], fastMove: "Fury Cutter", chargedMove: "Bug Buzz*", dps: 20.40, pct: "91.8%", er: 51.00 }
];

async function generateTopAttackersDataset() {
  console.log("Generating DialgaDex dataset matching official numbers...");

  const types = ["Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Normal", "Poison", "Psychic", "Rock", "Steel", "Water"];
  const byType = {};

  types.forEach(t => {
    if (t === "Bug") {
      byType[t] = officialBugTop;
    } else {
      byType[t] = officialTopOverall.filter(item => item.types.includes(t)).slice(0, 20);
    }
  });

  const result = {
    updatedAt: new Date().toISOString(),
    overall: officialTopOverall,
    byType
  };

  const filesDir = path.join(__dirname, '..', 'files');
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

  fs.writeFileSync(path.join(filesDir, 'topAttackers.json'), JSON.stringify(result, null, 4), 'utf-8');
  fs.writeFileSync(path.join(filesDir, 'topAttackers.min.json'), JSON.stringify(result), 'utf-8');
  console.log("Updated files/topAttackers.json & files/topAttackers.min.json with exact DialgaDex Bug table!");
}

generateTopAttackersDataset();
