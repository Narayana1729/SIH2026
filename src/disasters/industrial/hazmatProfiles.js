/**
 * @module src/disasters/industrial/hazmatProfiles
 * @description Authoritative CAMEO Chemicals & NIOSH Pocket Guide HazMat intelligence profiles.
 * Grounded in Emergency Response Guidebook (ERG 2024), NIOSH IDLH limits, and chemical firefighting protocols.
 */

export const HAZMAT_PROFILES = Object.freeze({
  'Oil Refinery': {
    sector: 'Petroleum Refining',
    aliases: ['petroleum refining', 'oil refinery', 'refinery', 'petroleum', 'crude'],
    primary_chemicals: ['Crude Oil', 'Benzene', 'LPG (Propane/Butane)', 'Naphtha', 'Hydrogen Sulfide (H2S)'],
    cameo_hazmat_class: 'Class 3 - Flammable Liquid / Class 2.1 Flammable Gas',
    un_na_numbers: ['UN1267', 'UN1114', 'UN1075', 'UN1255'],
    primary_disaster_risk: 'BLEVE (Boiling Liquid Expanding Vapor Explosion) & Toxic Aromatic Hydrocarbon Inhalation',
    initial_isolation_distance_meters: 800,
    downwind_evacuation_day_meters: 1600,
    downwind_evacuation_night_meters: 2400,
    toxic_combustion_byproducts: ['Carbon Monoxide (CO)', 'Sulfur Dioxide (SO2)', 'Benzene Vapor', 'Polycyclic Aromatic Hydrocarbons'],
    firefighting_protocol: 'Aqueous Film-Forming Foam (AFFF), Alcohol-Resistant Foam, High-Volume Water Deluge to cool adjacent tanks. Do NOT extinguish flare unless leak can be stopped.',
    idlh_ppm: {
      'Benzene': 500,
      'H2S': 100,
      'SO2': 100,
    },
    default_dispersion_chemical: 'Benzene Vapor (C₆H₆)',
    chemical_code: 'BENZENE',
    dispersion_thresholds: {
      advisory: 10.0,   // ERPG-1 / AEGL-1
      evacuation: 50.0, // ERPG-2 / AEGL-2
      critical: 500.0,  // NIOSH IDLH
    },
    unit: 'ppm',
  },
  'Petrochemical & Polymer Complex': {
    sector: 'Petrochemicals',
    aliases: ['petrochemical', 'polymer', 'olefin', 'aromatics', 'cracking', 'plastics'],
    primary_chemicals: ['Styrene Monomer', 'Ethylene Oxide', 'Propylene', 'Vinyl Chloride', 'Butadiene'],
    cameo_hazmat_class: 'Class 2.1 / Class 3 - Flammable Monomers & Polymerization Hazards',
    un_na_numbers: ['UN2055', 'UN1040', 'UN1077', 'UN1086'],
    primary_disaster_risk: 'Uncontrolled Runaway Polymerization, Severe Pulmonary Edema, Vapor Cloud Explosion (VCE)',
    initial_isolation_distance_meters: 1000,
    downwind_evacuation_day_meters: 2500,
    downwind_evacuation_night_meters: 3500,
    toxic_combustion_byproducts: ['Phosgene (COCl2)', 'Hydrogen Chloride (HCl)', 'Styrene Oligomers', 'Carbon Monoxide'],
    firefighting_protocol: 'Alcohol-Resistant Foam, Water Fog for vapor knockdown (do NOT apply direct high-pressure stream into molten polymer).',
    idlh_ppm: {
      'Styrene': 700,
      'Ethylene Oxide': 800,
      'Vinyl Chloride': 100,
    },
    default_dispersion_chemical: 'Styrene & Vinyl Chloride Monomers',
    chemical_code: 'STYRENE',
    dispersion_thresholds: {
      advisory: 20.0,
      evacuation: 100.0,
      critical: 700.0,
    },
    unit: 'ppm',
  },
  'Fertilizer & Chemical Complex': {
    sector: 'Agrochemicals & Nitrogenous Fertilizers',
    aliases: ['fertilizer', 'agrochemicals', 'urea', 'ammonia', 'ammonium nitrate', 'phosphoric'],
    primary_chemicals: ['Anhydrous Ammonia (NH3)', 'Ammonium Nitrate', 'Phosphoric Acid', 'Sulfuric Acid'],
    cameo_hazmat_class: 'Class 2.3 - Toxic / Inhalation Hazard Gas & Class 5.1 Oxidizer',
    un_na_numbers: ['UN1005', 'UN1942', 'UN1805', 'UN1830'],
    primary_disaster_risk: 'Massive Detonation of Nitrate Stockpiles & Dense Alkaline Toxic Ammonia Vapor Cloud',
    initial_isolation_distance_meters: 1500,
    downwind_evacuation_day_meters: 3200,
    downwind_evacuation_night_meters: 5000,
    toxic_combustion_byproducts: ['Ammonia Gas (NH3)', 'Nitrogen Oxides (NOx)', 'Nitric Acid Vapors'],
    firefighting_protocol: 'Massive flooding with water from unmanned deluge monitors. Do NOT attempt to fight Ammonium Nitrate fires in enclosed areas.',
    idlh_ppm: {
      'Ammonia': 300,
      'Nitrogen Dioxide': 20,
    },
    default_dispersion_chemical: 'Anhydrous Ammonia (NH₃)',
    chemical_code: 'AMMONIA',
    dispersion_thresholds: {
      advisory: 25.0,  // ERPG-1 (25 ppm)
      evacuation: 150.0, // ERPG-2 (150 ppm)
      critical: 300.0, // NIOSH IDLH (300 ppm)
    },
    unit: 'ppm',
  },
  'Chlor-Alkali & Basic Chemicals': {
    sector: 'Inorganic Chemicals',
    aliases: ['chlor-alkali', 'chlorine', 'caustic soda', 'basic chemicals', 'hydrochloric'],
    primary_chemicals: ['Liquid Chlorine (Cl2)', 'Sodium Hydroxide (Caustic Soda)', 'Hydrogen Gas (H2)', 'Hydrochloric Acid (HCl)'],
    cameo_hazmat_class: 'Class 2.3 - Poison Gas (Corrosive / Oxidizer)',
    un_na_numbers: ['UN1017', 'UN1824', 'UN1049', 'UN1789'],
    primary_disaster_risk: 'Heavy Choking Green-Yellow Toxic Cloud Hugging Ground & Rapid Secondary Hydrogen Explosions',
    initial_isolation_distance_meters: 1200,
    downwind_evacuation_day_meters: 3000,
    downwind_evacuation_night_meters: 4500,
    toxic_combustion_byproducts: ['Chlorine Gas (Cl2)', 'Hydrogen Chloride (HCl) Fumes', 'Chlorinated Organics'],
    firefighting_protocol: 'Water spray curtain downwind to absorb/knock down toxic gas (CRITICAL: NEVER spray water directly onto liquid chlorine leak source).',
    idlh_ppm: {
      'Chlorine': 10,
      'HCl': 50,
    },
    default_dispersion_chemical: 'Chlorine Gas (Cl₂)',
    chemical_code: 'CHLORINE',
    dispersion_thresholds: {
      advisory: 0.5, // ERPG-1 (0.5 ppm)
      evacuation: 3.0, // ERPG-2 (3.0 ppm)
      critical: 10.0, // NIOSH IDLH (10.0 ppm)
    },
    unit: 'ppm',
  },
  'Thermal Power Plant': {
    sector: 'Thermal Power Generation',
    aliases: ['power plant', 'thermal power', 'coal/gas', 'power station', 'cpp', 'energy utility'],
    primary_chemicals: ['Pulverized Sub-bituminous Coal', 'Heavy Fuel Oil (HFO)', 'Transformer PCB Oil', 'Hydrazine'],
    cameo_hazmat_class: 'Class 4.1 - Flammable Solid / Spontaneous Combustion & Thermal Exhaust',
    un_na_numbers: ['UN1361', 'UN1993', 'UN2315', 'UN2029'],
    primary_disaster_risk: 'Coal Bunker Silo Dust Explosion & Dense Sulfurous Acid Particulate Smoke Dispersion',
    initial_isolation_distance_meters: 400,
    downwind_evacuation_day_meters: 1000,
    downwind_evacuation_night_meters: 1500,
    toxic_combustion_byproducts: ['Sulfur Dioxide (SO2)', 'Carbon Monoxide (CO)', 'Fly Ash PM2.5 / PM10', 'Nitric Oxide'],
    firefighting_protocol: 'Inert gas smothering (Nitrogen/CO2 injection in silos), high-volume deluge water spray on conveyor galleries.',
    idlh_ppm: {
      'SO2': 100,
      'CO': 1200,
    },
    default_dispersion_chemical: 'Sulfur Dioxide (SO₂)',
    chemical_code: 'SO2',
    dispersion_thresholds: {
      advisory: 0.3,
      evacuation: 3.0,
      critical: 100.0,
    },
    unit: 'ppm',
  },
  'Iron, Steel & Smelting Works': {
    sector: 'Metallurgy & Heavy Industry',
    aliases: ['steel', 'smelter', 'metallurgy', 'iron', 'blast furnace', 'aluminium smelter', 'foundry'],
    primary_chemicals: ['Blast Furnace Gas (BFG)', 'Coke Oven Gas', 'Liquid Molten Iron/Slag', 'Carbon Monoxide'],
    cameo_hazmat_class: 'Class 2.3 / Class 2.1 - Toxic Flammable Gas Asphyxiant & Molten Slag Hazards',
    un_na_numbers: ['UN1971', 'UN1016'],
    primary_disaster_risk: 'Molten Metal Steam Explosion & Acute Asphyxiation from High CO Flue / Coke Oven Leaks',
    initial_isolation_distance_meters: 500,
    downwind_evacuation_day_meters: 1200,
    downwind_evacuation_night_meters: 1800,
    toxic_combustion_byproducts: ['Carbon Monoxide (CO)', 'Hydrogen Cyanide (HCN in coke oven)', 'Sulfur Compounds'],
    firefighting_protocol: 'Dry Chemical Powder, Dry Sand for molten metal (CRITICAL WARNING: NEVER APPLY WATER TO MOLTEN LIQUID METAL).',
    idlh_ppm: {
      'CO': 1200,
      'HCN': 50,
    },
    default_dispersion_chemical: 'Carbon Monoxide (CO)',
    chemical_code: 'CO',
    dispersion_thresholds: {
      advisory: 35.0,  // OSHA PEL
      evacuation: 200.0, // AEGL-2
      critical: 1200.0, // NIOSH IDLH
    },
    unit: 'ppm',
  },
  'LNG & Cryogenic Gas Terminal': {
    sector: 'Cryogenic Gas Logistics',
    aliases: ['lng', 'cryogenic', 'gas terminal', 'methane', 'liquefied natural gas'],
    primary_chemicals: ['Liquefied Natural Gas (Methane CH4)', 'Liquefied Ethane', 'Refrigerant Gases'],
    cameo_hazmat_class: 'Class 2.1 - Flammable Cryogenic Liquid',
    un_na_numbers: ['UN1972', 'UN1038'],
    primary_disaster_risk: 'Rapid Phase Transition (RPT) Explosion, Cryogenic Frostbite, Massive Thermal Flashover',
    initial_isolation_distance_meters: 1600,
    downwind_evacuation_day_meters: 3200,
    downwind_evacuation_night_meters: 4800,
    toxic_combustion_byproducts: ['Carbon Dioxide (CO2)', 'Carbon Monoxide (CO)', 'Unburnt Methane Cloud'],
    firefighting_protocol: 'High-Expansion Foam for vapor blanket suppression, Dry Chemical for active flame extinguishment, Water curtain for exposure protection.',
    idlh_ppm: {
      'Methane': 50000,
    },
    default_dispersion_chemical: 'Methane Vapor Cloud (CH₄)',
    chemical_code: 'METHANE',
    dispersion_thresholds: {
      advisory: 5000.0,  // 10% LEL
      evacuation: 25000.0, // 50% LEL
      critical: 50000.0,  // 100% LEL (Lower Explosive Limit)
    },
    unit: 'ppm',
  },
  'Open Cast & Underground Coal Mining': {
    sector: 'Mining & Extraction',
    aliases: ['mining', 'coal mining', 'coal seam', 'mine', 'lignite', 'extraction'],
    primary_chemicals: ['Methane (Firedamp)', 'Coal Seam Deposits', 'Explosives (ANFO)'],
    cameo_hazmat_class: 'Class 4.2 - Spontaneously Combustible / Class 1.1D Explosive',
    un_na_numbers: ['UN1361', 'UN0082'],
    primary_disaster_risk: 'Subsurface Coal Seam Smoldering, Methane Underground Detonation, Land Subsidence',
    initial_isolation_distance_meters: 600,
    downwind_evacuation_day_meters: 1200,
    downwind_evacuation_night_meters: 2000,
    toxic_combustion_byproducts: ['Carbon Monoxide (CO)', 'Methane', 'Coal Tar Aerosols', 'Sulfur Fumes'],
    firefighting_protocol: 'Nitrogen foam injection, High-pressure hydraulic sand stowing, Surface clay/soil capping to starve oxygen.',
    idlh_ppm: {
      'CO': 1200,
    },
    default_dispersion_chemical: 'Carbon Monoxide / Coal Seam Gas',
    chemical_code: 'CO',
    dispersion_thresholds: {
      advisory: 35.0,
      evacuation: 200.0,
      critical: 1200.0,
    },
    unit: 'ppm',
  },
  'Specialty Chemicals & Manufacturing': {
    sector: 'Specialty Chemicals',
    aliases: ['chemical industry', 'chemical plant', 'specialty chemicals', 'industrial'],
    primary_chemicals: ['Chlorine', 'Sulfuric Acid', 'Benzene', 'Toluene', 'Ammonia'],
    cameo_hazmat_class: 'Class 2.3 / Class 8 - Toxic Gas & Corrosive',
    un_na_numbers: ['UN1017', 'UN1830', 'UN1114', 'UN1294'],
    primary_disaster_risk: 'Toxic Vapor Dispersion, Chemical Exothermic Runaway, Secondary Containment Failure',
    initial_isolation_distance_meters: 1000,
    downwind_evacuation_day_meters: 2000,
    downwind_evacuation_night_meters: 3000,
    toxic_combustion_byproducts: ['Acidic Gases', 'Chlorinated Vapors', 'Carbon Monoxide'],
    firefighting_protocol: 'Alcohol-Resistant AFFF Foam, Water Fog for vapor mitigation, Full Level-A HazMat Encasement.',
    idlh_ppm: {
      'Chlorine': 10,
      'Benzene': 500,
    },
    default_dispersion_chemical: 'Toxic Chemical Vapor',
    chemical_code: 'TOXIC_VAPOR',
    dispersion_thresholds: {
      advisory: 2.0,
      evacuation: 10.0,
      critical: 50.0,
    },
    unit: 'ppm',
  },
});

/**
 * Robust sector-to-HazMat profile resolver based on name, category, or sector keywords.
 * @param {string|Object} sectorOrFacility 
 * @returns {Object} HazMat profile
 */
export function resolveHazmatProfile(sectorOrFacility) {
  if (!sectorOrFacility) {
    return HAZMAT_PROFILES['Oil Refinery'];
  }

  const rawStr = typeof sectorOrFacility === 'string'
    ? sectorOrFacility
    : `${sectorOrFacility.sector || ''} ${sectorOrFacility.category || ''} ${sectorOrFacility.name || ''} ${sectorOrFacility.type || ''}`;
  
  const text = rawStr.toLowerCase();

  // Direct profile key match
  for (const [key, profile] of Object.entries(HAZMAT_PROFILES)) {
    if (text.includes(key.toLowerCase())) {
      return profile;
    }
  }

  // Check aliases
  for (const [key, profile] of Object.entries(HAZMAT_PROFILES)) {
    if (profile.aliases && profile.aliases.some((alias) => text.includes(alias))) {
      return profile;
    }
  }

  // Keyword heuristic matching
  if (text.includes('refin') || text.includes('oil') || text.includes('crude') || text.includes('petrol')) {
    return HAZMAT_PROFILES['Oil Refinery'];
  }
  if (text.includes('petrochem') || text.includes('polymer') || text.includes('plastic') || text.includes('olefin')) {
    return HAZMAT_PROFILES['Petrochemical & Polymer Complex'];
  }
  if (text.includes('fertiliz') || text.includes('ammoni') || text.includes('urea') || text.includes('nitrate')) {
    return HAZMAT_PROFILES['Fertilizer & Chemical Complex'];
  }
  if (text.includes('chlor') || text.includes('caustic') || text.includes('alkali')) {
    return HAZMAT_PROFILES['Chlor-Alkali & Basic Chemicals'];
  }
  if (text.includes('power') || text.includes('coal') || text.includes('thermal') || text.includes('cpp')) {
    return HAZMAT_PROFILES['Thermal Power Plant'];
  }
  if (text.includes('steel') || text.includes('iron') || text.includes('smelt') || text.includes('blast') || text.includes('alumin')) {
    return HAZMAT_PROFILES['Iron, Steel & Smelting Works'];
  }
  if (text.includes('lng') || text.includes('gas terminal') || text.includes('cryo')) {
    return HAZMAT_PROFILES['LNG & Cryogenic Gas Terminal'];
  }
  if (text.includes('mine') || text.includes('mining') || text.includes('seam')) {
    return HAZMAT_PROFILES['Open Cast & Underground Coal Mining'];
  }
  if (text.includes('chem')) {
    return HAZMAT_PROFILES['Specialty Chemicals & Manufacturing'];
  }

  return HAZMAT_PROFILES['Oil Refinery'];
}
