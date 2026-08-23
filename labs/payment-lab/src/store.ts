export interface PaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  idempotencyKey?: string | undefined;
  status: 'PROCESSED' | 'FAILED';
  createdAt: string;
}

export class PaymentStore {
  private ledger: PaymentRecord[] = [];
  private idempotencyKeys = new Set<string>();
  private snapshots = new Map<string, { ledger: PaymentRecord[]; keys: string[] }>();

  charge(record: Omit<PaymentRecord, 'id' | 'createdAt'>): PaymentRecord {
    const payment: PaymentRecord = {
      ...record,
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    this.ledger.push(payment);
    if (record.idempotencyKey) {
      this.idempotencyKeys.add(record.idempotencyKey);
    }

    return payment;
  }

  isKeyProcessed(key?: string): boolean {
    if (!key) return false;
    return this.idempotencyKeys.has(key);
  }

  getLedger(): PaymentRecord[] {
    return [...this.ledger];
  }

  saveSnapshot(hash: string): void {
    this.snapshots.set(hash, {
      ledger: JSON.parse(JSON.stringify(this.ledger)),
      keys: Array.from(this.idempotencyKeys),
    });
  }

  restoreSnapshot(hash: string): boolean {
    const snapshot = this.snapshots.get(hash);
    if (!snapshot) return false;
    this.ledger = JSON.parse(JSON.stringify(snapshot.ledger));
    this.idempotencyKeys = new Set(snapshot.keys);
    return true;
  }

  reset(): void {
    this.ledger = [];
    this.idempotencyKeys.clear();
  }
}
