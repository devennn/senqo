import { loadRepoEnv } from "../lib/load-repo-env.js";

loadRepoEnv();

type SeedSkill = {
  displayName: string;
  description: string;
  content: string;
};

function normalizeSkillKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseArgs(argv: string[]): { workspaceId: string } {
  let workspaceId = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if ((arg === "-w" || arg === "--workspace") && next) {
      workspaceId = next;
      index += 1;
    }
  }
  if (!workspaceId) {
    throw new Error("Missing required workspace id. Use -w or --workspace.");
  }
  return { workspaceId };
}

const seedSkills: SeedSkill[] = [
  {
    displayName: "Check Availability",
    description: "Confirm chocolate stock and packaging readiness before quoting.",
    content: `# Check Availability

## Goal
Confirm product availability before committing to customer delivery date.

## Steps
1. Confirm requested chocolate type (dark, milk, white, mix).
2. Check available box sizes and gift packaging options.
3. Verify quantity available for requested delivery timeline.
4. Reply with in-stock items and nearest alternatives for out-of-stock SKUs.
`,
  },
  {
    displayName: "Purchase History Review",
    description: "Use previous orders to personalize repeat purchase offers.",
    content: `# Purchase History Review

## Goal
Increase conversion by using customer past buying behavior.

## Steps
1. Retrieve latest 3 completed orders.
2. Identify preferred flavors, packaging style, and order quantity.
3. Suggest repeat bundle with a small upgrade or seasonal variant.
4. Mention previous delivery success to increase confidence.
`,
  },
  {
    displayName: "Upsell Cross Sell",
    description: "Recommend relevant add-ons for chocolate purchases.",
    content: `# Upsell Cross Sell

## Goal
Increase average order value with relevant suggestions.

## Steps
1. Start from confirmed base order.
2. Offer 1 upsell (premium box, larger size, premium mix).
3. Offer 1 cross-sell (gift card, ribbon, express delivery).
4. Keep options concise with clear price difference.
`,
  },
  {
    displayName: "Order Issue Triage",
    description: "Handle delivery and damaged-item issues quickly and clearly.",
    content: `# Order Issue Triage

## Goal
Resolve order issues quickly and preserve customer trust.

## Steps
1. Confirm order number and customer phone.
2. Classify issue: late delivery, damaged item, wrong item, missing item.
3. Capture evidence (photo/video) and timestamp.
4. Provide next action with ETA (replacement/refund/escalation).
`,
  },
];

async function main(): Promise<void> {
  const { createWorkspaceSkill, listWorkspaceSkills, updateWorkspaceSkill } = await import(
    "../repositories/skills.js"
  );
  const { workspaceId } = parseArgs(process.argv.slice(2));
  const existingSkills = await listWorkspaceSkills(workspaceId);
  const bySkillKey = new Map(existingSkills.map((skill) => [skill.skill_key, skill]));

  for (const skill of seedSkills) {
    const skillKey = normalizeSkillKey(skill.displayName);
    const existing = bySkillKey.get(skillKey);
    if (!existing) {
      const created = await createWorkspaceSkill({
        workspaceId,
        displayName: skill.displayName,
        description: skill.description,
        content: skill.content,
      });
      if (!created.ok) {
        throw new Error(`Create failed for ${skill.displayName}: ${created.message}`);
      }
      process.stdout.write(`created: ${skill.displayName}\n`);
      continue;
    }

    const updated = await updateWorkspaceSkill({
      workspaceId,
      skillId: existing.id,
      displayName: skill.displayName,
      description: skill.description,
      content: skill.content,
      isActive: true,
    });
    if (!updated.ok) {
      throw new Error(`Update failed for ${skill.displayName}: ${updated.message}`);
    }
    process.stdout.write(`updated: ${skill.displayName}\n`);
  }

  process.stdout.write(`seeded_skills_count=${seedSkills.length}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
