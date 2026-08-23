export interface LabFaultState {
  scenarioCode: string;
  active: boolean;
  injectedAt: string;
  config: Record<string, unknown>;
}

export interface LabTelemetryEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  scenarioCode?: string;
  message: string;
  metadata: Record<string, unknown>;
}

export class FaultManager {
  private activeFaults = new Map<string, LabFaultState>();
  private events: LabTelemetryEvent[] = [];

  inject(code: string, config: Record<string, unknown> = {}): LabFaultState {
    const fault: LabFaultState = {
      scenarioCode: code,
      active: true,
      injectedAt: new Date().toISOString(),
      config,
    };
    this.activeFaults.set(code, fault);
    this.recordEvent('warn', `Fault injected: ${code}`, { config }, code);
    return fault;
  }

  isFaultActive(code: string): boolean {
    return this.activeFaults.has(code);
  }

  getFault(code: string): LabFaultState | undefined {
    return this.activeFaults.get(code);
  }

  getActiveFaults(): LabFaultState[] {
    return Array.from(this.activeFaults.values());
  }

  reset(): void {
    this.activeFaults.clear();
    this.recordEvent('info', 'All injected faults reset to normal operating baseline');
  }

  recordEvent(
    level: LabTelemetryEvent['level'],
    message: string,
    metadata: Record<string, unknown> = {},
    scenarioCode?: string,
  ): void {
    const event: LabTelemetryEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    };
    if (scenarioCode !== undefined) {
      event.scenarioCode = scenarioCode;
    }
    this.events.push(event);
  }

  getEvents(limit = 50): LabTelemetryEvent[] {
    return this.events.slice(-limit);
  }
}
