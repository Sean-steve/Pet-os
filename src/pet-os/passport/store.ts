/**
 * Pet OS Sprint 4 - Pet Passport Share & Export Store
 * Implements Volume III, Volume V, Volume XXX
 */

import { PassportShareToken, PassportExportRecord } from './types';
import { PetId, PassportShareId, PassportExportId } from '../kernel/ids';

export class PassportStore {
  private static shares = new Map<string, PassportShareToken>();
  private static exports = new Map<string, PassportExportRecord>();
  private static tokenHashIndex = new Map<string, string>(); // tokenHash -> shareId

  static reset(): void {
    this.shares.clear();
    this.exports.clear();
    this.tokenHashIndex.clear();
  }

  static saveShare(share: PassportShareToken): void {
    this.shares.set(share.shareId, { ...share });
    this.tokenHashIndex.set(share.tokenHash, share.shareId);
  }

  static findShareById(shareId: PassportShareId): PassportShareToken | undefined {
    const s = this.shares.get(shareId);
    return s ? { ...s } : undefined;
  }

  static findShareByTokenHash(tokenHash: string): PassportShareToken | undefined {
    const shareId = this.tokenHashIndex.get(tokenHash);
    if (!shareId) return undefined;
    return this.findShareById(shareId as PassportShareId);
  }

  static listSharesForPet(petId: PetId): PassportShareToken[] {
    const list: PassportShareToken[] = [];
    for (const s of this.shares.values()) {
      if (s.petId === petId) {
        list.push({ ...s });
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static saveExport(exportRecord: PassportExportRecord): void {
    this.exports.set(exportRecord.exportId, { ...exportRecord });
  }

  static findExportById(exportId: PassportExportId): PassportExportRecord | undefined {
    const ex = this.exports.get(exportId);
    return ex ? { ...ex } : undefined;
  }

  static listExportsForPet(petId: PetId): PassportExportRecord[] {
    const list: PassportExportRecord[] = [];
    for (const ex of this.exports.values()) {
      if (ex.petId === petId) {
        list.push({ ...ex });
      }
    }
    return list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }
}
