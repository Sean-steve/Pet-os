/**
 * Pet OS Sprint 5 - Canonical Veterinary Vaccine Catalog
 * Implements Volume VII (Veterinary Health & Medical Records) & Volume XXVIII
 * Pre-populated reference data for canine & feline vaccines
 */

import { VaccineCatalogItem } from './types';

export const CANONICAL_VACCINE_CATALOG: VaccineCatalogItem[] = [
  // --- Canine Core Vaccines ---
  {
    code: 'CANINE_RABIES',
    species: 'SPECIES_DOG',
    name: 'Rabies Virus Vaccine',
    category: 'CORE',
    targetDiseases: ['Rabies (Fatal Zoonotic Encephalomyelitis)'],
    standardValidityMonths: 12,
    description: 'Essential core vaccine legally required in many jurisdictions. Protects against fatal neurological rabies infection.',
    active: true
  },
  {
    code: 'CANINE_DHPP',
    species: 'SPECIES_DOG',
    name: 'DHPP / DA2PP Combo (Distemper, Adenovirus-2/Hepatitis, Parvovirus, Parainfluenza)',
    category: 'CORE',
    targetDiseases: [
      'Canine Distemper Virus',
      'Infectious Canine Hepatitis (Adenovirus-1)',
      'Respiratory Adenovirus-2',
      'Canine Parvovirus (CPV-2)',
      'Canine Parainfluenza Virus'
    ],
    standardValidityMonths: 12,
    description: 'Primary 5-in-1 or 4-in-1 modified-live canine core immunization.',
    active: true
  },
  {
    code: 'CANINE_PARVOVIRUS',
    species: 'SPECIES_DOG',
    name: 'Canine Parvovirus (CPV) Monovalent',
    category: 'CORE',
    targetDiseases: ['Canine Parvovirus (Severe hemorrhagic gastroenteritis)'],
    standardValidityMonths: 12,
    description: 'High-titer monovalent parvo booster for high-risk puppy environments.',
    active: true
  },

  // --- Canine Non-Core / Lifestyle ---
  {
    code: 'CANINE_BORDETELLA',
    species: 'SPECIES_DOG',
    name: 'Bordetella bronchiseptica (Kennel Cough)',
    category: 'NON_CORE',
    targetDiseases: ['Infectious Tracheobronchitis (Kennel Cough)'],
    standardValidityMonths: 12,
    description: 'Recommended for socialized pets, boarding facilities, dog parks, and grooming visits.',
    active: true
  },
  {
    code: 'CANINE_LEPTOSPIROSIS',
    species: 'SPECIES_DOG',
    name: 'Leptospira 4-Serogroup Vaccine',
    category: 'LIFESTYLE',
    targetDiseases: ['Leptospirosis (L. canicola, icterohaemorrhagiae, grippotyphosa, pomona)'],
    standardValidityMonths: 12,
    description: 'Protects against bacterial zoonotic renal and hepatic infection from standing water and wildlife.',
    active: true
  },
  {
    code: 'CANINE_LYME',
    species: 'SPECIES_DOG',
    name: 'Borrelia burgdorferi (Lyme Disease Bacterin)',
    category: 'NON_CORE',
    targetDiseases: ['Lyme Disease (Borreliosis transmitted by Ixodes ticks)'],
    standardValidityMonths: 12,
    description: 'Recommended in tick-endemic regions or outdoor working/hunting canines.',
    active: true
  },
  {
    code: 'CANINE_INFLUENZA_H3N2_H3N8',
    species: 'SPECIES_DOG',
    name: 'Canine Influenza Bivalent (CIV H3N2 / H3N8)',
    category: 'NON_CORE',
    targetDiseases: ['Canine Influenza Viral Pneumonia'],
    standardValidityMonths: 12,
    description: 'Protects against contagious canine flu in communal boarding or agility events.',
    active: true
  },

  // --- Feline Core Vaccines ---
  {
    code: 'FELINE_RABIES',
    species: 'SPECIES_CAT',
    name: 'Feline Rabies Vaccine',
    category: 'CORE',
    targetDiseases: ['Rabies (Fatal Zoonotic Encephalomyelitis)'],
    standardValidityMonths: 12,
    description: 'Essential core vaccine protecting cats and humans from fatal rabies transmission.',
    active: true
  },
  {
    code: 'FELINE_FVRCP',
    species: 'SPECIES_CAT',
    name: 'FVRCP Combo (Rhinotracheitis, Calicivirus, Panleukopenia)',
    category: 'CORE',
    targetDiseases: [
      'Feline Viral Rhinotracheitis (Herpesvirus-1)',
      'Feline Calicivirus (Upper respiratory & stomatitis)',
      'Feline Panleukopenia (Feline distemper / Parvovirus)'
    ],
    standardValidityMonths: 12,
    description: 'Essential 3-in-1 core immunization for all cats regardless of lifestyle.',
    active: true
  },

  // --- Feline Non-Core ---
  {
    code: 'FELINE_FELV',
    species: 'SPECIES_CAT',
    name: 'Feline Leukemia Virus (FeLV)',
    category: 'NON_CORE',
    targetDiseases: ['Feline Leukemia Retrovirosis (Lymphoma, immunosuppression)'],
    standardValidityMonths: 12,
    description: 'Strongly recommended for all outdoor cats, foster kittens, or multi-cat households.',
    active: true
  }
];

export const CANONICAL_VACCINES = CANONICAL_VACCINE_CATALOG;

export function getVaccineByCode(code: string): VaccineCatalogItem | undefined {
  return CANONICAL_VACCINE_CATALOG.find((v) => v.code.toUpperCase() === code.toUpperCase());
}

export function listVaccinesForSpecies(species: 'SPECIES_DOG' | 'SPECIES_CAT' | string): VaccineCatalogItem[] {
  return CANONICAL_VACCINE_CATALOG.filter(
    (v) => v.species === species || v.species === 'ALL'
  );
}
