import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Production Deployment & Docker Orchestration Configuration Tests', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('validates multi-stage Dockerfiles exist for all apps and labs', () => {
    const dockerfiles = [
      'apps/api/Dockerfile',
      'apps/worker/Dockerfile',
      'apps/web/Dockerfile',
      'labs/commerce-lab/Dockerfile',
      'labs/payment-lab/Dockerfile',
      'labs/perf-lab/Dockerfile',
    ];

    for (const df of dockerfiles) {
      const fullPath = path.join(rootDir, df);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content).toContain('FROM node:22-alpine');
    }
  });

  it('validates apps/web nginx.conf contains SPA fallback and security headers', () => {
    const nginxPath = path.join(rootDir, 'apps/web/nginx.conf');
    expect(fs.existsSync(nginxPath)).toBe(true);
    const content = fs.readFileSync(nginxPath, 'utf8');

    expect(content).toContain('try_files $uri $uri/ /index.html;');
    expect(content).toContain('X-Frame-Options "DENY"');
    expect(content).toContain('X-Content-Type-Options "nosniff"');
    expect(content).toContain('location = /health');
  });

  it('validates docker-compose.prod.yml defines all 8 required production services', () => {
    const composePath = path.join(rootDir, 'infra/docker/docker-compose.prod.yml');
    expect(fs.existsSync(composePath)).toBe(true);
    const content = fs.readFileSync(composePath, 'utf8');

    const expectedServices = [
      'postgres:',
      'redis:',
      'commerce-lab:',
      'payment-lab:',
      'perf-lab:',
      'api:',
      'worker:',
      'web:',
    ];

    for (const svc of expectedServices) {
      expect(content).toContain(svc);
    }

    expect(content).toContain('healthcheck:');
    expect(content).toContain('faultforge-network:');
    expect(content).toContain('postgres_prod_data:');
  });

  it('validates verify-prod.sh script is present and executable', () => {
    const scriptPath = path.join(rootDir, 'infra/scripts/verify-prod.sh');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content).toContain('FaultForge AI — Production Readiness Verification');
  });
});
