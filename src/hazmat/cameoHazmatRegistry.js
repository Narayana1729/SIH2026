/**
 * @module src/hazmat/cameoHazmatRegistry
 * @description Authoritative NOAA CAMEO / NIOSH Chemical Hazard & Exposure Limits Registry.
 *
 * Implements normalized chemical schemas, multi-index searching (name, synonym, CAS, UN),
 * NFPA 704 ratings, AEGL-1/2/3 exposure thresholds, IDLH, and ERG 2024 evacuation distances.
 */

import cameoChemicalsData from '../../data/industrial_infra/authoritative_cameo_chemicals.json' with { type: 'json' };
import { createDataProvenance } from '../core/provenance.js';

class CameoHazmatRegistry {
  constructor() {
    this.chemicals = cameoChemicalsData.chemicals || [];
    this._index = new Map();
    this._buildSearchIndexes();
  }

  _buildSearchIndexes() {
    for (const chem of this.chemicals) {
      // Primary name
      this._addToIndex(chem.name.toLowerCase(), chem);
      // Chemical ID
      this._addToIndex(chem.chemical_id.toLowerCase(), chem);
      // CAS
      if (chem.cas_number) {
        this._addToIndex(chem.cas_number.toLowerCase().trim(), chem);
        this._addToIndex(chem.cas_number.replace(/-/g, ''), chem);
      }
      // UN
      if (chem.un_number) {
        this._addToIndex(chem.un_number.toLowerCase().trim(), chem);
        this._addToIndex(chem.un_number.replace(/^un/i, ''), chem);
      }
      // Synonyms
      if (Array.isArray(chem.synonyms)) {
        for (const syn of chem.synonyms) {
          this._addToIndex(syn.toLowerCase(), chem);
        }
      }
    }
  }

  _addToIndex(key, chem) {
    if (!this._index.has(key)) {
      this._index.set(key, []);
    }
    const list = this._index.get(key);
    if (!list.includes(chem)) {
      list.push(chem);
    }
  }

  /**
   * Search registry by query string across name, synonym, CAS, or UN placard.
   * @param {string} query
   * @returns {Array<Object>} Matches sorted by relevance
   */
  search(query) {
    if (!query || typeof query !== 'string') return [];
    const q = query.toLowerCase().trim();
    const matches = new Set();

    // 1. Exact match check
    if (this._index.has(q)) {
      for (const item of this._index.get(q)) {
        matches.add(item);
      }
    }

    // 2. Substring search across all chemical fields
    for (const chem of this.chemicals) {
      if (chem.name.toLowerCase().includes(q)) {
        matches.add(chem);
        continue;
      }
      if (chem.cas_number && chem.cas_number.includes(q)) {
        matches.add(chem);
        continue;
      }
      if (chem.un_number && chem.un_number.toLowerCase().includes(q)) {
        matches.add(chem);
        continue;
      }
      if (Array.isArray(chem.synonyms)) {
        for (const s of chem.synonyms) {
          if (s.toLowerCase().includes(q)) {
            matches.add(chem);
            break;
          }
        }
      }
    }

    return Array.from(matches);
  }

  /**
   * Get chemical by UN number or CAS or ID.
   * @param {string} idOrUn
   * @returns {Object|null}
   */
  getChemical(idOrUn) {
    if (!idOrUn) return null;
    const clean = idOrUn.toLowerCase().trim();
    const list = this._index.get(clean);
    return list ? list[0] : null;
  }

  /**
   * Resolve chemicals associated with an industrial facility sector.
   * @param {string} sector Industry sector e.g. "Oil Refinery", "Fertilizer & Chemical Complex"
   * @returns {Array<Object>} Associated chemicals
   */
  getChemicalsForSector(sector) {
    if (!sector) return [];
    const cleanSector = sector.toLowerCase();
    return this.chemicals.filter(chem => {
      if (!chem.applicable_sectors) return false;
      return chem.applicable_sectors.some(s => s.toLowerCase().includes(cleanSector) || cleanSector.includes(s.toLowerCase()));
    });
  }

  /**
   * Get metadata and provenance for the registry.
   */
  getRegistryMetadata() {
    return {
      total_chemicals: this.chemicals.length,
      provenance: createDataProvenance({
        source: 'NOAA CAMEO Chemicals v3.0 & NIOSH Pocket Guide (CDC Pub 2005-149)',
        epistemic_tier: 'OBSERVED_TELEMETRY',
        attribution: 'Chemical Safety Hazard & Physical Response Attributes'
      }),
      sources: cameoChemicalsData.metadata.sources,
      last_updated: cameoChemicalsData.metadata.last_updated
    };
  }
}

export const cameoHazmatRegistry = new CameoHazmatRegistry();
