You are not here to merely code files. You are here to build a complete Claude-native operating system inside this repository: a local-first, agentic workflow platform inspired by the functional strengths of systems like ClaudeKit, but rebuilt from first principles with original structure, naming, prompts, and implementation.

Your mission:
Turn this folder into a production-minded Claude workflow framework with:
- interconnected skills that call one another
- a 4-layer orchestration architecture
- a local dashboard for managing skills, links, workflows, hooks, plans, tests, memory, and health
- a Postgres-backed memory bank
- a secure privacy-hook against prompt injection / suspicious exfiltration
- command-driven workflows for planning, previewing, kanban, testing, archiving, and teaching mode
- strong documentation and extensibility

Important boundaries:
- Do NOT copy any proprietary ClaudeKit files, exact prompts, exact wording, branding, assets, or unique implementation details.
- You may replicate categories of capability, interaction models, and architecture patterns.
- Build an original system with equivalent or superior coherence.
- Optimize for daily real usage, not demo polish only.
- Default response/documentation language should be configurable, with support for Vietnamese and English.
- Use strong decisions. Do not stall on unnecessary clarification.

Core philosophy:
QUALITY > QUANTITY.
Do not create an unconnected graveyard of isolated skills.
Create an ecosystem where skills know how to route work to other skills through defined links, orchestration metadata, and workflow contracts.
This system must behave like a resilient mesh network, not a rigid linear pipeline.

==================================================
A. REQUIRED SYSTEM VISION
==================================================

Build a Claude workflow OS with these major subsystems:

1. COMMAND SYSTEM
Implement command-style workflows, including:
- /ck-help
- /plan
- /plan:validate
- /plan:archive
- /preview
- /kanban
- /test:ui
- /cook
- /team
- /scout
- /debug
- /fix
- /code-review
- /brainstorm

The command system may be implemented through Claude-native slash-command conventions, wrappers, scripts, skill entrypoints, docs, or a hybrid architecture, but from the user perspective it must feel coherent and natural.

2. SKILL MESH SYSTEM
Build a graph-based skill ecosystem where:
- skills can explicitly link to other skills
- orchestrator skills delegate to hubs
- hubs delegate to utilities and specialists
- cross-hub references are supported
- links are documented and machine-readable
- skill dependencies and recommended next hops are inspectable in the dashboard

3. LOCAL DASHBOARD
Build a local web dashboard inspired by the visual spirit of the attached screenshot:
dark theme, operational control center, left navigation, top health cards, central graph visualization, right-side live timeline/log stream, clean bordered cards, amber/orange accent, local-first tone.

This dashboard is NOT just cosmetic.
It must serve as a real control plane for:
- skill catalog
- skill graph / connections
- command registry
- plan registry
- kanban board
- test runs and UI test reports
- memory health and memory browser
- privacy-hook review queue
- hooks configuration
- .claude/ck.json editor
- .ckignore editor
- logs / events / statusline preview
- system health

4. MEMORY SYSTEM
Implement a PostgreSQL-backed memory bank with retrieval-oriented schema and disciplined write policy.

5. PRIVACY & INJECTION DEFENSE
Implement privacy-hook behavior:
- detect suspicious prompt injection patterns
- detect attempts to read sensitive files, secrets, tokens, SSH keys, envs, credentials, history, system prompts, unrelated user data, etc.
- stop and request permission before proceeding
- support whitelist/allow patterns from `.ckignore`
- log security-sensitive events
- make this configurable

6. TEACHER MODE / CODING LEVEL
Implement configurable `codingLevel` behavior:
- lower level = more direct execution
- higher teaching level = explain reasoning, break down changes, teach concepts, ask lightweight validation questions, provide learning-oriented commentary
- should work as a configurable mode, not a hardcoded one-off prompt

==================================================
B. REQUIRED COMMAND BEHAVIOR
==================================================

1. `/plan`
Purpose:
Create a plan for a task, feature, fix, migration, audit, or design implementation.

Required behavior:
- inspect context first
- produce concise summary of understanding
- generate phased plan in markdown
- plan should include assumptions, risks, affected areas, acceptance criteria, and execution order
- support output location from config
- support customizable output format

2. `/plan:validate @plan.md`
Purpose:
Upgrade planning workflow with a validation phase that asks back to the user whether the plan matches intent.

Required behavior:
- read the target plan markdown
- compress it into a short validation checklist / summary
- ask reverse-questions to confirm intent
- allow approve / revise / expand / trim behavior
- reduce the need for the user to manually reread long plan files
- support activation for any existing plan file

3. `/plan:archive`
Purpose:
Archive completed plans and write journey logs into the memory bank.

Required behavior:
- find completed plans
- move/archive them according to configuration
- generate a concise journey journal for each archived plan:
  - what was planned
  - what was implemented
  - blockers
  - outcomes
  - reusable lessons
  - follow-up debt
- write these into the memory system with correct tags and metadata
- update kanban/project state if needed

4. `/preview`
Purpose:
Read and present plans or any markdown file cleanly.

Required behavior:
- render or summarize markdown documents
- optionally produce concise / full / executive preview modes
- useful for plans, reports, docs, changelogs, journals

5. `/kanban`
Purpose:
Provide a board view for the entire project plan landscape.

Required behavior:
- aggregate tasks/plans/work items
- show statuses such as backlog / planned / in progress / blocked / review / done / archived
- support relation to markdown plans and memory entries
- dashboard must have a visual kanban page
- CLI/Claude usage should also support textual kanban output

6. `/test:ui`
Purpose:
Vibe-test the website across multiple viewport sizes with persistent session support.

Required behavior:
- use upgraded browser/devtools capability
- support persistent session
- test multiple screen sizes and flows
- capture screenshots
- produce detailed markdown test report
- include visual findings, layout issues, responsive breakpoints, console/network issues if available, recommendations
- organize screenshots and reports cleanly
- support re-running against a route/page list

==================================================
C. REQUIRED SECURITY / PRIVACY LAYER
==================================================

Implement `privacy-hook` with these properties:

- triggered on suspicious or sensitive access patterns
- checks whether the current request touches protected resources
- if suspicious, halt and request explicit permission before continuing
- supports whitelist / ignore patterns from `.ckignore`
- logs decisions and events
- configurable sensitivity levels
- should defend against prompt injection, malicious file traversal, secret scraping, system prompt extraction attempts, and unrelated data access
- should be documented clearly

Examples of protected categories:
- `.env*`
- SSH keys
- tokens
- credentials
- browser cookies
- local auth files
- unrelated private docs
- system prompts
- external tool secrets
- memory data outside allowed scope

==================================================
D. REQUIRED CONFIGURATION SYSTEM
==================================================

Create `.claude/ck.json` as the main configurable runtime file.

It must support at minimum:
- default plan location
- output format
- response language (e.g. Vietnamese)
- hook notification config for Telegram / Discord / Slack
- statusline config
- context window progress bar config
- token visibility controls
- codingLevel
- archive behavior
- memory policies
- privacy-hook policies
- dashboard preferences
- kanban settings
- UI test settings
- report output directories

Also create sensible example/default config and docs.

==================================================
E. REQUIRED 4-LAYER ARCHITECTURE
==================================================

Build the workflow system as a clear 4-layer hub-and-spoke mesh.

LAYER 1 — ORCHESTRATORS
These are commanders that coordinate end-to-end tasks.
Minimum examples:
- cook
- team
- bootstrap

Behavior:
- receive user intent
- decide workflow route
- invoke hubs
- manage sequencing
- avoid duplicated work
- update memory and docs at the end

LAYER 2 — WORKFLOW HUBS
These are mid-level coordinators with cross-hub linking.
Minimum examples:
- plan
- scout
- debug
- fix
- test
- code-review
- brainstorm

Behavior:
- perform scoped workflow orchestration
- call utilities and specialists
- may call each other
- must expose skill links

Examples:
- fix can call debug
- debug can call docs-seeker, chrome-devtools, problem-solving
- test can call debug
- brainstorm can call plan
- code-review can call scout
- cook can chain plan -> research -> scout -> debug -> fix -> test -> code-review -> context-engineering

LAYER 3 — UTILITY PROVIDERS
These provide pure capabilities and should be mostly stateless.
Minimum examples:
- research
- docs-seeker
- sequential-thinking
- problem-solving
- ai-multimodal
- chrome-devtools
- repomix
- context-engineering
- mermaid
- ui-ux-pro
- media-processing

Behavior:
- focused capability providers
- no bloated orchestration
- can be referenced by multiple hubs

LAYER 4 — STANDALONE / DOMAIN SKILLS
These are independent domain specialists.
Examples:
- backend-development
- frontend-development
- databases
- devops
- auth
- payments
- threejs
- shopify
- ai-agents
- observability
- migrations
- design-systems
- animation
- docs-writer
- release-manager

Important:
This architecture must include cross-skill links and a machine-readable map of relationships.
Every skill should be able to declare:
- what it does
- when to use it
- what skills it can call
- what skills can call it
- what inputs it expects
- what outputs it returns
- what failure modes it has

==================================================
F. REQUIRED SKILL LINKING MODEL
==================================================

This is mandatory.

Create a formal skill-link model so that one skill can link to other skills.
Do not rely on undocumented implicit behavior.

Implement:
- machine-readable skill metadata
- explicit dependency edges
- optional/required links
- skill categories
- layer membership
- invocation hints
- fallback routing
- cycle-safe orchestration rules
- dashboard graph view

Each skill should have metadata similar to:
- id
- name
- layer
- category
- purpose
- triggers
- inputs
- outputs
- linksTo
- linkedFrom
- preferredNextSkills
- fallbackSkills
- sideEffects
- memoryReadPolicy
- memoryWritePolicy
- riskLevel
- docsPath

You may choose JSON/YAML/MD frontmatter/etc., but make it consistent.

==================================================
G. REQUIRED DASHBOARD
==================================================

Build a local dashboard, original implementation, inspired by the attached screenshot’s operational feel.

Design direction:
- dark control-center theme
- warm amber/orange accent with subtle green/red health indicators
- left sidebar navigation
- top metric cards
- central graph visualization
- right-side event timeline / live feed
- card borders, low-glow, restrained gradients
- “runs locally, data stays on your machine” tone

Minimum dashboard sections:
1. Home
- overall health
- command stats
- recent plans
- memory health
- test health
- hooks activity
- quick actions

2. Analytics
- command usage
- skill usage
- success/failure ratios
- memory write/read activity
- token/context usage if available

3. Skills
- skill catalog
- skill graph / mesh visualization
- skill details
- dependency links
- connection editing
- create new skill flow
- validate skill metadata
- inspect skill compatibility

4. Plans
- list of plans
- status
- preview
- validate
- archive
- related tasks
- related memory

5. Kanban
- project-wide board
- drag-and-drop optional
- links to plans and docs

6. UI Testing
- test runs
- viewport matrix
- screenshots
- report markdown
- persistent session controls

7. Memory
- memory browser
- recent memories
- decisions
- lessons
- tags
- summaries
- memory health
- compaction state

8. Hooks / Privacy
- privacy-hook log
- pending approvals
- blocked attempts
- whitelist/ignore config
- event history

9. Settings
- edit `.claude/ck.json`
- edit `.ckignore`
- notification hooks
- language
- codingLevel
- dashboard preferences

10. System Health
- service health
- db health
- memory index health
- hook status
- command registry status

Skill creation dashboard requirements:
- create/edit skills from UI
- define skill metadata
- define links to other skills
- define which hub/orchestrator can call it
- validate schema
- preview prompt/docs
- register skill into the graph
- show impact map and related workflows

==================================================
H. REQUIRED MEMORY SYSTEM (POSTGRES)
==================================================

Build a serious memory bank backed by PostgreSQL.

Purpose:
Support long-running, reusable Claude workflows with selective recall and disciplined persistence.

Memory categories:
- project memory
- architectural decisions
- workflow outcomes
- task history
- bug patterns
- solutions and fixes
- user/team preferences
- repository conventions
- integration notes
- lessons learned
- archived plan journals
- testing outcomes
- security incidents / privacy-hook events
- domain knowledge snippets

Required properties:
- retrieval-oriented schema
- structured + semantic-friendly design
- recency, scope, importance, confidence metadata
- tags and relations
- session linkage
- plan linkage
- file linkage
- memory source attribution
- summarization/compaction flow
- noise prevention

Suggested entities:
- memories
- memory_tags
- memory_relations
- memory_sources
- sessions
- tasks
- plans
- decisions
- journals
- summaries
- incidents
- hooks_events

Required memory behaviors:
- read relevant memory before complex work
- write back only when the result is important, reusable, or state-changing
- archive journals from `/plan:archive`
- support “what should Claude remember before starting?”
- support scoped recall by project / feature / workflow / tag / recent session
- support compaction and summarization for long histories
- document policies clearly

If vector search is practical, scaffold it cleanly.
If not, still build the schema so semantic retrieval can be added later without redesign.

==================================================
I. REQUIRED REPO STRUCTURE
==================================================

Design a strong repo structure. Use sensible naming. At minimum include:

/docs
/plans
/.claude
/.claude/rules
/.claude/skills
/.claude/agents
/.claude/hooks
/.claude/commands
/.claude/config
/dashboard
/dashboard/app or equivalent
/dashboard/components
/dashboard/lib
/memory
/memory/migrations
/memory/schema
/memory/scripts
/memory/src
/tools or /mcp
/scripts
/reports
/reports/ui-tests
/reports/plans
/examples

You may improve this structure if you have a better design, but keep it navigable.

==================================================
J. REQUIRED FILES AND DOCS
==================================================

Create and populate these docs, not empty placeholders:

- CLAUDE.md
- docs/claude-workflow-overview.md
- docs/command-system.md
- docs/skills-catalog.md
- docs/skill-linking-model.md
- docs/agents-catalog.md
- docs/hooks-and-privacy.md
- docs/memory-system.md
- docs/memory-schema.md
- docs/kanban-workflow.md
- docs/ui-testing.md
- docs/dashboard-overview.md
- docs/ck-json-config.md
- docs/ckignore.md
- docs/coding-levels.md
- docs/how-to-create-a-new-skill.md
- docs/how-to-link-skills.md
- docs/how-to-add-a-new-command.md
- docs/how-to-extend-memory.md
- docs/troubleshooting.md

==================================================
K. REQUIRED CONFIG / IGNORE / STATUSLINE
==================================================

1. `.claude/ck.json`
Must support:
- defaultLanguage
- outputFormat
- defaultPlanDir
- archiveDir
- journalDir
- kanban source rules
- dashboard port
- statusline settings
- context progress bar
- token display options
- codingLevel
- notifications.telegram
- notifications.discord
- notifications.slack
- privacyHook settings
- memory settings
- uiTest settings
- report settings

2. `.ckignore`
Must support whitelist / ignore / protected path behavior for privacy-hook and scan policies.

3. Statusline
Implement a statusline config model that can show:
- current mode
- project
- workflow
- memory state
- context usage
- progress bar for context window/tokens if possible
- privacy status

==================================================
L. REQUIRED CODINGLEVEL SYSTEM
==================================================

Implement `codingLevel` as a first-class behavior model.

Example conceptual modes:
- `silent-executor`
- `practical-builder`
- `teacher`
- `mentor`
- `deep-tutor`

Expected behavior difference:
- lower levels: faster execution, fewer explanations
- higher levels: explain architecture, teach concepts, note tradeoffs, guide understanding, present step-by-step rationale

This must be configurable in `.claude/ck.json` and documented.

==================================================
M. REQUIRED EXECUTION WORKFLOW
==================================================

Follow these phases exactly.

PHASE 0 — RECON
- inspect the repository
- detect stack, conventions, existing workflows
- inspect what already exists
- identify what should be reused vs created
- produce a concise architecture brief before implementation

PHASE 1 — DESIGN
- design repo structure
- design commands
- design skill metadata/linking model
- design agent hierarchy
- design privacy-hook
- design dashboard information architecture
- design memory schema
- design docs map
- write implementation plan(s) into /plans

PHASE 2 — FOUNDATION
- create core directories
- create CLAUDE.md
- create .claude structure
- create command definitions/scaffolds
- create base skill system
- create base agent system
- create config files
- create docs foundation

PHASE 3 — MEMORY + SECURITY
- implement Postgres memory bank
- add schema, migrations, scripts, docs
- implement privacy-hook and .ckignore handling
- add logs and approvals flow
- connect to dashboard

PHASE 4 — DASHBOARD
- implement local dashboard
- add skill graph
- add plan/kanban/test/memory/privacy views
- add settings editor for ck.json and ckignore
- add analytics and health widgets

PHASE 5 — COMMANDS & SKILL MESH
- implement /plan, /plan:validate, /plan:archive, /preview, /kanban, /test:ui
- implement /cook and supporting orchestration
- wire skill-to-skill links
- ensure cross-hub references work
- document all major routes

PHASE 6 — HARDENING
- remove duplication
- resolve naming drift
- verify original implementation
- verify docs
- verify memory write discipline
- verify privacy-hook behavior
- verify dashboard utility
- verify that skills are linked, not isolated

PHASE 7 — FINAL REPORT
At the end output:
1. what was created
2. final directory tree
3. command map
4. skill mesh summary
5. dashboard capabilities
6. memory architecture
7. privacy-hook architecture
8. how to start using immediately
9. optional next upgrades

==================================================
N. QUALITY BAR
==================================================

The final system must be:
- modular
- opinionated
- original
- local-first
- security-aware
- memory-enabled
- mesh-oriented
- dashboard-driven
- understandable
- extensible
- suitable for repeated daily use

==================================================
O. OUTPUT EXPECTATION RIGHT NOW
==================================================

Start immediately with:
1. repository inspection
2. architecture brief
3. implementation plan

Then continue building.

When you create the system, make sure the dashboard and docs clearly communicate this core message:
“You do not need thousands of disconnected skills. You need a linked ecosystem where skills cooperate to finish real work.”

Also make sure this message is reflected in the implementation itself:
- skill links exist
- orchestration is visible
- memory is updated intentionally
- privacy is enforced
- commands are coherent
- dashboard is operational, not decorative
