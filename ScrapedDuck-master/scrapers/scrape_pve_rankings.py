"""
PvE (raid attacker) rankings per type, reproducing DialgaDex.

DialgaDex (dialgadex.com) has no rankings feed: the site downloads its base data
from github.com/mgrann03/pokemon-resources and computes the rankings in the
browser (scripts/calc.js). This module uses the same data and ports that
calculation with DialgaDex's default settings:
  level 40 · 15/15/15 · metric eDPS · PvE turns · "new DPS" model · party size 1
  · relobby 10 s · 6 per team · mixed movesets allowed (one move must match)
  · elite moves, Megas, Shadows and legendaries included · type affinity on
    (the generic enemy is the average of the tier 4+ raid bosses weak to the type).
The list of forms per Pokémon is read from DialgaDex's own pokemon_enums.js.

Output shape:
{
  "updatedAt": "...", "level": 40,
  "types": {"dark": 412, ...},                              # attackers ranked per type
  "species": {"983": [ {"name": "Kingambit", "form": "Normal", "shadow": true, "mega": false,
                        "t": [["dark", 9, 18.41, "Snarl", "Foul Play", 0], ...]} ]}  # top types; last = elite flags (1 fast, 2 charged)
}
"""
import re
import math
import struct
import datetime
import requests

DATA = "https://raw.githubusercontent.com/mgrann03/pokemon-resources/main"
ENUMS = "https://www.dialgadex.com/scripts/pokemon_enums.js"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; pogo-data-scraper)"}

TYPES = ["Normal", "Fire", "Water", "Grass", "Electric", "Ice", "Fighting", "Poison", "Ground",
         "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"]
# attacking type -> [immune(0.390625), resisted(0.625), super effective(1.6)]
EFFECT = {
    "Normal": [["Ghost"], ["Rock", "Steel"], []],
    "Fire": [[], ["Dragon", "Fire", "Rock", "Water"], ["Bug", "Grass", "Ice", "Steel"]],
    "Water": [[], ["Dragon", "Grass", "Water"], ["Fire", "Ground", "Rock"]],
    "Grass": [[], ["Bug", "Dragon", "Fire", "Flying", "Grass", "Poison", "Steel"], ["Ground", "Rock", "Water"]],
    "Electric": [["Ground"], ["Dragon", "Electric", "Grass"], ["Flying", "Water"]],
    "Ice": [[], ["Fire", "Ice", "Steel", "Water"], ["Dragon", "Flying", "Grass", "Ground"]],
    "Fighting": [["Ghost"], ["Bug", "Fairy", "Flying", "Poison", "Psychic"], ["Dark", "Ice", "Normal", "Rock", "Steel"]],
    "Poison": [["Steel"], ["Ghost", "Ground", "Poison", "Rock"], ["Fairy", "Grass"]],
    "Ground": [["Flying"], ["Bug", "Grass"], ["Electric", "Fire", "Poison", "Rock", "Steel"]],
    "Flying": [[], ["Electric", "Rock", "Steel"], ["Bug", "Fighting", "Grass"]],
    "Psychic": [["Dark"], ["Psychic", "Steel"], ["Fighting", "Poison"]],
    "Bug": [[], ["Fairy", "Fighting", "Fire", "Flying", "Ghost", "Poison", "Steel"], ["Dark", "Grass", "Psychic"]],
    "Rock": [[], ["Fighting", "Ground", "Steel"], ["Bug", "Fire", "Flying", "Ice"]],
    "Ghost": [["Normal"], ["Dark"], ["Ghost", "Psychic"]],
    "Dragon": [["Fairy"], ["Steel"], ["Dragon"]],
    "Dark": [[], ["Dark", "Fairy", "Fighting"], ["Ghost", "Psychic"]],
    "Steel": [[], ["Electric", "Fire", "Steel", "Water"], ["Fairy", "Ice", "Rock"]],
    "Fairy": [[], ["Fire", "Poison", "Steel"], ["Dark", "Dragon", "Fighting"]],
}
MEGA_FORMS = ("Mega", "MegaY", "MegaZ")
FORM_LABEL = {"Alola": "Alolan", "Galarian": "Galarian", "Hisuian": "Hisuian", "Paldea": "Paldean"}


def f32(x):
    """Math.fround"""
    return struct.unpack("f", struct.pack("f", x))[0]


CPM_40 = f32(0.7903)
STAB = f32(1.2)
SE = f32(1.60)
SHADOW_ATK, SHADOW_DEF = f32(1.2), f32(0.8333333)
EST_Y_NUM, EST_CM_POWER = 1340, 11670
RESPAWN, REJOIN, PARTY = 1, 10, 6


def eff_against(attack_type, enemy_types):
    imm, res, se = EFFECT[attack_type]
    m = 1.0
    for t in enemy_types:
        if t in imm:
            m *= 0.390625
        elif t in res:
            m *= 0.625
        elif t in se:
            m *= SE
    return m


def duration(ms):          # PvE turns: rounded to 0.5 s
    return math.floor((ms / 1000) * 2 + 0.5) / 2


def power(move):
    new = duration(move["duration"])
    p = move["power"]
    if new:
        mod = (new - move["duration"] / 1000) / new
        if abs(mod) >= 0.199:
            p = p * (1 + mod)
    return p


def calc_damage(atk, dfn, pw, mult):
    return 0.5 * pw * (atk / dfn) * mult + 0.5


def specific_y(types, atk, fm, cm, incoming_dps):
    fm_stab = STAB if fm["type"] in types and fm["name"] != "Hidden Power" else 1
    fm_num = 0.5 * power(fm) * fm_stab * atk
    cm_stab = STAB if cm["type"] in types else 1
    cm_num = 0.5 * power(cm) * cm_stab * atk
    eps = 0.5 * incoming_dps
    fm_dur = duration(fm["duration"]) + 1.75
    cm_dur = duration(cm["duration"]) + 0.5
    per = (-cm["energy_delta"] - eps * cm_dur) / (fm["energy_delta"] + eps * fm_dur)
    per = max(0, per) + (1 / 0.3) - 1
    cycle = per * fm_dur + cm_dur
    ys = {"Any": [(per * fm_num + cm_num) / cycle, cm_num]}
    if fm["type"] == cm["type"]:
        ys[fm["type"]] = ys["Any"]
    else:
        ys[fm["type"]] = [(per * fm_num) / cycle, 0]
        ys[cm["type"]] = [cm_num / cycle, cm_num]
    return ys


def get_dps(types, atk, dfn, hp, fm, cm, fm_mult, cm_mult, enemy_def, y_num, cm_num):
    y = (y_num or EST_Y_NUM) / dfn
    in_cm = (cm_num or EST_CM_POWER) / dfn
    x = 0.5 * -cm["energy_delta"] + 0.5 * fm["energy_delta"] + 0.5 * in_cm
    fm_dmg = calc_damage(atk, enemy_def, power(fm), fm_mult * (STAB if fm["type"] in types and fm["name"] != "Hidden Power" else 1))
    fm_dur = duration(fm["duration"]) or 0.5
    fm_dps, fm_eps = fm_dmg / fm_dur, fm["energy_delta"] / fm_dur
    cm_dmg = calc_damage(atk, enemy_def, power(cm), cm_mult * (STAB if cm["type"] in types else 1))
    cm_dur = duration(cm["duration"]) or 0.5
    cm_dps = cm_dmg / cm_dur
    cm_eps = -cm["energy_delta"] / cm_dur
    if cm["energy_delta"] == -100:
        cm_eps = (-cm["energy_delta"] + 0.5 * fm["energy_delta"]) / cm_dur   # dws = 0 with PvE turns
    if fm_dps > cm_dps:
        return fm_dps
    if cm_eps + fm_eps == 0 or hp == 0:
        return 0          # NaN in the JS original, which falls through to 0
    dps0 = (fm_dps * cm_eps + cm_dps * fm_eps) / (cm_eps + fm_eps)
    dps = dps0 + ((cm_dps - fm_dps) / (cm_eps + fm_eps)) * (0.5 - x / hp) * y
    return fm_dps if fm_dps > dps else (dps if dps > 0 else 0)


def get_edps(dps, tdo, enemy_hp):
    if dps <= 0 or tdo <= 0:
        return 0.0
    tof = tdo / dps
    lives = enemy_hp / tdo
    deaths = lives - 0.5
    relobbies = deaths / PARTY - 0.5
    ttw = lives * tof + (deaths - relobbies) * RESPAWN + REJOIN * relobbies
    return enemy_hp / ttw


def parse_forms(js):
    """GetPokemonForms(id) from pokemon_enums.js -> {id: [forms]} (default ["Normal"])"""
    m = re.search(r"function GetPokemonForms\s*\(\s*pokemon_id\s*\)\s*\{(.*?)\n\}", js, re.S)
    forms, pending = {}, []
    if not m:
        return forms
    for line in m.group(1).splitlines():
        for c in re.findall(r"case\s+(\d+)\s*:", line):
            pending.append(int(c))
        r = re.search(r"return\s*\[([^\]]*)\]", line)
        if r and pending:
            lst = re.findall(r'"([^"]+)"', r.group(1))
            for pid in pending:
                forms[pid] = lst
            pending = []
    return forms


def pokemon_moves(p, by_id_form, hidden_filter):
    fm, cm = list(p.get("fm") or []), list(p.get("cm") or [])
    efm, ecm = list(p.get("elite_fm") or []), list(p.get("elite_cm") or [])
    if "Hidden Power" in fm or "Hidden Power" in efm:
        hp_types = ["Fighting"] if hidden_filter == "Raid Boss" else [t for t in TYPES if t not in ("Fairy", "Normal")]
        for t in hp_types:
            if "Hidden Power" in fm:
                fm.append("Hidden Power " + t)
            if "Hidden Power" in efm:
                efm.append("Hidden Power " + t)
    shadow_only, pure_only = [], []
    if p.get("shadow"):
        pure_only.append("Return")
    elif p.get("form") in MEGA_FORMS:
        base = by_id_form.get((p["id"], "Normal"))
        if base and base.get("shadow"):
            pure_only.append("Return")
    if p.get("form") == "S":
        if p["id"] == 249:
            shadow_only.append("Aeroblast Plus"); pure_only.append("Aeroblast Plus Plus")
        if p["id"] == 250:
            shadow_only.append("Sacred Fire Plus"); pure_only.append("Sacred Fire Plus Plus")
    ecm += list(p.get("temp_cm") or [])
    return fm, cm, efm, ecm, pure_only, shadow_only


def type_affinity(attack_type, pkm, by_id_form, fms, cms):
    bosses = [p for p in pkm if (p.get("raid_tier") or 0) >= 4 and eff_against(attack_type, p["types"]) > 1.01]
    if not bosses:
        bosses = [p for p in pkm if (p.get("raid_tier") or 0) >= 4]
    eff = {t: 0.0 for t in TYPES}
    ys = {t: [0.0, 0.0] for t in TYPES + ["Any", "None"]}
    st = [0.0, 0.0, 0.0]
    for b in bosses:
        for t in TYPES:
            eff[t] += eff_against(t, b["types"])
        tier = b["raid_tier"]
        cpm = f32([None, 0.6, 0.67, 0.73, 0.79, 0.79, 0.79, 1.0, 0.79, 0.79][tier])
        atk = (b["stats"]["baseAttack"] + 15) * cpm
        dfn = (b["stats"]["baseDefense"] + 15) * cpm
        hp = [None, 600, None, 3600, 9000, 15000, 22500, 20000, 25000, 25000][tier]
        st[0] += atk; st[1] += dfn; st[2] += hp
        bfm, bcm = pokemon_moves(b, by_id_form, "Raid Boss")[:2]
        all_ys = []
        for f in bfm:
            fo = fms.get(f)
            if not fo:
                continue
            for c in bcm:
                co = cms.get(c)
                if co:
                    all_ys.append(specific_y(b["types"], atk, fo, co, hp / (300 if tier >= 4 else 180)))
        if not all_ys:
            continue
        acc = {}
        for y in all_ys:
            for k, v in y.items():
                a = acc.setdefault(k, [0.0, 0.0]); a[0] += v[0]; a[1] += v[1]
        for k, v in acc.items():
            ys[k][0] += v[0] / len(all_ys); ys[k][1] += v[1] / len(all_ys)
    n = len(bosses)
    return ({t: v / n for t, v in eff.items()}, {k: [v[0] / n, v[1] / n] for k, v in ys.items()},
            {"atk": st[0] / n, "def": st[1] / n, "hp": st[2] / n})


def scrape_pve_rankings():
    print("Computing PvE attacker rankings (DialgaDex method)...")
    try:
        pkm = requests.get(f"{DATA}/pogo_pkm.min.json", headers=HEADERS, timeout=30).json()
        fms = {m["name"]: m for m in requests.get(f"{DATA}/pogo_fm.json", headers=HEADERS, timeout=30).json()}
        cms = {m["name"]: m for m in requests.get(f"{DATA}/pogo_cm.json", headers=HEADERS, timeout=30).json()}
        forms_by_id = parse_forms(requests.get(ENUMS, headers=HEADERS, timeout=30).text)
    except Exception as e:
        print(f"  Could not load DialgaDex data: {e}")
        return {}
    try:   # DialgaDex's "speculative" setting (on by default): announced moves / forms
        spec = requests.get(f"{DATA}/pogo_pkm_manual_announced.json", headers=HEADERS, timeout=30).json()
    except Exception:
        spec = []

    # only the forms DialgaDex treats as active (also used for the raid boss list)
    pkm = [p for p in pkm if p.get("form") in forms_by_id.get(p["id"], ["Normal"])]
    if "Hidden Power" in fms:
        fms["Hidden Power"] = {**fms["Hidden Power"], "type": "None"}   # generic Hidden Power is typeless
    by_id_form = {(p["id"], p["form"]): p for p in pkm}
    for patch in spec:
        target = by_id_form.get((patch.get("id"), patch.get("form")))
        if target is None:
            pkm.append(dict(patch))
            by_id_form[(patch.get("id"), patch.get("form"))] = pkm[-1]
        else:
            for k, v in patch.items():
                if k not in ("id", "name", "form"):
                    target[k] = v

    # every attacker variant (SearchAll): default form, its shadow, other forms (+ shadows)
    variants = []
    for pid in sorted({p["id"] for p in pkm}):
        forms = forms_by_id.get(pid, ["Normal"])
        base = by_id_form.get((pid, forms[0]))
        if not base or not base.get("released"):
            continue
        for i, form in enumerate(forms):
            p = by_id_form.get((pid, form))
            if not p or not p.get("released") or not p.get("stats"):
                continue
            variants.append((p, False))
            if p.get("shadow"):
                variants.append((p, True))

    # precompute attacker stats and move lists
    prepared = []
    for p, shadow in variants:
        s = p["stats"]
        atk = (s["baseAttack"] + 15) * CPM_40
        dfn = (s["baseDefense"] + 15) * CPM_40
        hp = math.floor((s["baseStamina"] + 15) * CPM_40)
        if shadow:
            atk *= SHADOW_ATK; dfn *= SHADOW_DEF
        fm, cm, efm, ecm, pure_only, shadow_only = pokemon_moves(p, by_id_form, "All")
        ecm = ecm + (shadow_only if shadow else pure_only)
        fast = [(fms[f], f in efm) for f in fm + efm if f in fms]
        charged = [(cms[c], c in ecm) for c in cm + ecm if c in cms]
        defeff = {t: eff_against(t, p["types"]) for t in TYPES}
        prepared.append((p, shadow, atk, dfn, hp, fast, charged, defeff))

    results = {}   # variant index -> {type: (rating, fm, cm, elite)}
    totals = {}
    for T in TYPES:
        weak, ys, est = type_affinity(T, pkm, by_id_form, fms, cms)
        scored = []
        for i, (p, shadow, atk, dfn, hp, fast, charged, defeff) in enumerate(prepared):
            # enemy damage against this attacker, weighted by its weaknesses
            y_num = sum(v[0] * defeff.get(t, 1) for t, v in ys.items() if t != "Any")
            cm_num = sum(v[1] * defeff.get(t, 1) for t, v in ys.items() if t != "Any")
            best = None
            for fo, fe in fast:
                for co, ce in charged:
                    if fo["type"] != T and co["type"] != T:
                        continue        # mixed allowed, but at least one move of the type
                    if fo["type"] not in weak or co["type"] not in weak:
                        continue        # typeless Hidden Power: NaN -> 0 in the original
                    dps = get_dps(p["types"], atk, dfn, hp, fo, co, weak[fo["type"]], weak[co["type"]], est["def"], y_num, cm_num)
                    tdo = dps * hp / ((y_num or EST_Y_NUM) / dfn)
                    r = get_edps(dps, tdo, est["hp"])
                    if not best or r > best[0]:
                        best = (r, fo["name"], co["name"], (1 if fe else 0) + (2 if ce else 0))
            if best and best[0] > 0:
                scored.append((best[0], i, best))
        scored.sort(key=lambda x: -x[0])
        totals[T.lower()] = len(scored)
        for rank, (_, i, best) in enumerate(scored, start=1):
            results.setdefault(i, []).append([T.lower(), rank, round(best[0], 2), best[1], best[2], best[3]])

    species = {}
    for i, rows in results.items():
        p, shadow = prepared[i][0], prepared[i][1]
        name = p["name"]
        if p["form"] in FORM_LABEL and not name.startswith(FORM_LABEL[p["form"]]):
            name = f"{FORM_LABEL[p['form']]} {name}"
        rows.sort(key=lambda r: r[1])
        species.setdefault(str(p["id"]), []).append({
            "name": name, "form": p["form"], "shadow": shadow, "mega": p["form"] in MEGA_FORMS, "t": rows[:4]
        })
    print(f"Ranked {len(prepared)} attacker variants across {len(totals)} types!")
    return {
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "level": 40,
        "types": totals,
        "species": species,
    }


if __name__ == "__main__":
    import json, time
    t0 = time.time()
    data = scrape_pve_rankings()
    print(f"{time.time() - t0:.1f}s, {len(json.dumps(data, separators=(',', ':'))) // 1024} KB")
    for n in ("983", "625", "150", "248", "105"):
        print(n, json.dumps(data["species"].get(n), ensure_ascii=False))
