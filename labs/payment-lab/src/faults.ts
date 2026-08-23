export interface PaymentFaultConfig {
  active: boolean;
  duplicateRedelivery: boolean;
  duplicateCount: number;
}

export class PaymentFaultManager {
  private config: PaymentFaultConfig = {
    active: false,
    duplicateRedelivery: false,
    duplicateCount: 2,
  };

  inject(scenarioCode: string): void {
    if (scenarioCode === 'PAYMENT_QUEUE_DUPLICATION') {
      this.config = {
        active: true,
        duplicateRedelivery: true,
        duplicateCount: 2,
      };
    }
  }

  reset(): void {
    this.config = {
      active: false,
      duplicateRedelivery: false,
      duplicateCount: 2,
    };
  }

  isDuplicateRedeliveryActive(): boolean {
    return this.config.active && this.config.duplicateRedelivery;
  }

  getConfig(): PaymentFaultConfig {
    return { ...this.config };
  }
}
