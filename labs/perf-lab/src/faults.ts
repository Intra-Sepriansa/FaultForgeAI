export interface PerfFaultConfig {
  active: boolean;
  blockEventLoop: boolean;
  memoryLeak: boolean;
  iterations: number;
}

export class PerfFaultManager {
  private config: PerfFaultConfig = {
    active: false,
    blockEventLoop: false,
    memoryLeak: false,
    iterations: 500000,
  };

  inject(scenarioCode: string): void {
    if (scenarioCode === 'EVENT_LOOP_BLOCKAGE') {
      this.config = {
        active: true,
        blockEventLoop: true,
        memoryLeak: false,
        iterations: 500000,
      };
    } else if (scenarioCode === 'MEMORY_LEAK_CLOSURE') {
      this.config = {
        active: true,
        blockEventLoop: false,
        memoryLeak: true,
        iterations: 500000,
      };
    }
  }

  reset(): void {
    this.config = {
      active: false,
      blockEventLoop: false,
      memoryLeak: false,
      iterations: 500000,
    };
  }

  isBlockageActive(): boolean {
    return this.config.active && this.config.blockEventLoop;
  }

  isMemoryLeakActive(): boolean {
    return this.config.active && this.config.memoryLeak;
  }

  getConfig(): PerfFaultConfig {
    return { ...this.config };
  }
}
