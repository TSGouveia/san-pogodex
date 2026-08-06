/**
 * SilphRoad Dex - Core Application JavaScript
 * Dynamic Pokémon GO PokéDex Loader, local storage state persistence, and filtering.
 */

// Global Application Database loaded dynamically
let pokemonDatabase = [];
let caughtPokemon = new Set();
let liveEggs = [];
let liveRaids = [];
let liveResearch = [];
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

// ==========================================================================
// DYNAMIC API DATA FETCHING & PARSING
// ==========================================================================
async function loadPokedex() {
    const loaderOverlay = document.getElementById('loader-overlay');
    const errorOverlay = document.getElementById('error-overlay');
    
    // Show loading spinner
    loaderOverlay.classList.remove('fade-out', 'hidden');
    errorOverlay.classList.add('hidden');
    
    try {
        // Fetch Pokedex data and live community databases concurrently
        const [pokedexRes, eggsRes, raidsRes, researchRes] = await Promise.all([
            fetch('https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json'),
            fetch('https://pokemn.quest/data/eggs.json'),
            fetch('https://pokemon-go-api.github.io/pokemon-go-api/api/raidboss.json'),
            fetch('https://pokemn.quest/data/research.json')
        ]);
        
        if (!pokedexRes.ok) throw new Error("Could not load Pokedex API");
        const data = await pokedexRes.json();
        
        if (eggsRes.ok) {
            try {
                const eggsData = await eggsRes.json();
                liveEggs = eggsData.data || [];
            } catch (err) {
                console.warn("Eggs API parsing failed:", err);
            }
        }
        if (raidsRes.ok) {
            try {
                const raidsData = await raidsRes.json();
                liveRaids = [];
                if (raidsData.currentList) {
                    const tierNamesMap = {
                        "mega": "Mega Raids",
                        "lvl5": "5-Star Raids",
                        "lvl3": "3-Star Raids",
                        "lvl1": "1-Star Raids",
                        "ultrabeast": "5-Star Raids",
                        "elite": "5-Star Raids",
                        "shadow_lvl1": "SHADOW LVL1 RAIDS",
                        "shadow_lvl3": "SHADOW LVL3 RAIDS",
                        "shadow_lvl5": "SHADOW LVL5 RAIDS",
                        "shadow_mega": "SHADOW MEGA RAIDS"
                    };
                    Object.entries(raidsData.currentList).forEach(([levelKey, bosses]) => {
                        if (Array.isArray(bosses)) {
                            bosses.forEach(boss => {
                                const cleanLabel = tierNamesMap[levelKey] || levelKey.replace(/_/g, ' ').toUpperCase() + " Raids";
                                liveRaids.push({
                                    idName: boss.id,
                                    name: boss.names ? boss.names.English : boss.id,
                                    tier: cleanLabel,
                                    image: boss.assets ? boss.assets.image : '',
                                    cp: {
                                        normal: boss.cpRange ? { max: boss.cpRange[1] } : null,
                                        boosted: boss.cpRangeBoost ? { max: boss.cpRangeBoost[1] } : null
                                    },
                                    shiny: boss.shiny
                                });
                            });
                        }
                    });
                }
            } catch (err) {
                console.warn("Raids API parsing failed:", err);
            }
        }
        if (researchRes.ok) {
            try {
                const researchData = await researchRes.json();
                liveResearch = researchData.data || [];
            } catch (err) {
                console.warn("Research API parsing failed:", err);
            }
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

        processed.sort((a, b) => a.id - b.id);
        pokemonDatabase = processed;
        filterObtainingMethods();
        migrateCaughtState();
        
        // Hide loader overlay, keep error overlay hidden
        loaderOverlay.classList.add('fade-out');
        setTimeout(() => loaderOverlay.classList.add('hidden'), 500);
        errorOverlay.classList.add('hidden');
        
        generateGenTabs();
        renderPokedex();
        renderMissingSummary();
        updateDashboardStats();
        updateRegionStatsBadge();
    } catch (e) {
        console.error("API loading failed:", e);
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
    // Hisui override (899-905)
    if (p.dexNr >= 899 && p.dexNr <= 905) {
        gen = 8.5;
    }
    // Meltan and Melmetal override
    else if (p.dexNr === 808 || p.dexNr === 809) {
        gen = 99;
    }

    return {
        id: p.dexNr,
        idName: p.id,
        num: idStr,
        name: p.names.English,
        gen: gen,
        types: types,
        img: p.assets && p.assets.image ? p.assets.image : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.dexNr}.png`,
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

    // 5. Standard Wild Spawns
    // Mythical Pokemon and Baby Pokemon never spawn in the wild normally.
    if (!isMythic && !isBaby) {
        const weather = getWeatherBoost(types);
        list.push({ 
            method: "Wild Spawn", 
            desc: `Spawns regularly in the wild. Catching is boosted by ${weather} weather.` 
        });
    }

    // 6. Mythical / Special storyline quests (fallback if not in research)
    if (isMythic && researchTasks.length === 0) {
        list.push({ 
            method: "Special Research", 
            desc: `Obtained exclusively through special storyline quests (e.g. 'A Mythical Discovery' or 'A Ripple in Time').` 
        });
    }

    return list;
}

// Generate simple region tabs
function generateGenTabs() {
    const gens = Array.from(new Set(pokemonDatabase.map(p => p.gen))).sort((a, b) => a - b);
    
    genTabsContainer.innerHTML = '';
    
    const allBtn = document.createElement('button');
    allBtn.className = `tab-btn ${currentGenFilter === 'all' ? 'active' : ''}`;
    allBtn.dataset.gen = 'all';
    allBtn.textContent = 'All Regions';
    genTabsContainer.appendChild(allBtn);
    
    gens.forEach(g => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${String(currentGenFilter) === String(g) ? 'active' : ''}`;
        btn.dataset.gen = g;
        btn.textContent = regionNames[g] || `Gen ${g}`;
        genTabsContainer.appendChild(btn);
    });
}

function updateRegionStatsBadge() {
    let total = 0;
    let caught = 0;
    let name = "All Regions";
    
    if (currentGenFilter === 'all') {
        total = pokemonDatabase.length;
        caught = pokemonDatabase.filter(p => caughtPokemon.has(Number(p.id))).length;
    } else {
        const genNum = parseFloat(currentGenFilter);
        total = pokemonDatabase.filter(p => p.gen === genNum).length;
        caught = pokemonDatabase.filter(p => p.gen === genNum && caughtPokemon.has(Number(p.id))).length;
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
    localStorage.setItem('pogo_caught_pokemon', JSON.stringify(Array.from(caughtPokemon).map(Number)));
    updateDashboardStats();
    updateRegionStatsBadge();
    renderMissingSummary();
}

function toggleCaughtState(id) {
    const numId = Number(id);
    if (caughtPokemon.has(numId)) {
        caughtPokemon.delete(numId);
    } else {
        caughtPokemon.add(numId);
    }
    saveCaughtState();
}

function updateDashboardStats() {
    const total = pokemonDatabase.length;
    const caught = pokemonDatabase.filter(p => caughtPokemon.has(Number(p.id))).length;
    const pct = total > 0 ? Math.round((caught / total) * 100) : 0;
    
    caughtCountEl.textContent = caught;
    totalCountEl.textContent = total;
    progressBarFill.style.width = `${pct}%`;
    progressPctEl.textContent = `${pct}% Completed`;
}

// ==========================================================================
// EVENT LISTENERS & FILTERING
// ==========================================================================
function setupEventListeners() {
    const viewButtons = document.querySelectorAll('.view-switcher .view-btn');
    const viewPanes = document.querySelectorAll('.view-pane');
    
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetPaneId = btn.dataset.view;
            viewPanes.forEach(pane => {
                if (pane.id === targetPaneId) {
                    pane.classList.remove('hidden');
                } else {
                    pane.classList.add('hidden');
                }
            });
            
            if (targetPaneId === 'hunt-pane') {
                document.querySelector('.radio-filters').classList.add('hidden');
                document.querySelector('.bulk-actions').classList.add('hidden');
                document.querySelector('.sort-wrapper').classList.add('hidden');
                document.getElementById('region-stats-badge').classList.add('hidden');
                genTabsScroll.classList.add('hidden');
                huntTabsScroll.classList.remove('hidden');
            } else if (targetPaneId === 'rotations-pane') {
                document.querySelector('.radio-filters').classList.add('hidden');
                document.querySelector('.bulk-actions').classList.add('hidden');
                document.querySelector('.sort-wrapper').classList.add('hidden');
                document.getElementById('region-stats-badge').classList.add('hidden');
                genTabsScroll.classList.add('hidden');
                huntTabsScroll.classList.add('hidden');
                renderActiveRotations();
            } else {
                document.querySelector('.radio-filters').classList.remove('hidden');
                document.querySelector('.bulk-actions').classList.remove('hidden');
                document.querySelector('.sort-wrapper').classList.remove('hidden');
                document.getElementById('region-stats-badge').classList.remove('hidden');
                genTabsScroll.classList.remove('hidden');
                huntTabsScroll.classList.add('hidden');
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
        });
    }

    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        renderPokedex();
        renderMissingSummary();
    });

    sortSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        renderPokedex();
    });

    genTabsContainer.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.tab-btn');
        if (!targetBtn) return;
        
        genTabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        targetBtn.classList.add('active');
        
        currentGenFilter = targetBtn.dataset.gen;
        renderPokedex();
        renderMissingSummary();
        updateRegionStatsBadge();
    });

    collectionFilterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            collectionFilterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCollectionFilter = btn.dataset.filter;
            renderPokedex();
        });
    });

    catchAllBtn.addEventListener('click', () => {
        const visible = getFilteredAndSortedPokemon();
        if (visible.length === 0) return;
        
        visible.forEach(p => caughtPokemon.add(p.id));
        saveCaughtState();
        renderPokedex();
    });

    resetAllBtn.addEventListener('click', () => {
        const visible = getFilteredAndSortedPokemon();
        if (visible.length === 0) return;
        
        visible.forEach(p => caughtPokemon.delete(p.id));
        saveCaughtState();
        renderPokedex();
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
            toggleCaughtState(activeModalPokemonId);
            updateModalCatchBtn(activeModalPokemonId);
            renderPokedex();
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
        result = result.filter(p => caughtPokemon.has(Number(p.id)));
    } else if (currentCollectionFilter === 'missing') {
        result = result.filter(p => !caughtPokemon.has(Number(p.id)));
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
        result.sort((a, b) => a.id - b.id);
    } else if (currentSortOrder === 'num-desc') {
        result.sort((a, b) => b.id - a.id);
    } else if (currentSortOrder === 'name-asc') {
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
}

// Render Pokedex Grid Cards
function renderPokedex() {
    const list = getFilteredAndSortedPokemon();
    pokedexGrid.innerHTML = '';

    if (list.length === 0) {
        emptyState.classList.remove('hidden');
        pokedexGrid.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    pokedexGrid.classList.remove('hidden');

    list.forEach(poke => {
        const isCaught = caughtPokemon.has(Number(poke.id));
        const cardClass = isCaught ? 'pokemon-card caught' : 'pokemon-card missing';
        const typeBadges = poke.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');

        const card = document.createElement('div');
        card.className = cardClass;
        card.dataset.id = poke.id;
        
        card.innerHTML = `
            <svg class="card-watermark" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="4"/>
                <path d="M4 50 H96" stroke="currentColor" stroke-width="4"/>
                <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="4"/>
            </svg>
            
            <div class="card-top">
                <span class="poke-number">#${poke.num}</span>
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
        `;

        card.addEventListener('click', (e) => {
            const catchBtn = card.querySelector('.catch-indicator-btn');
            if (catchBtn.contains(e.target) || e.target === catchBtn) {
                e.stopPropagation();
                toggleCaughtState(poke.id);
                renderPokedex();
                return;
            }
            openModal(poke.id);
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
    if (poke.id === 808 || poke.id === 809 || isMythic || obtaining.some(o => o.method && (o.method.toLowerCase().includes("research") || o.method.toLowerCase().includes("special") || o.method.toLowerCase().includes("mystery")))) {
        cats.push('special');
    }
    
    // 5. Wild
    const canSpawnInWild = !isBaby && poke.id !== 808 && poke.id !== 809 && !isMythic && !isLegendary;
    if (canSpawnInWild || obtaining.some(o => o.method && o.method.toLowerCase().includes("wild"))) {
        cats.push('wild');
    }
    
    // 6. Unavailable
    if (obtaining.some(o => o.method === "Unavailable")) {
        cats.push('unavailable');
    }
    
    return cats;
}

function compileCardObtainingPreview(poke) {
    const chain = findEvolutionChain(poke);
    const indexInChain = chain.findIndex(p => p.id === poke.id);
    if (indexInChain > 0) {
        const prevPoke = chain[indexInChain - 1];
        const rawEvos = prevPoke.rawEvolutions || [];
        const idName = poke.idName || "";
        const evoData = rawEvos.find(e => e.id && idName && e.id.toLowerCase() === idName.toLowerCase());
        if (evoData) {
            let itemStr = evoData.item ? ` + ${formatItemName(evoData.item)}` : '';
            return `Evolve from ${prevPoke.name} (${evoData.candies || 50} Candies${itemStr})`;
        }
    }
    
    const obtaining = poke.obtaining || [];
    if (obtaining.length > 0) {
        if (obtaining[0].method === "Unavailable") {
            return "Currently Unavailable";
        }
        return `${obtaining[0].method}: ${obtaining[0].desc.split('.')[0]}`;
    }
    
    return "Special Event Rotation";
}

// Render the Hunt List/Missing Pokémon grid filtered by the active method tab
function renderMissingSummary() {
    if (!huntGrid) return;
    
    huntGrid.innerHTML = '';
    
    // 1. Get all missing Pokémon
    let missingList = pokemonDatabase.filter(p => !caughtPokemon.has(p.id));
    
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
    if (currentHuntMethod !== 'all') {
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
        const previewText = compileCardObtainingPreview(poke);

        const card = document.createElement('div');
        card.className = 'pokemon-card missing';
        card.dataset.id = poke.id;
        
        card.innerHTML = `
            <svg class="card-watermark" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="4"/>
                <path d="M4 50 H96" stroke="currentColor" stroke-width="4"/>
                <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="4"/>
            </svg>
            
            <div class="card-top">
                <span class="poke-number">#${poke.num}</span>
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
            
            <div class="card-obtain-preview">
                ${previewText}
            </div>
        `;

        card.addEventListener('click', (e) => {
            const catchBtn = card.querySelector('.catch-indicator-btn');
            if (catchBtn.contains(e.target) || e.target === catchBtn) {
                e.stopPropagation();
                toggleCaughtState(poke.id);
                renderPokedex();
                renderMissingSummary();
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

    const chain = findEvolutionChain(poke);
    const indexInChain = chain.indexOf(poke);
    
    if (indexInChain > 0) {
        const prevPoke = chain[indexInChain - 1];
        const rawEvos = prevPoke.rawEvolutions || [];
        const idName = poke.idName || "";
        const evoData = rawEvos.find(e => e.id && idName && e.id.toLowerCase() === idName.toLowerCase());
        
        if (evoData) {
            const candy = evoData.candies || 50;
            let req = `Evolves from ${prevPoke.name} with ${candy} Candies`;
            
            if (evoData.item) {
                req += ` + ${formatItemName(evoData.item)}`;
            }
            if (evoData.quests && evoData.quests.length > 0) {
                req += ` after completing Buddy quest: "${evoData.quests[0]}"`;
            }
            
            lines.push(`
                <div style="margin-bottom: 0.15rem;">
                    <span class="table-obtain-desc" style="font-weight: 700; color: var(--accent-color);">Evolution:</span>
                    <span class="table-obtain-desc">${req}.</span>
                </div>
            `);
        }
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

    const chain = findEvolutionChain(poke);
    const indexInChain = chain.indexOf(poke);
    
    if (indexInChain > 0) {
        const prevPoke = chain[indexInChain - 1];
        const evoData = prevPoke.rawEvolutions.find(e => e.id.toLowerCase() === poke.idName.toLowerCase());
        
        if (evoData) {
            const candy = evoData.candies || 50;
            let req = `Evolves from ${prevPoke.name} with ${candy} Candies`;
            if (evoData.item) req += ` + ${formatItemName(evoData.item)}`;
            if (evoData.quests && evoData.quests.length > 0) req += ` after completing Buddy quest: "${evoData.quests[0]}"`;

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
    }

    poke.obtaining.forEach(opt => {
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
            const candyNeeded = prevStage.rawEvolutions.find(e => e.id && stage.idName && e.id.toLowerCase() === stage.idName.toLowerCase())?.candies || 50;

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
    
    let current = poke;
    let prevFound = true;
    while (prevFound) {
        const prev = pokemonDatabase.find(p => 
            p.rawEvolutions && p.rawEvolutions.some(e => e.id && current.idName && e.id.toLowerCase() === current.idName.toLowerCase())
        );
        if (prev && !chain.some(c => c.id === prev.id)) {
            chain.unshift(prev);
            current = prev;
        } else {
            prevFound = false;
        }
    }
    
    current = poke;
    let nextFound = true;
    while (nextFound) {
        if (current.rawEvolutions && current.rawEvolutions.length > 0) {
            const nextEvoInfo = current.rawEvolutions[0];
            const next = pokemonDatabase.find(p => p.idName && nextEvoInfo.id && p.idName.toLowerCase() === nextEvoInfo.id.toLowerCase());
            if (next && !chain.some(c => c.id === next.id)) {
                chain.push(next);
                current = next;
            } else {
                nextFound = false;
            }
        } else {
            nextFound = false;
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

function updateModalCatchBtn(id) {
    const isCaught = caughtPokemon.has(id);
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

        const sortedTiers = ["Mega Raids", "5-Star Raids", "3-Star Raids", "1-Star Raids"];
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
                card.className = `rotation-card-item ${cardTheme}`;
                
                const matchedPoke = pokemonDatabase.find(p => p.idName && raid.idName && p.idName.toLowerCase() === raid.idName.toLowerCase());
                
                let imgUrl = raid.image || '';
                if (imgUrl.startsWith('~pq/')) {
                    imgUrl = imgUrl.replace('~pq/', 'https://pokemn.quest/');
                }
                if (!imgUrl && matchedPoke) {
                    imgUrl = matchedPoke.img;
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

                card.innerHTML = `
                    ${raid.shiny ? '<i class="fa-solid fa-sparkles shiny-icon" title="Shiny Available"></i>' : ''}
                    <img class="rotation-card-img" src="${imgUrl}" alt="${raid.name}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${matchedPoke ? matchedPoke.id : ''}.png'">
                    <span class="rotation-card-name">${raid.name}</span>
                    ${cpMeta}
                `;

                if (matchedPoke) {
                    card.addEventListener('click', () => {
                        openModal(matchedPoke.id);
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
            let label = eggT;

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
                card.className = `rotation-card-item ${cardTheme}`;
                
                let imgUrl = egg.image || '';
                if (imgUrl.startsWith('~pq/')) {
                    imgUrl = imgUrl.replace('~pq/', 'https://pokemn.quest/');
                }

                let cpMeta = '';
                if (egg.cp && egg.cp.max && egg.cp.max !== 'N/A') {
                    cpMeta = `<div class="rotation-cp-details"><div><i class="fa-solid fa-egg" style="font-size:0.65rem; opacity:0.7;"></i> <span>Max Hatch: <strong>${egg.cp.max}</strong> CP</span></div></div>`;
                }

                card.innerHTML = `
                    ${egg.shiny ? '<i class="fa-solid fa-sparkles shiny-icon" title="Shiny Available"></i>' : ''}
                    <img class="rotation-card-img" src="${imgUrl}" alt="${egg.name}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${egg.dex}.png'">
                    <span class="rotation-card-name">${egg.name}</span>
                    ${cpMeta}
                `;

                card.addEventListener('click', () => {
                    const found = pokemonDatabase.find(p => p.id === egg.dex);
                    if (found) openModal(found.id);
                });
                grid.appendChild(card);
            });
        });
    }

    // 3. Render Quests Grid
    const researchEncounters = [];
    liveResearch.forEach(task => {
        if (task.rewards) {
            task.rewards.forEach(reward => {
                if (reward.type === 'encounter') {
                    researchEncounters.push({
                        taskText: task.text,
                        pokeName: reward.name,
                        dex: reward.dex,
                        image: reward.image,
                        shiny: reward.shiny,
                        cp: reward.cp
                    });
                }
            });
        }
    });

    if (researchEncounters.length === 0) {
        researchGrid.innerHTML = '<p class="no-rotations" style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">No active research rewards found.</p>';
    } else {
        researchEncounters.forEach(encounter => {
            const card = document.createElement('div');
            card.className = 'rotation-card-item theme-blue';
            
            let imgUrl = encounter.image || '';
            if (imgUrl.startsWith('~pq/')) {
                imgUrl = imgUrl.replace('~pq/', 'https://pokemn.quest/');
            }

            let cpMeta = '';
            if (encounter.cp && encounter.cp.max) {
                cpMeta = `<div class="rotation-cp-details"><div><i class="fa-solid fa-scroll" style="font-size:0.65rem; opacity:0.7;"></i> <span>Max Encounter: <strong>${encounter.cp.max}</strong> CP</span></div></div>`;
            }
            
            card.innerHTML = `
                ${encounter.shiny ? '<i class="fa-solid fa-sparkles shiny-icon" title="Shiny Available"></i>' : ''}
                <img class="rotation-card-img" src="${imgUrl}" alt="${encounter.pokeName}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${encounter.dex}.png'">
                <span class="rotation-card-name">${encounter.pokeName}</span>
                ${cpMeta}
                <span class="quest-task-text">${encounter.taskText}</span>
            `;
            
            card.addEventListener('click', () => {
                const found = pokemonDatabase.find(p => p.id === encounter.dex);
                if (found) openModal(found.id);
            });
            
            researchGrid.appendChild(card);
        });
    }
}

// Run application
window.addEventListener('DOMContentLoaded', () => {
    loadCaughtState();
    setupEventListeners();
    loadPokedex();
});
