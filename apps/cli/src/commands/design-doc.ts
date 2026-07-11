// intent: ut design-doc <get|review|approve>
// status: done
// next: surface lane-aggregate (need 3 approvals) inside `ut design-doc get` summary
// confidence: high
//
// Direct DB access for review/approval state (option (b) in spec).
// Doc CONTENT comes from Paperclip via api.ts.

import { Command } from "commander";
import chalk from "chalk";
import { neon } from "@neondatabase/serverless";
import { getIssue, getIssueDocument } from "../api.js";
import { DATABASE_URL, DIRECTOR_AGENT_ID } from "../config.js";
import { fmtRelative, printJson, makeTable } from "../format.js";

type Lane = "code" | "quality" | "devops";
type Verdict = "approve" | "changes-requested" | "block";

function sql() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — cannot reach UltraThink Neon");
  }
  return neon(DATABASE_URL);
}

export const designDocCommand = new Command("design-doc").description("Design-doc operations — get, review, approve");

designDocCommand
  .command("get <identifier>")
  .description("Print latest (or specific revision) design-doc body")
  .option("--revision <r>", "revision number; omit for latest")
  .option("--json", "machine-readable output")
  .action(async (identifier: string, opts) => {
    const issue = await getIssue(identifier);
    const doc = await getIssueDocument(issue.id);
    if (!doc) {
      process.stdout.write(chalk.dim(`(no design-doc on ${issue.identifier})\n`));
      process.exitCode = 1;
      return;
    }
    if (opts.json) {
      printJson(doc);
      return;
    }
    const rev = doc.revision?.revisionNumber ?? "?";
    process.stdout.write(
      `${chalk.bold(`${issue.identifier} design-doc rev ${rev}`)}\n${chalk.dim(`doc=${doc.doc?.id}`)}\n\n`
    );
    if (doc.sections && typeof doc.sections === "object") {
      const s = doc.sections as Record<string, string>;
      for (const key of ["what", "whatNot", "riskGuardrails", "verificationSteps"]) {
        const v = s[key];
        if (v) {
          process.stdout.write(`${chalk.bold(key)}\n${v}\n\n`);
        }
      }
    } else if (doc.body) {
      process.stdout.write(doc.body + "\n");
    }

    // Show lane verdicts on this revision
    const dbsql = sql();
    const reviews = (await dbsql`
      SELECT lane, verdict, comment, reviewer_agent_id, created_at
      FROM design_doc_reviews
      WHERE paperclip_doc_id = ${doc.doc.id}
        AND paperclip_revision_id = ${doc.revision.id}
        AND superseded_by IS NULL
      ORDER BY created_at DESC
    `) as Array<{
      lane: string;
      verdict: string;
      comment: string | null;
      reviewer_agent_id: string;
      created_at: string;
    }>;
    if (reviews.length > 0) {
      const table = makeTable(["Lane", "Verdict", "Reviewer", "When", "Comment"]);
      for (const r of reviews) {
        table.push([r.lane, colorVerdict(r.verdict), r.reviewer_agent_id, fmtRelative(r.created_at), r.comment ?? ""]);
      }
      process.stdout.write(`${chalk.bold("Lane verdicts")}\n${table.toString()}\n`);
    } else {
      process.stdout.write(chalk.dim("(no lane verdicts yet)\n"));
    }
  });

designDocCommand
  .command("review <identifier>")
  .description("Record a lane verdict on the latest revision")
  .requiredOption("--lane <lane>", "code | quality | devops")
  .requiredOption("--verdict <verdict>", "approve | changes-requested | block")
  .option("--comment <text>", "optional commentary")
  .option("--reviewer <agentId>", "reviewer agent UUID (defaults to director)")
  .action(async (identifier: string, opts) => {
    const lane = opts.lane as Lane;
    const verdict = opts.verdict as Verdict;
    if (!["code", "quality", "devops"].includes(lane)) {
      throw new Error(`--lane must be code|quality|devops, got ${lane}`);
    }
    if (!["approve", "changes-requested", "block"].includes(verdict)) {
      throw new Error(`--verdict must be approve|changes-requested|block, got ${verdict}`);
    }
    const issue = await getIssue(identifier);
    const doc = await getIssueDocument(issue.id);
    if (!doc) {
      throw new Error(`no design-doc on ${issue.identifier}`);
    }
    const reviewer = opts.reviewer || DIRECTOR_AGENT_ID;
    const dbsql = sql();
    // supersede previous open verdict on same lane/revision
    await dbsql`
      UPDATE design_doc_reviews
      SET superseded_by = id
      WHERE paperclip_doc_id = ${doc.doc.id}
        AND paperclip_revision_id = ${doc.revision.id}
        AND lane = ${lane}
        AND superseded_by IS NULL
    `;
    const inserted = (await dbsql`
      INSERT INTO design_doc_reviews
        (paperclip_doc_id, paperclip_issue_id, paperclip_revision_id,
         revision_number, lane, verdict, comment, reviewer_agent_id)
      VALUES
        (${doc.doc.id}, ${issue.id}, ${doc.revision.id},
         ${doc.revision.revisionNumber}, ${lane}, ${verdict},
         ${opts.comment ?? null}, ${reviewer})
      RETURNING id, created_at
    `) as Array<{ id: string; created_at: string }>;
    process.stdout.write(
      `recorded ${lane} ${colorVerdict(verdict)} on ${chalk.bold(issue.identifier)} rev ${doc.revision.revisionNumber} (${inserted[0].id})\n`
    );
  });

designDocCommand
  .command("approve <identifier>")
  .description("Director-only seal. Requires all 3 lanes (code, quality, devops) at verdict=approve.")
  .option("--note <text>", "decision note")
  .option("--approver <agentId>", "approver agent UUID (defaults to director)")
  .action(async (identifier: string, opts) => {
    const issue = await getIssue(identifier);
    const doc = await getIssueDocument(issue.id);
    if (!doc) throw new Error(`no design-doc on ${issue.identifier}`);
    const dbsql = sql();
    const verdicts = (await dbsql`
      SELECT lane, verdict
      FROM design_doc_reviews
      WHERE paperclip_doc_id = ${doc.doc.id}
        AND paperclip_revision_id = ${doc.revision.id}
        AND superseded_by IS NULL
    `) as Array<{ lane: string; verdict: string }>;
    const byLane = new Map(verdicts.map((v) => [v.lane, v.verdict]));
    const missing = ["code", "quality", "devops"].filter((l) => byLane.get(l) !== "approve");
    if (missing.length > 0) {
      throw new Error(
        `cannot approve — lanes not at 'approve': ${missing
          .map((l) => `${l}=${byLane.get(l) ?? "(missing)"}`)
          .join(", ")}`
      );
    }
    const approver = opts.approver || DIRECTOR_AGENT_ID;
    const rows = (await dbsql`
      INSERT INTO design_doc_approvals
        (paperclip_doc_id, paperclip_revision_id, approver_agent_id, decision_note)
      VALUES
        (${doc.doc.id}, ${doc.revision.id}, ${approver}, ${opts.note ?? null})
      ON CONFLICT (paperclip_doc_id, paperclip_revision_id) DO UPDATE
        SET decision_note = EXCLUDED.decision_note,
            approver_agent_id = EXCLUDED.approver_agent_id,
            approved_at = now()
      RETURNING id, approved_at
    `) as Array<{ id: string; approved_at: string }>;
    process.stdout.write(
      `${chalk.green("approved")} ${chalk.bold(issue.identifier)} rev ${doc.revision.revisionNumber} (${rows[0].id})\n`
    );
  });

function colorVerdict(v: string): string {
  if (v === "approve") return chalk.green(v);
  if (v === "block") return chalk.red(v);
  if (v === "changes-requested") return chalk.yellow(v);
  return v;
}
