/**
 * SilphRoad Dex - Core Application JavaScript
 * Dynamic Pokémon GO PokéDex Loader, local storage state persistence, and filtering.
 */

import { auth, db } from './firebase.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    updateProfile,
    sendPasswordResetEmail
} from 'firebase/auth';
import { 
    doc, 
    getDoc, 
    setDoc,
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    arrayUnion,
    arrayRemove,
    onSnapshot,
    writeBatch
} from 'firebase/firestore';

// Global Application Database loaded dynamically
let pokemonDatabase = [];
let rawPokedexData = null;

// Safe lowercasing helper function
function safeLower(val) {
    return (val && typeof val === 'string') ? val.toLowerCase() : (val != null ? String(val).toLowerCase() : '');
}

// Ntfy Notification helper for error alerts
window.sendNtfyNotification = function(message, title = 'PoGo Website Warning', tags = 'warning') {
    try {
        fetch('https://ntfy.sh/lazysan', {
            method: 'POST',
            headers: {
                'Title': title,
                'Tags': tags
            },
            body: message
        }).catch(err => console.error('Failed to send ntfy notification:', err));
    } catch (e) {
        console.error('Error sending ntfy notification:', e);
    }
};

window.addEventListener('error', (event) => {
    if (window.sendNtfyNotification) {
        const msg = event.message || (event.target && event.target.src ? `Recurso falhou ao carregar: ${event.target.src}` : 'Erro JavaScript');
        window.sendNtfyNotification(`Erro no site: ${msg}`, 'PoGo Website Error', 'warning,bug');
    }
}, true);

const regionalFormPokeApiIds = {
  "rattata-alola": "10091",
  "raticate-alola": "10092",
  "raticate-totem-alola": "10093",
  "pikachu-alola-cap": "10099",
  "raichu-alola": "10100",
  "sandshrew-alola": "10101",
  "sandslash-alola": "10102",
  "vulpix-alola": "10103",
  "ninetales-alola": "10104",
  "diglett-alola": "10105",
  "dugtrio-alola": "10106",
  "meowth-alola": "10107",
  "persian-alola": "10108",
  "geodude-alola": "10109",
  "graveler-alola": "10110",
  "golem-alola": "10111",
  "grimer-alola": "10112",
  "muk-alola": "10113",
  "exeggutor-alola": "10114",
  "marowak-alola": "10115",
  "meowth-galar": "10161",
  "ponyta-galar": "10162",
  "rapidash-galar": "10163",
  "slowpoke-galar": "10164",
  "slowbro-galar": "10165",
  "farfetchd-galar": "10166",
  "weezing-galar": "10167",
  "mr-mime-galar": "10168",
  "articuno-galar": "10169",
  "zapdos-galar": "10170",
  "moltres-galar": "10171",
  "slowking-galar": "10172",
  "corsola-galar": "10173",
  "zigzagoon-galar": "10174",
  "linoone-galar": "10175",
  "darumaka-galar": "10176",
  "darmanitan-galar-standard": "10177",
  "darmanitan-galar-zen": "10178",
  "yamask-galar": "10179",
  "stunfisk-galar": "10180",
  "growlithe-hisui": "10229",
  "arcanine-hisui": "10230",
  "voltorb-hisui": "10231",
  "electrode-hisui": "10232",
  "typhlosion-hisui": "10233",
  "qwilfish-hisui": "10234",
  "sneasel-hisui": "10235",
  "samurott-hisui": "10236",
  "lilligant-hisui": "10237",
  "zorua-hisui": "10238",
  "zoroark-hisui": "10239",
  "braviary-hisui": "10240",
  "sliggoo-hisui": "10241",
  "goodra-hisui": "10242",
  "avalugg-hisui": "10243",
  "decidueye-hisui": "10244",
  "tauros-paldea-combat-breed": "10250",
  "tauros-paldea-blaze-breed": "10251",
  "tauros-paldea-aqua-breed": "10252",
  "wooper-paldea": "10253",
  "basculin-white-striped": "10247"
};

let pokeApiIdMapping = {};

function getRegionalFormPokeApiId(name) {
    const nameLower = name.toLowerCase().trim();
    let key = '';
    if (nameLower.includes('alolan ')) {
        key = `${nameLower.replace('alolan ', '')}-alola`;
    } else if (nameLower.includes('galarian ')) {
        key = `${nameLower.replace('galarian ', '')}-galar`;
    } else if (nameLower.includes('hisuian ')) {
        key = `${nameLower.replace('hisuian ', '')}-hisui`;
    } else if (nameLower.includes('paldean ')) {
        key = `${nameLower.replace('paldean ', '')}-paldea`;
    } else if (nameLower.includes('white-striped ')) {
        key = `${nameLower.replace('white-striped ', '')}-white-striped`;
    }
    
    if (key) {
        key = key.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        return pokeApiIdMapping[key] || regionalFormPokeApiIds[key] || null;
    }
    return null;
}

function getMegaPokeApiIdFallback(key) {
    const fallbacks = {
        "venusaur-mega": "10033",
        "charizard-mega-x": "10034",
        "charizard-mega-y": "10035",
        "blastoise-mega": "10036",
        "alakazam-mega": "10037",
        "gengar-mega": "10038",
        "kangaskhan-mega": "10039",
        "pinsir-mega": "10040",
        "gyarados-mega": "10041",
        "aerodactyl-mega": "10042",
        "mewtwo-mega-x": "10043",
        "mewtwo-mega-y": "10044",
        "ampharos-mega": "10045",
        "steelix-mega": "10046",
        "scizor-mega": "10047",
        "heracross-mega": "10048",
        "houndoom-mega": "10049",
        "tyranitar-mega": "10050",
        "sceptile-mega": "10065",
        "blaziken-mega": "10066",
        "swampert-mega": "10067",
        "gardevoir-mega": "10068",
        "sableye-mega": "10069",
        "mawile-mega": "10070",
        "aggron-mega": "10071",
        "medicham-mega": "10072",
        "manectric-mega": "10073",
        "sharpedo-mega": "10074",
        "camerupt-mega": "10075",
        "altaria-mega": "10076",
        "banette-mega": "10077",
        "absol-mega": "10078",
        "glalie-mega": "10079",
        "salamence-mega": "10080",
        "metagross-mega": "10081",
        "latias-mega": "10082",
        "latios-mega": "10083",
        "rayquaza-mega": "10084",
        "garchomp-mega": "10085",
        "lucario-mega": "10086",
        "abomasnow-mega": "10087",
        "gallade-mega": "10091",
        "audino-mega": "10092",
        "diancie-mega": "10093",
        "beedrill-mega": "10100",
        "pidgeot-mega": "10101",
        "slowbro-mega": "10102",
        "kyogre-primal": "10088",
        "groudon-primal": "10089"
    };
    return fallbacks[key] || null;
}

function getPokemonImageUrl(name, matchedPoke) {
    if (!name) return matchedPoke ? matchedPoke.img : '';
    const nameLower = name.toLowerCase().trim();
    
    // Check special legend forms
    if (nameLower.includes('dawn wings') || nameLower.includes('dawn_wings')) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10156.png`;
    if (nameLower.includes('dusk mane') || nameLower.includes('dusk_mane')) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10155.png`;
    if (nameLower.includes('black kyurem') || nameLower.includes('kyurem black')) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10022.png`;
    if (nameLower.includes('white kyurem') || nameLower.includes('kyurem white')) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10023.png`;
    if (nameLower.includes('crowned sword') || nameLower.includes('zacian crowned')) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10188.png`;
    if (nameLower.includes('crowned shield') || nameLower.includes('zamazenta crowned')) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10189.png`;

    // Check if it's a regional form
    const rfId = getRegionalFormPokeApiId(name);
    if (rfId) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${rfId}.png`;
    }
    
    // Check if it's a Mega evolution
    if (nameLower.startsWith('mega ')) {
        const baseName = nameLower.replace('mega ', '').trim();
        let key = `${baseName}-mega`;
        if (nameLower.endsWith(' x')) {
            key = `${baseName.replace(' x', '')}-mega-x`;
        } else if (nameLower.endsWith(' y')) {
            key = `${baseName.replace(' y', '')}-mega-y`;
        }
        const mappedId = pokeApiIdMapping[key] || getMegaPokeApiIdFallback(key);
        if (mappedId) {
            return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${mappedId}.png`;
        }
    }

    // Check if it's Primal evolution
    if (nameLower.startsWith('primal ')) {
        const baseName = nameLower.replace('primal ', '').trim();
        let key = `${baseName}-primal`;
        const mappedId = pokeApiIdMapping[key] || getMegaPokeApiIdFallback(key);
        if (mappedId) {
            return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${mappedId}.png`;
        }
    }
    
    // Check if it has a specific form suffix (e.g. Origin, Altered, Therian, Incarnate)
    let formKey = nameLower;
    if (nameLower.includes('altered ')) {
        formKey = `${nameLower.replace('altered ', '')}-altered`;
    } else if (nameLower.includes('origin ')) {
        formKey = `${nameLower.replace('origin ', '')}-origin`;
    } else if (nameLower.includes('therian ')) {
        formKey = `${nameLower.replace('therian ', '')}-therian`;
    } else if (nameLower.includes('incarnate ')) {
        formKey = `${nameLower.replace('incarnate ', '')}-incarnate`;
    }
    
    if (formKey !== nameLower) {
        formKey = formKey.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        const mappedId = pokeApiIdMapping[formKey];
        if (mappedId) {
            return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${mappedId}.png`;
        }
    }

    if (matchedPoke) {
        return matchedPoke.img;
    }
    
    return '';
}


function getRegionalFormKey(rf) {
    if (!rf || !rf.formId) return '';
    const formId = rf.formId.toUpperCase();
    const parts = formId.split('_');
    if (parts.length < 2) return '';
    
    const species = parts[0].toLowerCase();
    const regionPart = parts.slice(1).join('_');
    
    let suffix = '';
    if (regionPart.includes('ALOLA')) {
        suffix = 'alola';
    } else if (regionPart.includes('GALAR')) {
        suffix = 'galar';
    } else if (regionPart.includes('HISUI')) {
        suffix = 'hisui';
    } else if (regionPart.includes('PALDEA')) {
        suffix = 'paldea';
    } else if (regionPart.includes('WHITE_STRIPED')) {
        suffix = 'white-striped';
    }
    
    if (suffix) {
        return `${species}-${suffix}`;
    }
    return '';
}

function getRegionalFormDisplayName(rf) {
    if (!rf || !rf.formId) return '';
    const formId = rf.formId.toUpperCase();
    const parts = formId.split('_');
    if (parts.length < 2) return rf.names.English;
    
    const regionPart = parts.slice(1).join('_');
    let prefix = '';
    if (regionPart.includes('ALOLA')) prefix = 'Alolan';
    else if (regionPart.includes('GALAR')) prefix = 'Galarian';
    else if (regionPart.includes('HISUI')) prefix = 'Hisuian';
    else if (regionPart.includes('PALDEA')) prefix = 'Paldean';
    else if (regionPart.includes('WHITE_STRIPED')) prefix = 'White-Striped';
    
    if (prefix) {
        if (rf.names.English.toLowerCase().startsWith(prefix.toLowerCase())) {
            return rf.names.English;
        }
        return `${prefix} ${rf.names.English}`;
    }
    return rf.names.English;
}
let caughtPokemon = new Set();
let transferredPokemon = new Set();

function isPokemonTransferred(poke) {
    if (!poke) return false;
    const strId = String(poke.id);
    const numId = Number(poke.id);
    if (transferredPokemon.has(strId) || (!isNaN(numId) && transferredPokemon.has(numId))) {
        return true;
    }
    if (typeof findEvolutionChain === 'function') {
        const chain = findEvolutionChain(poke);
        if (chain && chain.length > 0) {
            const baseId = chain[0].id;
            const strBaseId = String(baseId);
            const numBaseId = Number(baseId);
            if (transferredPokemon.has(strBaseId) || (!isNaN(numBaseId) && transferredPokemon.has(numBaseId))) {
                return true;
            }
        }
    }
    return false;
}

function isPokemonMissing(poke) {
    if (!poke) return false;
    const isCaught = caughtPokemon.has(poke.id) || caughtPokemon.has(Number(poke.id));
    const isTransf = isPokemonTransferred(poke);
    return !isCaught || isTransf;
}
let liveEggs = [];
let liveRaids = [];
let liveResearch = [];
let liveRocket = null;
let liveEvents = [];
let liveSpawns = [];
let currentSpawnFilter = 'all';
let currentSpawnSearch = '';
let currentEventTab = 'active';
let pokedexLimit = 60;
let currentRenderedIds = new Set();
const shinySparkleSvg = `
    <svg class="shiny-icon" viewBox="0 0 24 24" fill="currentColor" title="Shiny Available" style="position: absolute; top: 0.75rem; right: 0.75rem; width: 18px; height: 18px; color: #f5a623; filter: drop-shadow(0 0 4px rgba(245, 166, 35, 0.6)); z-index: 5;">
        <path d="M12 2l1.6 3.9 3.9 1.6-3.9 1.6-1.6 3.9-1.6-3.9-3.9-1.6 3.9-1.6zM6 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1zM18 13l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z"/>
    </svg>
`;
let typesDatabase = [];
let buddyDistances = {};
let userCandies = {};
let currentUser = null;
let currentTrainerUsername = null;
let userDocListenerUnsubscribe = null; // Firestore real-time listener cleanup handle
let currentGenFilter = 'all';
let currentSearchQuery = '';
let currentCollectionFilter = 'all'; // 'all' | 'missing' | 'caught'
let currentSortOrder = 'num-asc'; // 'num-asc' | 'num-desc' | 'name-asc'
let currentHuntMethod = 'all'; // 'all' | 'evolve' | 'wild' | 'egg' | 'raid' | 'special'
let activeModalPokemonId = null;

// DOM Elements
const pokedexGrid = document.getElementById('pokedex-grid');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const genTabsContainer = document.getElementById('gen-tabs');
const collectionFilterButtons = document.querySelectorAll('.radio-filters .filter-btn');

// Bulk Action Buttons
const catchAllBtn = document.getElementById('catch-all-btn');
const resetAllBtn = document.getElementById('reset-all-btn');

// Stats Dashboard Elements
const caughtCountEl = document.getElementById('caught-count');
const totalCountEl = document.getElementById('total-count');
const progressBarFill = document.getElementById('progress-bar');
const progressPctEl = document.getElementById('progress-pct');

// Region Stats Badge Elements
const activeRegionNameEl = document.getElementById('active-region-name');
const activeRegionRatioEl = document.getElementById('active-region-ratio');

// Missing Pokémon Hunt List Elements
const huntGrid = document.getElementById('hunt-grid');
const emptyHuntState = document.getElementById('empty-hunt-state');
const huntTabsContainer = document.getElementById('hunt-tabs');
const huntTabsScroll = document.getElementById('hunt-tabs-scroll');
const genTabsScroll = document.getElementById('gen-tabs-scroll');
const allCaughtBanner = document.getElementById('all-caught-banner');

// Modal Elements
const detailModal = document.getElementById('detail-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');

const modalHeaderBg = document.getElementById('modal-header-bg');
const modalPokeNum = document.getElementById('modal-pokemon-num');
const modalPokeName = document.getElementById('modal-pokemon-name');
const modalPokeTypes = document.getElementById('modal-pokemon-types');
const modalPokeImg = document.getElementById('modal-pokemon-img');
const modalTabButtons = document.querySelectorAll('.modal-tab-btn');
const modalPanes = document.querySelectorAll('.tab-pane');
const modalCatchToggle = document.getElementById('modal-catch-toggle');

// Helper to map Gen Number to Region Name
const regionNames = {
    1: "Kanto",
    2: "Johto",
    3: "Hoenn",
    4: "Sinnoh",
    5: "Unova",
    6: "Kalos",
    7: "Alola",
    8: "Galar",
    8.5: "Hisui",
    9: "Paldea",
    99: "Undiscovered"
};

// Permanent lists of special Pokémon GO categories
const babyPokemonIds = new Set([
    172, 173, 174, 175, 236, 238, 239, 240, 298, 360, 406, 433, 438, 439, 440, 446, 458, 848
]);

const regionalPokemon = {
    83: "East Asia", // Farfetch'd
    115: "Australia", // Kangaskhan
    122: "Europe", // Mr. Mime
    128: "North America", // Tauros
    214: "Latin America, South Florida & Texas", // Heracross
    222: "Tropical coasts", // Corsola
    313: "Europe, Asia & Australia", // Volbeat
    314: "Americas & Africa", // Illumise
    324: "South Asia", // Torkoal
    335: "Americas & Africa", // Zangoose
    336: "Europe, Asia & Australia", // Seviper
    337: "Americas & Africa", // Lunatone
    338: "Europe, Asia & Australia", // Solrock
    357: "Africa & Middle East", // Tropius
    369: "New Zealand & surrounding islands", // Relicanth
    417: "Northern regions (Canada, Alaska, Russia)", // Pachirisu
    441: "Southern Hemisphere", // Chatot
    455: "Southeast United States", // Carnivine
    480: "Asia-Pacific", // Uxie
    481: "Europe, Middle East, India & Africa", // Mesprit
    482: "Americas & Greenland", // Azelf
    511: "Europe, Middle East, India & Africa", // Pansage
    513: "Americas & Greenland", // Pansear
    515: "Asia-Pacific", // Panpour
    538: "North America & South America", // Throh
    539: "Europe, Asia, Australia & Africa", // Sawk
    556: "Central & South America, Southern US", // Maractus
    561: "Egypt & Greece", // Sigilyph
    626: "New York & surrounding areas", // Bouffalant
    664: "France", // Klefki
    707: "France", // Klefki (often shared region)
    741: "Americas & Greenland / Southern Hemisphere", // Oricorio forms
    764: "Hawaii", // Comfey
    781: "Mexico", // Hawlucha
    919: "Europe & Africa" // Charcadet / regionals (etc)
};

// Item ID name formatter
function formatItemName(itemId) {
    if (!itemId) return '';
    let id = '';
    if (typeof itemId === 'string') {
        id = itemId;
    } else if (itemId && typeof itemId === 'object' && itemId.id) {
        id = itemId.id;
    } else {
        return '';
    }
    return id
        .replace('ITEM_', '')
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Formats raw spawn/event names from the API (often ALL_CAPS or Title Case with form suffixes)
 * into readable display names.
 * Examples:
 *   "MEGA BLAZIKEN"       -> "Mega Blaziken"
 *   "GIRATINA ALTERED"   -> "Giratina (Altered)"
 *   "GIRATINA_ORIGIN"    -> "Giratina (Origin)"
 *   "Tapu Koko"           -> "Tapu Koko" (unchanged)
 */
function formatSpawnName(rawName) {
    if (!rawName) return '';
    // Replace underscores with spaces, then title-case each word
    let name = rawName.replace(/_/g, ' ').trim();

    // Known form suffixes that should appear in parentheses
    const formSuffixes = [
        'ALTERED', 'ORIGIN', 'ATTACK', 'DEFENSE', 'SPEED',
        'THERIAN', 'INCARNATE', 'LAND', 'SKY', 'ARIA', 'PIROUETTE',
        'BAILE', 'POM_POM', 'PA U', 'SENSU', 'MIDDAY', 'MIDNIGHT',
        'DUSK', 'DAWN WINGS', 'DUSK MANE', 'ULTRA', 'COMPLETE',
        'ORIGINAL', 'CROWNED', 'HANGRY', 'HERO', 'RAPID STRIKE',
        'SINGLE STRIKE', 'ICE RIDER', 'SHADOW RIDER', 'GLASTRIER',
        'SPECTRIER', 'ETERNAL', 'PRIMAL', 'ASH', 'GULPING', 'GORGING',
        'ICY SNOW', 'SANDY', 'TRASH', 'PLANT', 'SANDY CLOAK', 'TRASH CLOAK',
        'PLANT CLOAK', 'WEST', 'EAST', 'NORTH', 'SOUTH'
    ];

    // Check if the name ends with a form suffix (case-insensitive)
    const upperName = name.toUpperCase();
    let basePart = name;
    let formPart = '';
    for (const suffix of formSuffixes) {
        if (upperName.endsWith(' ' + suffix)) {
            basePart = name.slice(0, name.length - suffix.length - 1).trim();
            formPart = suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
            break;
        }
    }

    // Title-case the base part
    const titleCase = str => str.split(' ')
        .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')
        .join(' ');

    const displayBase = titleCase(basePart);
    return formPart ? `${displayBase} (${formPart})` : displayBase;
}

// Weather boost helper mapping
function getWeatherBoost(types) {
    if (types.includes("water") || types.includes("bug") || types.includes("electric")) return "Rainy";
    if (types.includes("grass") || types.includes("ground") || types.includes("fire")) return "Sunny";
    if (types.includes("steel") || types.includes("ice")) return "Snowy";
    if (types.includes("ghost") || types.includes("dark")) return "Foggy";
    if (types.includes("dragon") || types.includes("flying") || types.includes("psychic")) return "Windy";
    if (types.includes("normal") || types.includes("rock")) return "Partly Cloudy";
    if (types.includes("poison") || types.includes("fighting")) return "Cloudy";
    return "Partly Cloudy";
}

async function triggerBackgroundPokeApiFetch() {
    try {
        const pokeApiRes = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1500');
        if (pokeApiRes && pokeApiRes.ok) {
            const pokeApiData = await pokeApiRes.json();
            pokeApiData.results.forEach(item => {
                const name = item.name;
                const id = item.url.split('/').filter(Boolean).pop();
                pokeApiIdMapping[name] = id;
            });
        }
    } catch (err) {
        console.warn("Failed to fetch PokeAPI in background:", err);
    }
}

function findPokemonByName(name) {
    if (!name) return null;
    const nameLower = name.toLowerCase().trim();
    
    // 1. Direct match
    let found = pokemonDatabase.find(p => p.name && p.name.toLowerCase() === nameLower);
    if (found) return found;

    // 2. Clean name match (e.g. remove trailing numbers, text in parenthesis, Shadow/Regional prefixes)
    let cleanName = nameLower
        .replace(/^shadow\s+/g, '') // strip "Shadow " prefix
        .replace(/^(alolan|galarian|hisuian|paldean|white-striped)\s+/g, '') // strip regional prefixes
        .replace(/\s+\d+\b/g, '') // remove trailing numbers like " 2", " 3"
        .replace(/\s*\(.*\)/g, '') // remove parentheses like "(Form 2)", "(Mega Y)"
        .trim();
        
    found = pokemonDatabase.find(p => p.name && p.name.toLowerCase() === cleanName);
    if (found) return found;
    
    // 3. Prefix match: check if name starts with any pokemon name (e.g. "Spinda Pattern 3" starts with "Spinda")
    const sortedDb = [...pokemonDatabase].sort((a, b) => b.name.length - a.name.length);
    found = sortedDb.find(p => p.name && nameLower.replace(/^shadow\s+/g, '').startsWith(p.name.toLowerCase()));
    if (found) return found;

    // 4. Word boundary substring match (e.g. "World Championships 2026 Pikachu" contains "Pikachu")
    found = sortedDb.find(p => {
        if (!p.name || p.name.length < 3) return false;
        const pName = p.name.toLowerCase();
        const regex = new RegExp(`\\b${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(nameLower);
    });
    if (found) return found;

    return null;
}

function normalizeRocketLineups(rawRocket) {
    if (!rawRocket) return {};
    if (!Array.isArray(rawRocket)) {
        return typeof rawRocket === 'object' ? rawRocket : {};
    }
    const map = {};
    rawRocket.forEach(lineup => {
        let name = lineup.name || '';
        name = name.replace(/^Team GO Rocket (Leader|Boss)\s+/i, '').trim();

        const ensureArray = (val) => Array.isArray(val) ? val : (val ? [val] : []);

        let first = ensureArray(lineup.firstPokemon);
        let second = ensureArray(lineup.secondPokemon);
        let third = ensureArray(lineup.thirdPokemon);

        if (lineup.slots && Array.isArray(lineup.slots)) {
            lineup.slots.forEach(s => {
                if (s.slot === 1) first = ensureArray(s.pokemons);
                if (s.slot === 2) second = ensureArray(s.pokemons);
                if (s.slot === 3) third = ensureArray(s.pokemons);
            });
        }

        const slots = [1, 2, 3].map(slotNum => {
            const pokeArray = slotNum === 1 ? first : (slotNum === 2 ? second : third);
            const safeArray = ensureArray(pokeArray);
            const isSlotEnc = safeArray.some(p => p && (p.isEncounter === true || p.is_encounter === true));

            return {
                slot: slotNum,
                is_encounter: isSlotEnc,
                pokemons: safeArray.map(p => {
                    const obj = typeof p === 'object' ? { ...p } : { name: p };
                    obj.isEncounter = obj.isEncounter === true || obj.is_encounter === true;
                    return obj;
                })
            };
        });

        map[name] = slots;
    });
    return map;
}

async function loadScrapedDataFromFirestore() {
    const api_key = "AIzaSyAHsUktWNFdK8IiOYSAchnFxR-pqVQZJbU";
    const project_id = "pogo-website-14a46";

    try {
        const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${api_key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'scraper@pogowebsite.local', password: 'ScraperPassword123!', returnSecureToken: true })
        });
        if (!authRes.ok) throw new Error('Database auth failed');
        const authData = await authRes.json();
        const headers = { 'Authorization': `Bearer ${authData.idToken}` };

        const baseModules = ['events', 'raids', 'research', 'eggs', 'rocketLineups', 'promoCodes', 'partyChallenges', 'buddyDistances', 'types', 'spawns'];
        const pokedexParts = Array.from({ length: 11 }, (_, i) => `pokedex_part${i + 1}`);
        const modules = [...baseModules, ...pokedexParts];

        const fetchPromises = modules.map(m => 
            fetch(`https://firestore.googleapis.com/v1/projects/${project_id}/databases/(default)/documents/scraped_data/${m}`, { headers })
                .then(r => r.ok ? r.json() : null)
                .catch(err => {
                    if (window.sendNtfyNotification) window.sendNtfyNotification(`Erro ao carregar documento ${m} do Firestore: ${err}`);
                    return null;
                })
        );

        const results = await Promise.all(fetchPromises);
        const parsed = {};
        let assembledPokedex = [];

        modules.forEach((mod, idx) => {
            const doc = results[idx];
            const fields = doc ? doc.fields : null;
            if (fields) {
                let modContent = null;
                if (fields.data?.stringValue) {
                    try { modContent = JSON.parse(fields.data.stringValue); } catch (e) {}
                } else if (fields[mod]?.stringValue) {
                    try { modContent = JSON.parse(fields[mod].stringValue); } catch (e) {}
                }

                if (mod.startsWith('pokedex_part')) {
                    if (Array.isArray(modContent)) {
                        assembledPokedex.push(...modContent);
                    }
                } else {
                    parsed[mod] = modContent;
                }
                if (fields.updatedAt?.stringValue) parsed.updatedAt = fields.updatedAt.stringValue;
            }
        });

        if (assembledPokedex.length > 0) {
            parsed.pokedex = assembledPokedex;
        }

        return parsed;
    } catch (err) {
        if (window.sendNtfyNotification) window.sendNtfyNotification(`Erro crítico de autenticação Firestore: ${err}`);
        console.warn("Could not fetch scraped data from Firestore database, falling back to network endpoints:", err);
        return null;
    }
}

let cachedLastUpdatedFormattedDate = '';

function displayLastUpdatedTime(isoString) {
    try {
        if (isoString) {
            const date = new Date(isoString);
            if (!isNaN(date.getTime())) {
                const options = {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                };
                cachedLastUpdatedFormattedDate = date.toLocaleDateString('en-US', options);
            }
        }

        if (!cachedLastUpdatedFormattedDate) return;

        const badgeEls = document.querySelectorAll('.last-updated-badge');
        const textEls = document.querySelectorAll('.last-updated-text');

        badgeEls.forEach(el => el.style.display = 'inline-flex');
        textEls.forEach(el => el.textContent = `Last Updated: ${cachedLastUpdatedFormattedDate}`);
    } catch (e) {
        console.warn("Could not display last updated date:", e);
    }
}

async function loadPokedex() {
    const loaderOverlay = document.getElementById('loader-overlay');
    const errorOverlay = document.getElementById('error-overlay');
    
    // Show loading spinner
    loaderOverlay.classList.remove('fade-out', 'hidden');
    errorOverlay.classList.add('hidden');
    
    try {
        let rawEggs = {};
        let rawRaids = {};
        let rawResearch = {};
        let rawEvents = {};

        // Fetch scraped data directly from Firebase Firestore (scraped_data collection)
        const dbScrapedData = await loadScrapedDataFromFirestore();

        const isNonEmpty = (val) => {
            if (!val) return false;
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'object') return Object.keys(val).length > 0;
            return true;
        };

        let data = null;

        let rawSpawns = null;

        if (!dbScrapedData) {
            if (window.sendNtfyNotification) window.sendNtfyNotification("Erro crítico: Falha ao carregar base de dados Firestore");
            throw new Error("Could not connect to Firebase Firestore database. All external API fallbacks are disabled.");
        }

        if (isNonEmpty(dbScrapedData.eggs)) rawEggs = dbScrapedData.eggs;
        if (isNonEmpty(dbScrapedData.raids)) rawRaids = dbScrapedData.raids;
        if (isNonEmpty(dbScrapedData.research)) rawResearch = dbScrapedData.research;
        if (isNonEmpty(dbScrapedData.rocketLineups)) liveRocket = normalizeRocketLineups(dbScrapedData.rocketLineups);
        if (isNonEmpty(dbScrapedData.promoCodes)) rawPromoCodes = dbScrapedData.promoCodes;
        if (isNonEmpty(dbScrapedData.events)) rawEvents = dbScrapedData.events;
        if (isNonEmpty(dbScrapedData.partyChallenges)) partyRewardsData = dbScrapedData.partyChallenges;
        if (isNonEmpty(dbScrapedData.buddyDistances)) buddyDistances = dbScrapedData.buddyDistances;
        if (isNonEmpty(dbScrapedData.types)) typesDatabase = dbScrapedData.types;
        if (isNonEmpty(dbScrapedData.spawns)) rawSpawns = dbScrapedData.spawns;
        if (isNonEmpty(dbScrapedData.pokedex)) {
            data = dbScrapedData.pokedex;
            rawPokedexData = data;
        }
        if (dbScrapedData.updatedAt) displayLastUpdatedTime(dbScrapedData.updatedAt);

        if (!data) {
            if (window.sendNtfyNotification) window.sendNtfyNotification("Erro crítico: Dados da Pokédex em falta no Firestore");
            throw new Error("Pokédex data is missing or empty in Firebase Firestore database.");
        }
        
        const processed = [];
        const seenDexNrs = new Set();
        
        // Pass 1: Parse primary base forms
        data.forEach(p => {
            if (p.id === p.formId && !seenDexNrs.has(p.dexNr)) {
                seenDexNrs.add(p.dexNr);
                processed.push(formatPokemon(p));
            }
        });
        
        // Pass 2: Grab base forms normal forms
        data.forEach(p => {
            if (!seenDexNrs.has(p.dexNr)) {
                const hasNoFormSuffix = !p.formId.includes('_');
                if (hasNoFormSuffix || p.formId.endsWith('_NORMAL')) {
                    seenDexNrs.add(p.dexNr);
                    processed.push(formatPokemon(p));
                }
            }
        });

        // Pass 3: Fallback for any other missing entries
        data.forEach(p => {
            if (!seenDexNrs.has(p.dexNr)) {
                seenDexNrs.add(p.dexNr);
                processed.push(formatPokemon(p));
            }
        });

        // Inject missing Basculegion (902) since it's not present in the upstream Pokémon GO API
        if (!seenDexNrs.has(902)) {
            seenDexNrs.add(902);
            processed.push({
                id: "902",
                idName: "BASCULEGION",
                num: "902",
                name: "Basculegion",
                gen: 8.5,
                types: ["water", "ghost"],
                img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/902.png`,
                stats: {
                    atk: 247,
                    def: 146,
                    sta: 260
                },
                obtaining: [
                    { method: "Evolution", desc: "Evolves from White-Striped Basculin." }
                ],
                rawEvolutions: []
            });
        }

        processed.sort((a, b) => Number(a.id) - Number(b.id));
        pokemonDatabase = processed;

        const basculin = processed.find(p => p.id === "550");
        if (basculin) {
            if (!basculin.rawEvolutions) {
                basculin.rawEvolutions = [];
            }
            if (!basculin.rawEvolutions.some(e => e.id === "BASCULEGION")) {
                basculin.rawEvolutions.push({
                    id: "BASCULEGION",
                    formId: "BASCULEGION",
                    candies: 50
                });
            }
        }

        // 1. Parse Egg Pool from ScrapedDuck (flat array format)
        liveEggs = [];
        if (Array.isArray(rawEggs)) {
            rawEggs.forEach(egg => {
                const matchedPoke = findPokemonByName(egg.name);
                const dexNr = matchedPoke ? matchedPoke.id : null;
                if (dexNr) {
                    // eggType: "1 km", "2 km", "5 km", "7 km", "10 km", "12 km"
                    let eggT = "5km";
                    const eggTypeLower = (egg.eggType || '').toLowerCase();
                    if (eggTypeLower.includes("12")) eggT = "12km";
                    else if (eggTypeLower.includes("10")) {
                        eggT = egg.isAdventureSync ? "adventure10km" : "10km";
                    }
                    else if (eggTypeLower.includes("7")) eggT = "7km";
                    else if (eggTypeLower.includes("5")) {
                        eggT = egg.isAdventureSync ? "adventure5km" : "5km";
                    }
                    else if (eggTypeLower.includes("2")) eggT = "2km";
                    else if (eggTypeLower.includes("1")) eggT = "1km";
                    if (egg.isGiftExchange) eggT = "route"; // Route Gift eggs shown as 7km

                    liveEggs.push({
                        dex: Number(dexNr),
                        name: egg.name,
                        eggT: eggT,
                        shiny: egg.canBeShiny || false,
                        cp: egg.combatPower || null,
                        rarity: egg.rarity || null
                    });
                }
            });
        }

        // 2. Parse Raid Bosses from ScrapedDuck array or pokemon-go-api (grouped currentList format)
        liveRaids = [];
        if (Array.isArray(rawRaids)) {
            rawRaids.forEach(boss => {
                const matchedPoke = findPokemonByName(boss.name);
                let tier = boss.tier || '5-Star Raids';
                const isShadow = safeLower(boss.name).startsWith('shadow') || safeLower(tier).includes('shadow');
                if (isShadow && !tier.startsWith('Shadow')) {
                    tier = 'Shadow ' + tier;
                }
                liveRaids.push({
                    idName: matchedPoke ? matchedPoke.idName : boss.name,
                    name: boss.name,
                    tier: tier,
                    image: boss.image || '',
                    cp: boss.combatPower || null,
                    shiny: boss.canBeShiny || false,
                    types: boss.types || [],
                    weatherBoosts: boss.boostedWeather || [],
                    counters: {},
                    battleResult: null
                });
            });
        } else if (rawRaids && rawRaids.currentList) {
            const tierMapping = {
                'mega': 'Mega Raids',
                'lvl5': '5-Star Raids',
                'shadow_lvl5': 'Shadow 5-Star Raids',
                'lvl3': '3-Star Raids',
                'shadow_lvl3': 'Shadow 3-Star Raids',
                'lvl1': '1-Star Raids',
                'shadow_lvl1': 'Shadow 1-Star Raids'
            };
            for (const [key, list] of Object.entries(rawRaids.currentList)) {
                if (Array.isArray(list)) {
                    list.forEach(boss => {
                        const englishName = boss.names && boss.names.English ? boss.names.English : boss.id;
                        let finalName = englishName;
                        if (boss.level && boss.level.startsWith('shadow_') && !englishName.startsWith('Shadow ')) {
                            finalName = 'Shadow ' + englishName;
                        }
                        const matchedPoke = findPokemonByName(finalName);
                        
                        const normalMax = boss.cpRange && boss.cpRange[1] ? boss.cpRange[1] : null;
                        const boostedMax = boss.cpRangeBoost && boss.cpRangeBoost[1] ? boss.cpRangeBoost[1] : null;
                        
                        liveRaids.push({
                            idName: matchedPoke ? matchedPoke.idName : finalName,
                            name: finalName,
                            tier: tierMapping[key] || key,
                            image: boss.assets ? (boss.assets.image || '') : '',
                            cp: {
                                normal: normalMax ? { max: normalMax } : null,
                                boosted: boostedMax ? { max: boostedMax } : null
                            },
                            shiny: boss.shiny || false,
                            types: boss.types || [],
                            weatherBoosts: boss.weather || [],
                            counters: boss.counter || {},
                            battleResult: boss.battleResult || null
                        });
                    });
                }
            }
        }

        // 3. Parse Field Research from ScrapedDuck
        liveResearch = [];
        if (Array.isArray(rawResearch)) {
            rawResearch.forEach(t => {
                const taskText = (t.task || t.text || t.title || '').replace(/<[^>]+>/g, '').trim();
                if (t.rewards && Array.isArray(t.rewards)) {
                    const rewardList = [];
                    t.rewards.forEach(r => {
                        const pokeName = r.name || r.pokemon || '';
                        const matchedPoke = findPokemonByName(pokeName);
                        const dex = matchedPoke ? matchedPoke.id : (r.dex || null);
                        rewardList.push({
                            type: 'encounter',
                            name: pokeName,
                            dex: dex,
                            image: r.image || r.img || null,
                            shiny: r.canBeShiny || r.shiny || false,
                            min_cp: r.min_cp || (r.combatPower ? r.combatPower.min : null),
                            max_cp: r.max_cp || (r.combatPower ? r.combatPower.max : null),
                            cp: r.combatPower ? { max: r.combatPower.max, min: r.combatPower.min } : (r.cp ? { max: r.cp } : null)
                        });
                    });
                    if (rewardList.length > 0) {
                        liveResearch.push({ text: taskText, rewards: rewardList });
                    }
                } else if (t.reward || t.name) {
                    const pokeName = (t.reward || t.name || '').replace(/<[^>]+>/g, '').trim();
                    const matchedPoke = findPokemonByName(pokeName);
                    const dex = matchedPoke ? matchedPoke.id : null;
                    liveResearch.push({
                        text: taskText,
                        rewards: [{
                            type: 'encounter',
                            name: pokeName,
                            dex: dex,
                            image: t.img || t.image || null,
                            shiny: t.shiny || t.canBeShiny || false,
                            cp: t.cp || null
                        }]
                    });
                }
            });
        }

        // 4. Parse Events from ScrapedDuck (flat array format with deduplication)
        liveEvents = [];
        const seenEventKeys = new Set();
        if (Array.isArray(rawEvents)) {
            rawEvents.forEach(ev => {
                const eventKey = ev.eventID || ev.link || ev.url || ev.title || ev.name;
                if (!eventKey || seenEventKeys.has(eventKey)) return;
                seenEventKeys.add(eventKey);

                const rawImg = ev.image || ev.banner || '';
                const hdBanner = rawImg.replace(/\/cdn-cgi\/image\/[^\/]+\//, '/');
                liveEvents.push({
                    title: ev.name || ev.title || '',
                    category: ev.heading || ev.eventType || ev.category || 'Event',
                    banner: hdBanner,
                    url: ev.link || ev.url || '',
                    start: ev.start,
                    end: ev.end,
                    desc: ev.heading || ev.description || '',
                    details: ev.extraData || null
                });
            });
        }
        liveEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

        // 5. Parse Wild Spawns strictly from Firestore database
        liveSpawns = [];
        if (rawSpawns) {
            let items = [];
            if (Array.isArray(rawSpawns.result)) {
                items = rawSpawns.result;
            } else if (Array.isArray(rawSpawns)) {
                items = rawSpawns;
            }

            items.forEach(item => {
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const dexNr = item.dexNr;
                    const internalFormId = item.internalFormId;
                    const spawnRate = parseFloat(item.spawnRate) || 0;
                    const canBeShiny = Boolean(item.canBeShiny);
                    
                    const matchedPoke = pokemonDatabase.find(p => Number(p.id) === Number(dexNr));
                    liveSpawns.push({
                        dexNr: dexNr,
                        internalFormId: internalFormId,
                        spawnRate: spawnRate,
                        shiny: canBeShiny,
                        pokemon: matchedPoke || null,
                        name: matchedPoke ? matchedPoke.name : `Pokémon #${dexNr}`
                    });
                } else if (Array.isArray(item) && item.length >= 4) {
                    const dexNr = item[0];
                    const internalFormId = item[1];
                    const spawnRate = parseFloat(item[2]) || 0;
                    const canBeShiny = Boolean(item[3]);
                    
                    const matchedPoke = pokemonDatabase.find(p => Number(p.id) === Number(dexNr));
                    liveSpawns.push({
                        dexNr: dexNr,
                        internalFormId: internalFormId,
                        spawnRate: spawnRate,
                        shiny: canBeShiny,
                        pokemon: matchedPoke || null,
                        name: matchedPoke ? matchedPoke.name : `Pokémon #${dexNr}`
                    });
                }
            });
            liveSpawns.sort((a, b) => b.spawnRate - a.spawnRate);
        }

        filterObtainingMethods();
        migrateCaughtState();
        buildStaticEvolutionMaps();
        
        generateGenTabs();
        renderPokedex(true);
        renderMissingSummary();
        updateDashboardStats();
        updateRegionStatsBadge();
        renderWildSpawns();
        
        // Double requestAnimationFrame (standard technique to guarantee DOM is rendered & painted)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Introduce a tiny delay so GPU finishes painting completely
                setTimeout(() => {
                    loaderOverlay.classList.add('fade-out');
                    setTimeout(() => {
                        loaderOverlay.classList.add('hidden');
                        
                        // Once loader is completely gone, render the rest of the Pokedex smoothly without clearing existing items
                        pokedexLimit = Infinity;
                        renderPokedex(false);
                    }, 550);
                    
                    // Fetch heavy PokeAPI mappings in the background during idle time
                    triggerBackgroundPokeApiFetch();
                }, 150);
            });
        });
        errorOverlay.classList.add('hidden');
    } catch (e) {
        console.error("API loading failed:", e);
        const errorMsgEl = document.getElementById('error-overlay-msg') || document.createElement('p');
        errorMsgEl.id = 'error-overlay-msg';
        errorMsgEl.style.color = '#ef4444';
        errorMsgEl.style.marginTop = '1rem';
        errorMsgEl.innerHTML = `<strong>Error details:</strong> ${e.message}<br><pre style="text-align:left; font-size:0.75rem; max-height:200px; overflow:auto; background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">${e.stack}</pre>`;
        const errOverlay = document.getElementById('error-overlay');
        if (errOverlay && !document.getElementById('error-overlay-msg')) {
            errOverlay.appendChild(errorMsgEl);
        }

        pokemonDatabase = [];
        
        // Show error overlay, hide loader overlay
        loaderOverlay.classList.add('hidden');
        errorOverlay.classList.remove('hidden');
        
        // Update stats to 0 since nothing is loaded
        updateDashboardStats();
        updateRegionStatsBadge();
    }
}

function formatPokemon(p) {
    const idStr = String(p.dexNr).padStart(3, '0');
    const types = [
        p.primaryType ? p.primaryType.names.English.toLowerCase() : 'normal',
        p.secondaryType ? p.secondaryType.names.English.toLowerCase() : null
    ].filter(Boolean);

    const obtaining = generateObtainingMethods(p, types);

    let gen = p.generation || 1;
    if (p.dexNr >= 899 && p.dexNr <= 905) {
        gen = 8.5;
    }
    // Meltan and Melmetal override
    else if (p.dexNr === 808 || p.dexNr === 809) {
        gen = 99;
    }

    return {
        id: String(p.dexNr),
        idName: p.formId || p.id,
        num: idStr,
        name: p.names.English,
        gen: gen,
        types: types,
        img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.dexNr}.png`,
        stats: {
            atk: p.stats ? p.stats.attack : 100,
            def: p.stats ? p.stats.defense : 100,
            sta: p.stats ? p.stats.stamina : 100
        },
        obtaining: obtaining,
        rawEvolutions: p.evolutions || []
    };
}

// Procedural, highly-accurate obtaining parser reflecting real Pokemon GO mechanics
function generateObtainingMethods(p, types) {
    const list = [];
    const isLegendary = p.pokemonClass === "POKEMON_CLASS_LEGENDARY";
    const isMythic = p.pokemonClass === "POKEMON_CLASS_MYTHIC";
    const isBaby = babyPokemonIds.has(p.dexNr);
    const isRegional = regionalPokemon[p.dexNr];

    // Meltan / Melmetal specific overrides
    if (p.dexNr === 808) {
        list.push({ method: "Mystery Box", desc: "Obtained by transferring a Pokémon to Pokémon HOME or Pokémon Let's Go Pikachu/Eevee to open the Mystery Box, spawning Meltan for 60 minutes." });
        return list;
    } else if (p.dexNr === 809) {
        list.push({ method: "Evolution", desc: "Evolves exclusively from Meltan by collecting 400 Meltan Candies." });
        return list;
    }

    // 1. Check live egg hatches pool from API
    const eggMatches = liveEggs.filter(e => e.dex === p.dexNr);
    eggMatches.forEach(egg => {
        list.push({ 
            method: "Eggs", 
            desc: `Hatchable from a ${egg.eggT || 'standard'} Egg. (Max Hatch CP: ${egg.cp && egg.cp.max ? egg.cp.max : 'N/A'})` 
        });
    });

    // 2. Check live raid bosses pool from API
    const raidMatches = liveRaids.filter(r => r.idName && p.id && r.idName.toLowerCase() === p.id.toLowerCase());
    raidMatches.forEach(raid => {
        list.push({ 
            method: "Raids", 
            desc: `Currently available as a boss in ${raid.tier || 'Raid Battles'}.` 
        });
    });

    // 3. Check live field research reward encounters from API
    const researchTasks = [];
    liveResearch.forEach(task => {
        if (task.rewards) {
            task.rewards.forEach(reward => {
                if (reward.type === 'encounter' && reward.dex === p.dexNr) {
                    researchTasks.push(task.text);
                }
            });
        }
    });
    if (researchTasks.length > 0) {
        list.push({
            method: "Field Research",
            desc: `Obtain as a reward encounter by completing the task: "${researchTasks[0]}"`
        });
    }

    // 4. Regional Lock info
    if (isRegional) {
        list.push({ 
            method: "Regional Lock", 
            desc: `Geographically restricted. Only spawns in the wild within: ${isRegional}.` 
        });
    }
    return list;
}

// Generate simple region tabs with caught stats
function generateGenTabs() {
    if (!pokemonDatabase || pokemonDatabase.length === 0) return;
    const gens = Array.from(new Set(pokemonDatabase.map(p => p.gen))).sort((a, b) => a - b);
    
    genTabsContainer.innerHTML = '';
    
    // All Regions count
    const allTotal = pokemonDatabase.length;
    const allCaught = pokemonDatabase.filter(p => caughtPokemon.has(p.id) || caughtPokemon.has(Number(p.id))).length;
    
    const allBtn = document.createElement('button');
    allBtn.className = `tab-btn ${currentGenFilter === 'all' ? 'active' : ''}`;
    allBtn.dataset.gen = 'all';
    allBtn.innerHTML = `<span class="tab-label">All Regions</span><span class="tab-count">${allCaught}/${allTotal}</span>`;
    genTabsContainer.appendChild(allBtn);
    
    gens.forEach(g => {
        const genNum = parseFloat(g);
        const total = pokemonDatabase.filter(p => p.gen === genNum).length;
        const caught = pokemonDatabase.filter(p => p.gen === genNum && (caughtPokemon.has(p.id) || caughtPokemon.has(Number(p.id)))).length;
        
        const btn = document.createElement('button');
        btn.className = `tab-btn ${String(currentGenFilter) === String(g) ? 'active' : ''}`;
        btn.dataset.gen = g;
        const name = regionNames[g] || `Gen ${g}`;
        btn.innerHTML = `<span class="tab-label">${name}</span><span class="tab-count">${caught}/${total}</span>`;
        genTabsContainer.appendChild(btn);
    });
}

function updateRegionStatsBadge() {
    // Keep tab statistics synchronized whenever badge updates
    generateGenTabs();
    
    let total = 0;
    let caught = 0;
    let name = "All Regions";
    
    if (currentGenFilter === 'all') {
        total = pokemonDatabase.length;
        caught = pokemonDatabase.filter(p => caughtPokemon.has(p.id) || caughtPokemon.has(Number(p.id))).length;
    } else {
        const genNum = parseFloat(currentGenFilter);
        total = pokemonDatabase.filter(p => p.gen === genNum).length;
        caught = pokemonDatabase.filter(p => p.gen === genNum && (caughtPokemon.has(p.id) || caughtPokemon.has(Number(p.id)))).length;
        name = regionNames[genNum] || `Gen ${genNum}`;
    }
    
    const pct = total > 0 ? Math.round((caught / total) * 100) : 0;
    
    activeRegionNameEl.textContent = name;
    activeRegionRatioEl.textContent = `${caught} / ${total} (${pct}%)`;
}

// ==========================================================================
// STATE MANAGEMENT & LOCAL STORAGE
// ==========================================================================
function loadCaughtState() {
    try {
        const stored = localStorage.getItem('pogo_caught_pokemon');
        if (stored) {
            const parsed = JSON.parse(stored);
            caughtPokemon = new Set(parsed);
        }
    } catch (e) {
        console.error("Failed to load caught state:", e);
        caughtPokemon = new Set();
    }
}

function loadTransferredState() {
    try {
        const stored = localStorage.getItem('pogo_transferred_pokemon');
        if (stored) {
            const parsed = JSON.parse(stored);
            transferredPokemon = new Set(parsed);
        }
    } catch (e) {
        console.error("Failed to load transferred state:", e);
        transferredPokemon = new Set();
    }
}

function saveTransferredState() {
    localStorage.setItem('pogo_transferred_pokemon', JSON.stringify(Array.from(transferredPokemon).map(x => (isNaN(Number(x)) ? x : Number(x)))));
    if (currentUser) {
        saveUserDataToFirestore();
    }
}

function migrateCaughtState() {
    if (!pokemonDatabase || pokemonDatabase.length === 0) return;
    
    const migrated = new Set();
    caughtPokemon.forEach(item => {
        const num = Number(item);
        if (!isNaN(num)) {
            migrated.add(num);
        } else if (typeof item === 'string') {
            const found = pokemonDatabase.find(p => 
                (p.idName && p.idName.toLowerCase() === item.toLowerCase()) || 
                (p.name && p.name.toLowerCase() === item.toLowerCase())
            );
            if (found) {
                migrated.add(found.id);
            }
        }
    });
    
    caughtPokemon = migrated;
    localStorage.setItem('pogo_caught_pokemon', JSON.stringify(Array.from(caughtPokemon)));
}

function filterObtainingMethods() {
    if (!pokemonDatabase || pokemonDatabase.length === 0) return;
    
    pokemonDatabase.forEach(poke => {
        const chain = findEvolutionChain(poke);
        const indexInChain = chain.findIndex(p => p.id === poke.id);
        if (indexInChain > 0) {
            // Remove "Eggs" or "Egg Hatch Only" from evolved stages' methods
            poke.obtaining = (poke.obtaining || []).filter(o => 
                o.method && !o.method.toLowerCase().includes("egg")
            );
        }
    });
}

function saveCaughtState() {
    localStorage.setItem('pogo_caught_pokemon', JSON.stringify(Array.from(caughtPokemon)));
    updateDashboardStats();
    updateRegionStatsBadge();
    if (currentUser) {
        saveUserDataToFirestore();
    }
}

function syncPokemonCaughtStateUI(id, isNowCaught = null) {
    const strId = String(id);
    const numId = Number(id);
    const isCaught = caughtPokemon.has(strId) || (!isNaN(numId) && caughtPokemon.has(numId));

    // 1. Update the Pokedex Grid Card if it exists
    const pokedexCard = pokedexGrid.querySelector(`.pokemon-card[data-id="${id}"]`);
    if (pokedexCard) {
        if (currentCollectionFilter === 'caught' && !isCaught) {
            pokedexCard.remove();
            if (pokedexGrid.querySelectorAll('.pokemon-card').length === 0) {
                emptyState.classList.remove('hidden');
                pokedexGrid.classList.add('hidden');
            }
        } else if (currentCollectionFilter === 'missing' && isCaught) {
            pokedexCard.remove();
            if (pokedexGrid.querySelectorAll('.pokemon-card').length === 0) {
                emptyState.classList.remove('hidden');
                pokedexGrid.classList.add('hidden');
            }
        } else {
            pokedexCard.className = isCaught ? 'pokemon-card caught' : 'pokemon-card missing';
            
            // Add temporary 3D animation class
            if (isNowCaught !== null && !isNowCaught) {
                const animClass = 'remove-card-fade';
                pokedexCard.classList.add(animClass);
                setTimeout(() => {
                    pokedexCard.classList.remove(animClass);
                }, 420);
            }
            
            const svgBall = pokedexCard.querySelector('.pokeball-svg');
            if (svgBall) {
                svgBall.innerHTML = `
                    <circle cx="50" cy="50" r="44" fill="${isCaught ? '#ef4444' : 'transparent'}" stroke="${isCaught ? '#ffffff' : 'currentColor'}" stroke-width="8"/>
                    <path d="M6 50 H94" stroke="${isCaught ? '#ffffff' : 'currentColor'}" stroke-width="8"/>
                    <circle cx="50" cy="50" r="18" fill="${isCaught ? '#ffffff' : '#111b2e'}" stroke="${isCaught ? '#ffffff' : 'currentColor'}" stroke-width="8"/>
                    <circle cx="50" cy="50" r="8" fill="${isCaught ? '#ef4444' : '#64748b'}"/>
                `;
            }
            
            const catchBtn = pokedexCard.querySelector('.catch-indicator-btn');
            if (catchBtn) {
                catchBtn.title = isCaught ? 'Remove from Collection' : 'Mark as Caught';
            }
        }
    }

    // 2. Update the Hunt Grid Card if it exists
    if (huntGrid) {
        const huntCard = huntGrid.querySelector(`.pokemon-card[data-id="${id}"]`);
        if (isCaught) {
            if (huntCard) {
                huntCard.remove();
                if (huntGrid.querySelectorAll('.pokemon-card').length === 0) {
                    huntGrid.classList.add('hidden');
                    emptyHuntState.classList.remove('hidden');
                }
            }
        } else {
            if (!huntCard) {
                renderMissingSummary();
            }
        }
    }
}

function toggleCaughtState(id, eventSource = null) {
    const strId = String(id);
    const numId = Number(id);
    const isNowCaught = !(caughtPokemon.has(strId) || (!isNaN(numId) && caughtPokemon.has(numId)));
    
    if (caughtPokemon.has(strId) || (!isNaN(numId) && caughtPokemon.has(numId))) {
        caughtPokemon.delete(strId);
        if (!isNaN(numId)) caughtPokemon.delete(numId);
        transferredPokemon.delete(strId);
        if (!isNaN(numId)) transferredPokemon.delete(numId);
    } else {
        caughtPokemon.add(strId);
        transferredPokemon.delete(strId);
        if (!isNaN(numId)) transferredPokemon.delete(numId);
        if (eventSource) {
            triggerPremiumParticleBurst(eventSource, true);
        }
    }
    saveCaughtState();
    saveTransferredState();
    syncPokemonCaughtStateUI(id, isNowCaught);
}

// Particle Burst System (WOW Celebration or Fade effect)
function triggerPremiumParticleBurst(element, isCaught) {
    if (!isCaught) return; // No particles on removal

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + window.scrollX;
    const y = rect.top + rect.height / 2 + window.scrollY;
    
    const colors = ['#fcd34d', '#f5a623', '#10b981', '#3b82f6', '#ec4899', '#a78bfa', '#ef4444', '#ffffff']; 
    const particleCount = 24; // Festive confetti count
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle-burst';
        
        // Full radial explosion
        const angle = Math.random() * Math.PI * 2;
        const velocity = 35 + Math.random() * 65;
        
        let tx = Math.cos(angle) * velocity;
        let ty = Math.sin(angle) * velocity;
        
        const size = 6 + Math.random() * 8;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Star shapes or glowing circles
        if (Math.random() > 0.6) {
            particle.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        } else {
            particle.style.borderRadius = '50%';
        }
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.background = color;
        particle.style.boxShadow = `0 0 8px ${color}, 0 0 2px #fff`;
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        document.body.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 800);
    }
}

function updateDashboardStats() {
    const total = pokemonDatabase.length;
    const caught = pokemonDatabase.filter(p => caughtPokemon.has(p.id) || caughtPokemon.has(Number(p.id))).length;
    const pct = total > 0 ? Math.round((caught / total) * 100) : 0;
    
    caughtCountEl.textContent = caught;
    totalCountEl.textContent = total;
    progressBarFill.style.width = `${pct}%`;
    progressPctEl.textContent = `${pct}% Completed`;
    
    // Update To-Do and Candies pane targets dynamically
    if (typeof renderToDoPane === 'function') {
        renderToDoPane();
    }
    if (typeof renderCandiesPane === 'function') {
        renderCandiesPane();
    }
    if (typeof renderAttackersPane === 'function') {
        renderAttackersPane();
    }
}

// ==========================================================================
// EVENT LISTENERS & FILTERING
// ==========================================================================
function switchToPane(paneId) {
    const viewButtons = document.querySelectorAll('.view-switch-container .view-btn');
    viewButtons.forEach(btn => {
        if (btn.dataset.view === paneId) {
            btn.classList.add('active');
            btn.click();
        }
    });
}

function setupEventListeners() {
    const viewButtons = document.querySelectorAll('.view-switch-container .view-btn');
    const viewPanes = document.querySelectorAll('.view-pane');
    
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPaneId = btn.dataset.view;
            const activePane = Array.from(viewPanes).find(pane => !pane.classList.contains('hidden'));
            
            // If we click the already active tab, do nothing
            if (activePane && activePane.id === targetPaneId) return;

            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            viewPanes.forEach(pane => {
                if (pane.id === targetPaneId) {
                    pane.classList.remove('hidden');
                    pane.classList.add('pane-active-fade');
                } else {
                    pane.classList.add('hidden');
                    pane.classList.remove('pane-active-fade');
                }
            });
            
            if (targetPaneId === 'rotations-pane') {
                document.querySelector('.search-wrapper').classList.add('hidden');
                document.querySelector('.radio-filters').classList.add('hidden');
                document.querySelector('.bulk-actions').classList.add('hidden');
                document.querySelector('.sort-wrapper').classList.add('hidden');
                document.getElementById('region-stats-badge').classList.add('hidden');
                genTabsScroll.classList.add('hidden');
                if (huntTabsScroll) huntTabsScroll.classList.add('hidden');
                
                // Show the active rotations category section
                const activeSubnavBtn = document.querySelector('#rotations-subnav .subnav-btn.active') || document.querySelector('#rotations-subnav .subnav-btn');
                if (activeSubnavBtn) {
                    activeSubnavBtn.click();
                } else {
                    renderActiveRotations();
                }
            } else if (targetPaneId === 'candies-pane') {
                document.querySelector('.search-wrapper').classList.remove('hidden');
                document.querySelector('.radio-filters').classList.add('hidden');
                document.querySelector('.bulk-actions').classList.add('hidden');
                document.querySelector('.sort-wrapper').classList.add('hidden');
                document.getElementById('region-stats-badge').classList.add('hidden');
                genTabsScroll.classList.add('hidden');
                if (huntTabsScroll) huntTabsScroll.classList.add('hidden');
                renderCandiesPane();
            } else if (targetPaneId === 'todo-pane') {
                document.querySelector('.search-wrapper').classList.add('hidden');
                document.querySelector('.radio-filters').classList.add('hidden');
                document.querySelector('.bulk-actions').classList.add('hidden');
                document.querySelector('.sort-wrapper').classList.add('hidden');
                document.getElementById('region-stats-badge').classList.add('hidden');
                genTabsScroll.classList.add('hidden');
                if (huntTabsScroll) huntTabsScroll.classList.add('hidden');
                renderToDoPane();
            } else if (targetPaneId === 'friends-pane') {
                document.querySelector('.search-wrapper').classList.add('hidden');
                document.querySelector('.radio-filters').classList.add('hidden');
                document.querySelector('.bulk-actions').classList.add('hidden');
                document.querySelector('.sort-wrapper').classList.add('hidden');
                document.getElementById('region-stats-badge').classList.add('hidden');
                genTabsScroll.classList.add('hidden');
                if (huntTabsScroll) huntTabsScroll.classList.add('hidden');
                renderFriendsPane();
            } else if (targetPaneId === 'attackers-pane') {
                document.querySelector('.search-wrapper').classList.remove('hidden');
                document.querySelector('.radio-filters').classList.add('hidden');
                document.querySelector('.bulk-actions').classList.add('hidden');
                document.querySelector('.sort-wrapper').classList.add('hidden');
                document.getElementById('region-stats-badge').classList.add('hidden');
                genTabsScroll.classList.add('hidden');
                if (huntTabsScroll) huntTabsScroll.classList.add('hidden');
                renderAttackersPane();
            } else {
                document.querySelector('.search-wrapper').classList.remove('hidden');
                document.querySelector('.radio-filters').classList.remove('hidden');
                document.querySelector('.bulk-actions').classList.remove('hidden');
                document.querySelector('.sort-wrapper').classList.remove('hidden');
                document.getElementById('region-stats-badge').classList.remove('hidden');
                genTabsScroll.classList.remove('hidden');
                if (huntTabsScroll) huntTabsScroll.classList.add('hidden');
            }
        });
    });

    // Hunt Method Tabs Action
    if (huntTabsContainer) {
        huntTabsContainer.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.tab-btn');
            if (!targetBtn) return;
            
            huntTabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            targetBtn.classList.add('active');
            
            currentHuntMethod = targetBtn.dataset.method;
            renderMissingSummary();
        });
    }

    // Candies Sort Action
    const candiesSortSelect = document.getElementById('candies-sort');
    if (candiesSortSelect) {
        candiesSortSelect.addEventListener('change', () => {
            renderCandiesPane();
        });
    }

    // Rotations Subnav Tabs Action
    const rotationsSubnav = document.getElementById('rotations-subnav');
    if (rotationsSubnav) {
        rotationsSubnav.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.subnav-btn');
            if (!targetBtn) return;
            
            rotationsSubnav.querySelectorAll('.subnav-btn').forEach(btn => btn.classList.remove('active'));
            targetBtn.classList.add('active');
            
            const targetSectionId = targetBtn.dataset.target;
            const sections = document.querySelectorAll('#rotations-pane .rotation-section');
            sections.forEach(sec => {
                if (sec.id === targetSectionId) {
                    sec.classList.remove('hidden');
                } else {
                    sec.classList.add('hidden');
                }
            });

            if (targetSectionId === 'rotations-spawns-section') {
                renderWildSpawns();
            } else if (targetSectionId === 'rotations-events-section') {
                renderEventsPane();
            } else if (targetSectionId === 'rotations-promocodes-section') {
                renderPromoCodes();
            } else {
                renderActiveRotations();
            }
        });
    }



    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        pokedexLimit = Infinity; // Immediately load all search results
        renderPokedex(true);
        renderMissingSummary();
        renderCandiesPane();
    });

    sortSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        pokedexLimit = Infinity;
        renderPokedex(true);
    });

    genTabsContainer.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.tab-btn');
        if (!targetBtn) return;
        
        genTabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        targetBtn.classList.add('active');
        
        currentGenFilter = targetBtn.dataset.gen;
        pokedexLimit = Infinity; // Load full region immediately
        renderPokedex(true);
        renderMissingSummary();
        updateRegionStatsBadge();
    });

    collectionFilterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            collectionFilterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCollectionFilter = btn.dataset.filter;
            pokedexLimit = Infinity; // Load full filtered list immediately
            renderPokedex(true);
        });
    });

    catchAllBtn.addEventListener('click', () => {
        const visible = getFilteredAndSortedPokemon();
        if (visible.length === 0) return;
        
        visible.forEach(p => caughtPokemon.add(p.id));
        saveCaughtState();
        renderPokedex(true);
        renderMissingSummary();
    });

    resetAllBtn.addEventListener('click', () => {
        // Reset ignores the collection filter so it always acts on current gen/search subset
        const prevFilter = currentCollectionFilter;
        const savedFilter = currentCollectionFilter;
        currentCollectionFilter = 'all'; // temporarily lift filter
        const visible = getFilteredAndSortedPokemon();
        currentCollectionFilter = savedFilter; // restore

        if (visible.length === 0) return;

        if (!confirm(`Reset caught status for ${visible.length} Pokémon in current view?`)) return;

        visible.forEach(p => {
            caughtPokemon.delete(p.id);
            caughtPokemon.delete(Number(p.id));
            caughtPokemon.delete(String(p.id));
        });
        saveCaughtState();
        renderPokedex(true);
        renderMissingSummary();
    });

    modalCloseBtn.addEventListener('click', closeModal);
    
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            closeModal();
        }
    });

    modalTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modalTabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetId = btn.dataset.target;
            modalPanes.forEach(pane => {
                if (pane.id === targetId) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });

    modalCatchToggle.addEventListener('click', () => {
        if (activeModalPokemonId !== null) {
            toggleCaughtState(activeModalPokemonId, modalCatchToggle);
            updateModalCatchBtn(activeModalPokemonId);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !detailModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    const retryApiBtn = document.getElementById('retry-api-btn');
    if (retryApiBtn) {
        retryApiBtn.addEventListener('click', loadPokedex);
    }

}

function getFilteredAndSortedPokemon() {
    let result = [...pokemonDatabase];

    if (currentGenFilter !== 'all') {
        const genNum = parseFloat(currentGenFilter);
        result = result.filter(p => p.gen === genNum);
    }

    if (currentCollectionFilter === 'caught') {
        result = result.filter(p => (caughtPokemon.has(p.id) || caughtPokemon.has(Number(p.id))) && !isPokemonTransferred(p));
    } else if (currentCollectionFilter === 'missing') {
        result = result.filter(p => isPokemonMissing(p));
    }

    if (currentSearchQuery) {
        result = result.filter(p => {
            const matchesName = p.name.toLowerCase().includes(currentSearchQuery);
            const matchesNum = p.num.includes(currentSearchQuery);
            const matchesTypes = p.types.some(t => t.includes(currentSearchQuery));
            return matchesName || matchesNum || matchesTypes;
        });
    }

    if (currentSortOrder === 'num-asc') {
        result.sort((a, b) => {
            const numA = parseInt(a.num, 10);
            const numB = parseInt(b.num, 10);
            if (numA !== numB) return numA - numB;
            return a.id.localeCompare(b.id);
        });
    } else if (currentSortOrder === 'num-desc') {
        result.sort((a, b) => {
            const numA = parseInt(a.num, 10);
            const numB = parseInt(b.num, 10);
            if (numA !== numB) return numB - numA;
            return b.id.localeCompare(a.id);
        });
    } else if (currentSortOrder === 'name-asc') {
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
}

// Render Pokedex Grid Cards
function renderPokedex(forceClear = false) {
    const list = getFilteredAndSortedPokemon();

    if (forceClear) {
        pokedexGrid.innerHTML = '';
        currentRenderedIds.clear();
    }

    if (list.length === 0) {
        pokedexGrid.innerHTML = '';
        currentRenderedIds.clear();
        emptyState.classList.remove('hidden');
        pokedexGrid.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    pokedexGrid.classList.remove('hidden');

    // Slice list to limit elements rendered initially to avoid layout/painting freezes
    const listToRender = list.slice(0, pokedexLimit);

    listToRender.forEach((poke, index) => {
        // Skip rendering if already in DOM to prevent pixel flickering/cache reloads
        if (currentRenderedIds.has(poke.id)) return;
        currentRenderedIds.add(poke.id);

        const isCaught = caughtPokemon.has(poke.id) || caughtPokemon.has(Number(poke.id));
        const isTransf = isPokemonTransferred(poke);
        const readyToEvolve = isReadyToEvolve(poke);
        
        const cardClass = isCaught 
            ? (isTransf ? 'pokemon-card caught transferred' : 'pokemon-card caught') 
            : (isTransf ? 'pokemon-card missing transferred-missing' : (readyToEvolve ? 'pokemon-card missing ready-to-evolve' : 'pokemon-card missing'));

        const typeBadges = poke.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');

        const card = document.createElement('div');
        card.className = cardClass;
        card.dataset.id = poke.id;
        
        // Stagger entrance animation delay for first 40 elements to keep load light
        if (index < 40) {
            card.style.animationDelay = `${index * 15}ms`;
        } else {
            card.style.animationDelay = '0ms';
        }

        card.innerHTML = `
            <svg class="card-watermark" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="4"/>
                <path d="M4 50 H96" stroke="currentColor" stroke-width="4"/>
                <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="4"/>
            </svg>
            
            <div class="card-top">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span class="poke-number">#${poke.num}</span>
                    ${readyToEvolve ? `<span class="evolve-indicator-dot" style="width: 7px; height: 7px; background-color: #34d399; border-radius: 50%; display: inline-block;" title="Ready to Evolve (Almost Unlocked!)"></span>` : ''}
                </div>
                <button class="catch-indicator-btn" aria-label="Toggle catch status" title="${isCaught ? 'Remove from Collection' : 'Mark as Caught'}">
                    <svg viewBox="0 0 100 100" class="pokeball-svg" style="width: 22px; height: 22px;">
                        <circle cx="50" cy="50" r="44" fill="${isCaught ? '#ef4444' : 'transparent'}" stroke="${isCaught ? '#ffffff' : 'currentColor'}" stroke-width="8"/>
                        <path d="M6 50 H94" stroke="${isCaught ? '#ffffff' : 'currentColor'}" stroke-width="8"/>
                        <circle cx="50" cy="50" r="18" fill="${isCaught ? '#ffffff' : '#111b2e'}" stroke="${isCaught ? '#ffffff' : 'currentColor'}" stroke-width="8"/>
                        <circle cx="50" cy="50" r="8" fill="${isCaught ? '#ef4444' : '#64748b'}"/>
                    </svg>
                </button>
            </div>
            
            <div class="card-img-wrapper">
                <img src="${poke.img}" alt="${poke.name}" loading="lazy">
            </div>
            
            <h3 class="poke-name">${poke.name}</h3>
            
            <div class="types-container">
                ${typeBadges}
            </div>



            ${isTransf ? `
            <div class="pokedex-transferred-badge" style="position: absolute; bottom: 0.5rem; right: 0.5rem; background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 0.6rem; font-weight: 800; padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.4); display: flex; align-items: center; gap: 2px; z-index: 5;">
                <i class="fa-solid fa-arrows-spin"></i> Transferred
            </div>
            ` : ''}
        `;

        card.addEventListener('click', (e) => {
            const catchBtn = card.querySelector('.catch-indicator-btn');
            if (catchBtn.contains(e.target) || e.target === catchBtn) {
                e.stopPropagation();
                toggleCaughtState(poke.id, catchBtn);
                return;
            }
            openModal(poke.id);
        });

        // Glow Tracking Effect (No 3D Tilt rotation)
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--x', `${x}px`);
            card.style.setProperty('--y', `${y}px`);
        });

        card.addEventListener('mouseleave', () => {
            // Reset coordinates on leave if needed
        });

        pokedexGrid.appendChild(card);
    });
}

// Helper to classify Pokemon into all applicable obtain methods
function getObtainingCategories(poke) {
    const cats = [];
    const idName = poke.idName || "";
    const obtaining = poke.obtaining || [];
    
    const isLegendary = idName.includes("LEGENDARY") || obtaining.some(o => o.method && o.method.toLowerCase().includes("raid"));
    const isMythic = obtaining.some(o => o.method && (o.method.toLowerCase().includes("research") || o.method.toLowerCase().includes("special") || o.method.toLowerCase().includes("quest")));
    const isBaby = babyPokemonIds.has(poke.id);
    
    // 1. Evolve
    const chain = findEvolutionChain(poke);
    const indexInChain = chain.findIndex(p => p.id === poke.id);
    if (indexInChain > 0) {
        cats.push('evolve');
    }
    
    // 2. Raid
    if (isLegendary || obtaining.some(o => o.method && o.method.toLowerCase().includes("raid"))) {
        cats.push('raid');
    }
    
    // 3. Egg
    if (isBaby || obtaining.some(o => o.method && (o.method.toLowerCase().includes("egg") || o.method.toLowerCase().includes("hatch")))) {
        cats.push('egg');
    }
    
    // 4. Special
    if (isMythic) {
        cats.push('special');
    }
    
    // 5. Wild
    if (obtaining.some(o => o.method && (o.method.toLowerCase().includes("wild") || o.method.toLowerCase().includes("regional")))) {
        cats.push('wild');
    }
    
    // 6. Unavailable
    if (obtaining.some(o => o.method === "Unavailable")) {
        cats.push('unavailable');
    }
    
    return cats;
}

function compileCardObtainingPreview(poke) {
    const parentInfo = getEvolutionParentInfo(poke);
    if (parentInfo) {
        let itemStr = parentInfo.item ? ` + ${formatItemName(parentInfo.item)}` : '';
        return `Evolve from ${parentInfo.name} (${parentInfo.candies} Candies${itemStr})`;
    }
    
    const obtaining = poke.obtaining || [];
    if (obtaining.length > 0) {
        if (obtaining[0].method === "Unavailable") {
            return "Currently Unavailable";
        }
        return `${obtaining[0].method}: ${obtaining[0].desc.split('.')[0]}`;
    }
    
    return "";
}

// Render the Hunt List/Missing Pokémon grid filtered by the active method tab
function renderMissingSummary() {
    if (!huntGrid) return;
    
    huntGrid.innerHTML = '';
    
    // 1. Get all missing Pokémon (including transferred ones)
    let missingList = pokemonDatabase.filter(p => {
        const isCaught = caughtPokemon.has(p.id) || caughtPokemon.has(Number(p.id));
        const isTransf = transferredPokemon.has(p.id) || transferredPokemon.has(Number(p.id)) || transferredPokemon.has(String(p.id));
        return !isCaught || isTransf;
    });
    
    // 2. Filter by search query
    if (currentSearchQuery) {
        missingList = missingList.filter(p => {
            const matchesName = (p.name || "").toLowerCase().includes(currentSearchQuery);
            const matchesNum = (p.num || "").includes(currentSearchQuery);
            const matchesTypes = (p.types || []).some(t => t.includes(currentSearchQuery));
            return matchesName || matchesNum || matchesTypes;
        });
    }
    
    // 3. Filter by selected Hunt Method tab
    if (currentHuntMethod === 'all') {
        missingList = missingList.filter(p => {
            const cats = getObtainingCategories(p);
            const isLive = liveEggs.some(e => String(e.dex) === String(p.id)) || 
                           liveRaids.some(r => r.name.toLowerCase() === p.name.toLowerCase() || r.name.toLowerCase().replace(/^shadow\s+/g, '') === p.name.toLowerCase());
            return isLive || !cats.includes('unavailable');
        });
    } else if (currentHuntMethod === 'egg') {
        missingList = missingList.filter(p => liveEggs.some(e => String(e.dex) === String(p.id)));
    } else if (currentHuntMethod === 'raid') {
        missingList = missingList.filter(p => liveRaids.some(r => r.name.toLowerCase() === p.name.toLowerCase() || r.name.toLowerCase().replace(/^shadow\s+/g, '') === p.name.toLowerCase()));
    } else {
        missingList = missingList.filter(p => getObtainingCategories(p).includes(currentHuntMethod));
    }
    
    // 4. Sort according to selection
    if (currentSortOrder === 'num-asc') {
        missingList.sort((a, b) => a.id - b.id);
    } else if (currentSortOrder === 'num-desc') {
        missingList.sort((a, b) => b.id - a.id);
    } else if (currentSortOrder === 'name-asc') {
        missingList.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // 5. Handle empty state
    if (missingList.length === 0) {
        huntGrid.classList.add('hidden');
        emptyHuntState.classList.remove('hidden');
        return;
    }
    
    huntGrid.classList.remove('hidden');
    emptyHuntState.classList.add('hidden');
    
    // 6. Render missing cards
    missingList.forEach(poke => {
        const typeBadges = (poke.types || []).map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');
        let previewText = compileCardObtainingPreview(poke);
        if (currentHuntMethod === 'egg') {
            const matchedEgg = liveEggs.find(e => String(e.dex) === String(poke.id));
            if (matchedEgg) {
                let eggLabel = matchedEgg.eggT.replace('km', ' km Egg');
                if (eggLabel.includes('adventure')) eggLabel = eggLabel.replace('adventure', 'Adventure Sync ');
                previewText = `Available in: ${eggLabel}`;
            }
        } else if (currentHuntMethod === 'raid') {
            const matchedRaid = liveRaids.find(r => r.name.toLowerCase() === poke.name.toLowerCase() || r.name.toLowerCase().replace(/^shadow\s+/g, '') === poke.name.toLowerCase());
            if (matchedRaid) {
                previewText = `Available in: ${matchedRaid.tier}`;
            }
        } else if (currentHuntMethod === 'wild') {
            const matchedSpawn = liveSpawns.find(s => Number(s.dexNr) === Number(poke.id) || (s.name && s.name.toLowerCase() === poke.name.toLowerCase()));
            if (matchedSpawn && matchedSpawn.spawnRate >= 0.5) {
                previewText = `Active Spawn: ${matchedSpawn.spawnRate}%`;
            }
        }

        const isTransf = isPokemonTransferred(poke);
        if (isTransf) {
            previewText = `<span style="color: #60a5fa; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem;"><i class="fa-solid fa-arrows-spin"></i> Transferred (Need for Evolution)</span>`;
        }

        const card = document.createElement('div');
        card.className = `pokemon-card missing ${isTransf ? 'transferred-missing' : ''}`;
        card.dataset.id = poke.id;
        
        card.innerHTML = `
            <svg class="card-watermark" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="4"/>
                <path d="M4 50 H96" stroke="currentColor" stroke-width="4"/>
                <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="4"/>
            </svg>
            
            <div class="card-top">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span class="poke-number">#${poke.num}</span>
                    ${isTransf ? `
                        <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-size: 0.6rem; font-weight: 800; padding: 2px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">
                            <i class="fa-solid fa-arrows-spin"></i> TRANSFERRED
                        </span>
                    ` : ''}
                </div>
                <button class="catch-indicator-btn" aria-label="Mark as Caught" title="Mark as Caught">
                    <svg viewBox="0 0 100 100" class="pokeball-svg" style="width: 22px; height: 22px;">
                        <circle cx="50" cy="50" r="44" fill="transparent" stroke="currentColor" stroke-width="8"/>
                        <path d="M6 50 H94" stroke="currentColor" stroke-width="8"/>
                        <circle cx="50" cy="50" r="18" fill="#111b2e" stroke="currentColor" stroke-width="8"/>
                        <circle cx="50" cy="50" r="8" fill="#64748b"/>
                    </svg>
                </button>
            </div>
            
            <div class="card-img-wrapper">
                <img src="${poke.img}" alt="${poke.name}" loading="lazy">
            </div>
            
            <h3 class="poke-name">${poke.name}</h3>
            
            <div class="types-container">
                ${typeBadges}
            </div>
            
            ${previewText ? `
            <div class="card-obtain-preview">
                ${previewText}
            </div>
            ` : ''}
        `;

        card.addEventListener('click', (e) => {
            const catchBtn = card.querySelector('.catch-indicator-btn');
            if (catchBtn.contains(e.target) || e.target === catchBtn) {
                e.stopPropagation();
                toggleCaughtState(poke.id);
                return;
            }
            openModal(poke.id);
        });

        huntGrid.appendChild(card);
    });
}


// Trace evolution tree dynamically to compile exact evolution requirements
function compileObtainingDetails(poke) {
    const lines = [];

    const parentInfo = getEvolutionParentInfo(poke);
    if (parentInfo) {
        const candy = parentInfo.candies;
        let req = `Evolves from ${parentInfo.name} with ${candy} Candies`;
        
        if (parentInfo.item) {
            req += ` + ${formatItemName(parentInfo.item)}`;
        }
        if (parentInfo.quests && parentInfo.quests.length > 0) {
            req += ` after completing Buddy quest: "${parentInfo.quests[0]}"`;
        }
        
        lines.push(`
            <div style="margin-bottom: 0.15rem;">
                <span class="table-obtain-desc" style="font-weight: 700; color: var(--accent-color);">Evolution:</span>
                <span class="table-obtain-desc">${req}.</span>
            </div>
        `);
    }

    // Add standard obtaining methods
    const obtaining = poke.obtaining || [];
    obtaining.forEach(o => {
        lines.push(`
            <div style="margin-bottom: 0.15rem;">
                <span class="table-obtain-desc" style="font-weight: 700; color: var(--text-primary);">${o.method}:</span>
                <span class="table-obtain-desc">${o.desc}</span>
            </div>
        `);
    });

    return lines.join('');
}



// ==========================================================================
// DETAILS MODAL IMPLEMENTATION
// ==========================================================================
function openModal(id) {
    const poke = pokemonDatabase.find(p => p.id === id);
    if (!poke) return;

    activeModalPokemonId = id;
    
    modalPokeNum.textContent = `#${poke.num}`;
    modalPokeName.textContent = poke.name;
    modalPokeImg.src = poke.img;
    modalPokeImg.alt = poke.name;

    const primaryType = poke.types[0];
    modalHeaderBg.style.background = `linear-gradient(135deg, var(--type-${primaryType}) 0%, var(--bg-secondary) 100%)`;
    modalPokeTypes.innerHTML = poke.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');

    loadObtainingTab(poke);
    loadEvolutionTab(poke);
    loadStatsTab(poke);
    loadTypeMatchupsTab(poke);
    updateModalCatchBtn(id);

    modalTabButtons.forEach(btn => btn.classList.remove('active'));
    modalTabButtons[0].classList.add('active');
    modalPanes.forEach(pane => pane.classList.remove('active'));
    document.getElementById('obtaining-tab').classList.add('active');

    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
    activeModalPokemonId = null;
}

function jumpToRotationTarget(targetId) {
    setTimeout(() => {
        const element = document.querySelector(`[data-scroll-target="${targetId}"]`);
        if (element) {
            element.classList.remove('spawn-animation');
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('jump-highlight');
            setTimeout(() => {
                element.classList.remove('jump-highlight');
            }, 2500);
        }
    }, 180);
}

function loadObtainingTab(poke) {
    const container = document.getElementById('obtaining-methods');
    container.innerHTML = '';

    const getIcon = (method) => {
        const m = method.toLowerCase();
        if (m.includes('wild') || m.includes('spawn')) return 'fa-solid fa-tree';
        if (m.includes('egg') || m.includes('hatch')) return 'fa-solid fa-egg';
        if (m.includes('raid')) return 'fa-solid fa-hand-fist';
        if (m.includes('research') || m.includes('quest') || m.includes('special')) return 'fa-solid fa-scroll';
        if (m.includes('evol')) return 'fa-solid fa-dna';
        return 'fa-solid fa-compass';
    };

    const parentInfo = getEvolutionParentInfo(poke);
    
    if (parentInfo) {
        const candy = parentInfo.candies;
        let req = `Evolves from ${parentInfo.name} with ${candy} Candies`;
        if (parentInfo.item) req += ` + ${formatItemName(parentInfo.item)}`;
        if (parentInfo.quests && parentInfo.quests.length > 0) req += ` after completing Buddy quest: "${parentInfo.quests[0]}"`;

        const evoCard = document.createElement('div');
        evoCard.className = 'obtain-card';
        evoCard.innerHTML = `
            <div class="obtain-icon-box">
                <i class="fa-solid fa-dna"></i>
            </div>
            <div class="obtain-card-content">
                <h4>Evolution</h4>
                <p>${req}.</p>
            </div>
        `;
        container.appendChild(evoCard);
    }

    // 1. Dynamic Active Rotation Check: Raids
    const activeRaid = liveRaids.find(r => 
        (r.name && r.name.toLowerCase() === poke.name.toLowerCase()) || 
        (r.name && r.name.toLowerCase().includes(poke.name.toLowerCase()))
    );
    if (activeRaid) {
        const raidCard = document.createElement('div');
        raidCard.className = 'obtain-card active-rotation-link';
        raidCard.style.cursor = 'pointer';
        raidCard.style.border = '1px solid rgba(167, 139, 250, 0.4)';
        raidCard.style.background = 'linear-gradient(135deg, rgba(167, 139, 250, 0.08), var(--bg-tertiary))';
        
        let tierLabel = activeRaid.tier || 'Raid';
        if (tierLabel.startsWith('lvl')) {
            tierLabel = 'Tier ' + tierLabel.substring(3);
        } else if (tierLabel.toLowerCase().includes('mega')) {
            tierLabel = 'Mega Raid';
        } else if (tierLabel.toLowerCase().includes('shadow')) {
            tierLabel = 'Shadow ' + tierLabel.replace('shadow_', '').replace('lvl', 'Tier ');
        }
        
        raidCard.innerHTML = `
            <div class="obtain-icon-box" style="color: #a78bfa; background: rgba(167, 139, 250, 0.15);">
                <i class="fa-solid fa-hand-fist"></i>
            </div>
            <div class="obtain-card-content" style="flex-grow: 1;">
                <h4 style="color: #a78bfa; display: flex; align-items: center; gap: 6px;">
                    Active Raid Boss <span style="font-size: 0.65rem; background: #a78bfa; color: #1e1b4b; padding: 2px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>
                </h4>
                <p>Currently appearing in <strong>${tierLabel}</strong>! Click to view details, CP values, and counters.</p>
            </div>
            <div style="align-self: center; padding-right: 0.5rem; color: #a78bfa; opacity: 0.8;">
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
        raidCard.addEventListener('click', () => {
            closeModal();
            const rotationsTabBtn = document.querySelector('.view-switch-container .view-btn[data-view="rotations-pane"]');
            if (rotationsTabBtn) rotationsTabBtn.click();
            const raidsSubnavBtn = document.querySelector('.subnav-btn[data-target="rotations-raids-section"]');
            if (raidsSubnavBtn) raidsSubnavBtn.click();
            const targetKey = `raid-${poke.name.toLowerCase().replace(/\s+/g, '-')}-${(activeRaid.tier || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            jumpToRotationTarget(targetKey);
        });
        container.appendChild(raidCard);
    }

    // 2. Dynamic Active Rotation Check: Eggs
    const activeEgg = liveEggs.find(e => 
        (e.name && e.name.toLowerCase() === poke.name.toLowerCase())
    );
    if (activeEgg) {
        const eggCard = document.createElement('div');
        eggCard.className = 'obtain-card active-rotation-link';
        eggCard.style.cursor = 'pointer';
        eggCard.style.border = '1px solid rgba(52, 211, 153, 0.4)';
        eggCard.style.background = 'linear-gradient(135deg, rgba(52, 211, 153, 0.08), var(--bg-tertiary))';
        
        let eggDist = activeEgg.eggT || 'Egg';
        if (eggDist.endsWith('km')) {
            eggDist = eggDist.replace('km', ' km');
        } else if (eggDist.toLowerCase().includes('adventure')) {
            eggDist = eggDist.replace('adventure', 'Adventure Sync ').replace('km', ' km');
        }
        
        eggCard.innerHTML = `
            <div class="obtain-icon-box" style="color: #34d399; background: rgba(52, 211, 153, 0.15);">
                <i class="fa-solid fa-egg"></i>
            </div>
            <div class="obtain-card-content" style="flex-grow: 1;">
                <h4 style="color: #34d399; display: flex; align-items: center; gap: 6px;">
                    Active Egg Hatch <span style="font-size: 0.65rem; background: #34d399; color: #064e3b; padding: 2px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>
                </h4>
                <p>Currently hatching from <strong>${eggDist}</strong> eggs! Click to view egg pool.</p>
            </div>
            <div style="align-self: center; padding-right: 0.5rem; color: #34d399; opacity: 0.8;">
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
        eggCard.addEventListener('click', () => {
            closeModal();
            const rotationsTabBtn = document.querySelector('.view-switch-container .view-btn[data-view="rotations-pane"]');
            if (rotationsTabBtn) rotationsTabBtn.click();
            const eggsSubnavBtn = document.querySelector('.subnav-btn[data-target="rotations-eggs-section"]');
            if (eggsSubnavBtn) eggsSubnavBtn.click();
            const targetKey = `egg-${poke.name.toLowerCase().replace(/\s+/g, '-')}-${(activeEgg.eggT || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            jumpToRotationTarget(targetKey);
        });
        container.appendChild(eggCard);
    }

    // 3. Dynamic Active Rotation Check: Quests
    let activeQuests = [];
    if (liveResearch) {
        liveResearch.forEach(task => {
            if (task.rewards) {
                task.rewards.forEach(reward => {
                    const rewardNameLower = (reward.name || '').toLowerCase();
                    const pokeNameLower = (poke.name || '').toLowerCase();
                    const nameMatches = rewardNameLower === pokeNameLower || rewardNameLower.includes(pokeNameLower);
                    const dexMatches = reward.dex && String(reward.dex) === String(poke.id);
                    if (reward.type === 'encounter' && (nameMatches || dexMatches)) {
                        activeQuests.push(task.text);
                    }
                });
            }
        });
    }
    activeQuests.forEach(questText => {
        const questCard = document.createElement('div');
        questCard.className = 'obtain-card active-rotation-link';
        questCard.style.cursor = 'pointer';
        questCard.style.border = '1px solid rgba(96, 165, 250, 0.4)';
        questCard.style.background = 'linear-gradient(135deg, rgba(96, 165, 250, 0.08), var(--bg-tertiary))';
        questCard.innerHTML = `
            <div class="obtain-icon-box" style="color: #60a5fa; background: rgba(96, 165, 250, 0.15);">
                <i class="fa-solid fa-scroll"></i>
            </div>
            <div class="obtain-card-content" style="flex-grow: 1;">
                <h4 style="color: #60a5fa; display: flex; align-items: center; gap: 6px;">
                    Active Field Research <span style="font-size: 0.65rem; background: #60a5fa; color: #1e3a8a; padding: 2px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>
                </h4>
                <p>Appearing as a reward encounter for the task: <strong>"${questText}"</strong>. Click to view all active quests.</p>
            </div>
            <div style="align-self: center; padding-right: 0.5rem; color: #60a5fa; opacity: 0.8;">
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
        questCard.addEventListener('click', () => {
            closeModal();
            const rotationsTabBtn = document.querySelector('.view-switch-container .view-btn[data-view="rotations-pane"]');
            if (rotationsTabBtn) rotationsTabBtn.click();
            const questsSubnavBtn = document.querySelector('.subnav-btn[data-target="rotations-quests-section"]');
            if (questsSubnavBtn) questsSubnavBtn.click();
            const targetKey = `quest-${poke.name.toLowerCase().replace(/\s+/g, '-')}-${questText.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            jumpToRotationTarget(targetKey);
        });
        container.appendChild(questCard);
    });

    // 4. Dynamic Active Rotation Check: Team GO Rocket (Only show if catchable/encounter)
    let activeRockets = [];
    if (liveRocket) {
        Object.entries(liveRocket).forEach(([charName, charData]) => {
            if (Array.isArray(charData)) {
                charData.forEach(slot => {
                    if (slot.is_encounter && slot.pokemons) {
                        slot.pokemons.forEach(p => {
                            if (p.name && p.name.toLowerCase() === poke.name.toLowerCase()) {
                                activeRockets.push({
                                    character: charName,
                                    slot: slot.slot
                                });
                            }
                        });
                    }
                });
            }
        });
    }
    activeRockets.forEach(rocket => {
        const rocketCard = document.createElement('div');
        rocketCard.className = 'obtain-card active-rotation-link';
        rocketCard.style.cursor = 'pointer';
        rocketCard.style.border = '1px solid rgba(248, 113, 113, 0.4)';
        rocketCard.style.background = 'linear-gradient(135deg, rgba(248, 113, 113, 0.08), var(--bg-tertiary))';
        rocketCard.innerHTML = `
            <div class="obtain-icon-box" style="color: #f87171; background: rgba(248, 113, 113, 0.15);">
                <i class="fa-solid fa-user-ninja"></i>
            </div>
            <div class="obtain-card-content" style="flex-grow: 1;">
                <h4 style="color: #f87171; display: flex; align-items: center; gap: 6px;">
                    Active Team GO Rocket <span style="font-size: 0.65rem; background: #f87171; color: #7f1d1d; padding: 2px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>
                </h4>
                <p>Appears as a reward encounter after defeating <strong>${rocket.character}</strong> (Slot ${rocket.slot}). Click to view Rocket matchups.</p>
            </div>
            <div style="align-self: center; padding-right: 0.5rem; color: #f87171; opacity: 0.8;">
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
        rocketCard.addEventListener('click', () => {
            closeModal();
            const rotationsTabBtn = document.querySelector('.view-switch-container .view-btn[data-view="rotations-pane"]');
            if (rotationsTabBtn) rotationsTabBtn.click();
            const rocketSubnavBtn = document.querySelector('.subnav-btn[data-target="rotations-rocket-section"]');
            if (rocketSubnavBtn) rocketSubnavBtn.click();
            jumpToRotationTarget(`rocket-${rocket.character.toLowerCase().replace(/\s+/g, '-')}`);
        });
        container.appendChild(rocketCard);
    });

    // 5. Dynamic Active Rotation Check: Party Challenges
    const activeParties = partyRewardsData.filter(p => 
        (p.name && p.name.toLowerCase() === poke.name.toLowerCase()) || 
        (p.dex && p.dex == poke.id)
    );
    activeParties.forEach(party => {
        const partyCard = document.createElement('div');
        partyCard.className = 'obtain-card active-rotation-link';
        partyCard.style.cursor = 'pointer';
        partyCard.style.border = '1px solid rgba(59, 130, 246, 0.4)';
        partyCard.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), var(--bg-tertiary))';
        partyCard.innerHTML = `
            <div class="obtain-icon-box" style="color: #60a5fa; background: rgba(59, 130, 246, 0.15);">
                <i class="fa-solid fa-users"></i>
            </div>
            <div class="obtain-card-content" style="flex-grow: 1;">
                <h4 style="color: #60a5fa; display: flex; align-items: center; gap: 6px;">
                    Active Party Play Reward <span style="font-size: 0.65rem; background: #60a5fa; color: #1e3a8a; padding: 2px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>
                </h4>
                <p>Appearing as a reward encounter for the party challenge: <strong>"${party.task}"</strong>. Click to view all party rewards.</p>
            </div>
            <div style="align-self: center; padding-right: 0.5rem; color: #60a5fa; opacity: 0.8;">
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
        partyCard.addEventListener('click', () => {
            closeModal();
            const rotationsTabBtn = document.querySelector('.view-switch-container .view-btn[data-view="rotations-pane"]');
            if (rotationsTabBtn) rotationsTabBtn.click();
            const partySubnavBtn = document.querySelector('.subnav-btn[data-target="rotations-party-section"]');
            if (partySubnavBtn) partySubnavBtn.click();
            const targetKey = `party-${poke.name.toLowerCase().replace(/\s+/g, '-')}-${party.task.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            jumpToRotationTarget(targetKey);
        });
        container.appendChild(partyCard);
    });

    // 6. Dynamic Active Rotation Check: Wild Spawns (Only show if spawnRate >= 0.5%)
    const activeSpawn = liveSpawns.find(s => Number(s.dexNr) === Number(poke.id) || (s.name && s.name.toLowerCase() === poke.name.toLowerCase()));
    if (activeSpawn && activeSpawn.spawnRate >= 0.5) {
        const isHighChance = activeSpawn.spawnRate >= 1.0;
        const spawnCard = document.createElement('div');
        spawnCard.className = 'obtain-card active-rotation-link';
        spawnCard.style.cursor = 'pointer';
        spawnCard.style.border = isHighChance ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(245, 166, 35, 0.4)';
        spawnCard.style.background = isHighChance 
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), var(--bg-tertiary))' 
            : 'linear-gradient(135deg, rgba(245, 166, 35, 0.08), var(--bg-tertiary))';
        
        const badgeHtml = `<span style="font-size: 0.65rem; background: ${isHighChance ? '#22c55e' : '#f5a623'}; color: ${isHighChance ? '#052e16' : '#451a03'}; padding: 2px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>`;

        const descText = `Currently spawning in the wild with a rate of <strong>${activeSpawn.spawnRate}%</strong>! Click to view all active wild spawns.`;

        spawnCard.innerHTML = `
            <div class="obtain-icon-box" style="color: ${isHighChance ? '#4ade80' : '#f5a623'}; background: ${isHighChance ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 166, 35, 0.15)'};">
                <i class="fa-solid fa-location-dot"></i>
            </div>
            <div class="obtain-card-content" style="flex-grow: 1;">
                <h4 style="color: ${isHighChance ? '#4ade80' : '#f5a623'}; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    Wild Spawn ${badgeHtml}
                </h4>
                <p>${descText}</p>
            </div>
            <div style="align-self: center; padding-right: 0.5rem; color: ${isHighChance ? '#4ade80' : '#f5a623'}; opacity: 0.8;">
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
        spawnCard.addEventListener('click', () => {
            closeModal();
            const rotationsTabBtn = document.querySelector('.view-switch-container .view-btn[data-view="rotations-pane"]');
            if (rotationsTabBtn) rotationsTabBtn.click();
            const spawnsSubnavBtn = document.querySelector('.subnav-btn[data-target="rotations-spawns-section"]');
            if (spawnsSubnavBtn) spawnsSubnavBtn.click();
            jumpToRotationTarget(`spawn-${activeSpawn.dexNr}`);
        });
        container.appendChild(spawnCard);
    }

    poke.obtaining.forEach(opt => {
        // Skip adding static placeholders if we already have the active card to prevent duplication
        if (opt.method.toLowerCase().includes('raid') && activeRaid) return;
        if ((opt.method.toLowerCase().includes('wild') || opt.method.toLowerCase().includes('spawn')) && activeSpawn && activeSpawn.spawnRate >= 0.5) return;
        if ((opt.method.toLowerCase().includes('egg') || opt.method.toLowerCase().includes('hatch')) && activeEgg) return;
        if ((opt.method.toLowerCase().includes('research') || opt.method.toLowerCase().includes('quest') || opt.method.toLowerCase().includes('special')) && activeQuests.length > 0) return;
        if (opt.method.toLowerCase().includes('rocket') && activeRockets.length > 0) return;
        if (opt.method.toLowerCase().includes('party') && activeParties.length > 0) return;

        const card = document.createElement('div');
        card.className = 'obtain-card';
        card.innerHTML = `
            <div class="obtain-icon-box">
                <i class="${getIcon(opt.method)}"></i>
            </div>
            <div class="obtain-card-content">
                <h4>${opt.method}</h4>
                <p>${opt.desc}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

function loadEvolutionTab(poke) {
    const container = document.getElementById('evolution-flow');
    container.innerHTML = '';

    const chain = findEvolutionChain(poke);
    if (chain.length <= 1) {
        container.innerHTML = `<p class="no-evo-text" style="color: var(--text-secondary); font-size: 0.9rem;">This Pokémon has no evolution line.</p>`;
        return;
    }

    chain.forEach((stage, idx) => {
        if (idx > 0) {
            const prevStage = chain[idx - 1];
            const candyNeeded = prevStage.rawEvolutions.find(e => {
                const targetEvoId = e.formId || e.id;
                return targetEvoId && stage.idName && targetEvoId.toLowerCase() === stage.idName.toLowerCase();
            })?.candies || 50;

            const arrow = document.createElement('div');
            arrow.className = 'evo-arrow';
            arrow.innerHTML = `
                <span class="candy-req">${candyNeeded} Candies</span>
                <i class="fa-solid fa-angles-right"></i>
            `;
            container.appendChild(arrow);
        }

        const step = document.createElement('div');
        step.className = `evo-step ${stage.id === poke.id ? 'active-evo' : ''}`;
        if (stage.id === poke.id) {
            step.style.border = '1px solid var(--accent-color)';
            step.style.background = 'rgba(245, 166, 35, 0.05)';
        }
        
        step.innerHTML = `
            <div class="evo-img-container">
                <img src="${stage.img}" alt="${stage.name}">
            </div>
            <span class="evo-name">${stage.name}</span>
        `;

        step.addEventListener('click', () => {
            openModal(stage.id);
        });

        container.appendChild(step);
    });
}

function findEvolutionChain(poke) {
    const chain = [poke];
    
    // Build backwards
    let current = poke;
    while (true) {
        const parentInfo = getEvolutionParentInfo(current);
        if (parentInfo && parentInfo.parent) {
            const parentStage = {
                id: parentInfo.parent.id,
                idName: parentInfo.parent.idName,
                num: parentInfo.parent.num,
                name: parentInfo.name,
                img: parentInfo.img,
                types: parentInfo.parent.types,
                stats: parentInfo.parent.stats,
                rawEvolutions: parentInfo.parent.rawEvolutions
            };
            if (chain.some(c => c.name === parentStage.name)) break;
            chain.unshift(parentStage);
            current = parentInfo.parent;
        } else {
            break;
        }
    }
    
    // Build forwards
    current = poke;
    while (true) {
        if (current.rawEvolutions && current.rawEvolutions.length > 0) {
            const nextEvoInfo = current.rawEvolutions[0];
            const next = pokemonDatabase.find(p => p.idName && (
                p.idName.toLowerCase() === nextEvoInfo.id.toLowerCase() ||
                (nextEvoInfo.formId && p.idName.toLowerCase() === nextEvoInfo.formId.toLowerCase())
            ));
            if (next) {
                if (chain.some(c => c.id === next.id)) break;
                chain.push(next);
                current = next;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    
    return chain;
}


function loadStatsTab(poke) {
    const container = document.getElementById('stats-bars');
    container.innerHTML = '';

    const maxValues = { atk: 450, def: 450, sta: 550 };
    const statLabels = {
        atk: { name: 'Attack', color: 'linear-gradient(90deg, #f87171, #ef4444)' },
        def: { name: 'Defense', color: 'linear-gradient(90deg, #60a5fa, #3b82f6)' },
        sta: { name: 'Stamina / HP', color: 'linear-gradient(90deg, #34d399, #10b981)' }
    };

    Object.entries(poke.stats).forEach(([key, val]) => {
        const max = maxValues[key];
        const pct = Math.round((val / max) * 100);
        
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `
            <div class="stat-row-info">
                <span class="stat-label-text">${statLabels[key].name}</span>
                <span class="stat-val-text">${val}</span>
            </div>
            <div class="stat-bar-outer">
                <div class="stat-bar-inner" style="width: 0%; background: ${statLabels[key].color}"></div>
            </div>
        `;
        
        container.appendChild(row);
        
        setTimeout(() => {
            const barInner = row.querySelector('.stat-bar-inner');
            if (barInner) barInner.style.width = `${pct}%`;
        }, 50);
    });
}

function loadTypeMatchupsTab(poke) {
    const container = document.getElementById('type-matchups');
    if (!container) return;
    container.innerHTML = '';

    const allTypes = [
        "normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", 
        "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "steel", "dark", "fairy"
    ];

    const multipliers = {};
    allTypes.forEach(t => multipliers[t] = 1.0);

    poke.types.forEach(pokeType => {
        const typeData = typesDatabase.find(t => t.type.toLowerCase() === pokeType.toLowerCase());
        if (typeData) {
            if (typeData.doubleDamageFrom) {
                typeData.doubleDamageFrom.forEach(attType => {
                    const lower = attType.toLowerCase();
                    if (multipliers[lower] !== undefined) multipliers[lower] *= 1.6;
                });
            }
            if (typeData.halfDamageFrom) {
                typeData.halfDamageFrom.forEach(attType => {
                    const lower = attType.toLowerCase();
                    if (multipliers[lower] !== undefined) multipliers[lower] *= 0.625;
                });
            }
            if (typeData.noDamageFrom) {
                typeData.noDamageFrom.forEach(attType => {
                    const lower = attType.toLowerCase();
                    if (multipliers[lower] !== undefined) multipliers[lower] *= 0.39;
                });
            }
        }
    });

    const doubleWeakness = [];
    const weakness = [];
    const resistance = [];
    const doubleResistance = [];

    Object.entries(multipliers).forEach(([type, mult]) => {
        if (mult >= 2.0) {
            doubleWeakness.push({ type, mult });
        } else if (mult > 1.2 && mult < 2.0) {
            weakness.push({ type, mult });
        } else if (mult > 0.4 && mult < 0.8) {
            resistance.push({ type, mult });
        } else if (mult < 0.4) {
            doubleResistance.push({ type, mult });
        }
    });

    const renderGroup = (title, list, badgeClass) => {
        if (list.length === 0) return '';
        const badgesHtml = list.map(item => {
            const displayVal = item.mult >= 2.0 ? '2.56x' : item.mult > 1.2 ? '1.6x' : item.mult > 0.4 ? '0.62x' : '0.39x';
            return `<span class="type-badge type-${item.type}" style="margin: 4px; display: inline-flex; align-items: center; gap: 4px; text-transform: capitalize;">${item.type} <strong style="font-size: 0.75rem; color: rgba(255,255,255,0.9);">${displayVal}</strong></span>`;
        }).join('');
        
        return `
            <div class="matchup-group ${badgeClass}" style="margin-bottom: 1.2rem; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 12px;">
                <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                    <span class="indicator-dot" style="width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
                    ${title}
                </h4>
                <div style="display: flex; flex-wrap: wrap;">
                    ${badgesHtml}
                </div>
            </div>
        `;
    };

    let html = '';
    html += renderGroup('Double Weakness (2.56x)', doubleWeakness, 'double-weakness');
    html += renderGroup('Weakness (1.6x)', weakness, 'weakness');
    html += renderGroup('Resistance (0.625x)', resistance, 'resistance');
    html += renderGroup('Double Resistance (0.39x)', doubleResistance, 'double-resistance');

    if (!html) {
        html = '<p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 2rem 0;">No active weaknesses or resistances. Completely neutral effectiveness.</p>';
    }

    container.innerHTML = html;

    const addIndicatorColor = (selector, color) => {
        container.querySelectorAll(selector).forEach(el => {
            const dot = el.querySelector('.indicator-dot');
            if (dot) dot.style.backgroundColor = color;
        });
    };
    addIndicatorColor('.double-weakness', '#ef4444');
    addIndicatorColor('.weakness', '#fb923c');
    addIndicatorColor('.resistance', '#34d399');
    addIndicatorColor('.double-resistance', '#60a5fa');
}

function renderWildSpawns() {
    const grid = document.getElementById('spawns-grid-container');
    if (!grid) return;

    if (liveSpawns.length === 0) {
        grid.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">Loading wild spawns...</p>';
        return;
    }

    let filtered = liveSpawns;

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1.5rem 0;">No active wild spawns available.</p>';
        return;
    }

    let html = `
        <div class="rotation-grid-layout" style="margin-top: 1rem;">
    `;

    filtered.forEach(s => {
        const poke = s.pokemon;
        const dexFormatted = '#' + String(s.dexNr).padStart(3, '0');
        const isTransferred = poke ? isPokemonTransferred(poke) : false;
        const isMissing = poke ? (!isTransferred && isPokemonMissing(poke)) : false;
        const isCandyNeeded = poke ? needsCandies(poke) : false;
        
        const highlightClass = isTransferred ? 'transferred-rotation-target' : (isMissing ? 'missing-rotation-target' : (isCandyNeeded ? 'candy-rotation-target' : ''));

        let imgUrl = '';
        if (poke && poke.img) {
            imgUrl = poke.img;
        } else {
            imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${s.dexNr}.png`;
        }

        const rateBadge = s.spawnRate > 0 
            ? `<div><i class="fa-solid fa-location-dot" style="font-size:0.65rem; opacity:0.7;"></i> <span>Spawn Rate: <strong style="color: var(--accent-color);">${s.spawnRate}%</strong></span></div>` 
            : `<div><i class="fa-solid fa-location-dot" style="font-size:0.65rem; opacity:0.7;"></i> <span>Rarity: <strong style="color: #94a3b8;">Rare / Event</strong></span></div>`;

        html += `
            <div class="spawn-card rotation-card-item theme-blue ${highlightClass} spawn-animation" data-dex="${s.dexNr}" data-scroll-target="spawn-${s.dexNr}">
                ${s.shiny ? shinySparkleSvg : ''}
                <div class="rotation-badges">
                    ${isTransferred ? '<span class="transferred-rotation-badge"><i class="fa-solid fa-arrows-spin"></i> Transferred</span>' : (isMissing ? '<span class="missing-rotation-badge"><i class="fa-solid fa-crosshairs"></i> Missing</span>' : '')}
                    ${isCandyNeeded && !isTransferred ? '<span class="candy-rotation-badge"><i class="fa-solid fa-candy-cane"></i> Candy</span>' : ''}
                </div>
                <img class="rotation-card-img" src="${imgUrl}" alt="${s.name}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${s.dexNr}.png'; this.onerror=null;">
                <div class="rotation-card-details-wrapper">
                    <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">${dexFormatted}</span>
                    <span class="rotation-card-name">${s.name}</span>
                    <div class="rotation-cp-details">
                        ${rateBadge}
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    grid.innerHTML = html;

    grid.querySelectorAll('.spawn-card').forEach(card => {
        card.addEventListener('click', () => {
            const dex = card.dataset.dex;
            const targetPoke = pokemonDatabase.find(p => Number(p.id) === Number(dex));
            if (targetPoke) {
                openModal(targetPoke.id);
            }
        });
    });
}

function updateModalCatchBtn(id) {
    const isCaught = caughtPokemon.has(id) || caughtPokemon.has(Number(id));
    if (isCaught) {
        modalCatchToggle.className = 'catch-action-btn is-caught';
        modalCatchToggle.innerHTML = `
            <i class="fa-solid fa-circle-xmark"></i>
            <span>Remove from Collection</span>
        `;
    } else {
        modalCatchToggle.className = 'catch-action-btn uncaught';
        modalCatchToggle.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>Mark as Caught</span>
        `;
    }
}

function renderActiveRotations() {
    const raidsContainer = document.getElementById('raids-tiers-container');
    const eggsContainer = document.getElementById('eggs-types-container');
    const researchGrid = document.getElementById('active-research-grid');

    if (!raidsContainer || !eggsContainer || !researchGrid) return;

    // Clear contents
    raidsContainer.innerHTML = '';
    eggsContainer.innerHTML = '';
    researchGrid.innerHTML = '';

    // 1. Group and Render Raids by Tier
    if (liveRaids.length === 0) {
        raidsContainer.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">No active raids found.</p>';
    } else {
        const raidsByTier = {};
        liveRaids.forEach(r => {
            const tier = r.tier || "1-Star Raids";
            if (!raidsByTier[tier]) raidsByTier[tier] = [];
            raidsByTier[tier].push(r);
        });

        const sortedTiers = [
            "Mega Raids", 
            "5-Star Raids", 
            "Shadow 5-Star Raids", 
            "3-Star Raids", 
            "Shadow 3-Star Raids", 
            "1-Star Raids",
            "Shadow 1-Star Raids"
        ];
        const keys = Object.keys(raidsByTier).sort((a, b) => {
            const idxA = sortedTiers.indexOf(a);
            const idxB = sortedTiers.indexOf(b);
            return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        });

        keys.forEach(tier => {
            const sub = document.createElement('div');
            let subClass = 'one-star';
            let cardTheme = 'theme-green';
            let icon = 'fa-circle-chevron-up';

            if (tier.includes("Mega")) {
                subClass = 'mega';
                cardTheme = 'theme-mega';
                icon = 'fa-bolt';
            } else if (tier.includes("Shadow")) {
                subClass = 'shadow';
                cardTheme = 'theme-shadow';
                icon = 'fa-ghost';
            } else if (tier.includes("5")) {
                subClass = 'five-star';
                cardTheme = 'theme-purple';
                icon = 'fa-certificate';
            } else if (tier.includes("3")) {
                subClass = 'three-star';
                cardTheme = 'theme-blue';
                icon = 'fa-star';
            }

            sub.className = `rotation-subchapter ${subClass}`;
            sub.innerHTML = `
                <h4 class="rotation-subchapter-title">
                    <i class="fa-solid ${icon}"></i> ${tier}
                </h4>
                <div class="rotation-grid-layout"></div>
            `;
            raidsContainer.appendChild(sub);

            const grid = sub.querySelector(`.rotation-grid-layout`);
            raidsByTier[tier].forEach(raid => {
                const card = document.createElement('div');
                const raidName = safeLower(raid.name);
                const raidIdName = safeLower(raid.idName);
                const matchedPoke = pokemonDatabase.find(p => p.idName && raidIdName && safeLower(p.idName) === raidIdName) || pokemonDatabase.find(p => p.name && raidName && safeLower(p.name) === raidName);
                // For Megas/forms, also try to find the base form for click/highlight purposes
                const baseFormPoke = matchedPoke || (() => {
                    const nameLower = raidName;
                    // Strip common form prefixes/suffixes to find base species
                    let baseName = nameLower
                        .replace(/^mega /, '')
                        .replace(/^primal /, '')
                        .replace(/^shadow /, '')
                        .replace(/\s*\(.*\)$/, '')        // remove trailing (Altered Form) etc
                        .replace(/\s+(altered|origin|therian|incarnate|sky|land|standard|zen|ordinary|resolute|blade|shield|rapid-strike|single-strike)\s+form$/i, '')
                        .replace(/^(alolan|galarian|hisuian|paldean)\s+/, '');
                    return pokemonDatabase.find(p => p.name && safeLower(p.name) === baseName) || null;
                })();
                const targetPoke = matchedPoke || baseFormPoke;
                const isTransferred = targetPoke && isPokemonTransferred(targetPoke);
                const isMissing = targetPoke && !isTransferred && (!caughtPokemon.has(targetPoke.id) && !caughtPokemon.has(Number(targetPoke.id)));
                const isCandyNeeded = matchedPoke && needsCandies(matchedPoke);
                const highlightClass = isTransferred ? 'transferred-rotation-target' : (isMissing ? 'missing-rotation-target' : (isCandyNeeded ? 'candy-rotation-target' : ''));
                card.className = `rotation-card-item ${cardTheme} ${highlightClass} spawn-animation`;
                card.setAttribute('data-scroll-target', `raid-${raidName.replace(/\s+/g, '-')}-${safeLower(tier).replace(/[^a-z0-9]/g, '')}`);
                
                // Try to get official artwork; only fall back to PoGo-style leekduck icon as last resort
                let imgUrl = getPokemonImageUrl(raid.name, matchedPoke);
                if (!imgUrl) {
                    // If we have a base form, use its official artwork
                    imgUrl = baseFormPoke ? baseFormPoke.img : (raid.image || '');
                }

                let cpMeta = '';
                if (raid.cp) {
                    let normalText = '';
                    let boostedText = '';
                    if (raid.cp.normal && raid.cp.normal.max) {
                        normalText = `<div><i class="fa-solid fa-gamepad" style="font-size:0.65rem; opacity:0.7;"></i> <span>Normal: <strong>${raid.cp.normal.max}</strong> CP</span></div>`;
                    }
                    if (raid.cp.boosted && raid.cp.boosted.max) {
                        boostedText = `<div><i class="fa-solid fa-cloud-sun-rain" style="font-size:0.65rem; opacity:0.7;"></i> <span>Boosted: <strong>${raid.cp.boosted.max}</strong> CP</span></div>`;
                    }
                    if (normalText || boostedText) {
                        cpMeta = `<div class="rotation-cp-details">${normalText}${boostedText}</div>`;
                    }
                }

                let recommendedTrainers = '';
                if (raid.battleResult) {
                    const easyEst = raid.battleResult.easy ? raid.battleResult.easy.totalEstimator : null;
                    const normalEst = raid.battleResult.normal ? raid.battleResult.normal.totalEstimator : null;
                    const hardEst = raid.battleResult.hard ? raid.battleResult.hard.totalEstimator : null;

                    const easyVal = typeof easyEst === 'number' ? easyEst.toFixed(1) : '-';
                    const normalVal = typeof normalEst === 'number' ? normalEst.toFixed(1) : '-';
                    const hardVal = typeof hardEst === 'number' ? hardEst.toFixed(1) : '-';

                    recommendedTrainers = `
                        <div class="difficulty-estimators" style="display: flex; gap: 6px; justify-content: flex-start; margin-top: 0.3rem; font-size: 0.7rem; font-weight: 700;">
                            <span style="color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.2); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 2px;" title="Hard (Lvl 40)">
                                <i class="fa-solid fa-fire-flame-curved" style="font-size:0.6rem;"></i> H:${hardVal}
                            </span>
                            <span style="color: #f5a623; background: rgba(245, 166, 35, 0.12); border: 1px solid rgba(245, 166, 35, 0.2); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 2px;" title="Normal (Lvl 30)">
                                <i class="fa-solid fa-shield" style="font-size:0.6rem;"></i> N:${normalVal}
                            </span>
                            <span style="color: #34d399; background: rgba(52, 211, 153, 0.12); border: 1px solid rgba(52, 211, 153, 0.2); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 2px;" title="Easy (Lvl 20)">
                                <i class="fa-solid fa-leaf" style="font-size:0.6rem;"></i> E:${easyVal}
                            </span>
                        </div>
                    `;
                }

                let weatherHtml = '';
                if (raid.weatherBoosts && raid.weatherBoosts.length > 0) {
                    const wIcons = {
                        sunny: 'fa-sun',
                        clear: 'fa-sun',
                        rainy: 'fa-cloud-showers-water',
                        partlycloudy: 'fa-cloud-sun',
                        cloudy: 'fa-cloud',
                        windy: 'fa-wind',
                        snow: 'fa-snowflake',
                        fog: 'fa-smog'
                    };
                    const badges = raid.weatherBoosts.map(w => {
                        const wName = typeof w === 'object' && w ? (w.name || '') : String(w || '');
                        const wLower = safeLower(wName).replace(/_/g, '').trim();
                        const icon = wIcons[wLower] || 'fa-cloud-sun';
                        return `<span class="weather-badge" style="font-size: 0.68rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 3px;" title="Boosted in ${wName} weather"><i class="fa-solid ${icon}"></i> ${wName}</span>`;
                    }).join(', ');
                    weatherHtml = `<div class="raid-weather-boosts" style="margin-top: 0.3rem; font-size: 0.7rem; display: flex; align-items: center; gap: 4px; color: var(--text-secondary);"><span>Weather Boost:</span> ${badges}</div>`;
                }

                let countersHtml = '';
                if (raid.counters && Object.keys(raid.counters).length > 0) {
                    const sortedCounters = Object.entries(raid.counters)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3);
                    
                    const badges = sortedCounters.map(([type, mult]) => {
                        const typeLower = type.toLowerCase();
                        return `<span class="counter-type-badge type-${typeLower}" style="font-size: 0.68rem; padding: 2px 5px; border-radius: 4px; text-transform: capitalize; color: #111b2e; background-color: color-mix(in srgb, var(--type-${typeLower}) 30%, #ffffff); font-weight: 700;" title="Counter multiplier: ${mult}x">${type} ${mult}x</span>`;
                    }).join(' ');
                    countersHtml = `<div class="raid-counters-list" style="display: flex; gap: 6px; align-items: center; justify-content: flex-start; flex-wrap: wrap; margin-top: 0.3rem;"><span>Top Counters:</span> ${badges}</div>`;
                }

                card.innerHTML = `
                    ${raid.shiny ? shinySparkleSvg : ''}
                    <div class="rotation-badges">
                        ${isTransferred ? '<span class="transferred-rotation-badge"><i class="fa-solid fa-arrows-spin"></i> Transferred</span>' : (isMissing ? '<span class="missing-rotation-badge"><i class="fa-solid fa-crosshairs"></i> Missing</span>' : '')}
                        ${isCandyNeeded && !isTransferred ? '<span class="candy-rotation-badge"><i class="fa-solid fa-candy-cane"></i> Candy</span>' : ''}
                    </div>
                    <img class="rotation-card-img" src="${imgUrl}" alt="${raid.name}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${matchedPoke ? matchedPoke.id : ''}.png'">
                    <div class="rotation-card-details-wrapper">
                        <span class="rotation-card-name">${raid.name}</span>
                        ${cpMeta}
                        ${recommendedTrainers}
                        ${weatherHtml}
                        ${countersHtml}
                    </div>
                `;

                // Allow clicking if we have either a direct match or a base form match
                const clickTarget = matchedPoke || baseFormPoke;
                if (clickTarget) {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', () => {
                        openModal(clickTarget.id);
                    });
                }
                grid.appendChild(card);
            });
        });
    }

    // 2. Group and Render Eggs by Type
    if (liveEggs.length === 0) {
        eggsContainer.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">No active egg pools found.</p>';
    } else {
        const eggsByType = {};
        liveEggs.forEach(e => {
            const eggT = e.eggT || "5km";
            if (!eggsByType[eggT]) eggsByType[eggT] = [];
            eggsByType[eggT].push(e);
        });

        const eggOrder = ["1km", "2km", "5km", "adventure5km", "7km", "route", "10km", "adventure10km", "12km"];
        const keys = Object.keys(eggsByType).sort((a, b) => {
            return eggOrder.indexOf(a) - eggOrder.indexOf(b);
        });

        keys.forEach(eggT => {
            const sub = document.createElement('div');
            let subClass = 'egg-5km';
            let cardTheme = 'theme-blue';
            let label = eggT === '5km' ? '5km Eggs' : eggT;

            if (eggT === '1km' || eggT === '2km') {
                subClass = 'egg-2km';
                cardTheme = 'theme-green';
                label = eggT === '1km' ? '1km Eggs' : '2km Eggs';
            } else if (eggT === '7km' || eggT === 'route') {
                subClass = 'egg-7km';
                cardTheme = 'theme-pink';
                label = eggT === 'route' ? 'Route Gift (7km)' : '7km Eggs';
            } else if (eggT === '10km' || eggT === 'adventure10km') {
                subClass = 'egg-10km';
                cardTheme = 'theme-purple';
                label = eggT === 'adventure10km' ? 'Adventure Sync (10km)' : '10km Eggs';
            } else if (eggT === '12km') {
                subClass = 'egg-12km';
                cardTheme = 'theme-red';
                label = 'Strange Eggs (12km)';
            } else if (eggT === 'adventure5km') {
                label = 'Adventure Sync (5km)';
            }

            sub.className = `rotation-subchapter ${subClass}`;
            sub.innerHTML = `
                <h4 class="rotation-subchapter-title">
                    <i class="fa-solid fa-egg"></i> ${label}
                </h4>
                <div class="rotation-grid-layout"></div>
            `;
            eggsContainer.appendChild(sub);

            const grid = sub.querySelector(`.rotation-grid-layout`);
            eggsByType[eggT].forEach(egg => {
                const card = document.createElement('div');
                const matchedPoke = pokemonDatabase.find(p => p.id == egg.dex);
                const isTransferred = matchedPoke && isPokemonTransferred(matchedPoke);
                const isMissing = matchedPoke && !isTransferred && (!caughtPokemon.has(matchedPoke.id) && !caughtPokemon.has(Number(matchedPoke.id)));
                const isCandyNeeded = matchedPoke && needsCandies(matchedPoke);
                const highlightClass = isTransferred ? 'transferred-rotation-target' : (isMissing ? 'missing-rotation-target' : (isCandyNeeded ? 'candy-rotation-target' : ''));
                card.className = `rotation-card-item ${cardTheme} ${highlightClass} spawn-animation`;
                card.setAttribute('data-scroll-target', `egg-${safeLower(egg.name).replace(/\s+/g, '-')}-${safeLower(eggT).replace(/[^a-z0-9]/g, '')}`);
                
                let imgUrl = getPokemonImageUrl(egg.name, matchedPoke);
                if (!imgUrl) {
                    if (egg.image) {
                        imgUrl = egg.image;
                    } else if (egg.dex && egg.dex !== 'null') {
                        imgUrl = `https://raw.githubusercontent.com/pokemon-go-api/assets/main/Pokemon/pm${egg.dex}.icon.png`;
                    } else {
                        imgUrl = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22 opacity=%220.3%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22none%22 stroke=%22%23cbd5e1%22 stroke-width=%228%22/><line x1=%2210%22 y1=%2250%22 x2=%2290%22 y2=%2250%22 stroke=%22%23cbd5e1%22 stroke-width=%228%22/></svg>';
                    }
                }
                const eggOnerror = (egg.dex && egg.dex !== 'null') 
                    ? `onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${egg.dex}.png'; this.onerror=function(){this.style.opacity=0.3; if(window.sendNtfyNotification) window.sendNtfyNotification('Imagem falhou ao carregar: ${egg.name}');};"`
                    : `onerror="this.style.opacity=0.3; if(window.sendNtfyNotification) window.sendNtfyNotification('Imagem falhou ao carregar: ${egg.name}');"`;

                let cpMeta = '';
                if ((egg.cp && egg.cp.max && egg.cp.max !== 'N/A') || egg.rarity) {
                    let cpPart = '';
                    if (egg.cp && egg.cp.max && egg.cp.max !== 'N/A') {
                        cpPart = `<div><i class="fa-solid fa-egg" style="font-size:0.65rem; opacity:0.7;"></i> <span>Max Hatch: <strong>${egg.cp.max}</strong> CP</span></div>`;
                    }
                    let rarityPart = '';
                    if (egg.rarity) {
                        const eggIcons = Array(egg.rarity).fill('<i class="fa-solid fa-egg" style="font-size:0.6rem; color: var(--accent-color);"></i>').join('');
                        rarityPart = `<div style="margin-top: 2px;"><span style="font-size:0.68rem; opacity:0.8;">Rarity:</span> <span style="display:inline-flex; gap:1px; margin-left: 2px;">${eggIcons}</span></div>`;
                    }
                    cpMeta = `<div class="rotation-cp-details">${cpPart}${rarityPart}</div>`;
                }

                card.innerHTML = `
                    ${egg.shiny ? shinySparkleSvg : ''}
                    <div class="rotation-badges">
                        ${isTransferred ? '<span class="transferred-rotation-badge"><i class="fa-solid fa-arrows-spin"></i> Transferred</span>' : (isMissing ? '<span class="missing-rotation-badge"><i class="fa-solid fa-crosshairs"></i> Missing</span>' : '')}
                        ${isCandyNeeded && !isTransferred ? '<span class="candy-rotation-badge"><i class="fa-solid fa-candy-cane"></i> Candy</span>' : ''}
                    </div>
                    <img class="rotation-card-img" src="${imgUrl}" alt="${egg.name}" ${eggOnerror}>
                    <span class="rotation-card-name">${egg.name}</span>
                    ${cpMeta}
                `;

                card.addEventListener('click', () => {
                    const found = pokemonDatabase.find(p => p.id == egg.dex);
                    if (found) openModal(found.id);
                });
                grid.appendChild(card);
            });
        });
    }

    // 3. Render Quests Grid
    const researchEncounters = [];
    liveResearch.forEach(task => {
        const rawTaskText = task.text || task.task || task.title || "Field Research Task";
        const cleanTaskText = rawTaskText.replace(/<[^>]*>/g, '').trim();
        if (task.rewards && Array.isArray(task.rewards)) {
            task.rewards.forEach(reward => {
                const rawName = reward.name || reward.pokemon || "Reward";
                const cleanName = rawName.replace(/<[^>]*>/g, '').trim();
                const matchedPoke = (reward.dex && reward.dex !== 'null')
                    ? pokemonDatabase.find(p => p.id == reward.dex)
                    : findPokemonByName(cleanName);

                // Include if matched to a Pokemon or if reward contains a valid Pokemon name
                if (matchedPoke) {
                    const isShiny = reward.canBeShiny || reward.shiny || false;
                    let maxCp = reward.max_cp || (reward.combatPower ? reward.combatPower.max : null);
                    let minCp = reward.min_cp || (reward.combatPower ? reward.combatPower.min : null);
                    if (!maxCp && reward.cp) {
                        maxCp = typeof reward.cp === 'object' ? reward.cp.max : String(reward.cp);
                    }
                    researchEncounters.push({
                        taskText: cleanTaskText,
                        fullPokeName: cleanName,
                        basePokeName: matchedPoke.name,
                        dex: matchedPoke.id,
                        image: reward.image || reward.img || null,
                        shiny: isShiny,
                        minCp: minCp,
                        maxCp: maxCp
                    });
                }
            });
        }
    });

    if (researchEncounters.length === 0) {
        researchGrid.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">No active research rewards found.</p>';
    } else {
        researchGrid.innerHTML = '';
        const encountersByQuest = {};
        researchEncounters.forEach(encounter => {
            if (!encountersByQuest[encounter.taskText]) {
                encountersByQuest[encounter.taskText] = [];
            }
            encountersByQuest[encounter.taskText].push(encounter);
        });

        Object.entries(encountersByQuest).forEach(([taskText, encounters]) => {
            const sub = document.createElement('div');
            sub.className = 'rotation-subchapter';
            sub.innerHTML = `
                <h4 class="rotation-subchapter-title">
                    <i class="fa-solid fa-scroll"></i> ${taskText}
                </h4>
                <div class="rotation-grid-layout"></div>
            `;
            researchGrid.appendChild(sub);
            
            const grid = sub.querySelector('.rotation-grid-layout');
            encounters.forEach(encounter => {
                const card = document.createElement('div');
                const matchedPoke = pokemonDatabase.find(p => p.id == encounter.dex) || findPokemonByName(encounter.fullPokeName);
                const isTransferred = matchedPoke && isPokemonTransferred(matchedPoke);
                const isMissing = matchedPoke && !isTransferred && (!caughtPokemon.has(matchedPoke.id) && !caughtPokemon.has(Number(matchedPoke.id)));
                const isCandyNeeded = matchedPoke && needsCandies(matchedPoke);
                const highlightClass = isTransferred ? 'transferred-rotation-target' : (isMissing ? 'missing-rotation-target' : (isCandyNeeded ? 'candy-rotation-target' : ''));
                card.className = `rotation-card-item theme-blue ${highlightClass} spawn-animation`;
                const keyName = matchedPoke ? matchedPoke.name : encounter.fullPokeName;
                card.setAttribute('data-scroll-target', `quest-${safeLower(keyName).replace(/\s+/g, '-')}-${safeLower(taskText).replace(/[^a-z0-9]/g, '')}`);
                
                // Prioritize official Pokemon artwork over LeekDuck images
                let imgUrl = matchedPoke ? matchedPoke.img : getPokemonImageUrl(encounter.fullPokeName, matchedPoke);
                if (!imgUrl) {
                    imgUrl = encounter.image || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${encounter.dex}.png`;
                }
                const fallbackDex = matchedPoke ? matchedPoke.id : encounter.dex;
                const questOnerror = (fallbackDex && fallbackDex !== 'null') 
                    ? `onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${fallbackDex}.png'; this.onerror=function(){this.style.opacity=0.3; if(window.sendNtfyNotification) window.sendNtfyNotification('Imagem falhou ao carregar: ${encounter.fullPokeName}');};"`
                    : `onerror="this.style.opacity=0.3; if(window.sendNtfyNotification) window.sendNtfyNotification('Imagem falhou ao carregar: ${encounter.fullPokeName}');"`;

                let cpMeta = '';
                if (encounter.maxCp) {
                    cpMeta = `<div class="rotation-cp-details"><div><i class="fa-solid fa-star" style="font-size:0.65rem; opacity:0.7;"></i> <span>Max CP: <strong>${encounter.maxCp}</strong></span></div></div>`;
                }

                card.innerHTML = `
                    ${encounter.shiny ? shinySparkleSvg : ''}
                    <div class="rotation-badges">
                        ${isTransferred ? '<span class="transferred-rotation-badge"><i class="fa-solid fa-arrows-spin"></i> Transferred</span>' : (isMissing ? '<span class="missing-rotation-badge"><i class="fa-solid fa-crosshairs"></i> Missing</span>' : '')}
                        ${isCandyNeeded && !isTransferred ? '<span class="candy-rotation-badge"><i class="fa-solid fa-candy-cane"></i> Candy</span>' : ''}
                    </div>
                    <img class="rotation-card-img" src="${imgUrl}" alt="${encounter.fullPokeName}" ${questOnerror}>
                    <span class="rotation-card-name">${encounter.fullPokeName}</span>
                    ${cpMeta}
                `;
                
                card.addEventListener('click', () => {
                    const found = (encounter.dex && encounter.dex !== 'null') 
                        ? pokemonDatabase.find(p => p.id == encounter.dex) 
                        : findPokemonByName(encounter.fullPokeName);
                    if (found) openModal(found.id);
                });
                
                grid.appendChild(card);
            });
        });
    }

    // 5. Render Team GO Rocket Lineups
    renderRocketLineups();

    // 6. Render Party Rewards
    const partyGrid = document.getElementById('party-rewards-grid');
    if (partyGrid) {
        renderPartyRewardsByQuest(partyGrid, partyRewardsData, 'theme-blue');
    }

    // Toggle tab buttons and sections based on actual data availability
    const hasRaids = liveRaids.length > 0;
    const hasEggs = liveEggs.length > 0;
    const hasQuests = researchEncounters.length > 0;
    const hasRocket = liveRocket && Object.keys(liveRocket).length > 0;

    const navBtnRaids = document.querySelector('.subnav-btn[data-target="rotations-raids-section"]');
    const navBtnEggs = document.querySelector('.subnav-btn[data-target="rotations-eggs-section"]');
    const navBtnQuests = document.querySelector('.subnav-btn[data-target="rotations-quests-section"]');
    const navBtnRocket = document.querySelector('.subnav-btn[data-target="rotations-rocket-section"]');
    const navBtnParty = document.querySelector('.subnav-btn[data-target="rotations-party-section"]');

    const secRaids = document.getElementById('rotations-raids-section');
    const secEggs = document.getElementById('rotations-eggs-section');
    const secQuests = document.getElementById('rotations-quests-section');
    const secRocket = document.getElementById('rotations-rocket-section');
    const secParty = document.getElementById('rotations-party-section');

    if (navBtnRaids) navBtnRaids.style.display = hasRaids ? '' : 'none';
    if (navBtnEggs) navBtnEggs.style.display = hasEggs ? '' : 'none';
    if (navBtnQuests) navBtnQuests.style.display = hasQuests ? '' : 'none';
    if (navBtnRocket) navBtnRocket.style.display = hasRocket ? '' : 'none';
    if (navBtnParty) navBtnParty.style.display = '';

    // Set first visible category active if the currently active category has no items
    const activeBtn = document.querySelector('.subnav-btn.active');
    if (!activeBtn || activeBtn.style.display === 'none') {
        const visibleBtns = Array.from(document.querySelectorAll('.subnav-btn')).filter(btn => btn.style.display !== 'none');
        document.querySelectorAll('.subnav-btn').forEach(btn => btn.classList.remove('active'));
        
        // Hide all rotation sections initially
        if (secRaids) secRaids.classList.add('hidden');
        if (secEggs) secEggs.classList.add('hidden');
        if (secQuests) secQuests.classList.add('hidden');
        if (secRocket) secRocket.classList.add('hidden');
        if (secParty) secParty.classList.add('hidden');

        if (visibleBtns.length > 0) {
            const defaultBtn = visibleBtns[0];
            defaultBtn.classList.add('active');
            const targetSec = document.getElementById(defaultBtn.dataset.target);
            if (targetSec) {
                targetSec.classList.remove('hidden');
            }
        }
    } else {
        // Just make sure active tab section is visible and other sections are hidden
        const targetSecId = activeBtn.dataset.target;
        if (secRaids) secRaids.classList.toggle('hidden', targetSecId !== 'rotations-raids-section');
        if (secEggs) secEggs.classList.toggle('hidden', targetSecId !== 'rotations-eggs-section');
        if (secQuests) secQuests.classList.toggle('hidden', targetSecId !== 'rotations-quests-section');
        if (secRocket) secRocket.classList.toggle('hidden', targetSecId !== 'rotations-rocket-section');
        if (secParty) secParty.classList.toggle('hidden', targetSecId !== 'rotations-party-section');
    }
}

// Party & Special Rewards Data and helper function
let partyRewardsData = [
    { dex: 924, name: "Tandemaus", task: "Complete Party Challenges", shiny: true },
    { dex: 133, name: "Eevee", task: "Walk 2 km", shiny: true },
    { dex: 374, name: "Beldum", task: "Walk 2 km", shiny: true },
    { dex: 134, name: "Vaporeon", task: "Catch 20 Pokémon (Ultra Balls)", shiny: true },
    { dex: 135, name: "Jolteon", task: "Catch 20 Pokémon (Ultra Balls)", shiny: true },
    { dex: 136, name: "Flareon", task: "Catch 20 Pokémon (Ultra Balls)", shiny: true },
    { dex: 110, name: "Galarian Weezing", task: "10 Excellent Throws", shiny: true },
    { dex: 113, name: "Chansey", task: "10 Excellent Throws", shiny: true },
    { dex: 131, name: "Lapras", task: "10 Excellent Throws", shiny: true },
    { dex: 599, name: "Klink", task: "10 Excellent Throws", shiny: true },
    { dex: 299, name: "Nosepass", task: "20 Great Throws", shiny: true },
    { dex: 415, name: "Combee", task: "20 Great Throws", shiny: true },
    { dex: 420, name: "Cherubi", task: "20 Great Throws", shiny: true },
    { dex: 688, name: "Binacle", task: "20 Great Throws", shiny: true },
    { dex: 50, name: "Diglett", task: "10 Nice Throws", shiny: true },
    { dex: 81, name: "Magnemite", task: "10 Nice Throws", shiny: true },
    { dex: 109, name: "Koffing", task: "10 Nice Throws", shiny: true }
];


function renderPartyRewardsByQuest(container, data, cardTheme = 'theme-blue') {
    if (!container) return;
    container.innerHTML = '';
    if (!data || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">No active Party Play challenges found.</p>';
        return;
    }

    // Filter items to pokemon encounters only
    const pokemonItems = [];
    data.forEach(item => {
        if (item.rewards && Array.isArray(item.rewards)) {
            item.rewards.forEach(r => {
                const matchedPoke = findPokemonByName(r.name);
                if (matchedPoke) {
                    pokemonItems.push({
                        dex: matchedPoke.id,
                        name: matchedPoke.name,
                        task: item.task || item.category || "Party Challenge",
                        shiny: r.canBeShiny || r.shiny || false
                    });
                }
            });
        } else if (item.dex || item.name) {
            const matchedPoke = item.dex ? pokemonDatabase.find(p => p.id == item.dex) : findPokemonByName(item.name);
            if (matchedPoke) {
                pokemonItems.push({
                    dex: matchedPoke.id,
                    name: matchedPoke.name,
                    task: item.task || "Party Challenge",
                    shiny: item.shiny || false
                });
            }
        }
    });

    if (pokemonItems.length === 0) {
        container.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">No active Pokémon encounters in Party Play challenges.</p>';
        return;
    }

    // Group by task text
    const encountersByQuest = {};
    pokemonItems.forEach(item => {
        if (!encountersByQuest[item.task]) {
            encountersByQuest[item.task] = [];
        }
        encountersByQuest[item.task].push(item);
    });

    Object.entries(encountersByQuest).forEach(([taskText, encounters]) => {
        const sub = document.createElement('div');
        sub.className = 'rotation-subchapter';
        sub.innerHTML = `
            <h4 class="rotation-subchapter-title">
                <i class="fa-solid fa-users"></i> ${taskText}
            </h4>
            <div class="rotation-grid-layout"></div>
        `;
        container.appendChild(sub);

        const grid = sub.querySelector('.rotation-grid-layout');
        encounters.forEach(item => {
            const card = document.createElement('div');
            const matchedPoke = pokemonDatabase.find(p => p.id == item.dex);
            const isTransferred = matchedPoke && isPokemonTransferred(matchedPoke);
            const isMissing = matchedPoke && !isTransferred && (!caughtPokemon.has(matchedPoke.id) && !caughtPokemon.has(Number(matchedPoke.id)));
            const isCandyNeeded = matchedPoke && needsCandies(matchedPoke);
            const highlightClass = isTransferred ? 'transferred-rotation-target' : (isMissing ? 'missing-rotation-target' : (isCandyNeeded ? 'candy-rotation-target' : ''));
            card.className = `rotation-card-item ${cardTheme} ${highlightClass} spawn-animation`;
            card.setAttribute('data-scroll-target', `party-${safeLower(item.name).replace(/\s+/g, '-')}-${safeLower(taskText).replace(/[^a-z0-9]/g, '')}`);

            let imgUrl = matchedPoke ? matchedPoke.img : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${item.dex}.png`;
            const imgOnerror = `onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${item.dex}.png'; this.onerror=null;"`;

            card.innerHTML = `
                ${item.shiny ? shinySparkleSvg : ''}
                <div class="rotation-badges">
                    ${isTransferred ? '<span class="transferred-rotation-badge"><i class="fa-solid fa-arrows-spin"></i> Transferred</span>' : (isMissing ? '<span class="missing-rotation-badge"><i class="fa-solid fa-crosshairs"></i> Missing</span>' : '')}
                    ${isCandyNeeded && !isTransferred ? '<span class="candy-rotation-badge"><i class="fa-solid fa-candy-cane"></i> Candy</span>' : ''}
                </div>
                <img class="rotation-card-img" src="${imgUrl}" alt="${item.name}" ${imgOnerror}>
                <span class="rotation-card-name">${item.name}</span>
            `;

            card.addEventListener('click', () => {
                if (matchedPoke) openModal(matchedPoke.id);
            });
            grid.appendChild(card);
        });
    });
}

function renderRewardsListHelper(container, data, cardTheme) {
    if (!container) return;
    container.innerHTML = '';
    data.forEach(item => {
        const card = document.createElement('div');
        const matchedPoke = pokemonDatabase.find(p => p.id == item.dex);
        const isTransferred = matchedPoke && isPokemonTransferred(matchedPoke);
        const isMissing = matchedPoke && !isTransferred && (!caughtPokemon.has(matchedPoke.id) && !caughtPokemon.has(Number(matchedPoke.id)));
        const isCandyNeeded = matchedPoke && needsCandies(matchedPoke);
        const highlightClass = isTransferred ? 'transferred-rotation-target' : (isMissing ? 'missing-rotation-target' : (isCandyNeeded ? 'candy-rotation-target' : ''));
        card.className = `rotation-card-item ${cardTheme} ${highlightClass}`;
        
        let imgUrl = matchedPoke ? matchedPoke.img : '';
        if (!imgUrl) {
            imgUrl = `https://raw.githubusercontent.com/pokemon-go-api/assets/main/Pokemon/pm${item.dex}.icon.png`;
        }
        
        const imgOnerror = `onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${item.dex}.png'; this.onerror=null;"`;

        card.innerHTML = `
            ${item.shiny ? shinySparkleSvg : ''}
            <div class="rotation-badges">
                ${isTransferred ? '<span class="transferred-rotation-badge"><i class="fa-solid fa-arrows-spin"></i> Transferred</span>' : (isMissing ? '<span class="missing-rotation-badge"><i class="fa-solid fa-crosshairs"></i> Missing</span>' : '')}
                ${isCandyNeeded && !isTransferred ? '<span class="candy-rotation-badge"><i class="fa-solid fa-candy-cane"></i> Candy</span>' : ''}
            </div>
            <img class="rotation-card-img" src="${imgUrl}" alt="${item.name}" ${imgOnerror}>
            <span class="rotation-card-name">${item.name}</span>
            <div class="rotation-cp-details" style="margin-top: 4px; font-size: 0.75rem; text-align: center; color: var(--text-secondary);">
                <span><i class="fa-solid fa-circle-info" style="font-size:0.65rem; opacity:0.7;"></i> ${item.task}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            if (matchedPoke) openModal(matchedPoke.id);
        });
        container.appendChild(card);
    });
}

function renderRocketLineups() {
    const container = document.getElementById('rocket-lineups-container');
    if (!container) return;
    container.innerHTML = '';

    if (!liveRocket || Object.keys(liveRocket).length === 0) {
        container.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">No active Team GO Rocket lineups found.</p>';
        return;
    }

    const gruntQuotes = {
        "Normal-type Male Grunt": "«Normal does not mean weak.»",
        "Fire-type Female Grunt": "«Do you know how hot fire breath can get?»",
        "Water-type Female Grunt": "«These waters are treacherous!»",
        "Water-type Male Grunt": "«These waters are treacherous!»",
        "Electric-type Female Grunt": "«Get ready to be shocked!»",
        "Grass-type Male Grunt": "«Don't tangle with us!»",
        "Ice-type Female Grunt": "«You're gonna be frozen in your tracks.»",
        "Fighting-type Female Grunt": "«This buff physique isn't just for show!»",
        "Poison-type Female Grunt": "«Coiled and ready to strike!»",
        "Ground-type Male Grunt": "«You'll be defeated into the ground!»",
        "Flying-type Female Grunt": "«Battle against my Flying-type Pokémon!»",
        "Psychic-type Male Grunt": "«Are you scared of psychic powers that use unseen gravity?»",
        "Bug-type Male Grunt": "«Go, my super bug Pokémon!»",
        "Rock-type Male Grunt": "«Let's rock and roll!»",
        "Ghost-type Male Grunt": "«Ke ke ke ke ke...»",
        "Dragon-type Female Grunt": "«ROAR! ... How'd that sound?»",
        "Dark-type Female Grunt": "«Wherever there is light, there is also shadow.»",
        "Steel-type Male Grunt": "«You're no match for my iron will!»",
        "Fairy-type Female Grunt": "«Check out my cute Pokémon!»",
        "Male Grunt": "«Winning is for winners.»",
        "Female Grunt": "«Winning is for winners.»",
        "Decoy Female Grunt": "«Fooled ya!»"
    };

    const primaryLeaders = ["Giovanni", "Cliff", "Arlo", "Sierra"];
    const keys = Object.keys(liveRocket);
    const leaders = keys.filter(k => primaryLeaders.includes(k)).sort((a, b) => primaryLeaders.indexOf(a) - primaryLeaders.indexOf(b));
    const grunts = keys.filter(k => !primaryLeaders.includes(k));

    const renderCharacter = (name, slotsData) => {
        const charEl = document.createElement('div');
        charEl.setAttribute('data-scroll-target', `rocket-${safeLower(name).replace(/\s+/g, '-')}`);

        let iconHtml = '<i class="fa-solid fa-user-ninja" style="color: #ef4444;"></i>';
        let cardColor = '#ef4444';

        const isLeader = primaryLeaders.includes(name);
        if (isLeader) {
            if (name === 'Giovanni') {
                iconHtml = '<i class="fa-solid fa-crown" style="color: #fbbf24;"></i>';
                cardColor = '#fbbf24';
            } else {
                iconHtml = '<i class="fa-solid fa-user-tie" style="color: #c084fc;"></i>';
                cardColor = '#c084fc';
            }
        } else {
            const cleanName = name.replace(/\u00a0/g, ' ').trim();
            if (cleanName.includes('-type')) {
                const extractedType = cleanName.split('-type')[0].toLowerCase().trim();
                cardColor = `var(--type-${extractedType})`;
            }
        }

        charEl.className = 'rocket-character-card';
        charEl.style.background = `linear-gradient(135deg, color-mix(in srgb, ${cardColor} 6%, rgba(0,0,0,0.3)), rgba(0,0,0,0.2))`;
        charEl.style.borderColor = `color-mix(in srgb, ${cardColor} 20%, rgba(255,255,255,0.04))`;

        const cleanKey = name.replace(/\u00a0/g, ' ').trim();
        const quote = gruntQuotes[cleanKey] || "«Active Grunt Lineup»";

        let headerHtml = '';
        if (isLeader) {
            headerHtml = `
                <div class="rocket-char-header" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
                    <span style="font-size: 1.1rem; display: flex; align-items: center; justify-content: center;">${iconHtml}</span>
                    <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0;">${name}</h3>
                </div>
            `;
        } else {
            headerHtml = `
                <div class="rocket-char-header" style="display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
                    <span style="font-style: italic; font-size: 0.95rem; font-weight: 600; color: var(--text-primary); line-height: 1.3;">${quote}</span>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">${name}</span>
                    </div>
                </div>
            `;
        }

        charEl.innerHTML = `
            ${headerHtml}
            <div class="rocket-slots-container" style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;"></div>
        `;

        const slotsContainer = charEl.querySelector('.rocket-slots-container');
        if (slotsContainer && Array.isArray(slotsData)) {
            slotsData.forEach((slot) => {
                const isSlotEncounter = slot.is_encounter || (slot.pokemons && slot.pokemons.some(p => p && (p.isEncounter || p.is_encounter)));
                const slotEl = document.createElement('div');
                slotEl.className = 'rocket-slot';
                slotEl.style.cssText = 'display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); flex: 1;';
                slotEl.innerHTML = `
                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
                        <span>Slot ${slot.slot}</span>
                        ${isSlotEncounter ? '<span style="color: #10b981; font-size: 0.65rem;"><i class="fa-solid fa-star"></i> Encounter</span>' : ''}
                    </div>
                `;
                const pokeList = document.createElement('div');
                pokeList.className = 'rocket-slot-pokemons-list';
                pokeList.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

                if (Array.isArray(slot.pokemons)) {
                    slot.pokemons.forEach(poke => {
                        const pokeNameStr = safeLower(poke && typeof poke === 'object' ? poke.name : poke);
                        const matchedPoke = pokemonDatabase.find(p => p.name && safeLower(p.name) === pokeNameStr);
                        const isTransferred = matchedPoke && isPokemonTransferred(matchedPoke);
                        const isMissing = matchedPoke && (isPokemonMissing(matchedPoke) || isTransferred);
                        const isCandyNeeded = matchedPoke && needsCandies(matchedPoke);
                        const isEncounterPoke = (poke && (poke.isEncounter || poke.is_encounter)) || isSlotEncounter;

                        const rawName = poke && typeof poke === 'object' ? poke.name : poke;
                        const displayName = matchedPoke ? matchedPoke.name : formatSpawnName(rawName);

                        let highlightClass = '';
                        if (isEncounterPoke) {
                            highlightClass = isTransferred ? 'transferred-rotation-target' : (isMissing ? 'missing-rotation-target' : (isCandyNeeded ? 'candy-rotation-target' : ''));
                        }

                        const isShiny = (poke && (poke.canBeShiny || poke.shiny_available)) || false;
                        const shinyHtml = isShiny ? `
                            <svg class="shiny-icon-inline" viewBox="0 0 24 24" fill="currentColor" title="Shiny Available" style="width: 12px; height: 12px; color: #f5a623; display: inline-block; vertical-align: middle; margin-left: 4px; filter: drop-shadow(0 0 2px rgba(245, 166, 35, 0.6));">
                                <path d="M12 2l1.6 3.9 3.9 1.6-3.9 1.6-1.6 3.9-1.6-3.9-3.9-1.6 3.9-1.6zM6 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1zM18 13l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z"/>
                            </svg>
                        ` : '';

                        let imgUrl = getPokemonImageUrl(rawName, matchedPoke);
                        if (!imgUrl && matchedPoke) {
                            imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${matchedPoke.id}.png`;
                        }
                        if (!imgUrl) imgUrl = '';

                        let statusBadges = [];
                        if (isEncounterPoke) {
                            statusBadges.push(`<span style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 0.65rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;"><i class="fa-solid fa-crosshairs"></i> Catchable</span>`);
                            if (isTransferred) {
                                statusBadges.push(`<span style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.25); font-size: 0.65rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;"><i class="fa-solid fa-arrows-spin"></i> Transferred</span>`);
                            } else if (isMissing) {
                                statusBadges.push(`<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); font-size: 0.65rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;"><i class="fa-solid fa-crosshairs"></i> Missing</span>`);
                            } else if (isCandyNeeded) {
                                statusBadges.push(`<span style="background: rgba(245, 166, 35, 0.15); color: var(--accent-color); border: 1px solid rgba(245, 166, 35, 0.25); font-size: 0.65rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;"><i class="fa-solid fa-candy-cane"></i> Candy</span>`);
                            }
                        }

                        const pokeCard = document.createElement('div');
                        pokeCard.className = `rocket-poke-item ${highlightClass}`;
                        pokeCard.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); cursor: ${matchedPoke ? 'pointer' : 'default'}; transition: all 0.2s ease;`;

                        if (matchedPoke) {
                            pokeCard.addEventListener('mouseenter', () => {
                                pokeCard.style.background = 'rgba(255,255,255,0.06)';
                                pokeCard.style.borderColor = 'rgba(255,255,255,0.12)';
                                pokeCard.style.transform = 'translateX(2px)';
                            });
                            pokeCard.addEventListener('mouseleave', () => {
                                pokeCard.style.background = 'rgba(255,255,255,0.03)';
                                pokeCard.style.borderColor = 'rgba(255,255,255,0.05)';
                                pokeCard.style.transform = 'none';
                            });
                            pokeCard.addEventListener('click', () => openModal(matchedPoke.id));
                        }

                        pokeCard.innerHTML = `
                            <img src="${imgUrl}" alt="${displayName}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.src='${poke.asset_url || ''}'; this.onerror=null;">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-size: 0.8rem; font-weight: 500; color: var(--text-primary); display: flex; align-items: center; gap: 4px;">
                                    ${displayName}${shinyHtml}
                                </span>
                                <div style="display: flex; gap: 4px; flex-wrap: wrap;">${statusBadges.join('')}</div>
                            </div>
                        `;
                        pokeList.appendChild(pokeCard);
                    });
                }

                slotEl.appendChild(pokeList);
                slotsContainer.appendChild(slotEl);
            });
        }

        return charEl;
    };

    const leadersTitle = document.createElement('h3');
    leadersTitle.style.cssText = "font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 1rem 0 0.5rem 0; display: flex; align-items: center; gap: 8px;";
    leadersTitle.innerHTML = `<i class="fa-solid fa-crown" style="color: #fbbf24;"></i> Leaders & Giovanni`;
    container.appendChild(leadersTitle);

    const giovanni = leaders.find(name => name === 'Giovanni');
    const otherLeaders = leaders.filter(name => name !== 'Giovanni');

    if (giovanni) {
        const giovanniContainer = document.createElement('div');
        giovanniContainer.style.cssText = "margin-bottom: 1.25rem;";
        giovanniContainer.appendChild(renderCharacter(giovanni, liveRocket[giovanni]));
        container.appendChild(giovanniContainer);
    }

    if (otherLeaders.length > 0) {
        const leadersGrid = document.createElement('div');
        leadersGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 2rem;";
        container.appendChild(leadersGrid);

        otherLeaders.forEach(name => {
            leadersGrid.appendChild(renderCharacter(name, liveRocket[name]));
        });
    }

    if (grunts.length > 0) {
        const gruntsTitle = document.createElement('h3');
        gruntsTitle.style.cssText = "font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 1.5rem 0 0.5rem 0; display: flex; align-items: center; gap: 8px;";
        gruntsTitle.innerHTML = `<i class="fa-solid fa-user-ninja" style="color: #94a3b8;"></i> Rocket Grunts`;
        container.appendChild(gruntsTitle);

        const gruntsGrid = document.createElement('div');
        gruntsGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;";
        container.appendChild(gruntsGrid);

        grunts.forEach(name => {
            gruntsGrid.appendChild(renderCharacter(name, liveRocket[name]));
        });
    }
}

// ==========================================================================
// CANDIES CALCULATOR
// ==========================================================================
function loadCandyState() {
    try {
        const stored = localStorage.getItem('pogo_user_candies');
        if (stored) {
            userCandies = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load candy state:", e);
        userCandies = {};
    }
}

let saveCandiesCloudTimeout = null;
function saveCandyState(debounceCloud = false) {
    localStorage.setItem('pogo_user_candies', JSON.stringify(userCandies));
    if (currentUser) {
        if (debounceCloud) {
            clearTimeout(saveCandiesCloudTimeout);
            saveCandiesCloudTimeout = setTimeout(() => {
                saveUserDataToFirestore();
            }, 1000);
        } else {
            clearTimeout(saveCandiesCloudTimeout);
            saveUserDataToFirestore();
        }
    }
}

// ==========================================================================
// CLOUD DATABASE INTEGRATION (FIREBASE)
// ==========================================================================
async function saveUserDataToFirestore() {
    if (!currentUser) return;
    try {
        const dataToSave = {
            email: currentUser.email,
            displayName: currentUser.displayName || '',
            caught: Array.from(caughtPokemon).map(x => (isNaN(Number(x)) ? x : Number(x))),
            candies: userCandies,
            transferred: Array.from(transferredPokemon).map(x => (isNaN(Number(x)) ? x : Number(x))),
            updatedAt: new Date().toISOString()
        };
        if (currentTrainerUsername) {
            dataToSave.username = currentTrainerUsername;
            dataToSave.username_lowercase = currentTrainerUsername.toLowerCase();
        }
        await setDoc(doc(db, "users_data", currentUser.uid), dataToSave, { merge: true });
    } catch (e) {
        console.error("Error saving data to Firestore:", e);
    }
}

async function loadUserDataFromFirestore(user) {
    try {
        const docRef = doc(db, "users_data", user.uid);
        const docSnap = await getDoc(docRef);
        let hasUsername = false;
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentTrainerUsername = data.username || null;
            if (currentTrainerUsername) {
                hasUsername = true;
            }
            
            // Merge local and cloud data to prevent data loss on initial login
            const cloudCaught = data.caught || [];
            const cloudCandies = data.candies || {};
            const cloudTransferred = data.transferred || [];
            
            // Union of local and cloud caught Pokemon
            const mergedCaught = new Set([...caughtPokemon, ...cloudCaught.map(x => (isNaN(Number(x)) ? x : Number(x)))]);
            
            // Merge candies
            const mergedCandies = { ...userCandies, ...cloudCandies };

            // Union of local and cloud transferred Pokemon
            const mergedTransferred = new Set([...transferredPokemon, ...cloudTransferred.map(x => (isNaN(Number(x)) ? x : Number(x)))]);
            
            caughtPokemon = mergedCaught;
            userCandies = mergedCandies;
            transferredPokemon = mergedTransferred;
            
            // Sync with local storage
            localStorage.setItem('pogo_caught_pokemon', JSON.stringify(Array.from(caughtPokemon).map(x => (isNaN(Number(x)) ? x : Number(x)))));
            localStorage.setItem('pogo_user_candies', JSON.stringify(userCandies));
            localStorage.setItem('pogo_transferred_pokemon', JSON.stringify(Array.from(transferredPokemon).map(x => (isNaN(Number(x)) ? x : Number(x)))));
            
            // Sync merged state back to cloud immediately so both are up-to-date
            await saveUserDataToFirestore();
        } else {
            // Document doesn't exist, initialize Firestore with current local data
            await saveUserDataToFirestore();
        }
        
        if (!hasUsername) {
            openUsernameSetupModal();
        }
        
        // Trigger UI updates
        renderPokedex();
        renderMissingSummary();
        renderCandiesPane();
        updateDashboardStats();
        updateRegionStatsBadge();
    } catch (e) {
        console.error("Error loading data from Firestore:", e);
    }
}

// Handle sign-in redirect results on page load (essential for mobile Google login)
getRedirectResult(auth)
    .then((result) => {
        if (result && result.user) {
            console.log("Redirect login successful:", result.user);
        }
    })
    .catch((error) => {
        console.error("Redirect login error:", error);
    });

onAuthStateChanged(auth, async (user) => {
    const authStatusContainer = document.getElementById('auth-status-container');
    
    // Clean up active snapshot listener
    if (userDocListenerUnsubscribe) {
        userDocListenerUnsubscribe();
        userDocListenerUnsubscribe = null;
    }
    
    if (user) {
        currentUser = user;
        const trainerName = user.displayName || (user.email ? user.email.split('@')[0] : 'Trainer');
        
        if (authStatusContainer) {
            authStatusContainer.innerHTML = `
                <span style="color: #94a3b8; font-size: 0.8rem; font-weight: 600; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 0.5rem;">Trainer: ${trainerName}</span>
                <button class="logout-btn" id="logout-btn" title="Log Out" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); color: #f87171; padding: 6px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; height: 38px; width: auto !important;">
                    <i class="fa-solid fa-right-from-bracket"></i> Logout
                </button>
            `;
            
            // Bind logout handler
            document.getElementById('logout-btn').addEventListener('click', () => {
                signOut(auth).then(() => {
                    currentUser = null;
                    activeFriendUid = null;
                    activeFriendEmail = null;
                    caughtPokemon = new Set();
                    transferredPokemon = new Set();
                    userCandies = {};
                    loadCaughtState();
                    loadCandyState();
                    loadTransferredState();
                    
                    renderPokedex();
                    renderMissingSummary();
                    renderCandiesPane();
                    renderFriendsPane();
                    updateDashboardStats();
                    updateRegionStatsBadge();
                    
                    // Reset request badge
                    const badge = document.getElementById('friends-badge');
                    if (badge) badge.classList.add('hidden');
                }).catch((error) => {
                    console.error("Logout failed:", error);
                });
            });
        }
        
        // Load their database progress
        await loadUserDataFromFirestore(user);
        
        // Bind real-time Firestore sync listener
        userDocListenerUnsubscribe = onSnapshot(doc(db, "users_data", user.uid), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.username) {
                    currentTrainerUsername = data.username;
                    const span = authStatusContainer ? authStatusContainer.querySelector('span') : null;
                    if (span) {
                        span.textContent = `Trainer: ${data.username}`;
                    }
                }
                
                // Keep local state updated from cloud database in real-time
                const cloudCaught = data.caught || [];
                const cloudCandies = data.candies || {};
                const cloudTransferred = data.transferred || [];
                caughtPokemon = new Set(cloudCaught.map(x => (isNaN(Number(x)) ? x : Number(x))));
                userCandies = cloudCandies;
                transferredPokemon = new Set(cloudTransferred.map(x => (isNaN(Number(x)) ? x : Number(x))));
                localStorage.setItem('pogo_caught_pokemon', JSON.stringify(Array.from(caughtPokemon).map(x => (isNaN(Number(x)) ? x : Number(x)))));
                localStorage.setItem('pogo_user_candies', JSON.stringify(userCandies));
                localStorage.setItem('pogo_transferred_pokemon', JSON.stringify(Array.from(transferredPokemon).map(x => (isNaN(Number(x)) ? x : Number(x)))));
                
                renderPokedex();
                renderMissingSummary();
                renderCandiesPane();
                updateDashboardStats();
                updateRegionStatsBadge();
                
                // Refresh Friends Tab details in real-time
                renderFriendsPaneFromData(data);
            }
        });
    } else {
        currentUser = null;
        activeFriendUid = null;
        activeFriendEmail = null;
        if (authStatusContainer) {
            authStatusContainer.innerHTML = `
                <button class="bulk-btn" id="auth-trigger-btn" title="Sign In or Sign Up" style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); color: #818cf8; padding: 8px 14px; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: background 0.2s, transform 0.1s; height: 38px;">
                    <i class="fa-solid fa-user"></i> Login / Register
                </button>
            `;
            
            // Bind click to open login modal
            document.getElementById('auth-trigger-btn').addEventListener('click', openAuthModal);
        }
        renderFriendsPane();
        const badge = document.getElementById('friends-badge');
        if (badge) badge.classList.add('hidden');
    }
});

// ==========================================================================
// AUTH MODAL HANDLERS
// ==========================================================================
const authModal = document.getElementById('auth-modal');
const authCloseBtn = document.getElementById('auth-close-btn');
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authConfirmPasswordInput = document.getElementById('auth-confirm-password');
const authConfirmPasswordContainer = document.getElementById('auth-confirm-password-container');
const authForgotContainer = document.getElementById('auth-forgot-container');
const authForgotLink = document.getElementById('auth-forgot-link');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authErrorMsg = document.getElementById('auth-error-msg');
const authSwitchLink = document.getElementById('auth-switch-link');
const authSwitchText = document.getElementById('auth-switch-text');
const authModalTitle = document.getElementById('auth-modal-title');

let authMode = 'login'; // 'login' | 'register'

function openAuthModal() {
    if (authModal) {
        authModal.classList.remove('hidden');
        authEmailInput.value = '';
        authPasswordInput.value = '';
        if (authConfirmPasswordInput) authConfirmPasswordInput.value = '';
        authErrorMsg.style.display = 'none';
        setAuthMode('login');
    }
}

function closeAuthModal() {
    if (authModal) {
        authModal.classList.add('hidden');
    }
}

function setAuthMode(mode) {
    authMode = mode;
    authErrorMsg.style.display = 'none';
    if (mode === 'login') {
        authModalTitle.textContent = "Trainer Sign In";
        authSubmitBtn.textContent = "Sign In";
        authSwitchText.textContent = "Don't have an account?";
        authSwitchLink.textContent = "Create Account";
        if (authConfirmPasswordContainer) authConfirmPasswordContainer.classList.add('hidden');
        if (authConfirmPasswordInput) authConfirmPasswordInput.required = false;
        if (authForgotContainer) authForgotContainer.style.display = 'block';
    } else {
        authModalTitle.textContent = "Trainer Sign Up";
        authSubmitBtn.textContent = "Create Account";
        authSwitchText.textContent = "Already have an account?";
        authSwitchLink.textContent = "Sign In";
        if (authConfirmPasswordContainer) authConfirmPasswordContainer.classList.remove('hidden');
        if (authConfirmPasswordInput) authConfirmPasswordInput.required = true;
        if (authForgotContainer) authForgotContainer.style.display = 'none';
    }
}

// Bind auth modal close buttons and background clicks
if (authCloseBtn) {
    authCloseBtn.addEventListener('click', closeAuthModal);
}
if (authModal) {
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            closeAuthModal();
        }
    });
}

if (authSwitchLink) {
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        setAuthMode(authMode === 'login' ? 'register' : 'login');
    });
}

if (authForgotLink) {
    authForgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = authEmailInput.value.trim();
        authErrorMsg.style.display = 'none';
        
        if (!email) {
            authErrorMsg.style.color = '#ef4444';
            authErrorMsg.textContent = "Please enter your Email Address to recover password.";
            authErrorMsg.style.display = 'block';
            return;
        }
        
        try {
            await sendPasswordResetEmail(auth, email);
            authErrorMsg.style.color = '#34d399';
            authErrorMsg.textContent = "Password recovery email sent! Check your inbox.";
            authErrorMsg.style.display = 'block';
        } catch (err) {
            console.error("Password reset error:", err);
            authErrorMsg.style.color = '#ef4444';
            authErrorMsg.textContent = "Failed to send reset email. Verify your email address.";
            authErrorMsg.style.display = 'block';
        }
    });
}

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmailInput.value.trim();
        const password = authPasswordInput.value;
        
        authErrorMsg.style.color = '#ef4444';
        authErrorMsg.style.display = 'none';
        
        if (authMode === 'register') {
            const confirmPassword = authConfirmPasswordInput.value;
            if (password !== confirmPassword) {
                authErrorMsg.textContent = "Passwords do not match.";
                authErrorMsg.style.display = 'block';
                return;
            }
        }
        
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = authMode === 'login' ? "Signing In..." : "Creating Account...";
        
        try {
            if (authMode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            closeAuthModal();
        } catch (err) {
            console.error("Auth error:", err);
            let userMsg = "Authentication failed. Please check your credentials.";
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                userMsg = "Incorrect email or password.";
            } else if (err.code === 'auth/email-already-in-use') {
                userMsg = "This email address is already in use.";
            } else if (err.code === 'auth/weak-password') {
                userMsg = "Password should be at least 6 characters.";
            }
            authErrorMsg.textContent = userMsg;
            authErrorMsg.style.display = 'block';
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = authMode === 'login' ? "Sign In" : "Create Account";
        }
    });
}

const googleAuthBtn = document.getElementById('google-auth-btn');
if (googleAuthBtn) {
    googleAuthBtn.addEventListener('click', async () => {
        authErrorMsg.style.color = '#ef4444';
        authErrorMsg.style.display = 'none';
        const provider = new GoogleAuthProvider();
        
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileDevice) {
            try {
                await signInWithRedirect(auth, provider);
            } catch (err) {
                console.error("Google redirect auth error:", err);
                authErrorMsg.textContent = "Google sign-in failed. Please try again.";
                authErrorMsg.style.display = 'block';
            }
        } else {
            try {
                await signInWithPopup(auth, provider);
                closeAuthModal();
            } catch (err) {
                console.error("Google auth error:", err);
                // Fallback to redirect if popup is blocked, closed, or unsupported
                const fallbackCodes = ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/operation-not-supported-in-this-environment'];
                if (fallbackCodes.includes(err.code)) {
                    try {
                        await signInWithRedirect(auth, provider);
                    } catch (redirectErr) {
                        console.error("Google redirect fallback auth error:", redirectErr);
                        authErrorMsg.textContent = "Google sign-in failed. Please try again.";
                        authErrorMsg.style.display = 'block';
                    }
                } else {
                    authErrorMsg.textContent = "Google sign-in failed. Please try again.";
                    authErrorMsg.style.display = 'block';
                }
            }
        }
    });
}

function getEvolutionParentInfo(poke) {
    if (poke.id === "902" || (poke.idName && poke.idName.toLowerCase() === "basculegion")) {
        const basePoke = pokemonDatabase.find(x => x.id === "550");
        if (basePoke) {
            return {
                parent: basePoke,
                name: "Basculin",
                img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/550.png`,
                candies: 50,
                item: null,
                quests: []
            };
        }
    }

    if (!rawPokedexData) return null;
    
    for (const p of rawPokedexData) {
        // Check base form evolutions
        if (p.evolutions) {
            const match = p.evolutions.find(e => 
                e.id.toLowerCase() === poke.idName.toLowerCase() || 
                (e.formId && e.formId.toLowerCase() === poke.idName.toLowerCase())
            );
            if (match) {
                const basePoke = pokemonDatabase.find(x => x.id === String(p.dexNr));
                if (basePoke) {
                    return {
                        parent: basePoke,
                        name: p.names.English,
                        img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.dexNr}.png`,
                        candies: match.candies || 50,
                        item: match.item || null,
                        quests: match.quests || []
                    };
                }
            }
        }
        // Check regional forms
        if (p.regionForms) {
            for (const rf of Object.values(p.regionForms)) {
                if (rf.evolutions) {
                    const match = rf.evolutions.find(e => 
                        e.id.toLowerCase() === poke.idName.toLowerCase() || 
                        (e.formId && e.formId.toLowerCase() === poke.idName.toLowerCase())
                    );
                    if (match) {
                        const basePoke = pokemonDatabase.find(x => x.id === String(p.dexNr));
                        if (basePoke) {
                            const rKey = getRegionalFormKey(rf);
                            const rfId = rKey ? (pokeApiIdMapping[rKey] || regionalFormPokeApiIds[rKey]) : null;
                            
                            let img = rfId 
                                ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${rfId}.png`
                                : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.dexNr}.png`;
                            
                            const displayName = getRegionalFormDisplayName(rf);
                            
                            return {
                                parent: basePoke,
                                name: displayName,
                                img: img,
                                candies: match.candies || 50,
                                item: match.item || null,
                                quests: match.quests || []
                            };
                        }
                    }
                }
            }
        }
    }
    return null;
}

function getEvolutionParentAndCandies(poke) {
    const parentInfo = getEvolutionParentInfo(poke);
    if (parentInfo) {
        return {
            parent: parentInfo.parent,
            candies: parentInfo.candies
        };
    }
    return null;
}

function needsCandies(poke) {
    if (!poke) return false;
    const chain = findEvolutionChain(poke);
    if (!chain || chain.length === 0) return false;
    const basePoke = chain[0];
    const baseId = basePoke.id;
    
    // Only care about candies if we already have the base form of the family
    const baseIsCaught = caughtPokemon.has(baseId) || caughtPokemon.has(Number(baseId));
    if (!baseIsCaught) return false;

    const currentCandies = userCandies[baseId] || 0;
    
    let totalNeeded = 0;
    chain.forEach(member => {
        if (!caughtPokemon.has(member.id) && !caughtPokemon.has(Number(member.id))) {
            const parentInfo = getEvolutionParentAndCandies(member);
            if (parentInfo) {
                totalNeeded += parentInfo.candies;
            }
        }
    });
    
    const remaining = Math.max(0, totalNeeded - currentCandies);
    return remaining > 0 && totalNeeded > 0;
}

const parentToEvolutionsMap = new Map();
const pokeToFamilyBaseIdMap = new Map();

function buildStaticEvolutionMaps() {
    parentToEvolutionsMap.clear();
    pokeToFamilyBaseIdMap.clear();
    
    if (!pokemonDatabase || pokemonDatabase.length === 0) return;
    
    pokemonDatabase.forEach(poke => {
        // Cache family base ID
        const chain = findEvolutionChain(poke);
        if (chain && chain.length > 0) {
            pokeToFamilyBaseIdMap.set(poke.id, chain[0].id);
        }
        
        // Cache evolution parent info
        const parentInfo = getEvolutionParentAndCandies(poke);
        if (parentInfo && parentInfo.parent) {
            const parentId = String(parentInfo.parent.id);
            if (!parentToEvolutionsMap.has(parentId)) {
                parentToEvolutionsMap.set(parentId, []);
            }
            parentToEvolutionsMap.get(parentId).push({
                childId: poke.id,
                candies: parentInfo.candies
            });
        }
    });
}

function isReadyToEvolve(poke) {
    if (!poke) return false;
    // The target pokemon itself must NOT be caught
    const isCaught = caughtPokemon.has(poke.id) || caughtPokemon.has(Number(poke.id));
    if (isCaught) return false;

    // Get the parent info of this target pokemon
    const parentInfo = getEvolutionParentAndCandies(poke);
    if (!parentInfo || !parentInfo.parent) return false;

    // The parent must be caught
    const isParentCaught = caughtPokemon.has(parentInfo.parent.id) || caughtPokemon.has(Number(parentInfo.parent.id));
    if (!isParentCaught) return false;

    // Get family base ID and current candies
    const baseId = pokeToFamilyBaseIdMap.get(poke.id);
    if (!baseId) return false;
    const currentCandies = userCandies[baseId] || 0;

    return currentCandies >= parentInfo.candies;
}


function getBuddyDistanceForFamily(family) {
    if (!family || !family.base) return undefined;
    const candidates = [
        family.base.id,
        Number(family.base.id),
        String(family.base.id),
        safeLower(family.base.name)
    ];
    if (Array.isArray(family.members)) {
        family.members.forEach(member => {
            candidates.push(member.id, Number(member.id), String(member.id), safeLower(member.name));
        });
    }
    for (const cand of candidates) {
        if (cand !== undefined && cand !== null && buddyDistances[cand] !== undefined) {
            return buddyDistances[cand];
        }
    }
    return undefined;
}

function isSpecialVersion(member) {
    const nameLower = member.name.toLowerCase();
    if (nameLower.includes('alolan') || nameLower.includes('galarian') || nameLower.includes('hisuian') || nameLower.includes('paldean')) {
        return true;
    }
    const specialIds = ["901", "903", "904", "URSALUNA", "SNEASLER", "OVERQWIL"];
    if (specialIds.includes(member.id) || specialIds.includes(member.idName)) {
        return true;
    }
    const parentInfo = getEvolutionParentInfo(member);
    if (parentInfo && (parentInfo.name.toLowerCase().includes('hisuian') || parentInfo.name.toLowerCase().includes('alolan') || parentInfo.name.toLowerCase().includes('galarian') || parentInfo.name.toLowerCase().includes('paldean') || parentInfo.name.toLowerCase().includes('white-striped'))) {
        return true;
    }
    return false;
}

function renderCandiesPane() {
    const gridReady = document.getElementById('grid-ready-evolve');
    const gridNeed = document.getElementById('grid-need-candies');
    const gridMissing = document.getElementById('grid-missing-base');
    const gridTransferred = document.getElementById('grid-transferred-base');
    const candiesSortSelect = document.getElementById('candies-sort');
    
    if (!gridReady || !gridNeed || !gridMissing || !gridTransferred) return;
    
    gridReady.innerHTML = '';
    gridNeed.innerHTML = '';
    gridMissing.innerHTML = '';
    gridTransferred.innerHTML = '';

    const sortOrder = candiesSortSelect ? candiesSortSelect.value : 'num-asc';

    // Group database by family
    const families = {};
    pokemonDatabase.forEach(poke => {
        const chain = findEvolutionChain(poke);
        const basePoke = chain[0];
        if (!families[basePoke.id]) {
            families[basePoke.id] = {
                base: basePoke,
                members: []
            };
        }
        if (!families[basePoke.id].members.some(m => m.id === poke.id)) {
            families[basePoke.id].members.push(poke);
        }
    });

    // Filter families that have at least one evolution and at least one missing member
    let evolutionFamilies = Object.values(families).filter(f => {
        const hasEvolution = f.members.length > 1;
        const hasMissingMember = f.members.some(member => !caughtPokemon.has(member.id) && !caughtPokemon.has(Number(member.id)) && !caughtPokemon.has(String(member.id)));
        return hasEvolution && hasMissingMember;
    });

    // Filter by search query if active
    if (currentSearchQuery) {
        evolutionFamilies = evolutionFamilies.filter(f => {
            return f.members.some(member => 
                (member.name || '').toLowerCase().includes(currentSearchQuery) ||
                (member.num || '').includes(currentSearchQuery) ||
                (member.types || []).some(t => t.toLowerCase().includes(currentSearchQuery))
            );
        });
    }

    // Compute metrics for each family
    const familyDataList = evolutionFamilies.map(family => {
        const baseId = family.base.id;
        const currentCandies = (userCandies[baseId] !== undefined) ? userCandies[baseId] : ((userCandies[Number(baseId)] !== undefined) ? userCandies[Number(baseId)] : 0);
        
        let totalNeeded = 0;
        family.members.forEach(member => {
            if (!caughtPokemon.has(member.id) && !caughtPokemon.has(Number(member.id))) {
                const parentInfo = getEvolutionParentAndCandies(member);
                if (parentInfo) {
                    totalNeeded += parentInfo.candies;
                }
            }
        });
        
        const remaining = Math.max(0, totalNeeded - currentCandies);
        const baseIsCaught = caughtPokemon.has(baseId) || caughtPokemon.has(Number(baseId));
        const buddyDist = getBuddyDistanceForFamily(family);
        const km = (buddyDist !== undefined) ? remaining * buddyDist : 0;
        
        return {
            family,
            baseId,
            currentCandies,
            totalNeeded,
            remaining,
            baseIsCaught,
            buddyDist,
            km
        };
    });

    // Calculate totals for summary bar
    let grandTotalKm = 0;
    let grandTotalCandies = 0;
    familyDataList.forEach(d => {
        grandTotalKm += d.km;
        grandTotalCandies += d.remaining;
    });

    const totalKmEl = document.getElementById('candies-total-km');
    const totalCandiesEl = document.getElementById('candies-total-candies');
    if (totalKmEl) totalKmEl.textContent = `${grandTotalKm.toFixed(1)} km`;
    if (totalCandiesEl) totalCandiesEl.textContent = grandTotalCandies;

    // Apply sorting
    familyDataList.sort((a, b) => {
        if (sortOrder === 'num-asc') {
            return a.family.base.id - b.family.base.id;
        } else if (sortOrder === 'name-asc') {
            return a.family.base.name.localeCompare(b.family.base.name);
        } else if (sortOrder === 'needed-desc') {
            return b.remaining - a.remaining;
        } else if (sortOrder === 'needed-asc') {
            return a.remaining - b.remaining;
        } else if (sortOrder === 'km-desc') {
            return b.km - a.km;
        } else if (sortOrder === 'km-asc') {
            return a.km - b.km;
        }
        return 0;
    });

    // Distribute into categories
    let readyCount = 0;
    let needCount = 0;
    let missingCount = 0;
    let transferredCount = 0;

    familyDataList.forEach(data => {
        const family = data.family;
        const baseId = data.baseId;
        const currentCandies = data.currentCandies;
        const totalNeeded = data.totalNeeded;
        const remaining = data.remaining;
        const baseIsCaught = data.baseIsCaught;
        
        const buddyDist = data.buddyDist;
        
        let kmText = '';
        let kmClass = 'km-success';
        if (totalNeeded === 0) {
            kmText = 'Already Fully Evolved/Caught';
            kmClass = 'km-complete';
        } else if (remaining === 0) {
            kmText = 'Enough candies to evolve!';
            kmClass = 'km-success';
        } else {
            if (buddyDist === undefined) {
                kmText = '⚠️ Distance unknown (not in API)';
                kmClass = 'km-warning';
            } else {
                const km = (remaining * buddyDist).toFixed(1);
                kmText = `Walk ${km} km (${remaining} candies needed, ${buddyDist} km each)`;
                kmClass = 'km-walk';
            }
        }

        let displayImg = family.base.img;
        family.members.forEach(member => {
            const isCaught = caughtPokemon.has(member.id) || caughtPokemon.has(Number(member.id));
            if (!isCaught) {
                const parentInfo = getEvolutionParentInfo(member);
                if (parentInfo && parentInfo.parent.id === family.base.id && parentInfo.name !== family.base.name) {
                    displayImg = parentInfo.img;
                }
            }
        });

        const card = document.createElement('div');
        card.className = 'candy-family-card';
        const isTransf = transferredPokemon.has(baseId) || transferredPokemon.has(Number(baseId)) || transferredPokemon.has(String(baseId));
        card.innerHTML = `
            <div class="family-header">
                <img src="${displayImg}" alt="${family.base.name}" class="family-base-img">
                <div class="family-info">
                    <h3 class="family-title">${family.base.name}</h3>
                    <div class="family-buddy-dist">${buddyDist !== undefined ? `Buddy: ${buddyDist} km/candy` : 'Buddy distance: Unknown'}</div>
                </div>
                <div class="candy-input-wrapper">
                    <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png" class="candy-icon">
                    <input type="number" min="0" value="${currentCandies}" class="candy-count-input" data-family-id="${baseId}" placeholder="0">
                </div>
            </div>
            
            <div class="family-stages">
                ${family.members.map(member => {
                    const isCaught = caughtPokemon.has(member.id) || caughtPokemon.has(Number(member.id));
                    const isMemberTransf = transferredPokemon.has(member.id) || transferredPokemon.has(Number(member.id)) || transferredPokemon.has(String(member.id));
                    const parentInfo = getEvolutionParentAndCandies(member);
                    const candyCost = parentInfo ? parentInfo.candies : 0;
                    
                    const isBase = member.id === family.base.id;
                    const actionButton = (isBase && isCaught) ? `
                        <button class="transferred-inline-toggle" title="Toggle Transferred Status" style="margin-left: auto; margin-right: 0.25rem; background: ${isMemberTransf ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isMemberTransf ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.1)'}; color: ${isMemberTransf ? '#60a5fa' : '#94a3b8'}; border-radius: 4px; padding: 2px 6px; font-size: 0.62rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; transition: all 0.2s; outline: none; text-decoration: none !important;" data-family-id="${baseId}">
                            <i class="fa-solid fa-right-left"></i>
                            <span>Transferred</span>
                        </button>
                    ` : '';
                    
                    return `
                        <div class="family-stage-item ${isCaught ? 'caught' : 'missing'}" style="${isMemberTransf ? 'opacity: 0.45; filter: grayscale(40%); text-decoration: none !important;' : ''}">
                            <span class="stage-caught-status">
                                <i class="fa-solid ${isMemberTransf ? 'fa-right-left' : (isCaught ? 'fa-circle-check' : 'fa-circle-xmark')}"></i>
                            </span>
                            <span class="stage-name" style="${isBase && isCaught ? 'flex-grow: 0;' : ''}">${member.name}</span>
                            ${actionButton}
                            ${candyCost > 0 ? `<span class="stage-cost" style="${actionButton ? '' : 'margin-left: auto;'}"><i class="fa-solid fa-candy-cane"></i> ${candyCost}</span>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="family-calculation-result ${kmClass}">
                ${kmText}
            </div>
        `;

        const inlineToggles = card.querySelectorAll('.transferred-inline-toggle');
        inlineToggles.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const wasActive = transferredPokemon.has(baseId) || transferredPokemon.has(Number(baseId));
                if (!wasActive) {
                    transferredPokemon.add(baseId);
                    transferredPokemon.add(Number(baseId));
                } else {
                    transferredPokemon.delete(baseId);
                    transferredPokemon.delete(Number(baseId));
                    transferredPokemon.delete(String(baseId));
                }
                saveTransferredState();
                renderPokedex();
                renderMissingSummary();
                renderCandiesPane();
                updateDashboardStats();
                updateRegionStatsBadge();
            });
        });

        const input = card.querySelector('.candy-count-input');
        
        // Listen to change/input, but use a small trick: if they focus out or change, we re-render.
        // Using 'change' or keeping the focus state in mind so they can type.
        // To allow natural typing without losing focus, we save userCandies on input,
        // and only trigger renderCandiesPane on 'change' or 'blur' (when they press Enter or focus out).
        // That prevents the card from moving out of the mouse/keyboard focus mid-typing!
        input.addEventListener('input', (e) => {
            const val = parseInt(e.target.value) || 0;
            userCandies[baseId] = val;
            saveCandyState(true);
        });
        
        input.addEventListener('blur', () => {
            saveCandyState(false);
            renderCandiesPane();
        });
        
        input.addEventListener('change', () => {
            saveCandyState(false);
            renderCandiesPane();
        });

        // Append to appropriate grid
        if (isTransf) {
            gridTransferred.appendChild(card);
            transferredCount++;
        } else if (!baseIsCaught) {
            gridMissing.appendChild(card);
            missingCount++;
        } else if (remaining === 0) {
            gridReady.appendChild(card);
            readyCount++;
        } else {
            gridNeed.appendChild(card);
            needCount++;
        }
    });

    // Hide/Show category sections based on count
    document.getElementById('cat-ready-evolve').style.display = readyCount > 0 ? 'block' : 'none';
    document.getElementById('cat-need-candies').style.display = needCount > 0 ? 'block' : 'none';
    document.getElementById('cat-missing-base').style.display = missingCount > 0 ? 'block' : 'none';
    document.getElementById('cat-transferred-base').style.display = transferredCount > 0 ? 'block' : 'none';
}

// Friends system state variables
let activeFriendUid = null;
let activeFriendEmail = null;

async function renderFriendsPane() {
    const authWarning = document.getElementById('friends-auth-warning');
    const mainContent = document.getElementById('friends-main-content');
    
    if (!currentUser) {
        authWarning.classList.remove('hidden');
        mainContent.classList.add('hidden');
        return;
    }
    
    authWarning.classList.add('hidden');
    mainContent.classList.remove('hidden');
    
    try {
        const docRef = doc(db, "users_data", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            renderFriendsPaneFromData(docSnap.data());
        }
    } catch (e) {
        console.error("Error rendering friends pane:", e);
    }
}

function renderFriendsPaneFromData(data) {
    const friendsListDiv = document.getElementById('friends-list');
    const pendingSection = document.getElementById('pending-requests-section');
    const pendingCountSpan = document.getElementById('pending-requests-count');
    const pendingListDiv = document.getElementById('pending-requests-list');
    const badge = document.getElementById('friends-badge');
    
    const friends = data.friends || [];
    const incomingRequests = data.incomingRequests || [];
    
    // 1. Update Notification Badge
    if (badge) {
        if (incomingRequests.length > 0) {
            badge.textContent = incomingRequests.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    // 2. Render Pending Requests
    if (incomingRequests.length > 0) {
        if (pendingSection) pendingSection.classList.remove('hidden');
        if (pendingCountSpan) pendingCountSpan.textContent = incomingRequests.length;
        if (pendingListDiv) {
            pendingListDiv.innerHTML = '';
            incomingRequests.forEach(req => {
                const reqItem = document.createElement('div');
                reqItem.style.display = 'flex';
                reqItem.style.justifyContent = 'space-between';
                reqItem.style.alignItems = 'center';
                reqItem.style.padding = '12px 14px';
                reqItem.style.background = 'var(--bg-tertiary)';
                reqItem.style.border = '1px solid var(--border-color)';
                reqItem.style.borderRadius = '10px';
                reqItem.style.width = '100%';
                reqItem.style.boxSizing = 'border-box';
                
                reqItem.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${req.username}</span>
                        <span style="font-size: 0.7rem; color: #64748b;">wants to be friends</span>
                    </div>
                    <div style="display: flex; gap: 0.4rem;">
                        <button class="accept-btn" style="background: #10b981; color: white; border: none; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;" title="Accept"><i class="fa-solid fa-check"></i></button>
                        <button class="decline-btn" style="background: #ef4444; color: white; border: none; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;" title="Decline"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
                
                reqItem.querySelector('.accept-btn').addEventListener('click', () => acceptFriendRequest(req));
                reqItem.querySelector('.decline-btn').addEventListener('click', () => declineFriendRequest(req));
                pendingListDiv.appendChild(reqItem);
            });
        }
    } else {
        if (pendingSection) pendingSection.classList.add('hidden');
    }
    
    // 3. Render Friends List
    if (friendsListDiv) {
        friendsListDiv.innerHTML = '';
        if (friends.length === 0) {
            friendsListDiv.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; padding: 1rem 0; text-align: center;">No friends added yet.</p>';
        } else {
            friends.forEach(friend => {
                const item = document.createElement('div');
                const isSelected = activeFriendUid === friend.uid;
                item.className = `rotation-card-item theme-blue ${isSelected ? 'active-friend' : ''}`;
                item.style.cursor = 'pointer';
                item.style.padding = '10px 14px';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.width = '100%';
                
                const friendName = friend.displayName || friend.email.split('@')[0];
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-user" style="color: ${isSelected ? 'var(--accent-color)' : '#94a3b8'};"></i>
                        <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${friendName}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right" style="font-size: 0.75rem; color: #64748b;"></i>
                `;
                item.addEventListener('click', () => {
                    activeFriendUid = friend.uid;
                    activeFriendEmail = friend.email;
                    renderFriendsPaneFromData(data);
                    compareFriendsCollections(friend);
                });
                friendsListDiv.appendChild(item);
            });
        }
    }
    
    if (activeFriendUid) {
        const currentActive = friends.find(f => f.uid === activeFriendUid);
        if (currentActive) {
            compareFriendsCollections(currentActive);
        } else {
            activeFriendUid = null;
            activeFriendEmail = null;
            document.getElementById('comparison-empty-state').classList.remove('hidden');
            document.getElementById('comparison-content').classList.add('hidden');
        }
    }
}

async function acceptFriendRequest(request) {
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, "users_data", currentUser.uid);
        const friendDocRef = doc(db, "users_data", request.uid);
        
        const friendSnap = await getDoc(friendDocRef);
        let friendDisplayName = request.username;
        let friendEmail = request.email;
        if (friendSnap.exists()) {
            const fd = friendSnap.data();
            friendDisplayName = fd.username || fd.displayName || request.username;
            friendEmail = fd.email || request.email;
        }
        
        const mySnap = await getDoc(userDocRef);
        if (mySnap.exists()) {
            const myData = mySnap.data();
            const myDisplayName = myData.username || myData.displayName || currentUser.email.split('@')[0];
            
            // Update my friends list and incoming requests
            const myUpdatedFriends = [...(myData.friends || [])];
            if (!myUpdatedFriends.some(f => f.uid === request.uid)) {
                myUpdatedFriends.push({ uid: request.uid, email: friendEmail, displayName: friendDisplayName });
            }
            const myUpdatedRequests = (myData.incomingRequests || []).filter(r => r.uid !== request.uid);
            
            // Update friend's friends list and sent requests
            const friendData = friendSnap.data();
            const friendUpdatedFriends = [...(friendData.friends || [])];
            if (!friendUpdatedFriends.some(f => f.uid === currentUser.uid)) {
                friendUpdatedFriends.push({ uid: currentUser.uid, email: currentUser.email, displayName: myDisplayName });
            }
            const friendUpdatedSent = (friendData.sentRequests || []).filter(r => r.uid !== currentUser.uid);
            
            const batch = writeBatch(db);
            batch.update(userDocRef, {
                friends: myUpdatedFriends,
                incomingRequests: myUpdatedRequests
            });
            batch.update(friendDocRef, {
                friends: friendUpdatedFriends,
                sentRequests: friendUpdatedSent
            });
            
            await batch.commit();
        }
    } catch (e) {
        console.error("Error accepting friend request:", e);
    }
}

async function declineFriendRequest(request) {
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, "users_data", currentUser.uid);
        const friendDocRef = doc(db, "users_data", request.uid);
        
        const mySnap = await getDoc(userDocRef);
        const friendSnap = await getDoc(friendDocRef);
        
        const batch = writeBatch(db);
        let runBatch = false;
        
        if (mySnap.exists()) {
            const myData = mySnap.data();
            const myUpdatedRequests = (myData.incomingRequests || []).filter(r => r.uid !== request.uid);
            batch.update(userDocRef, {
                incomingRequests: myUpdatedRequests
            });
            runBatch = true;
        }
        
        if (friendSnap.exists()) {
            const friendData = friendSnap.data();
            const friendUpdatedSent = (friendData.sentRequests || []).filter(r => r.uid !== currentUser.uid);
            batch.update(friendDocRef, {
                sentRequests: friendUpdatedSent
            });
            runBatch = true;
        }
        
        if (runBatch) {
            await batch.commit();
        }
    } catch (e) {
        console.error("Error declining friend request:", e);
    }
}

async function compareFriendsCollections(friend) {
    const emptyState = document.getElementById('comparison-empty-state');
    const content = document.getElementById('comparison-content');
    
    emptyState.classList.add('hidden');
    content.classList.remove('hidden');
    
    const friendName = friend.displayName || friend.email.split('@')[0];
    document.getElementById('comparison-friend-name').textContent = `Comparing with: ${friendName}`;
    
    const giveGrid = document.getElementById('friends-give-grid');
    const getGrid = document.getElementById('friends-get-grid');
    const statsContainer = document.getElementById('friends-stats-container');
    
    giveGrid.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; grid-column: 1 / -1;">Loading trade data...</p>';
    getGrid.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; grid-column: 1 / -1;">Loading trade data...</p>';
    if (statsContainer) {
        statsContainer.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">Loading comparison stats...</p>';
    }
    
    // Auto switch to stats tab
    const statsTabBtn = document.querySelector('.comp-tab-btn[data-tab="stats-tab"]');
    if (statsTabBtn) {
        const compTabBtns = document.querySelectorAll('.comp-tab-btn');
        compTabBtns.forEach(b => b.classList.remove('active'));
        statsTabBtn.classList.add('active');
        
        const panes = document.querySelectorAll('.comp-pane');
        panes.forEach(pane => {
            if (pane.id === 'stats-tab-pane') {
                pane.classList.remove('hidden');
            } else {
                pane.classList.add('hidden');
            }
        });
    }
    
    try {
        const docRef = doc(db, "users_data", friend.uid);
        const docSnap = await getDoc(docRef);
        
        let friendCaught = [];
        if (docSnap.exists()) {
            friendCaught = docSnap.data().caught || [];
        }
        
        const friendCaughtSet = new Set(friendCaught.map(x => (isNaN(Number(x)) ? x : Number(x))));
        
        // Render stats comparison
        renderComparisonStats(friendCaught, friendName);
        
        // 1. You can give them: I have caught, they haven't
        const giveList = [];
        pokemonDatabase.forEach(poke => {
            if ((caughtPokemon.has(poke.id) || caughtPokemon.has(Number(poke.id))) && !friendCaughtSet.has(poke.id) && !friendCaughtSet.has(Number(poke.id))) {
                giveList.push(poke);
            }
        });
        
        // 2. They can give you: They have caught, I haven't
        const getList = [];
        pokemonDatabase.forEach(poke => {
            if (!caughtPokemon.has(poke.id) && !caughtPokemon.has(Number(poke.id)) && (friendCaughtSet.has(poke.id) || friendCaughtSet.has(Number(poke.id)))) {
                getList.push(poke);
            }
        });
        
        // Render You can give them
        renderGroupedTradeGrid(giveGrid, giveList);
        
        // Render They can give you
        renderGroupedTradeGrid(getGrid, getList);
    } catch (e) {
        console.error("Error comparing collections:", e);
        giveGrid.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem; grid-column: 1 / -1;">Failed to load trade matches.</p>';
        getGrid.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem; grid-column: 1 / -1;">Failed to load trade matches.</p>';
        if (statsContainer) {
            statsContainer.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem;">Failed to load comparison stats.</p>';
        }
    }
}

function renderComparisonStats(friendCaughtArray, friendName) {
    const container = document.getElementById('friends-stats-container');
    if (!container) return;
    
    // Normalize caught sets
    const friendSet = new Set(friendCaughtArray.map(x => (isNaN(Number(x)) ? x : Number(x))));
    const mySet = new Set(Array.from(caughtPokemon).map(x => (isNaN(Number(x)) ? x : Number(x))));
    
    const totalPokes = pokemonDatabase.length;
    const myTotalCaught = pokemonDatabase.filter(p => mySet.has(p.id) || mySet.has(Number(p.id))).length;
    const friendTotalCaught = pokemonDatabase.filter(p => friendSet.has(p.id) || friendSet.has(Number(p.id))).length;
    
    const myPercent = totalPokes > 0 ? ((myTotalCaught / totalPokes) * 100).toFixed(1) : 0;
    const friendPercent = totalPokes > 0 ? ((friendTotalCaught / totalPokes) * 100).toFixed(1) : 0;
    
    // Gen breakdown
    const gens = Array.from(new Set(pokemonDatabase.map(p => p.gen))).sort((a, b) => a - b);
    let genHtml = "";
    gens.forEach(g => {
        const genPokes = pokemonDatabase.filter(p => p.gen === g);
        const genTotal = genPokes.length;
        if (genTotal === 0) return;
        
        const myGenCaught = genPokes.filter(p => mySet.has(p.id) || mySet.has(Number(p.id))).length;
        const friendGenCaught = genPokes.filter(p => friendSet.has(p.id) || friendSet.has(Number(p.id))).length;
        
        const myGenPercent = ((myGenCaught / genTotal) * 100).toFixed(0);
        const friendGenPercent = ((friendGenCaught / genTotal) * 100).toFixed(0);
        
        const genLabel = regionNames[g] || `Gen ${g}`;
        
        genHtml += `
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${genLabel}</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">Total: ${genTotal}</span>
                </div>
                
                <!-- You Progress -->
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                        <span style="color: #60a5fa; font-weight: 600;">You</span>
                        <span style="color: var(--text-primary); font-weight: 700;">${myGenCaught}/${genTotal} (${myGenPercent}%)</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${myGenPercent}%; height: 100%; background: #60a5fa; border-radius: 3px;"></div>
                    </div>
                </div>
                
                <!-- Friend Progress -->
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                        <span style="color: var(--accent-color); font-weight: 600;">${friendName}</span>
                        <span style="color: var(--text-primary); font-weight: 700;">${friendGenCaught}/${genTotal} (${friendGenPercent}%)</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${friendGenPercent}%; height: 100%; background: var(--accent-color); border-radius: 3px;"></div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <!-- Main head-to-head score card -->
        <div style="background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; align-items: center; box-shadow: var(--shadow-md);">
            <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; width: 100%; text-align: center;">Global PokéDex Progress</div>
            
            <div style="display: flex; align-items: stretch; justify-content: center; gap: 1.5rem; width: 100%; max-width: 400px;">
                <!-- You -->
                <div style="flex: 1; background: rgba(96, 165, 250, 0.05); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center;">
                    <span style="font-weight: 700; font-size: 0.8rem; color: #60a5fa;">You</span>
                    <span style="font-weight: 800; font-size: 1.4rem; color: #fff;">${myPercent}%</span>
                    <span style="font-size: 0.72rem; color: #94a3b8;">${myTotalCaught} / ${totalPokes}</span>
                </div>
                
                <!-- Friend -->
                <div style="flex: 1; background: rgba(245, 166, 35, 0.05); border: 1px solid rgba(245, 166, 35, 0.2); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center;">
                    <span style="font-weight: 700; font-size: 0.8rem; color: var(--accent-color);">${friendName}</span>
                    <span style="font-weight: 800; font-size: 1.4rem; color: #fff;">${friendPercent}%</span>
                    <span style="font-size: 0.72rem; color: #94a3b8;">${friendTotalCaught} / ${totalPokes}</span>
                </div>
            </div>
        </div>

        <!-- Gen breakdowns -->
        <div style="margin-top: 0.5rem;">
            <h4 style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                <i class="fa-solid fa-map" style="color: var(--accent-color);"></i> Completion by Region
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
                ${genHtml}
            </div>
        </div>
    `;
}

function createTradePokemonCard(poke) {
    const card = document.createElement('div');
    card.className = `rotation-card-item theme-blue`;
    card.style.cssText = `
        cursor: pointer;
        padding: 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s ease, background 0.2s ease;
    `;
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.background = 'rgba(255, 255, 255, 0.06)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.background = 'rgba(255, 255, 255, 0.03)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.05)';
    });
    card.innerHTML = `
        <img src="${poke.img}" alt="${poke.name}" style="width: 54px; height: 54px; object-fit: contain;">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); text-align: center;">${poke.name}</span>
        <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 500;">#${poke.num}</span>
    `;
    card.addEventListener('click', () => openModal(poke.id));
    return card;
}

function renderGroupedTradeGrid(container, list) {
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 2rem 0; width: 100%;">No matches found.</p>';
        return;
    }

    const grouped = {};
    list.forEach(poke => {
        const gen = poke.gen || 1;
        if (!grouped[gen]) grouped[gen] = [];
        grouped[gen].push(poke);
    });

    const genNames = {
        1: "Generation 1 (Kanto)",
        2: "Generation 2 (Johto)",
        3: "Generation 3 (Hoenn)",
        4: "Generation 4 (Sinnoh)",
        5: "Generation 5 (Unova)",
        6: "Generation 6 (Kalos)",
        7: "Generation 7 (Alola)",
        8: "Generation 8 (Galar)",
        8.5: "Hisui Region",
        9: "Generation 9 (Paldea)",
        99: "Special / Unknown"
    };

    const sortedGens = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

    sortedGens.forEach(gen => {
        const sub = document.createElement('div');
        sub.style.cssText = "margin-bottom: 1.5rem; width: 100%;";
        
        const title = document.createElement('h4');
        title.style.cssText = "font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; display: flex; align-items: center; gap: 6px;";
        title.innerHTML = `<i class="fa-solid fa-folder-open" style="font-size: 0.8rem; color: var(--accent-color);"></i> ${genNames[gen] || `Generation ${gen}`}`;
        sub.appendChild(title);

        const grid = document.createElement('div');
        grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(115px, 1fr)); gap: 10px; width: 100%;";
        
        grouped[gen].forEach(poke => {
            grid.appendChild(createTradePokemonCard(poke));
        });
        sub.appendChild(grid);
        container.appendChild(sub);
    });
}

function openUsernameSetupModal() {
    const modal = document.getElementById('username-setup-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('setup-username').value = '';
        document.getElementById('username-setup-error').style.display = 'none';
    }
}

function setupUsernameSetupListener() {
    const setupForm = document.getElementById('username-setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('setup-username');
            const username = input.value.trim();
            const errorDiv = document.getElementById('username-setup-error');
            const btn = document.getElementById('username-setup-btn');
            
            if (username.length < 3) {
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Username must be at least 3 characters.';
                return;
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Usernames can only contain letters, numbers, underscores, and hyphens.';
                return;
            }
            
            errorDiv.style.display = 'none';
            btn.disabled = true;
            btn.textContent = 'Checking availability...';
            
            try {
                const q = query(collection(db, "users_data"), where("username_lowercase", "==", username.toLowerCase()));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const existingDoc = querySnapshot.docs[0];
                    if (existingDoc.id !== currentUser.uid) {
                        errorDiv.style.display = 'block';
                        errorDiv.textContent = 'Username already taken. Please try another one.';
                        btn.disabled = false;
                        btn.textContent = 'Confirm Username';
                        return;
                    }
                }
                
                currentTrainerUsername = username;
                await updateProfile(currentUser, { displayName: username });
                await saveUserDataToFirestore();
                
                document.getElementById('username-setup-modal').classList.add('hidden');
                
                // Refresh trainer header prefix
                const authStatusContainer = document.getElementById('auth-status-container');
                if (authStatusContainer) {
                    const span = authStatusContainer.querySelector('span');
                    if (span) {
                        span.textContent = `Trainer: ${username}`;
                    }
                }
                
                renderFriendsPane();
            } catch (err) {
                console.error("Error setting username:", err);
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Failed to save username. Please try again.';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Confirm Username';
            }
        });
    }
}

function setupFriendsListeners() {
    const addFriendForm = document.getElementById('add-friend-form');
    const removeFriendBtn = document.getElementById('remove-friend-btn');
    const compTabBtns = document.querySelectorAll('.comp-tab-btn');
    const friendsLoginBtn = document.getElementById('friends-login-btn');
    
    if (friendsLoginBtn) {
        friendsLoginBtn.addEventListener('click', openAuthModal);
    }
    
    if (addFriendForm) {
        addFriendForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('friend-username-input');
            const targetUsername = usernameInput.value.trim().toLowerCase();
            const msgDiv = document.getElementById('add-friend-msg');
            
            msgDiv.style.display = 'block';
            msgDiv.style.color = '#eab308';
            msgDiv.textContent = 'Searching...';
            
            if (!currentUser) {
                msgDiv.style.color = '#ef4444';
                msgDiv.textContent = 'You must be logged in to add friends.';
                return;
            }
            
            if (currentTrainerUsername && targetUsername === currentTrainerUsername.toLowerCase()) {
                msgDiv.style.color = '#ef4444';
                msgDiv.textContent = 'You cannot add yourself as a friend!';
                return;
            }
            
            try {
                const q = query(collection(db, "users_data"), where("username_lowercase", "==", targetUsername));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    msgDiv.style.color = '#ef4444';
                    msgDiv.textContent = 'No trainer found with this username.';
                    return;
                }
                
                const friendDoc = querySnapshot.docs[0];
                const friendUid = friendDoc.id;
                const friendData = friendDoc.data();
                const friendEmail = friendData.email;
                const friendDisplayName = friendData.displayName || friendData.username || '';
                
                const userDocRef = doc(db, "users_data", currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                let friends = [];
                let sentRequests = [];
                let incomingRequests = [];
                if (userDocSnap.exists()) {
                    const myData = userDocSnap.data();
                    friends = myData.friends || [];
                    sentRequests = myData.sentRequests || [];
                    incomingRequests = myData.incomingRequests || [];
                }
                
                const targetIncoming = friendData.incomingRequests || [];
                const requestReceivedByFriend = targetIncoming.some(r => r.uid === currentUser.uid);
                
                if (friends.some(f => f.uid === friendUid)) {
                    msgDiv.style.color = '#ef4444';
                    msgDiv.textContent = 'You are already friends with this trainer!';
                    return;
                }
                
                if (sentRequests.some(r => r.uid === friendUid) && requestReceivedByFriend) {
                    msgDiv.style.color = '#ef4444';
                    msgDiv.textContent = 'Friend request already sent!';
                    return;
                }
                
                if (incomingRequests.some(r => r.uid === friendUid)) {
                    msgDiv.style.color = '#eab308';
                    msgDiv.textContent = 'This trainer already sent you a request! Accept it below.';
                    return;
                }
                
                const batch = writeBatch(db);
                
                // 1. Add to my sentRequests if not already present
                if (!sentRequests.some(r => r.uid === friendUid)) {
                    batch.update(userDocRef, {
                        sentRequests: arrayUnion({ uid: friendUid, email: friendEmail, username: friendDisplayName })
                    });
                }
                
                // 2. Add to target user's incomingRequests
                const myDisplayName = userDocSnap.data().username || userDocSnap.data().displayName || currentUser.email.split('@')[0];
                const friendDocRef = doc(db, "users_data", friendUid);
                batch.update(friendDocRef, {
                    incomingRequests: arrayUnion({ uid: currentUser.uid, email: currentUser.email, username: myDisplayName })
                });
                
                await batch.commit();
                
                usernameInput.value = '';
                msgDiv.style.color = '#34d399';
                msgDiv.textContent = 'Friend request sent successfully!';
                
                setTimeout(() => {
                    msgDiv.style.display = 'none';
                }, 3000);
            } catch (err) {
                console.error("Error adding friend:", err);
                msgDiv.style.color = '#ef4444';
                msgDiv.textContent = 'Error adding friend. Please try again.';
            }
        });
    }
    
    if (removeFriendBtn) {
        removeFriendBtn.addEventListener('click', async () => {
            if (!currentUser || !activeFriendUid) return;
            
            if (confirm("Are you sure you want to remove this friend?")) {
                try {
                    const userDocRef = doc(db, "users_data", currentUser.uid);
                    const friendDocRef = doc(db, "users_data", activeFriendUid);
                    
                    const userDocSnap = await getDoc(userDocRef);
                    const friendDocSnap = await getDoc(friendDocRef);
                    
                    const batch = writeBatch(db);
                    let runBatch = false;
                    
                    if (userDocSnap.exists()) {
                        const currentFriends = userDocSnap.data().friends || [];
                        const updatedFriends = currentFriends.filter(f => f.uid !== activeFriendUid);
                        batch.update(userDocRef, {
                            friends: updatedFriends
                        });
                        runBatch = true;
                    }
                    
                    if (friendDocSnap.exists()) {
                        const friendFriends = friendDocSnap.data().friends || [];
                        const updatedFriendFriends = friendFriends.filter(f => f.uid !== currentUser.uid);
                        batch.update(friendDocRef, {
                            friends: updatedFriendFriends
                        });
                        runBatch = true;
                    }
                    
                    if (runBatch) {
                        await batch.commit();
                    }
                    
                    activeFriendUid = null;
                    activeFriendEmail = null;
                    renderFriendsPane();
                } catch (err) {
                    console.error("Error removing friend:", err);
                }
            }
        });
    }
    
    compTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            compTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetTab = btn.dataset.tab;
            const panes = document.querySelectorAll('.comp-pane');
            panes.forEach(pane => {
                if (pane.id === `${targetTab}-pane`) {
                    pane.classList.remove('hidden');
                } else {
                    pane.classList.add('hidden');
                }
            });
        });
    });
}

// Run application
window.addEventListener('DOMContentLoaded', () => {
    loadCaughtState();
    loadCandyState();
    loadTransferredState();
    setupEventListeners();
    setupEventsTabListener();
    setupFriendsListeners();
    setupUsernameSetupListener();
    loadPokedex();

    // Bind initial Login/Register button (in case onAuthStateChanged fires late)
    const initialAuthBtn = document.getElementById('auth-trigger-btn');
    if (initialAuthBtn) {
        initialAuthBtn.addEventListener('click', openAuthModal);
    }

    // Ensure event modal close is always bound regardless of tab init order
    const evModalCloseBtn = document.getElementById('event-modal-close-btn');
    const evModal = document.getElementById('event-modal');
    if (evModalCloseBtn && evModal) {
        evModalCloseBtn.addEventListener('click', () => evModal.classList.add('hidden'));
        evModal.addEventListener('click', (e) => {
            if (e.target === evModal) evModal.classList.add('hidden');
        });
    }
});

// ==========================================================================
// EVENTS PANE
// ==========================================================================
function setupEventsTabListener() {
    const container = document.getElementById('rotations-events-section');
    if (container) {
        const tabs = container.querySelectorAll('.event-tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active button visual state with inline styles
                tabs.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'none';
                    b.style.color = '#94a3b8';
                });
                btn.classList.add('active');
                btn.style.background = 'var(--accent-color)';
                btn.style.color = '#000';
                currentEventTab = btn.dataset.tab;
                renderEventsList();
            });
        });

        // Set initial visual state
        const activeTab = container.querySelector('.event-tab-btn.active');
        if (activeTab) {
            activeTab.style.background = 'var(--accent-color)';
            activeTab.style.color = '#000';
        }
    }
    // Note: event modal close listeners are now set in DOMContentLoaded for reliability
}

function renderEventsPane() {
    renderEventsList();
}

function openEventModal(ev) {
    const modal = document.getElementById('event-modal');
    if (!modal) return;

    const bannerEl = document.getElementById('event-modal-banner');
    const categoryEl = document.getElementById('event-modal-category');
    const dateEl = document.getElementById('event-modal-date');
    const countdownEl = document.getElementById('event-modal-countdown');
    const titleEl = document.getElementById('event-modal-title');
    const descEl = document.getElementById('event-modal-desc');
    const bonusesEl = document.getElementById('event-modal-bonuses');
    const spawnsEl = document.getElementById('event-modal-spawns');
    const linkEl = document.getElementById('event-modal-link');

    // Banner image
    if (bannerEl) {
        if (ev.banner) {
            bannerEl.style.backgroundImage = `url(${ev.banner})`;
            bannerEl.style.display = 'block';
        } else {
            bannerEl.style.backgroundImage = 'none';
            bannerEl.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)';
        }
    }

    // Category Badge (Readable contrast text)
    let categoryColor = '#60a5fa'; // Readable pastel blue
    let categoryBg = 'rgba(59, 130, 246, 0.2)';
    if (ev.category.includes('Spotlight')) {
        categoryColor = '#fcd34d'; // yellow
        categoryBg = 'rgba(245, 166, 35, 0.2)';
    } else if (ev.category.includes('Community')) {
        categoryColor = '#34d399'; // green
        categoryBg = 'rgba(16, 185, 129, 0.2)';
    } else if (ev.category.includes('Raid')) {
        categoryColor = '#f87171'; // red
        categoryBg = 'rgba(239, 68, 68, 0.2)';
    }
    if (categoryEl) {
        categoryEl.innerHTML = `<span style="font-size: 0.65rem; font-weight: 800; color: ${categoryColor}; background: ${categoryBg}; border: 1px solid ${categoryColor}40; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${ev.category}</span>`;
    }

    // Dates
    const startD = new Date(ev.start);
    const endD = new Date(ev.end);
    const dateStr = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + 
        " - " + endD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.textContent = dateStr;

    // Countdown / Status
    const now = new Date();
    let timeLabel = '';
    if (now >= startD && now <= endD) {
        const diff = endD - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const timeText = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        timeLabel = `<span style="font-size: 0.72rem; font-weight: 700; color: #ef4444; background: rgba(239, 68, 68, 0.15); padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock"></i> Ends in ${timeText}</span>`;
    } else {
        const diff = startD - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const timeText = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        timeLabel = `<span style="font-size: 0.72rem; font-weight: 700; color: #34d399; background: rgba(52, 211, 153, 0.15); padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-calendar"></i> Starts in ${timeText}</span>`;
    }
    if (countdownEl) countdownEl.innerHTML = timeLabel;

    // Title and Desc
    if (titleEl) titleEl.textContent = ev.title;
    if (descEl) descEl.textContent = ev.desc;

    // Bonuses
    if (bonusesEl) {
        bonusesEl.innerHTML = '';
        if (ev.details && Array.isArray(ev.details.bonuses) && ev.details.bonuses.length > 0) {
            const listItems = ev.details.bonuses.map(b => `<li style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: 5px;"><i class="fa-solid fa-gift" style="color: var(--accent-color); font-size: 0.72rem; margin-right: 6px;"></i> ${b}</li>`).join('');
            bonusesEl.innerHTML = `
                <span style="font-size: 0.78rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Active Bonuses</span>
                <ul style="margin: 0; padding: 0; list-style: none;">${listItems}</ul>
            `;
            bonusesEl.style.display = 'block';
        } else {
            bonusesEl.style.display = 'none';
        }
    }

    // Spawns
    if (spawnsEl) {
        spawnsEl.innerHTML = '';
        const allSpawns = [];
        if (ev.details) {
            if (Array.isArray(ev.details.spawns)) allSpawns.push(...ev.details.spawns);
            if (Array.isArray(ev.details.features)) allSpawns.push(...ev.details.features);
            // Merge shiny list into main list instead of pushing separately (avoids duplicates)
            if (Array.isArray(ev.details.shiny)) {
                ev.details.shiny.forEach(shinyEntry => {
                    const existing = allSpawns.find(s => s.name && shinyEntry.name && s.name.toLowerCase() === shinyEntry.name.toLowerCase());
                    if (existing) {
                        existing.shiny_available = true; // upgrade existing entry with shiny flag
                    } else {
                        allSpawns.push({ ...shinyEntry, shiny_available: true });
                    }
                });
            }
        }

        if (allSpawns.length > 0) {
            // Deduplicate by canonical name (case-insensitive), merging shiny flags
            const seen = new Map();
            allSpawns.forEach(s => {
                if (!s.name) return;
                const key = s.name.toLowerCase();
                if (seen.has(key)) {
                    if (s.shiny_available) seen.get(key).shiny_available = true;
                } else {
                    seen.set(key, { ...s });
                }
            });
            const uniqueSpawns = Array.from(seen.values());

            const spawnItems = uniqueSpawns.map(spawn => {
                const matchedPoke = pokemonDatabase.find(p => p.name && spawn.name && p.name.toLowerCase() === spawn.name.toLowerCase());
                const isTransferred = matchedPoke && isPokemonTransferred(matchedPoke);
                const isMissing = matchedPoke && (isPokemonMissing(matchedPoke) || isTransferred);
                const isCandyNeeded = matchedPoke && needsCandies(matchedPoke);

                // Format the raw API name into a readable display name
                const displayName = matchedPoke ? matchedPoke.name : formatSpawnName(spawn.name);

                let highlightStyle = 'border: 1px solid rgba(255,255,255,0.05);';
                if (matchedPoke) {
                    if (isTransferred) highlightStyle = 'border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.03);';
                    else if (isMissing) highlightStyle = 'border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.03);';
                    else if (isCandyNeeded) highlightStyle = 'border: 1px solid rgba(245, 166, 35, 0.3); background: rgba(245, 166, 35, 0.03);';
                }

                const shinySparkle = spawn.shiny_available ? `
                    <svg viewBox="0 0 24 24" fill="currentColor" title="Shiny Available" style="width: 10px; height: 10px; color: #f5a623; position: absolute; top: 2px; right: 2px; filter: drop-shadow(0 0 2px rgba(245, 166, 35, 0.8));">
                        <path d="M12 2l1.6 3.9 3.9 1.6-3.9 1.6-1.6 3.9-1.6-3.9-3.9-1.6 3.9-1.6zM6 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1zM18 13l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z"/>
                    </svg>
                ` : '';

                const matchedId = matchedPoke ? matchedPoke.id : '';
                // For matched Pokémon use PokeAPI official artwork.
                // For unmatched (Megas, alternate forms) fall back to spawn.asset_url from the events API.
                let pokeImgUrl;
                if (matchedPoke) {
                    pokeImgUrl = matchedPoke.img || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${matchedPoke.id}.png`;
                } else {
                    // asset_url from the API has the correct sprite for Megas and alternate forms
                    pokeImgUrl = spawn.asset_url || '';
                }

                const titleText = spawn.shiny_available ? `${displayName} (Shiny Available)` : displayName;

                return `
                    <div ${matchedPoke ? `class="clickable-spawn-icon" data-id="${matchedId}"` : ''} title="${titleText}" style="position: relative; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.02); border-radius: 8px; ${highlightStyle} padding: 4px; cursor: ${matchedPoke ? 'pointer' : 'default'}; transition: transform 0.2s ease;">
                        ${shinySparkle}
                        <img src="${pokeImgUrl}" alt="${displayName}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'">
                    </div>
                `;
            }).join('');

            spawnsEl.innerHTML = `
                <span style="font-size: 0.78rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Featured Pokémon</span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${spawnItems}
                </div>
            `;
            spawnsEl.style.display = 'block';

            spawnsEl.querySelectorAll('.clickable-spawn-icon').forEach(icon => {
                icon.addEventListener('click', () => {
                    const id = icon.dataset.id;
                    if (id) {
                        modal.classList.add('hidden'); // Close event modal
                        openModal(id); // Open pokemon modal
                    }
                });
            });
        } else {
            spawnsEl.style.display = 'none';
        }
    }

    // External Link
    if (linkEl) {
        linkEl.href = ev.url || '';
        linkEl.style.display = ev.url ? 'inline-flex' : 'none';
    }

    modal.classList.remove('hidden');
}

function renderEventsList() {
    const listContainer = document.getElementById('events-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const now = new Date();
    
    // Filter active or upcoming events
    const filtered = liveEvents.filter(ev => {
        const start = new Date(ev.start);
        const end = new Date(ev.end);
        
        if (currentEventTab === 'active') {
            return now >= start && now <= end;
        } else {
            return now < start;
        }
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<p style="grid-column: 1 / -1; color: var(--text-secondary); text-align: center; padding: 2rem 0; font-size: 0.95rem;">No ${currentEventTab} events found.</p>`;
        return;
    }

    filtered.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card-item';
        card.style.cssText = `
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 15px -3px rgba(0,0,0,0.2);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            cursor: pointer;
        `;
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-3px)';
            card.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 4px 15px -3px rgba(0,0,0,0.2)';
        });

        const startD = new Date(ev.start);
        const endD = new Date(ev.end);
        const dateStr = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + 
            " - " + endD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        let timeLabel = '';
        if (currentEventTab === 'active') {
            const diff = endD - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const timeText = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
            timeLabel = `<span style="font-size: 0.72rem; font-weight: 700; color: #ef4444; background: rgba(239, 68, 68, 0.15); padding: 3px 8px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock"></i> Ends in ${timeText}</span>`;
        } else {
            const diff = startD - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const timeText = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
            timeLabel = `<span style="font-size: 0.72rem; font-weight: 700; color: #34d399; background: rgba(52, 211, 153, 0.15); padding: 3px 8px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-calendar"></i> Starts in ${timeText}</span>`;
        }

        let categoryColor = '#60a5fa';
        let categoryBg = 'rgba(59, 130, 246, 0.15)';
        let categoryIcon = 'fa-calendar-days';
        const catLower = (ev.category || '').toLowerCase();
        if (catLower.includes('spotlight')) {
            categoryColor = '#fcd34d';
            categoryBg = 'rgba(245, 166, 35, 0.15)';
            categoryIcon = 'fa-star';
        } else if (catLower.includes('community')) {
            categoryColor = '#34d399';
            categoryBg = 'rgba(16, 185, 129, 0.15)';
            categoryIcon = 'fa-people-group';
        } else if (catLower.includes('raid')) {
            categoryColor = '#f87171';
            categoryBg = 'rgba(239, 68, 68, 0.15)';
            categoryIcon = 'fa-hand-fist';
        } else if (catLower.includes('battle league') || catLower.includes('gbl')) {
            categoryColor = '#818cf8';
            categoryBg = 'rgba(129, 140, 248, 0.15)';
            categoryIcon = 'fa-shield-halved';
        } else if (catLower.includes('season')) {
            categoryColor = '#38bdf8';
            categoryBg = 'rgba(56, 189, 248, 0.15)';
            categoryIcon = 'fa-sun';
        } else if (catLower.includes('max')) {
            categoryColor = '#fb923c';
            categoryBg = 'rgba(251, 146, 60, 0.15)';
            categoryIcon = 'fa-bolt';
        }

        const categoryBadge = `<span style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.65rem; font-weight: 700; color: ${categoryColor}; background: rgba(11, 19, 34, 0.85); border: 1px solid ${categoryColor}55; padding: 3px 8px; border-radius: 6px; white-space: nowrap; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.5);"><i class="fa-solid ${categoryIcon}" style="font-size:0.58rem;"></i>${ev.category}</span>`;

        const bannerHtml = ev.banner ? `
            <div style="width: 100%; height: 130px; position: relative; overflow: hidden; background: #0b1322;">
                <img src="${ev.banner}" alt="${ev.title}" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; bottom: 8px; left: 8px; z-index: 2;">
                    ${categoryBadge}
                </div>
            </div>
        ` : `
            <div style="width: 100%; height: 50px; background: linear-gradient(135deg, #1e293b, #0f172a); position: relative; display: flex; align-items: center; padding-left: 8px;">
                ${categoryBadge}
            </div>
        `;
        card.innerHTML = `
            ${bannerHtml}
            <div style="padding: 1rem; display: flex; flex-direction: column; gap: 4px; flex-grow: 1; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; display: flex; align-items: center; gap: 4px;">
                            <i class="fa-regular fa-calendar-days"></i> ${dateStr}
                        </span>
                        ${timeLabel}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 2px;">
                        <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.25;">
                            ${ev.title}
                        </h3>
                        <i class="fa-solid fa-arrow-up-right-from-square" style="color: var(--text-secondary); font-size: 0.85rem; opacity: 0.7;"></i>
                    </div>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            openEventModal(ev);
        });

        listContainer.appendChild(card);
    });
}

// Smart Header Show/Hide on Scroll
let lastScrollY = 0;
window.addEventListener('scroll', () => {
    const header = document.querySelector('.app-header');
    if (!header) return;
    
    const currentScrollY = window.scrollY;
    
    // Scroll down past 80px -> hide
    if (currentScrollY > lastScrollY && currentScrollY > 80) {
        header.classList.add('scroll-hide');
    } else {
        // Scroll up -> show
        header.classList.remove('scroll-hide');
    }
    lastScrollY = currentScrollY;
}, { passive: true });

function renderToDoPane() {
    const missingList = document.getElementById('todo-missing-list');
    const candiesList = document.getElementById('todo-candies-list');
    if (!missingList || !candiesList) return;
    
    missingList.innerHTML = '';
    candiesList.innerHTML = '';

    const missingItems = [];
    const candyItems = [];

    // Helper to add item to lists
    function addPriority(poke, type, source, detail, sectionTarget, scrollTarget) {
        const item = {
            poke,
            type, // 'Missing', 'Transferred', or 'Candy'
            source, // 'Raid', 'Egg', 'Quest', 'Rocket', 'Party'
            detail,
            sectionTarget,
            scrollTarget
        };
        if (type === 'Missing' || type === 'Transferred') {
            if (!missingItems.some(i => i.poke.id === poke.id && i.source === source && i.detail === detail)) {
                missingItems.push(item);
            }
        } else {
            if (!candyItems.some(i => i.poke.id === poke.id && i.source === source && i.detail === detail)) {
                candyItems.push(item);
            }
        }
    }

    // 1. Check Raids
    if (typeof liveRaids !== 'undefined' && Array.isArray(liveRaids)) {
        liveRaids.forEach(raid => {
            const raidName = safeLower(raid.name);
            const raidIdName = safeLower(raid.idName);
            const matched = pokemonDatabase.find(p => p.idName && raidIdName && safeLower(p.idName) === raidIdName) || 
                            pokemonDatabase.find(p => p.name && raidName && safeLower(p.name) === raidName);
            if (matched) {
                let tierLabel = String(raid.tier || 'Raid');
                if (tierLabel.startsWith('lvl')) {
                    tierLabel = 'Tier ' + tierLabel.substring(3);
                } else if (safeLower(tierLabel).includes('mega')) {
                    tierLabel = 'Mega Raid';
                } else if (safeLower(tierLabel).includes('shadow')) {
                    tierLabel = 'Shadow ' + tierLabel.replace('shadow_', '').replace('lvl', 'Tier ');
                }
                
                const isTransf = isPokemonTransferred(matched);
                const isMiss = isPokemonMissing(matched) && !isTransf;
                const isCandy = needsCandies(matched);
                const key = `raid-${safeLower(matched.name).replace(/\s+/g, '-')}-${safeLower(raid.tier).replace(/[^a-z0-9]/g, '')}`;

                if (isTransf) {
                    addPriority(matched, 'Transferred', 'Raid', `Raid Boss (${tierLabel})`, 'rotations-raids-section', key);
                } else if (isMiss) {
                    addPriority(matched, 'Missing', 'Raid', `Raid Boss (${tierLabel})`, 'rotations-raids-section', key);
                } else if (isCandy) {
                    addPriority(matched, 'Candy', 'Raid', `Raid Boss (${tierLabel})`, 'rotations-raids-section', key);
                }
            }
        });
    }

    const getEggFriendlyName = (eggT) => {
        if (eggT === '1km') return '1km Eggs';
        if (eggT === '2km') return '2km Eggs';
        if (eggT === '5km') return '5km Eggs';
        if (eggT === '7km') return '7km Eggs';
        if (eggT === 'route') return 'Route Gift (7km)';
        if (eggT === '10km') return '10km Eggs';
        if (eggT === 'adventure10km') return 'Adventure Sync (10km)';
        if (eggT === '12km') return 'Strange Eggs (12km)';
        if (eggT === 'adventure5km') return 'Adventure Sync (5km)';
        return eggT || 'Egg';
    };

    // 2. Check Eggs
    if (typeof liveEggs !== 'undefined' && Array.isArray(liveEggs)) {
        liveEggs.forEach(egg => {
            const matched = pokemonDatabase.find(p => p.id == egg.dex);
            if (matched) {
                const eggDist = getEggFriendlyName(egg.eggT);
                const isTransf = isPokemonTransferred(matched);
                const isMiss = isPokemonMissing(matched) && !isTransf;
                const isCandy = needsCandies(matched);
                const key = `egg-${safeLower(egg.name).replace(/\s+/g, '-')}-${safeLower(egg.eggT).replace(/[^a-z0-9]/g, '')}`;

                if (isTransf) {
                    addPriority(matched, 'Transferred', 'Egg', `Hatching from ${eggDist}`, 'rotations-eggs-section', key);
                } else if (isMiss) {
                    addPriority(matched, 'Missing', 'Egg', `Hatching from ${eggDist}`, 'rotations-eggs-section', key);
                } else if (isCandy) {
                    addPriority(matched, 'Candy', 'Egg', `Hatching from ${eggDist}`, 'rotations-eggs-section', key);
                }
            }
        });
    }

    // 3. Check Quests
    if (typeof liveResearch !== 'undefined' && Array.isArray(liveResearch)) {
        liveResearch.forEach(task => {
            if (task.rewards) {
                task.rewards.forEach(reward => {
                    if (reward.type === 'encounter' && reward.name) {
                        const rName = safeLower(reward.name);
                        const matched = pokemonDatabase.find(p => safeLower(p.name) === rName) || pokemonDatabase.find(p => p.id == reward.dex);
                        if (matched) {
                            const isTransf = isPokemonTransferred(matched);
                            const isMiss = isPokemonMissing(matched) && !isTransf;
                            const isCandy = needsCandies(matched);
                            const key = `quest-${safeLower(matched.name).replace(/\s+/g, '-')}-${safeLower(task.text).replace(/[^a-z0-9]/g, '')}`;

                            if (isTransf) {
                                addPriority(matched, 'Transferred', 'Quest', `Quest: "${task.text}"`, 'rotations-quests-section', key);
                            } else if (isMiss) {
                                addPriority(matched, 'Missing', 'Quest', `Quest: "${task.text}"`, 'rotations-quests-section', key);
                            } else if (isCandy) {
                                addPriority(matched, 'Candy', 'Quest', `Quest: "${task.text}"`, 'rotations-quests-section', key);
                            }
                        }
                    }
                });
            }
        });
    }

    // 4. Check Team GO Rocket
    if (typeof liveRocket !== 'undefined' && liveRocket) {
        Object.entries(liveRocket).forEach(([charName, charData]) => {
            if (Array.isArray(charData)) {
                charData.forEach(slot => {
                    if (slot.is_encounter && slot.pokemons) {
                        slot.pokemons.forEach(p => {
                            const pName = safeLower(p && typeof p === 'object' ? p.name : p);
                            if (pName) {
                                const matched = pokemonDatabase.find(poke => safeLower(poke.name) === pName);
                                if (matched) {
                                    const isTransf = isPokemonTransferred(matched);
                                    const isMiss = isPokemonMissing(matched) && !isTransf;
                                    const isCandy = needsCandies(matched);
                                    const key = `rocket-${safeLower(charName).replace(/\s+/g, '-')}`;

                                    if (isTransf) {
                                        addPriority(matched, 'Transferred', 'Rocket', `Team GO Rocket ${charName} (Slot ${slot.slot})`, 'rotations-rocket-section', key);
                                    } else if (isMiss) {
                                        addPriority(matched, 'Missing', 'Rocket', `Team GO Rocket ${charName} (Slot ${slot.slot})`, 'rotations-rocket-section', key);
                                    } else if (isCandy) {
                                        addPriority(matched, 'Candy', 'Rocket', `Team GO Rocket ${charName} (Slot ${slot.slot})`, 'rotations-rocket-section', key);
                                    }
                                }
                            }
                        });
                    }
                });
            }
        });
    }

    // 5. Check Party Challenges
    if (typeof partyRewardsData !== 'undefined' && Array.isArray(partyRewardsData)) {
        partyRewardsData.forEach(party => {
            const pName = safeLower(party.name);
            const matched = pokemonDatabase.find(p => p.id == party.dex) || pokemonDatabase.find(p => safeLower(p.name) === pName);
            if (matched) {
                const isTransf = isPokemonTransferred(matched);
                const isMiss = isPokemonMissing(matched) && !isTransf;
                const isCandy = needsCandies(matched);
                const key = `party-${safeLower(matched.name).replace(/\s+/g, '-')}-${safeLower(party.task).replace(/[^a-z0-9]/g, '')}`;

                if (isTransf) {
                    addPriority(matched, 'Transferred', 'Party', `Party Challenge: "${party.task}"`, 'rotations-party-section', key);
                } else if (isMiss) {
                    addPriority(matched, 'Missing', 'Party', `Party Challenge: "${party.task}"`, 'rotations-party-section', key);
                } else if (isCandy) {
                    addPriority(matched, 'Candy', 'Party', `Party Challenge: "${party.task}"`, 'rotations-party-section', key);
                }
            }
        });
    }

    const icons = {
        Raid: 'fa-solid fa-hand-fist',
        Egg: 'fa-solid fa-egg',
        Quest: 'fa-solid fa-scroll',
        Rocket: 'fa-solid fa-user-ninja',
        Party: 'fa-solid fa-users'
    };

    const colors = {
        Raid: '#a78bfa',
        Egg: '#34d399',
        Quest: '#60a5fa',
        Rocket: '#f87171',
        Party: '#3b82f6'
    };

    const borderColors = {
        Raid: 'rgba(167, 139, 250, 0.25)',
        Egg: 'rgba(52, 211, 153, 0.25)',
        Quest: 'rgba(96, 165, 250, 0.25)',
        Rocket: 'rgba(248, 113, 113, 0.25)',
        Party: 'rgba(59, 130, 246, 0.25)'
    };

    const buildItemHtml = (item) => {
        const imgUrl = getPokemonImageUrl(item.poke.name, item.poke) || item.poke.img;
        const iconClass = icons[item.source] || 'fa-solid fa-star';
        const color = colors[item.source] || 'var(--accent-color)';
        const borderCol = borderColors[item.source] || 'var(--border-color)';
        
        let badgeText = 'MISSING';
        let badgeColor = '#ef4444';
        let badgeTextColor = '#1e1b4b';
        let badgeIcon = '';

        if (item.type === 'Transferred') {
            badgeText = 'TRANSFERRED';
            badgeColor = '#3b82f6';
            badgeTextColor = '#ffffff';
            badgeIcon = '<i class="fa-solid fa-arrows-spin"></i>';
        } else if (item.type === 'Candy') {
            badgeText = 'CANDY';
            badgeColor = 'var(--accent-color)';
            badgeTextColor = '#1e1b4b';
        }

        const div = document.createElement('div');
        div.className = 'todo-item active-rotation-link';
        div.style.borderColor = borderCol;
        
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${imgUrl}" style="width: 38px; height: 38px; object-fit: contain;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22 opacity=%220.25%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22none%22 stroke=%22%23cbd5e1%22 stroke-width=%228%22/><line x1=%2210%22 y1=%2250%22 x2=%2290%22 y2=%2250%22 stroke=%22%23cbd5e1%22 stroke-width=%228%22/></svg>'">
                <div>
                    <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 6px;">
                        ${item.poke.name} <span style="font-size: 0.62rem; background: ${badgeColor}; color: ${badgeTextColor}; padding: 1px 5px; border-radius: 4px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">${badgeIcon} ${badgeText}</span>
                    </h4>
                    <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 2px 0 0 0; line-height: 1.3;">
                        <i class="${iconClass}" style="color: ${color}; margin-right: 4px;"></i> ${item.detail}
                    </p>
                </div>
            </div>
            <div style="color: var(--text-secondary); opacity: 0.35; padding-left: 0.5rem; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-chevron-right" style="font-size: 0.75rem;"></i>
            </div>
        `;

        div.addEventListener('click', () => {
            const rotationsTabBtn = document.querySelector('.view-switch-container .view-btn[data-view="rotations-pane"]');
            if (rotationsTabBtn) rotationsTabBtn.click();
            const subnavBtn = document.querySelector(`.subnav-btn[data-target="${item.sectionTarget}"]`);
            if (subnavBtn) subnavBtn.click();
            jumpToRotationTarget(item.scrollTarget);
        });

        // Hover border-color swap only (translateY and shadow handled by CSS class transitions)
        div.addEventListener('mouseenter', () => {
            div.style.borderColor = color;
        });
        div.addEventListener('mouseleave', () => {
            div.style.borderColor = borderCol;
        });

        return div;
    };

    // Render Missing Priorities
    if (missingItems.length === 0) {
        missingList.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fa-solid fa-circle-check" style="color: var(--accent-green); font-size: 1.8rem; margin-bottom: 0.5rem; display: block;"></i>
                No active rotation has missing or transferred Pokémon! You are up to date.
            </div>
        `;
    } else {
        missingItems.forEach(item => {
            missingList.appendChild(buildItemHtml(item));
        });
    }

    // Render Candy Priorities
    if (candyItems.length === 0) {
        candiesList.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fa-solid fa-circle-check" style="color: var(--accent-green); font-size: 1.8rem; margin-bottom: 0.5rem; display: block;"></i>
                No active rotation has candy targets. All set!
            </div>
        `;
    } else {
        candyItems.forEach(item => {
            candiesList.appendChild(buildItemHtml(item));
        });
    }
}



// ==========================================================================
// PROMO CODES PANEL
// ==========================================================================
let rawPromoCodes = [];

function loadPromoCodesFallback() {
    fetch('files/promoCodes.min.json')
        .then(r => r.json())
        .then(data => {
            rawPromoCodes = data;
            const sec = document.getElementById('rotations-promocodes-section');
            if (sec && !sec.classList.contains('hidden')) {
                renderPromoCodes();
            }
        })
        .catch(err => console.warn('Could not load promoCodes fallback:', err));
}

function renderPromoCodes() {
    const grid = document.getElementById('promocodes-grid');
    if (!grid) return;

    if (!rawPromoCodes || rawPromoCodes.length === 0) {
        loadPromoCodesFallback();
    }

    const list = Array.isArray(rawPromoCodes) ? rawPromoCodes : [];
    grid.innerHTML = '';

    if (list.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <i class="fa-solid fa-gift" style="font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.4;"></i>
                <p style="font-size: 0.95rem; font-weight: 600; margin: 0;">No promo codes currently available.</p>
            </div>
        `;
        return;
    }

    const activeList = [];
    const expiredList = [];

    list.forEach(item => {
        const expLower = (item.expires || '').toLowerCase();
        if (item.isExpired || expLower.includes('expired')) {
            expiredList.push(item);
        } else {
            activeList.push(item);
        }
    });

    function createCard(item, isExpiredCard = false) {
        const code = item.code || '';
        const title = item.title || code;
        const description = item.description || '';
        const link = item.link || `https://store.pokemongo.com/offer-redemption?passcode=${encodeURIComponent(code)}`;
        const expires = item.expires || '';

        const card = document.createElement('div');
        card.className = 'promocode-card';
        card.style.cssText = `
            background: var(--bg-secondary);
            border: 1px solid ${isExpiredCard ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-color)'};
            border-radius: 12px;
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            position: relative;
            opacity: ${isExpiredCard ? '0.7' : '1'};
            transition: transform 0.15s, border-color 0.15s;
        `;

        card.innerHTML = `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 42px; height: 42px; border-radius: 10px; background: ${isExpiredCard ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'}; border: 1px solid ${isExpiredCard ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}; display: flex; align-items: center; justify-content: center; color: ${isExpiredCard ? '#f87171' : '#f59e0b'}; font-size: 1.2rem; flex-shrink: 0;">
                        <i class="fa-solid ${isExpiredCard ? 'fa-hourglass-end' : 'fa-ticket'}"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--text-primary); line-height: 1.3;">${title}</h4>
                        ${isExpiredCard ? `<span style="font-size: 0.72rem; color: #f87171; font-weight: 800;"><i class="fa-solid fa-ban"></i> EXPIRED</span>` : (expires ? `<span style="font-size: 0.72rem; color: #f87171; font-weight: 700;"><i class="fa-solid fa-clock"></i> Expires: ${expires}</span>` : `<span style="font-size: 0.72rem; color: #10b981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Active Code</span>`)}
                    </div>
                </div>
            </div>

            <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${description}</p>
            ${Array.isArray(item.rewards) && item.rewards.length > 0 ? `
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: -2px;">
                    ${item.rewards.map(r => `<span style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25); padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700;"><i class="fa-solid fa-gift"></i> ${r}</span>`).join('')}
                </div>
            ` : ''}

            <div style="background: rgba(0,0,0,0.3); border: 1px dashed ${isExpiredCard ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.15)'}; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="font-family: monospace; font-size: 1rem; font-weight: 900; color: ${isExpiredCard ? '#94a3b8' : '#fbbf24'}; letter-spacing: 1px; ${isExpiredCard ? 'text-decoration: line-through;' : ''}">${code}</span>
                <button class="copy-code-btn" data-code="${code}" style="background: rgba(255,255,255,0.08); border: 1px solid var(--border-color); color: var(--text-primary); padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s;">
                    <i class="fa-regular fa-copy"></i> Copy
                </button>
            </div>

            <a href="${link}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; margin-top: 4px;">
                <button style="width: 100%; background: ${isExpiredCard ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; color: ${isExpiredCard ? 'var(--text-secondary)' : '#1e1b4b'}; border: 1px solid ${isExpiredCard ? 'var(--border-color)' : 'transparent'}; border-radius: 8px; padding: 10px; font-size: 0.88rem; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; opacity: ${isExpiredCard ? '0.7' : '1'}; transition: filter 0.15s, transform 0.1s;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Redeem Code on Web Store
                </button>
            </a>
        `;

        const copyBtn = card.querySelector('.copy-code-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                navigator.clipboard.writeText(code).then(() => {
                    copyBtn.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> Copied!`;
                    copyBtn.style.borderColor = '#10b981';
                    setTimeout(() => {
                        copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`;
                        copyBtn.style.borderColor = 'var(--border-color)';
                    }, 2000);
                });
            });
        }

        return card;
    }

    if (activeList.length > 0) {
        activeList.forEach(item => {
            grid.appendChild(createCard(item, false));
        });
    } else {
        const noActiveEl = document.createElement('div');
        noActiveEl.style.cssText = "grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-secondary);";
        noActiveEl.innerHTML = `<p style="margin: 0; font-weight: 600;">No active promo codes currently available.</p>`;
        grid.appendChild(noActiveEl);
    }

    if (expiredList.length > 0) {
        const expiredDivider = document.createElement('div');
        expiredDivider.style.cssText = "grid-column: 1 / -1; margin-top: 2rem; margin-bottom: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; display: flex; align-items: center; gap: 10px;";
        expiredDivider.innerHTML = `
            <i class="fa-solid fa-clock-rotate-left" style="color: #f87171; font-size: 1.1rem;"></i>
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-secondary);">Expired / Past Promo Codes (${expiredList.length})</h3>
        `;
        grid.appendChild(expiredDivider);

        expiredList.forEach(item => {
            grid.appendChild(createCard(item, true));
        });
    }
}
