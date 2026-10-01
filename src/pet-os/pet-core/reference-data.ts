/**
 * Pet OS Sprint 3 - Species & Breed Managed Reference Data
 * Implements Volume V (Pet Identity), Volume XXXVIII (Multi-Species), and Volume XXX (Database Schema).
 * Reference data is deterministic, version-controlled, and environment-consistent.
 */

import { Species, Breed, SizeClassification } from './types';

export const SPECIES_CATALOG: Species[] = [
  {
    code: 'SPECIES_DOG',
    commonName: 'Dog',
    scientificName: 'Canis lupus familiaris',
    description: 'Canine companion animals. Primary launch focus for Pet OS Dog-First V1.',
    active: true,
    supportedSizeClassifications: ['TOY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT']
  },
  {
    code: 'SPECIES_CAT',
    commonName: 'Cat',
    scientificName: 'Felis catus',
    description: 'Feline companion animals. Multi-species capability supported in core domain.',
    active: true,
    supportedSizeClassifications: ['SMALL', 'MEDIUM']
  },
  {
    code: 'SPECIES_RABBIT',
    commonName: 'Rabbit',
    scientificName: 'Oryctolagus cuniculus',
    description: 'Lagomorph companion animals.',
    active: true,
    supportedSizeClassifications: ['SMALL', 'MEDIUM']
  },
  {
    code: 'SPECIES_BIRD',
    commonName: 'Bird',
    scientificName: 'Aves',
    description: 'Avian companion animals.',
    active: true,
    supportedSizeClassifications: ['SMALL', 'MEDIUM', 'LARGE']
  }
];

export const BREED_CATALOG: Breed[] = [
  // --- Dog Breeds (Kenya-First & Global Popular) ---
  {
    code: 'BREED_DOG_AFRICANIS',
    speciesCode: 'SPECIES_DOG',
    name: 'East African Village Dog / Africanis',
    sizeCategory: 'MEDIUM',
    coatType: 'Short, smooth',
    origin: 'East Africa / Kenya',
    aliases: ['Africanis', 'Kenyan Village Dog', 'East African Landrace'],
    active: true
  },
  {
    code: 'BREED_DOG_KENYAN_SHEPHERD',
    speciesCode: 'SPECIES_DOG',
    name: 'Kenyan Shepherd',
    sizeCategory: 'LARGE',
    coatType: 'Dense, medium',
    origin: 'Kenya',
    aliases: ['Rift Valley Shepherd'],
    active: true
  },
  {
    code: 'BREED_DOG_BOERBOEL',
    speciesCode: 'SPECIES_DOG',
    name: 'Boerboel (South African Mastiff)',
    sizeCategory: 'GIANT',
    coatType: 'Short, dense',
    origin: 'Southern/Eastern Africa',
    aliases: ['African Mastiff'],
    active: true
  },
  {
    code: 'BREED_DOG_RHODESIAN_RIDGEBACK',
    speciesCode: 'SPECIES_DOG',
    name: 'Rhodesian Ridgeback',
    sizeCategory: 'LARGE',
    coatType: 'Short, dense with dorsal ridge',
    origin: 'Southern Africa',
    aliases: ['African Lion Hound'],
    active: true
  },
  {
    code: 'BREED_DOG_GERMAN_SHEPHERD',
    speciesCode: 'SPECIES_DOG',
    name: 'German Shepherd',
    sizeCategory: 'LARGE',
    coatType: 'Double coat, medium',
    origin: 'Germany',
    aliases: ['GSD', 'Alsatian'],
    active: true
  },
  {
    code: 'BREED_DOG_LABRADOR',
    speciesCode: 'SPECIES_DOG',
    name: 'Labrador Retriever',
    sizeCategory: 'LARGE',
    coatType: 'Short, water-resistant double coat',
    origin: 'United Kingdom / Canada',
    aliases: ['Lab', 'Labrador'],
    active: true
  },
  {
    code: 'BREED_DOG_GOLDEN_RETRIEVER',
    speciesCode: 'SPECIES_DOG',
    name: 'Golden Retriever',
    sizeCategory: 'LARGE',
    coatType: 'Dense, water-repellent wavy coat',
    origin: 'Scotland',
    aliases: ['Golden'],
    active: true
  },
  {
    code: 'BREED_DOG_FRENCH_BULLDOG',
    speciesCode: 'SPECIES_DOG',
    name: 'French Bulldog',
    sizeCategory: 'SMALL',
    coatType: 'Short, smooth',
    origin: 'France',
    aliases: ['Frenchie'],
    active: true
  },
  {
    code: 'BREED_DOG_ROTTWEILER',
    speciesCode: 'SPECIES_DOG',
    name: 'Rottweiler',
    sizeCategory: 'LARGE',
    coatType: 'Short, coarse double coat',
    origin: 'Germany',
    aliases: ['Rottie'],
    active: true
  },
  {
    code: 'BREED_DOG_BEAGLE',
    speciesCode: 'SPECIES_DOG',
    name: 'Beagle',
    sizeCategory: 'SMALL',
    coatType: 'Short, dense hound coat',
    origin: 'United Kingdom',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_DOG_SIBERIAN_HUSKY',
    speciesCode: 'SPECIES_DOG',
    name: 'Siberian Husky',
    sizeCategory: 'MEDIUM',
    coatType: 'Thick double coat',
    origin: 'Siberia',
    aliases: ['Husky'],
    active: true
  },
  {
    code: 'BREED_DOG_BOXER',
    speciesCode: 'SPECIES_DOG',
    name: 'Boxer',
    sizeCategory: 'LARGE',
    coatType: 'Short, tight',
    origin: 'Germany',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_DOG_DACHSHUND',
    speciesCode: 'SPECIES_DOG',
    name: 'Dachshund',
    sizeCategory: 'SMALL',
    coatType: 'Smooth, wirehaired, or longhaired',
    origin: 'Germany',
    aliases: ['Wiener Dog', 'Doxie'],
    active: true
  },
  {
    code: 'BREED_DOG_GREAT_DANE',
    speciesCode: 'SPECIES_DOG',
    name: 'Great Dane',
    sizeCategory: 'GIANT',
    coatType: 'Short, smooth',
    origin: 'Germany',
    aliases: ['German Mastiff'],
    active: true
  },
  {
    code: 'BREED_DOG_CHIHUAHUA',
    speciesCode: 'SPECIES_DOG',
    name: 'Chihuahua',
    sizeCategory: 'TOY',
    coatType: 'Smooth or long',
    origin: 'Mexico',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_DOG_POODLE',
    speciesCode: 'SPECIES_DOG',
    name: 'Poodle (Standard / Miniature / Toy)',
    sizeCategory: 'MEDIUM',
    coatType: 'Curly, dense, hypoallergenic',
    origin: 'France / Germany',
    aliases: ['Caniche'],
    active: true
  },
  {
    code: 'BREED_DOG_MIXED',
    speciesCode: 'SPECIES_DOG',
    name: 'Mixed Breed (Canine)',
    sizeCategory: 'MEDIUM',
    aliases: ['Mutt', 'Crossbreed'],
    active: true,
    isSpecial: true
  },
  {
    code: 'BREED_DOG_UNKNOWN',
    speciesCode: 'SPECIES_DOG',
    name: 'Unknown Canine Breed',
    sizeCategory: 'UNKNOWN',
    aliases: ['Unknown'],
    active: true,
    isSpecial: true
  },

  // --- Cat Breeds ---
  {
    code: 'BREED_CAT_DOMESTIC_SHORTHAIR',
    speciesCode: 'SPECIES_CAT',
    name: 'Domestic Shorthair',
    sizeCategory: 'MEDIUM',
    coatType: 'Short, resilient',
    origin: 'Global',
    aliases: ['House Cat', 'Moggie'],
    active: true
  },
  {
    code: 'BREED_CAT_SIAMESE',
    speciesCode: 'SPECIES_CAT',
    name: 'Siamese',
    sizeCategory: 'SMALL',
    coatType: 'Short, pointed coloring',
    origin: 'Thailand',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_CAT_PERSIAN',
    speciesCode: 'SPECIES_CAT',
    name: 'Persian',
    sizeCategory: 'MEDIUM',
    coatType: 'Long, silky',
    origin: 'Iran',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_CAT_MAINE_COON',
    speciesCode: 'SPECIES_CAT',
    name: 'Maine Coon',
    sizeCategory: 'MEDIUM',
    coatType: 'Heavy, water-resistant long coat',
    origin: 'United States',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_CAT_BENGAL',
    speciesCode: 'SPECIES_CAT',
    name: 'Bengal',
    sizeCategory: 'MEDIUM',
    coatType: 'Short, rosetted or marbled',
    origin: 'United States',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_CAT_BRITISH_SHORTHAIR',
    speciesCode: 'SPECIES_CAT',
    name: 'British Shorthair',
    sizeCategory: 'MEDIUM',
    coatType: 'Short, plush, dense',
    origin: 'United Kingdom',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_CAT_MIXED',
    speciesCode: 'SPECIES_CAT',
    name: 'Mixed Breed (Feline)',
    sizeCategory: 'MEDIUM',
    aliases: ['Mixed Cat'],
    active: true,
    isSpecial: true
  },
  {
    code: 'BREED_CAT_UNKNOWN',
    speciesCode: 'SPECIES_CAT',
    name: 'Unknown Feline Breed',
    sizeCategory: 'UNKNOWN',
    aliases: ['Unknown'],
    active: true,
    isSpecial: true
  },

  // --- Rabbit Breeds ---
  {
    code: 'BREED_RABBIT_HOLLAND_LOP',
    speciesCode: 'SPECIES_RABBIT',
    name: 'Holland Lop',
    sizeCategory: 'SMALL',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_RABBIT_NETHERLAND_DWARF',
    speciesCode: 'SPECIES_RABBIT',
    name: 'Netherland Dwarf',
    sizeCategory: 'SMALL',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_RABBIT_UNKNOWN',
    speciesCode: 'SPECIES_RABBIT',
    name: 'Unknown / Mixed Rabbit',
    sizeCategory: 'UNKNOWN',
    aliases: [],
    active: true,
    isSpecial: true
  },

  // --- Bird Breeds ---
  {
    code: 'BREED_BIRD_AFRICAN_GREY',
    speciesCode: 'SPECIES_BIRD',
    name: 'African Grey Parrot',
    sizeCategory: 'MEDIUM',
    origin: 'Central/East Africa',
    aliases: ['Grey Parrot'],
    active: true
  },
  {
    code: 'BREED_BIRD_COCKATIEL',
    speciesCode: 'SPECIES_BIRD',
    name: 'Cockatiel',
    sizeCategory: 'SMALL',
    aliases: [],
    active: true
  },
  {
    code: 'BREED_BIRD_BUDGERIGAR',
    speciesCode: 'SPECIES_BIRD',
    name: 'Budgerigar (Budgie)',
    sizeCategory: 'SMALL',
    aliases: ['Parakeet', 'Budgie'],
    active: true
  },
  {
    code: 'BREED_BIRD_UNKNOWN',
    speciesCode: 'SPECIES_BIRD',
    name: 'Unknown Bird Species/Breed',
    sizeCategory: 'UNKNOWN',
    aliases: [],
    active: true,
    isSpecial: true
  }
];

export class ReferenceDataService {
  static getAllSpecies(): Species[] {
    return SPECIES_CATALOG.filter(s => s.active);
  }

  static getSpeciesByCode(code: string): Species | undefined {
    return SPECIES_CATALOG.find(s => s.code === code && s.active);
  }

  static getBreedsForSpecies(speciesCode: string): Breed[] {
    return BREED_CATALOG.filter(b => b.speciesCode === speciesCode && b.active);
  }

  static getBreedByCode(code: string): Breed | undefined {
    return BREED_CATALOG.find(b => b.code === code && b.active);
  }

  /**
   * Validates that a breed code corresponds strictly to the provided species code.
   * Cat breeds cannot be assigned to dogs or vice-versa.
   */
  static isBreedValidForSpecies(breedCode: string, speciesCode: string): boolean {
    const breed = this.getBreedByCode(breedCode);
    if (!breed) return false;
    return breed.speciesCode === speciesCode;
  }

  /**
   * Normalizes microchip numbers into canonical alphanumeric string.
   * Standard ISO 11784/11785 chips are 15 numeric digits (e.g. 985141001234567).
   */
  static normalizeMicrochipNumber(raw: string): string {
    return (raw || '').trim().replace(/[\s\-_.]/g, '').toUpperCase();
  }

  /**
   * Validates microchip format (typically 9 to 15 alphanumeric characters).
   */
  static validateMicrochipNumber(normalized: string): boolean {
    // 9 to 15 alphanumeric characters, standard ISO 15 digits or legacy 9/10/12 characters
    const microchipRegex = /^[A-Z0-9]{9,15}$/;
    return microchipRegex.test(normalized);
  }
}
