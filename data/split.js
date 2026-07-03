const fs = require('fs');

// 1. Comprehensive Category Map (based on your master list)
const categoryMap = {
  // Architecture Core
  "floor": "arch", "wall": "arch", "wall_segment": "arch", "column": "arch", "pillar": "arch", "beam": "arch", "archway": "arch", "stone_arch": "arch", "spiral_stair": "arch", "staircase": "arch", "spiral_staircase": "arch", "wooden_stairs_ext": "arch", "stone_steps": "arch", "door_frame": "arch", "doorFrame": "arch", "window_frame": "arch", "window": "arch", "dungeon_door": "arch", "wooden_gate": "arch", "cobblestone_path": "arch", "dirt_road": "arch", "brick_road": "arch", "gravel_path": "arch", "road_crossroads": "arch", "road_curve": "arch", "garden_path_curved": "arch", "wooden_walkway": "arch",
  
  // Buildings & Structures
  "tower": "buildings", "castle_tower_round": "buildings", "cottage": "buildings", "mill_house": "buildings", "manor_house": "buildings", "tower_house": "buildings", "gatehouse": "buildings", "chapel": "buildings", "stable": "buildings", "granary": "buildings", "warehouse": "buildings", "forge": "buildings", "pavilion": "buildings", "tent": "buildings", "guard_tent": "buildings", "bridge": "buildings", "covered_bridge": "buildings", "suspension_bridge": "buildings", "rope_bridge": "buildings", "dock": "buildings", "aqueduct": "buildings", "town_square": "buildings", "moat": "buildings", "castle_wall": "buildings", "watchtower": "buildings", "drawbridge": "buildings", "drawbridge_gate": "buildings", "siege_wall_section": "buildings", "town_gate": "buildings",
  
  // Furniture
  "table_round": "furniture", "dining_table": "furniture", "diningTable": "furniture", "coffeeTable": "furniture", "desk": "furniture", "chair": "furniture", "dining_chair": "furniture", "armchair": "furniture", "sofa": "furniture", "bed": "furniture", "sideTable": "furniture", "nightstand": "furniture", "stool": "furniture", "bench": "furniture", "throne": "furniture", "cabinet": "furniture", "shelf_wall": "furniture", "bookcase": "furniture", "dresser": "furniture", "wardrobe": "furniture", "bookshelf": "furniture", "bookshelf_tall": "furniture", "map_table": "furniture",
  
  // Decor Interior
  "mirror": "decor_interior", "mirrorWall": "decor_interior", "clock": "decor_interior", "grandfather_clock": "decor_interior", "clockWall": "decor_interior", "curtain": "decor_interior", "globe": "decor_interior", "telescope": "decor_interior", "telescope_floor": "decor_interior", "hourglass": "decor_interior", "rug": "decor_interior", "rugRound": "decor_interior", "painting": "decor_interior", "vase": "decor_interior", "vaseTall": "decor_interior", "pillow": "decor_interior", "tapestry": "decor_interior", "banner": "decor_interior", "scroll": "decor_interior", "book": "decor_interior", "book_stack": "decor_interior", "bookwall": "decor_interior", "skull": "decor_interior", "orb": "decor_interior", "washbasin": "decor_interior", "ink_well": "decor_interior", "wine_rack": "decor_interior", "sculpture": "decor_interior", "statue": "decor_interior", "trophy": "decor_interior", "treasure_chest": "decor_interior",
  
  // Decor Exterior
  "hanging_sign": "decor_exterior", "sundial": "decor_exterior", "horse_trough": "decor_exterior", "flag_pole": "decor_exterior", "market_awning": "decor_exterior", "market_stall": "decor_exterior", "wagon_wheel": "decor_exterior", "log_pile": "decor_exterior", "hay_bale": "decor_exterior", "hay_wagon": "decor_exterior", "dung_pile": "decor_exterior", "campsite": "decor_exterior", "signpost": "decor_exterior", "pedestal": "decor_exterior", "ruins_column": "decor_exterior", "tombstone": "decor_exterior", "cross_grave": "decor_exterior", "stone_fountain": "decor_exterior", "stone_statue": "decor_exterior", "obelisk": "decor_exterior", "stone_circle": "decor_exterior",
  
  // Lighting
  "candelabra": "lighting", "chandelier": "lighting", "floor_lamp": "lighting", "lantern": "lighting", "torch": "lighting", "candle_set": "lighting", "sconce": "lighting", "fire_pit": "lighting", "street_lamp": "lighting", "candle": "lighting", "floorLamp": "lighting", "tableLamp": "lighting", "pendantLamp": "lighting", "wallSconce": "lighting", "torchWall": "lighting", "lamppost": "lighting", "lamp_post_double": "lighting", "campfire": "lighting", "chandelier_ornate": "lighting", "hanging_lantern": "lighting", "torch_stand": "lighting", "lamp": "lighting",
  
  // Nature
  "pine_tree": "nature", "bush": "nature", "flower_cluster": "nature", "mushroom_ring": "nature", "potted_plant": "nature", "willow_tree": "nature", "lily_pad_cluster": "nature", "vine_wall": "nature", "tree": "nature", "treeTall": "nature", "oak_tree": "nature", "dead_tree": "nature", "hedge": "nature", "flower_bed": "nature", "cherry_blossom": "nature", "mushroom_cluster": "nature", "tall_grass": "nature", "cactus": "nature", "plantPot": "nature", "plantFern": "nature", "flower": "nature", "pond": "nature", "rock": "nature", "fallen_log": "nature", "cliff_face": "nature", "hill": "nature", "river_section": "nature", "stepping_stones": "nature", "boulder_cluster": "nature", "plateau": "nature", "canyon": "nature", "cave_entrance": "nature", "island": "nature", "crater": "nature", "marsh": "nature", "snow_patch": "nature", "lava_pool": "nature", "tree_stump": "nature", "waterfall_cliff": "nature", "volcano": "nature", "ice_block": "nature", "crystal_cluster": "nature", "skyDome": "nature", "starDome": "nature", "hedge_maze_corner": "nature",
  
  // Props / Items
  "anvil": "props", "weapon_rack": "props", "shield": "props", "sword_display": "props", "treasure_pile": "props", "cauldron": "props", "cauldron_large": "props", "spinning_wheel": "props", "butter_churn": "props", "bellows": "props", "loom": "props", "water_wheel": "props", "windmill": "props", "wine_press": "props", "monitor": "props", "laptop": "props", "keyboard": "props", "speaker": "props", "guitar": "props", "micStand": "props", "wine_bottle": "props", "plate_set": "props", "goblet": "props", "tankard": "props", "mug": "props", "plate": "props", "bottle": "props", "bowlFruit": "props",
  
  // Military & Prison
  "crow_nest": "military", "trebuchet": "military", "siege_tower": "military", "catapult": "military", "battering_ram": "military", "archery_target": "military", "training_dummy": "military", "executioner_block": "military", "pillory": "military", "gibbet": "military", "gallows": "military", "stocks": "military", "iron_maiden": "military", "prison_cell": "military", "palisade": "military", "scaffold": "military", "viking_longship": "military", "ship_hull": "military", "rowboat": "military", "round_tower_ruin": "military",
  
  // Utility & Farm
  "cart": "utility", "rope_coil": "utility", "crate": "utility", "barrel": "utility", "ladder": "utility", "well_bucket": "utility", "broom": "utility", "picnic_basket": "utility", "bird_cage": "utility", "mortar_pestle": "utility", "barrel_stack": "utility", "crate_stack": "utility", "well_with_roof": "utility", "rain_barrel": "utility", "well_pulley": "utility", "well": "utility", "fountain": "utility", "crane_medieval": "utility", "wooden_crane": "utility", "fishing_net": "utility", "chicken_coop": "utility", "pig_pen": "utility", "dog_house": "utility", "bee_hive": "utility", "wooden_barrel": "utility", "cage": "utility", "fence": "utility", "graveyard_fence": "utility", "wooden_fence": "utility", "picket_fence": "utility", "railing": "utility"
};

const code = fs.readFileSync('objects.js', 'utf8');

// 2. Find starts of ALL objects using Regex
// This matches: OBJECTS.register("name" ... AND make.name = ...
// Matches: register("name"
const blockRegex = /(?:^|\n)[ \t]*register\s*\(\s*["'`]([\w_]+)["'`]/g;

const blocks = [];
let match;
while ((match = blockRegex.exec(code)) !== null) {
  blocks.push({
    index: match.index,
    name: match[1]
  });
}

if (blocks.length === 0) {
  console.log("❌ No objects found! Ensure your file contains 'make.name =' or 'OBJECTS.register('");
  process.exit(1);
}

console.log(`🔍 Found ${blocks.length} total objects to process.`);

// 3. Extract contents safely by slicing from one object's start to the next
const extracted = [];
for (let i = 0; i < blocks.length; i++) {
  const current = blocks[i];
  // Next index is either the start of the next object, or the end of the file
  const nextIndex = (i < blocks.length - 1) ? blocks[i + 1].index : code.length;
  
  let content = code.substring(current.index, nextIndex).trim();
  
  // Clean up any trailing exports (e.g., window.ROOM_PARTS) if they got caught in the last block
  const exportMatch = content.indexOf('window.ROOM_PARTS');
  if (exportMatch !== -1) {
    content = content.substring(0, exportMatch).trim();
  }

  extracted.push({ name: current.name, content });
}

// 4. Save everything BEFORE the first object to objects_core.js (Materials, helpers, etc.)
let coreCode = code.substring(0, blocks[0].index).trimEnd();
fs.writeFileSync('objects_core.js', coreCode + '\n\n// NOTE: Objects have been split into category files.\n');
console.log(`✅ Wrote objects_core.js (Retained materials and helpers)`);

// 5. Group into categories
const grouped = {};
extracted.forEach(reg => {
  const cat = categoryMap[reg.name] || "uncategorized";
  if (!grouped[cat]) grouped[cat] = [];
  grouped[cat].push(reg.content);
});

// 6. Write categorized files
for (const [cat, items] of Object.entries(grouped)) {
  const filename = `objects_${cat}.js`;
  
  // We include `make` in the destruction in case you are still using the `make.floor =` syntax.
  const header = `// category: "${cat}"\n(function () {\n  const { register, M, _box, _cyl, rand, pick, _spineTexture, make = {} } = window.OBJECTS || window.ROOM_PARTS || {};\n\n  `;
  const footer = `\n\n})();\n`;
  
  fs.writeFileSync(filename, header + items.join('\n\n  ') + footer);
  console.log(`✅ Wrote ${filename} (${items.length} objects)`);
}