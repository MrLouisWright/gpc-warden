import type { Report, Rule } from './core.js';
export * from './core.js';
export interface GpcOptions {
  baseUrl?: string; include?: string[]; exclude?: string[]; cleanUrls?: boolean;
  /** Your CMP is configured to honour GPC. */
  cmpHonoursGpc?: boolean;
  now?: Date; toolVersion?: string; [option: string]: unknown;
}
export declare const RULES: Record<string, Rule>;
export declare const SITE_OPTIONS: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>;
export declare const SITE_HELP: string;
export declare function check(dir: string, opts?: GpcOptions, config?: Record<string, unknown>, configFile?: string): Report;
export declare function analyze(site: unknown, opts?: GpcOptions, config?: Record<string, unknown>): { findings: Report['findings']; info: Record<string, unknown>; summary: string };
/** Returns null when valid, otherwise a list of problems. */
export declare function validateGpcJson(text: string): string[] | null;
