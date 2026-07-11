/**
 * Tekiō — Cycle of Nova (適応)
 *
 * Inspired by Mahoraga's wheel of adaptation: "If the General is hit by
 * a particular attack, the wheel turns once the attack is analyzed,
 * and Mahoraga adapts."
 *
 * Unlike Mahoraga's limited 8 wheel spins, Tekiō has NO limit.
 * Every failure triggers a nova — an explosion of insight.
 * The wheel turns, a new adaptation is forged, and the same mistake
 * never happens twice. Infinite cycles. Infinite growth.
 *
 * Four adaptation types (evolved beyond Mahoraga):
 *   defensive  — become immune to a known failure pattern
 *   auxiliary   — improve perception (detect issues before they happen)
 *   offensive   — modify approach to bypass obstacles
 *   learning    — absorb successful new patterns (first-time approaches that worked)
 *
 * Evaluation logic: EVERY interaction is evaluated.
 *   - New pattern → turn the wheel (learn)
 *   - Already known → skip (no duplicate)
 *   - Failure → always turn the wheel (counter-strategy)
 *   - Success confirmation → turn the wheel (reinforce)
 */
import type { SqlClient } from "./client.js";
export interface Adaptation {
  id: string;
  trigger_pattern: string;
  adaptation_rule: string;
  source_failure: string | null;
  category: "defensive" | "auxiliary" | "offensive" | "learning";
  severity: number;
  scope: string | null;
  times_applied: number;
  times_prevented: number;
  created_at: string;
  last_applied_at: string | null;
  is_active: boolean;
  tags: string[];
}
export interface FailureEvent {
  error: string;
  context: string;
  tool?: string;
  scope?: string;
  exitCode?: number;
}
/**
 * Find adaptations that match a failure pattern.
 * Uses tsvector + trigram for fuzzy matching.
 */
export declare function findMatchingAdaptations(sql: SqlClient, failure: FailureEvent): Promise<Adaptation[]>;
/**
 * Nova Ignites — analyze a failure and create/apply an adaptation.
 * Returns the adaptation that was created or applied.
 */
export declare function wheelTurn(
  sql: SqlClient,
  failure: FailureEvent
): Promise<{
  adaptation: Adaptation;
  isNew: boolean;
  wheelSpin: number;
} | null>;
/**
 * Record a prevented failure — the adaptation successfully stopped a repeat.
 */
export declare function recordPrevention(sql: SqlClient, adaptationId: string): Promise<void>;
/**
 * Get all active adaptations for injection into session context.
 * These are the hard-earned lessons — rules that must be followed.
 */
export declare function getActiveAdaptations(sql: SqlClient, scope?: string): Promise<Adaptation[]>;
/**
 * Format adaptations for context injection.
 * This is the "wheel state" — visible to Claude as hard rules.
 */
export declare function formatAdaptations(adaptations: Adaptation[]): string;
/**
 * Create an adaptation from a user correction.
 * When the user says "no, not that — do this instead", that's a wheel turn.
 */
export declare function adaptFromCorrection(
  sql: SqlClient,
  wrongApproach: string,
  correctApproach: string,
  scope?: string
): Promise<Adaptation>;
/**
 * Learn from a successful new pattern.
 * When something works and it's novel, the wheel turns — absorbing the approach.
 */
export declare function wheelLearn(
  sql: SqlClient,
  learning: {
    pattern: string;
    insight: string;
    scope?: string;
    tags?: string[];
  }
): Promise<{
  adaptation: Adaptation;
  isNew: boolean;
  wheelSpin: number;
}>;
/**
 * Evaluate an interaction and decide: is this worth learning from?
 * Returns true if the wheel turned, false if skipped.
 *
 * This is the "always-on" evaluator:
 *   - New? → learn
 *   - Known? → skip
 *   - Failure? → handled by wheelTurn (separate path)
 *   - Correction? → handled by adaptFromCorrection (separate path)
 */
export declare function evaluateInteraction(
  sql: SqlClient,
  interaction: {
    type: "success" | "novel-approach" | "skill-combo" | "preference";
    pattern: string;
    insight: string;
    scope?: string;
  }
): Promise<{
  learned: boolean;
  wheelSpin: number;
}>;
/**
 * Get wheel stats for display.
 */
export declare function getWheelStats(sql: SqlClient): Promise<{
  total: number;
  defensive: number;
  auxiliary: number;
  offensive: number;
  learning: number;
  totalPrevented: number;
  totalApplied: number;
}>;
