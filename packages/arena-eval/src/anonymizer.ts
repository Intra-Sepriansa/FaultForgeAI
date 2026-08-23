import crypto from 'crypto';

export interface BlindedCandidate<T> {
  blindedId: string;
  alias: string;
  data: T;
}

export interface BlindedSession<T> {
  sessionId: string;
  candidates: BlindedCandidate<T>[];
  unblindMap: Record<string, string>; // blindedId -> originalId
}

export class DoubleBlindAnonymizer {
  /**
   * Shuffles and assigns blinded aliases ('Candidate-ALPHA', 'Candidate-BETA', etc.)
   * to candidate items while preserving an internal unblind map.
   */
  static anonymize<T extends { id?: string; candidateId?: string }>(items: T[]): BlindedSession<T> {
    const sessionId = crypto.randomUUID();
    const greekLetters = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'];

    // Cryptographic shuffle
    const shuffled = [...items].sort(() => (crypto.randomBytes(1)[0] ?? 0) - 128);

    const unblindMap: Record<string, string> = {};
    const candidates: BlindedCandidate<T>[] = [];

    shuffled.forEach((item, index) => {
      const originalId = item.id || item.candidateId || `item-${index}`;
      const blindedId = `blinded-${crypto.randomBytes(6).toString('hex')}`;
      const alias = `Candidate-${greekLetters[index] || index + 1} (Blinded)`;

      unblindMap[blindedId] = originalId;
      candidates.push({
        blindedId,
        alias,
        data: item,
      });
    });

    return {
      sessionId,
      candidates,
      unblindMap,
    };
  }

  /**
   * Resolves a blinded ID back to its original model / candidate identifier.
   */
  static unblind(blindedId: string, unblindMap: Record<string, string>): string | undefined {
    return unblindMap[blindedId];
  }
}
