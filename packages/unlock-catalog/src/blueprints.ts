import type { RunbookBlueprint, SkillBlueprint, SkillBlueprintCategory } from "./types.ts";

const SOURCE_SKILL_CATEGORIES = [
  {
    id: "core-infrastructure",
    number: "01",
    title: "Core Infrastructure",
    description:
      "The foundation layer: image generation, current search, transcription, ingestion, and artifacts. Build these when other workflows keep re-solving the same tool and packaging problems.",
    skills: [
      {
        id: "image-generation-gateway",
        installName: "image-gateway",
        title: "Image Generation Gateway",
        whatItDoes:
          'Generates or edits images through a single API (OpenRouter is a good choice) with one command and zero per-call setup. The skill stores your saved preferences — default model, output directory, default size — so "generate an image of X" just works. It captures the current request shape of the API: which fields the endpoint expects, which model IDs are live, what each model costs per image, and the gotchas you\'ve already hit. Other skills reference this one instead of writing their own API code.',
        whyBuildIt:
          "Image APIs change constantly, and every agent session that improvises an API call repeats old mistakes. Centralizing image generation in one skill means you fix an API change once, and every workflow that generates images inherits the fix. This is the clearest example of a skill as a shared primitive: at least three other skills in this library call it rather than reimplementing it.",
        whatYouNeed: [
          "An OpenRouter account and API key (or any image API you prefer — the pattern is identical)",
        ],
        setupPrompt: `<prompt>
  <task>
    Create a new AI coding-agent skill called "image-gateway".
  </task>

  <storage>
    Store the skill wherever this harness loads skills from, such as
    ~/.claude/skills/image-gateway/SKILL.md or ~/.codex/skills/image-gateway/SKILL.md.
  </storage>

  <job>
    The skill generates or edits images through the OpenRouter API with one command.
    It should use saved preferences so routine image requests do not require per-call setup.
  </job>

  <inputs_to_collect>
    <input>Preferred default image model.</input>
    <input>Default output directory.</input>
    <input>Where the OpenRouter API key lives. It must be read from an env file, never written into the skill.</input>
  </inputs_to_collect>

  <requirements>
    <requirement>Define trigger conditions for direct image-generation requests and for other skills that need image generation.</requirement>
    <requirement>Document the current OpenRouter image API request shape.</requirement>
    <requirement>Include a working curl or script example that reads the key from the env file.</requirement>
    <requirement>Store the collected preferences in the skill.</requirement>
    <requirement>Include per-image cost notes for the selected default model.</requirement>
    <requirement>Tell other skills to call this skill instead of writing their own image API code.</requirement>
  </requirements>

  <verification>
    Generate one image with the saved defaults, show me the result, then update the skill with anything learned from the test.
  </verification>
</prompt>`,
      },
      {
        id: "current-information-search",
        title: "Current-Information Search",
        whatItDoes:
          "Routes the agent's web research through a search API built for discovering new information (Perplexity's API is the canonical choice) instead of the harness's built-in search. The skill defines when to use it — recent releases, pricing, anything that may contradict the model's training data — and carries the exact API call shape, default model choice, and key location. Optionally it can be wired in as a hook so all web searches redirect automatically.",
        whyBuildIt:
          'Agents are confidently out of date. The single most common failure mode in AI-assisted research is the model "confirming" stale training data instead of discovering what changed last week. A dedicated search skill turns "search for current info" from a hope into a procedure — and it makes every other research-flavored skill in this library more trustworthy.',
        whatYouNeed: ["A Perplexity API key (or another search API with real-time results)"],
        setupPrompt: `Create a new skill for my AI coding agent called "current-information-search",
stored wherever my harness loads skills from.

The skill's job: when I ask about anything that changes quickly — AI model releases,
pricing, software versions, news, APIs — call the Perplexity API directly instead of
relying on training data or default web search.

Before writing it, interview me for: where to store my Perplexity API key (env file)
and which Perplexity model to default to (suggest one).

The skill must include: (1) trigger conditions — any question about recent or
fast-moving information, and any time my claim or the agent's knowledge might be
stale; (2) a working curl example for the Perplexity chat completions endpoint that
reads the key from the env file; (3) a rule to cite dates and primary sources in
answers built from search results; (4) a rule that when search results contradict the
model's training data, the search results win.

After writing it, test it by asking yourself one question about something released in
the last month, run the search, and show me the answer with sources.`,
      },
      {
        id: "media-transcription",
        title: "Media Transcription",
        whatItDoes:
          "Transcribes local audio or video files with a transcription API (AssemblyAI is a strong default) and packages the output into reusable artifacts: a clean readable Markdown transcript, word-level timestamps, semantic chapters, and speaker labels. The skill captures the current API request shape — including newer fields the docs bury — so transcription work never repeats old API mistakes. The output artifacts are deliberately designed to feed other skills: editing workflows, research synthesis, and content generation all start from these files.",
        whyBuildIt:
          "Transcripts are the universal input format for media work. Once a video or recording is a timestamped transcript, your agent can edit it, summarize it, fact-check it, extract clips from it, and generate graphics for it. Almost every media runbook in this library starts here. Getting the packaging right once — consistent filenames, chapters, timestamps — is what makes the downstream skills composable.",
        whatYouNeed: [
          "An AssemblyAI API key (or comparable transcription API)",
          "ffmpeg installed for audio extraction from video",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "media-transcription", stored
wherever my harness loads skills from.

The skill's job: take a local audio or video file path and produce a complete
transcription package using the AssemblyAI API.

Before writing it, interview me for: where my AssemblyAI API key should live (env
file), and where transcription outputs should be saved (suggest a folder convention
next to the source media).

The skill must include: (1) trigger conditions — any time I give you a media file and
ask for a transcript, captions, chapters, or "make this searchable"; (2) the current
AssemblyAI request shape including the speech model field, with a working script that
reads the key from the env file; (3) a standard output package: readable Markdown
transcript, word-level timestamp JSON, semantic chapters, and speaker labels, all with
consistent filenames; (4) an ffmpeg step to extract audio from video first when
needed; (5) a note that these artifacts are inputs for editing and research skills, so
the format must stay consistent.

After writing it, test it on a short audio file and show me the output package.`,
      },
      {
        id: "heavy-file-ingestion",
        title: "Heavy File Ingestion",
        whatItDoes:
          "Converts heavy, agent-hostile files — large PDFs, slide decks, spreadsheets, CSVs, long Word docs — into lightweight Markdown and CSV artifacts plus an index file, before any analysis begins. The skill enforces a discipline: never analyze a heavy file directly in context; convert it to lean text artifacts first, then analyze those. It includes the conversion recipes (which tools to use per file type) and the index format so a folder of converted material stays navigable.",
        whyBuildIt:
          "Heavy files silently destroy agent sessions. A 200-page PDF or a 40-tab spreadsheet read directly into context burns the context window, degrades reasoning, and leaves nothing reusable behind. Ingest-first means you pay the conversion cost once and every future session works from clean, greppable text. This is the foundational skill of the research runbook.",
        whatYouNeed: [
          "Nothing beyond standard conversion tools your agent can install (e.g. pdf-to-text utilities); no accounts",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "heavy-file-ingestion", stored
wherever my harness loads skills from.

The skill's job: when I hand you a heavy file (big PDF, slide deck, spreadsheet, CSV
dump, long doc), convert it into lightweight Markdown/CSV artifacts plus an index
BEFORE doing any analysis — never analyze the heavy file directly.

Before writing it, interview me for: where converted artifacts should live (suggest a
convention like an \`_ingested/\` folder next to the source), and which file types I
handle most often.

The skill must include: (1) trigger conditions — any heavy or binary document I share,
or any analysis request that touches one; (2) per-file-type conversion recipes using
tools available on my machine, installing what's missing; (3) a standard index file
listing each artifact with a one-line summary; (4) the rule that analysis always reads
the converted artifacts, never the original; (5) chunking guidance for very large
sources so each artifact stays comfortably readable.

After writing it, test it on one real PDF or deck I give you and show me the artifact
folder and index.`,
      },
      {
        id: "html-artifact-builder",
        title: "HTML Artifact Builder",
        whatItDoes:
          "Turns dense agent output — implementation plans, research explainers, code review summaries, comparison tables, walkthroughs, diagrams, interactive reports — into a single self-contained HTML file with consistent, polished styling. The skill carries your visual conventions (fonts, colors, layout patterns, dark/light preference) so every artifact looks like it came from the same shop, and it enforces self-containment: one file, inline CSS/JS, no external dependencies, openable anywhere.",
        whyBuildIt:
          'Long chat responses are where good analysis goes to die. A complex comparison or plan rendered as a styled, scrollable, sometimes interactive HTML page is dramatically more useful — you can read it properly, share it, and keep it. Once your agent has a house style for artifacts, "make this a page" becomes a one-line request, and the publishing skill (below) can take any artifact public.',
        whatYouNeed: ["Nothing. This is pure agent capability plus your taste."],
        setupPrompt: `Create a new skill for my AI coding agent called "html-artifact-builder", stored
wherever my harness loads skills from.

The skill's job: render dense or visual output — plans, reports, research explainers,
review summaries, comparisons, diagrams, walkthroughs — as a single self-contained
HTML file with my house style, instead of a long chat response.

Before writing it, interview me for: my visual preferences (typeface direction, color
palette or a brand color, dark or light default) and where artifact files should be
saved.

The skill must include: (1) trigger conditions — whenever output would be dense,
visual, interactive, or worth keeping/sharing, offer or produce an HTML artifact;
(2) hard rules: one file, inline CSS and JS, no external dependencies, works offline;
(3) my house style tokens (type, spacing, colors) defined once at the top so every
artifact matches; (4) layout patterns for the common cases: report, comparison table,
timeline, diagram, dashboard; (5) a rule to open or screenshot the result and verify
it renders before declaring it done.

After writing it, test it by converting your own setup summary of this skill into an
artifact and showing me.`,
      },
    ],
  },
  {
    id: "context-engineering",
    number: "02",
    title: "Context Engineering",
    description:
      "Skills for controlling what actually reaches the model: keep the context budget honest, then turn scattered, uncited paperwork into a structured case file — ingest documents, normalize records, store evidence, retrieve deterministically, validate citations, and export a human-reviewed packet.",
    skills: [
      {
        id: "token-saver",
        title: "Token Saver",
        whatItDoes:
          "Makes the agent spend your context budget deliberately instead of by habit. Once loaded, it changes how the agent works for the rest of the job: it searches a large source and sends only the matching passages rather than the whole file, runs exact work as local code before reaching for another model, saves the one result you accepted and builds the next revision from that result plus your change, declines to load tools the job cannot use, keeps the answer to the length you asked for, and refuses to retry a token-limit failure. It ships with three local Python helpers — a passage selector, a context-packet builder, and a state tool that holds exactly one accepted result — and the agent runs them itself rather than asking you to.",
        whyBuildIt:
          "The message you type is usually the smallest part of the call. The same request carries the old conversation, earlier answers, tool results, attached files, and every loaded tool description — and a failed answer makes the retry carry most of it again. That is why switching to a cheaper model so often changes nothing: the pile moves rather than shrinks. This skill is the cheapest intervention that survives contact with a real workflow, because it does not ask you to change how you work. Be clear about its one hard limit, though: it loads inside a model call that has already begun, so it cannot shrink the current call — only the work that follows.",
        whatYouNeed: [
          "Python 3 available locally (the three helper scripts are dependency-free)",
          "Codex or Claude Code — the skill works standalone in either, with no gateway required",
          "Optional: a pre-call gateway if you need the request reduced before the model ever sees it",
        ],
        setupPrompt: `<prompt>
  <task>
    Install and adapt a token-discipline skill called "token-saver" for this harness.
  </task>

  <storage>
    Store it wherever this harness loads skills from, such as
    ~/.claude/skills/token-saver/SKILL.md or ~/.codex/skills/token-saver/SKILL.md.
  </storage>

  <source>
    A ready-made kit is published at /guides/cut-token-waste. If I give you that zip,
    unpack it into the skills directory and adapt it to this machine rather than
    rewriting it. If I do not, build the equivalent from the requirements below.
  </source>

  <job>
    Once loaded, the skill governs how you spend context for the rest of the job. It
    should do the extra work itself and never hand me chores: do not ask me to
    summarize an old chat, pick source files by hand, create a state file, or learn
    script paths.
  </job>

  <requirements>
    <requirement>Try local code before another model for anything with one right answer: counting, sorting, exact text search, field extraction, date normalization, format conversion, file comparison, and output validation.</requirement>
    <requirement>Search a large source and send only the matching passages. Never load a whole transcript, repository, or export because the answer might be inside it. If the selected passages are not enough, pull one more bounded passage instead of falling back to everything.</requirement>
    <requirement>Save the result I accepted, and build the next revision from that result plus my new change — not from the conversation that produced it. Keep exactly one current accepted result, not a growing history. Never promote a result I rejected.</requirement>
    <requirement>Load only the tools this job can use. A job that needs no tools gets none.</requirement>
    <requirement>Use a smaller model only when the complete job wins, counting every call, retry, and human repair. Do not call a model to decide which model to call.</requirement>
    <requirement>Match the answer to the request. If I ask for a sentence, return a sentence. No process diary, no unrequested options.</requirement>
    <requirement>Allow one bounded repair against a failed check. Never retry a token-limit or usage-limit failure — reduce the input instead.</requirement>
    <requirement>State the honest limit in the skill itself: it cannot erase the call it was loaded into, only make the work after it smaller.</requirement>
  </requirements>

  <verification>
    Run one real job with the skill loaded. Report fresh input, reused input, output,
    number of model calls, and retries. Where the harness does not report a number,
    write "unavailable" rather than estimating it.
  </verification>
</prompt>`,
      },
      {
        id: "pdf-document-ingestion",
        title: "PDF / Document Ingestion",
        whatItDoes:
          "Converts PDFs, scans, forms, CSVs, and loose source files into lightweight markdown or tabular artifacts with stable source anchors. The skill treats ingestion as a chain-of-custody step: every paragraph, row, or form field needs a path back to the original file, page, heading, row, or box, using one canonical anchor scheme that downstream citations reuse verbatim.",
        whyBuildIt:
          "Most bureaucratic workflows fail before reasoning starts because the evidence is trapped in documents the agent cannot cite cleanly. Ingestion makes the file system usable: the original stays intact, the converted text is greppable, and every later draft can point back to the source instead of hand-waving.",
        whatYouNeed: [
          "A local folder of source documents",
          "PDF/text conversion tools available to the agent",
          "A chosen output folder convention such as work/<case-id>/ingested",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "pdf-document-ingestion".</task>
  <job>Turn heavy or messy documents into lightweight artifacts with stable source anchors before analysis begins.</job>
  <requirements>
    <requirement>Preserve original files unchanged.</requirement>
    <requirement>Convert PDFs and forms into markdown or structured text.</requirement>
    <requirement>Attach source anchors for page, heading path, row, box, or file location.</requirement>
    <requirement>Choose one canonical anchor convention per case: raw source coordinates such as PDF page and region, CSV line number, or form box label.</requirement>
    <requirement>Embed that identical anchor scheme in the ingested markdown and downstream citations; two numbering schemes in one artifact is a defect because a citation must resolve without a translation table.</requirement>
    <requirement>Write an index listing each converted artifact, source path, document type, and conversion confidence.</requirement>
    <requirement>Never analyze the original heavy file directly when an ingested artifact exists.</requirement>
  </requirements>
  <verification>Run the skill on one sample document and prove that a converted paragraph can be traced back to its source anchor.</verification>
</prompt>`,
      },
      {
        id: "document-chunking-tagging",
        title: "Document Chunking and Tagging",
        whatItDoes:
          "Splits ingested documents into addressable sections and tags each chunk with document type, normalized section label, domain relevance, source anchor, effective date, and content. The skill favors structure-first tagging over vector similarity when the source documents have known sections.",
        whyBuildIt:
          "A good chunk is reusable by any model. A bad chunk is a landmine. Chunking and tagging is the seam that lets healthcare appeals, tax prep, contract review, and grant packets all share the same retrieval discipline while keeping their domain labels separate.",
        whatYouNeed: [
          "Ingested markdown/text artifacts",
          "A domain-specific section-label map",
          "A target store such as SQLite or Open Brain",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "document-chunking-tagging".</task>
  <job>Split ingested documents into addressable chunks and apply normalized metadata.</job>
  <schema>
    <field>chunk_id</field>
    <field>case_id or plan_id</field>
    <field>document_type</field>
    <field>section_label</field>
    <field>domain_tags</field>
    <field>source_anchor</field>
    <field>granularity</field>
    <field>effective_date</field>
    <field>content</field>
  </schema>
  <requirements>
    <requirement>Use headings, form boxes, table rows, and known document structure before semantic guessing.</requirement>
    <requirement>Keep chunks small enough to retrieve directly, but large enough to preserve the clause or table meaning.</requirement>
    <requirement>For long documents, use two-tier granularity: page-level chunks for whole-document citability, plus clause-level chunks for sections named by the retrieval map; record the tier in granularity.</requirement>
    <requirement>Exclude table of contents and front matter pages from evidence chunks; a chunk cited as evidence must contain operative language, not headings or dotted page listings.</requirement>
    <requirement>Flag unclassified sections for review instead of inventing labels.</requirement>
  </requirements>
  <verification>Show a query that pulls one chunk by section_label and returns its source_anchor. Print the text of every chunk a draft cites and read it; a TOC line offered as coverage evidence means the chunking failed.</verification>
</prompt>`,
      },
      {
        id: "case-data-normalization",
        title: "Case Data Normalization",
        whatItDoes:
          "Turns messy facts into a normalized case ledger: dates, parties, amounts, codes, categories, document links, confidence, and review status. It separates extracted facts from inferred classifications so a human can see which fields came from the page and which fields need judgment.",
        whyBuildIt:
          "Scattered facts are how institutions keep the advantage. Once the facts become a ledger, the agent can compare, query, audit, and draft against them. Normalization is the move from a pile of paperwork to a case file.",
        whatYouNeed: [
          "A target case type",
          "Source artifacts with anchors",
          "A schema for records and review flags",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "case-data-normalization".</task>
  <job>Extract messy document facts into a structured, reviewable ledger.</job>
  <requirements>
    <requirement>Define the minimum schema for the current domain before extraction.</requirement>
    <requirement>Store source-backed facts separately from agent classifications.</requirement>
    <requirement>Track confidence and review_status for every normalized record.</requirement>
    <requirement>Preserve evidence links to source chunks, pages, rows, boxes, or files.</requirement>
    <requirement>Run field-level sanity checks against the source: names must look like names, with a street address in a name field as the canonical failure; dates must parse to real absolute dates with days remaining computed for deadlines; and amounts must reconcile against line-item sums.</requirement>
    <requirement>When two documents state the same fact, compare field by field: denial letter CPT code against EOB row, receipt against bank line, and similar duplicate evidence.</requirement>
    <requirement>Represent one real-world event as one record citing all supporting sources; mismatches become needs_review unresolved questions naming which source governs the tracked value.</requirement>
    <requirement>Records that fail sanity checks get review_status needs_review with a concrete unresolved question, never a default pending status.</requirement>
    <requirement>Produce unresolved_questions when required fields are missing or contradictory.</requirement>
  </requirements>
  <verification>Normalize one sample case and show which fields came directly from source evidence.</verification>
</prompt>`,
      },
      {
        id: "sqlite-case-store",
        title: "SQLite Case Store",
        whatItDoes:
          "Creates a local SQLite database for source documents, chunks, normalized records, retrieval mappings, run outputs, and validation results. It is the default starter backend because it is local, inspectable, portable, and enough for one person's case file.",
        whyBuildIt:
          "A case file needs durable structure, not another chat transcript. SQLite gives the workflow a real query surface without creating infrastructure theater. You can inspect it with standard tools, copy it with the repo, and swap it later when the system earns more complexity.",
        whatYouNeed: [
          "SQLite available locally",
          "A schema migration folder",
          "A convention for case IDs and generated work folders",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "sqlite-case-store".</task>
  <job>Stand up a local SQLite store for document-grounded case workflows.</job>
  <requirements>
    <requirement>Create tables for source_documents, chunks, normalized_records, retrieval_mappings, run_outputs, and validation_results.</requirement>
    <requirement>Keep original document paths and source anchors in the database.</requirement>
    <requirement>Provide scripts for migrate, inspect, query-by-section, and export-case.</requirement>
    <requirement>Do not store secrets or real private data in committed fixtures.</requirement>
  </requirements>
  <verification>Run a migration, insert sample chunks, and demonstrate a WHERE section_label query.</verification>
</prompt>`,
      },
      {
        id: "open-brain-case-store",
        title: "Open Brain Case Store",
        whatItDoes:
          "Adapts the same case-file schema to Open Brain for OB1 users who want the normalized records, chunks, and source anchors inside their durable personal context layer instead of a local SQLite file.",
        whyBuildIt:
          "SQLite is the right starter path. Open Brain is the upgrade path for people already running OB1: the same primitives become part of a larger memory and retrieval system instead of staying trapped in one folder.",
        whatYouNeed: [
          "An existing Open Brain / OB1 setup",
          "A project or case namespace",
          "A mapping from starter schema fields to Open Brain primitives",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "open-brain-case-store".</task>
  <job>Map document-grounded case workflows onto Open Brain instead of SQLite.</job>
  <requirements>
    <requirement>Start from the same logical schema used by the SQLite case store.</requirement>
    <requirement>Define where source documents, chunks, normalized records, retrieval mappings, and run outputs live in Open Brain.</requirement>
    <requirement>Preserve source anchors and provenance.</requirement>
    <requirement>Include a migration note for moving a local SQLite starter case into Open Brain.</requirement>
    <requirement>Do not imply Open Brain is required for the beginner path.</requirement>
  </requirements>
  <verification>Write one sample case record and show how it would be queried back by case_id and section_label.</verification>
</prompt>`,
      },
      {
        id: "deterministic-retrieval-map",
        title: "Deterministic Retrieval Map",
        whatItDoes:
          "Builds explicit lookup tables that map a case type to the document sections or record categories that matter. It retrieves by known structure first, then lets the agent reason over a small, cited packet.",
        whyBuildIt:
          "Vector search is not the first move when the documents already have known structure. Deterministic retrieval keeps v1 boring in the best way: denial type to plan sections, expense type to tax categories, clause type to contract sections. The strong model gets the right evidence instead of a haystack.",
        whatYouNeed: [
          "Chunked/tagged documents",
          "A domain mapping table",
          "A query path for the selected store",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "deterministic-retrieval-map".</task>
  <job>Retrieve evidence by explicit case-type to section/category mappings.</job>
  <requirements>
    <requirement>Define the domain case types and the section labels each type requires.</requirement>
    <requirement>Implement retrieval with ordinary queries against tags and labels.</requirement>
    <requirement>Return a compact evidence packet with chunk IDs, source anchors, and content.</requirement>
    <requirement>Flag missing expected sections before drafting starts.</requirement>
    <requirement>Use semantic search only as a later fallback, never as the v1 foundation.</requirement>
  </requirements>
  <verification>Run all case types through the mapping and show the retrieved chunk IDs.</verification>
</prompt>`,
      },
      {
        id: "citation-guard",
        title: "Citation Guard",
        whatItDoes:
          "Checks generated drafts for substantive claims and verifies that each one cites evidence that actually supports it — the cited chunk or record must exist in the case store AND match the claimed amount, date, or language. A citation that resolves but does not support its claim fails. Verdicts are three-state: pass, needs_review, fail.",
        whyBuildIt:
          "The whole promise of context ownership collapses if the final artifact invents around gaps. Citation Guard is the trust layer: claims either point to evidence, ask for confirmation, or get cut.",
        whatYouNeed: [
          "A generated draft",
          "A citation map or source registry",
          "A validation command that can fail the run",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "citation-guard".</task>
  <job>Validate that substantive draft claims are grounded in known evidence.</job>
  <requirements>
    <requirement>Define what counts as a substantive claim for the current domain: amounts, dates, deadlines, coverage or rule statements, and counts.</requirement>
    <requirement>Prescribe ONE machine-checkable citation syntax and show a worked example, e.g. a claim line ending with [record:case-42:expense:adobe_feb] or [chunk:eoc-017].</requirement>
    <requirement>Resolve every citation against the case store; a citation that does not resolve is a fail.</requirement>
    <requirement>Verify support, not just existence: compare the claimed amount, date, or quoted language against the cited record's stored values; a resolvable citation that does not support the claim is a fail.</requirement>
    <requirement>Use three verdicts — pass, needs_review, fail — and write a validation report listing every claim under its verdict. needs_review is for claims whose underlying record is itself flagged for review, not a soft pass for unsupported claims.</requirement>
    <requirement>Save both sides of the verification test as artifacts, and make sure the seeded fabricated sentence itself appears as the failing item in the failure report; a report that fails other claims does not prove the guard works.</requirement>
    <requirement>Exit nonzero when any claim fails, so the guard can gate downstream steps.</requirement>
    <requirement>Allow general disclaimers and process labels without citations only when they are boilerplate from the runbook.</requirement>
  </requirements>
  <verification>Two-sided test: run the guard on a fully-cited draft and prove it PASSES (exit 0); then run it on a copy with one seeded fabricated-but-well-formed citation (a plausible record ID that does not exist) and prove it FAILS (nonzero exit). Save both reports as evidence.</verification>
</prompt>`,
      },
      {
        id: "packet-export",
        title: "Packet Export",
        whatItDoes:
          "Packages the reviewed outputs into an editable folder and PDF: draft letter or summary, citation map, checklist, supporting documents list, source manifest, and any unresolved questions. It keeps editable markdown as the source of truth and treats PDF as the delivery artifact.",
        whyBuildIt:
          "The work is not done when the agent writes a decent draft. The human needs a packet they can inspect, edit, send to a professional, or file manually. Packet export turns agent output into something operational.",
        whatYouNeed: ["Validated markdown outputs", "A source manifest", "A local PDF export path"],
        setupPrompt: `<prompt>
  <task>Create a new skill called "packet-export".</task>
  <job>Turn validated case outputs into an editable packet folder and PDF.</job>
  <requirements>
    <requirement>Refuse to export while the citation guard reports any failing claim; a packet ships only when every claim is pass or needs_review, and the guard's verdict summary appears in the packet README.</requirement>
    <requirement>Keep markdown, JSON, and CSV outputs editable in the packet folder.</requirement>
    <requirement>Create a source manifest with original files and citation anchors.</requirement>
    <requirement>Export through a concrete PDF path: markdown to HTML, then headless Chrome with --print-to-pdf; markdown needs the HTML intermediate.</requirement>
    <requirement>Warn that headless Chrome can keep the process alive about 2 minutes after the PDF is written; verify the file appears on disk instead of trusting exit status, and use --disable-background-networking or a poll-then-kill wrapper.</requirement>
    <requirement>Produce one combined rendered PDF for handoff while keeping the individual drafts editable in the packet folder.</requirement>
    <requirement>Show the expected folder shape, for example packet/: draft.md, packet.pdf, citation-map.json, checklist.md, unresolved-questions.md, sources/.</requirement>
    <requirement>Include unresolved questions and missing documents instead of hiding them.</requirement>
    <requirement>Never transmit, submit, sign, file, or send the packet.</requirement>
  </requirements>
  <verification>Export a sample packet, open the PDF, confirm the page count is sane (single or low double digits for one case), and confirm tables render with no raw markdown artifacts.</verification>
</prompt>`,
      },
      {
        id: "human-gate",
        title: "Human Gate",
        whatItDoes:
          "Defines the stop line for high-stakes workflows: the agent may organize, draft, validate, and export, but a human reviews, signs, sends, files, or submits. The skill writes this boundary into the workflow instead of relying on vibes.",
        whyBuildIt:
          "Healthcare, taxes, legal, finance, and identity workflows all have a point where agency matters. The human gate is not a missing automation feature. It is the product boundary that keeps the person in charge and prevents the agent from taking irreversible action with sensitive data.",
        whatYouNeed: [
          "A list of allowed actions",
          "A list of forbidden actions",
          "A review checklist for the handoff",
        ],
        setupPrompt: `<prompt>
  <task>Create a new skill called "human-gate".</task>
  <job>Enforce the review-and-submit boundary in high-stakes agent workflows.</job>
  <requirements>
    <requirement>List what the agent may do: organize, draft, validate, summarize, export.</requirement>
    <requirement>List what the agent must not do: sign, send, file, submit, authorize, pay, or transmit sensitive data.</requirement>
    <requirement>Add an explicit review checklist to every packet.</requirement>
    <requirement>Stop the workflow at export unless the human starts a separate approved sending workflow.</requirement>
    <requirement>Use domain-specific disclaimers without burying the actual next step.</requirement>
  </requirements>
  <verification>Run the skill against a sample packet and show where the workflow stops.</verification>
</prompt>`,
      },
    ],
  },
  {
    id: "research-thinking",
    number: "03",
    title: "Research & Thinking",
    description:
      "Skills for turning messy input into thinking you can review: voice notes, meetings, document piles, weekly noise, and assumptions that need to be challenged before they become plans.",
    skills: [
      {
        id: "brain-dump-processor",
        title: "Brain Dump Processor",
        whatItDoes:
          "Takes messy, multi-topic input — voice memo transcripts, stream-of-consciousness notes, long rambling drafts — and pans for gold: it extracts each distinct idea, separates them cleanly, evaluates which threads are worth pursuing, and files the results. The skill defines the extraction format (idea, context, why it might matter, suggested next step) and a consistent destination so processed ideas accumulate somewhere instead of evaporating.",
        whyBuildIt:
          'Your best ideas arrive mixed with your worst ones, usually while walking. Without a procedure, voice notes get transcribed and never read again. This skill makes the agent the filter: you talk for ten minutes, it hands back five separated ideas with an honest evaluation of each. Paired with the transcription skill, it turns "rambling into your phone" into a legitimate ideation pipeline.',
        whatYouNeed: ["Nothing required; pairs naturally with Media Transcription for voice memos"],
        setupPrompt: `Create a new skill for my AI coding agent called "brain-dump-processor", stored
wherever my harness loads skills from.

The skill's job: process messy multi-topic input — voice memo transcripts, brain
dumps, rambling notes — into cleanly separated, evaluated ideas.

Before writing it, interview me for: where processed ideas should be filed (one inbox
file, a folder of dated notes, or a tool I use), and what I tend to ramble about so
the evaluation criteria fit my work.

The skill must include: (1) trigger conditions — whenever I share a voice transcript,
brain dump, or say "process this"; (2) an extraction format per idea: the idea in one
sentence, surrounding context, an honest assessment of whether it's worth pursuing and
why, and a concrete suggested next step; (3) a rule to separate genuinely distinct
ideas rather than summarizing the whole dump into mush; (4) a rule to flag
contradictions with things I've said before in the same dump; (5) the filing
destination and format.

After writing it, test it on a real note or transcript I give you.`,
      },
      {
        id: "meeting-synthesis",
        title: "Meeting Synthesis",
        whatItDoes:
          "Turns meeting recordings or transcripts into a structured synthesis: key takeaways, decisions made (with who made them), action items (with owners and deadlines where stated), open questions, and reusable context worth keeping beyond the meeting. The skill enforces a separation between what was actually said versus what the agent inferred, so the synthesis stays trustworthy.",
        whyBuildIt:
          "Meeting notes done by hand are either too thin to be useful or too long to be read. An agent with a fixed synthesis format produces the same reliable artifact from every meeting, and the decisions/actions/questions split means the output plugs directly into your task system instead of becoming another unread document.",
        whatYouNeed: [
          "Nothing required; pairs with Media Transcription if you start from recordings",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "meeting-synthesis", stored wherever
my harness loads skills from.

The skill's job: turn a meeting transcript or recording into a structured synthesis I
can act on.

Before writing it, interview me for: where syntheses should be saved, and whether
action items should also go somewhere specific (task tool, file, email draft).

The skill must include: (1) trigger conditions — any meeting transcript, recording, or
"what happened in this meeting" request; (2) a fixed output structure: takeaways,
decisions (with who decided), action items (with owner and deadline where stated),
open questions, and durable context worth keeping; (3) a hard rule separating what was
said from what you inferred — inferences get marked as such; (4) a rule to preserve
exact quotes for anything contentious or commitment-shaped; (5) handling for
multi-topic meetings: synthesize per topic, not chronologically.

After writing it, test it on one real transcript and show me the synthesis.`,
      },
      {
        id: "weekly-signal-diff",
        title: "Weekly Signal Diff",
        whatItDoes:
          "On a recurring basis (weekly is the natural cadence), reviews a defined set of inputs — your notes, a folder, feeds, project state, saved searches — and reports only what meaningfully changed since the last run: new signals, shifted assumptions, dead threads, emerging patterns. The skill keeps a small state file recording what it saw last time, which is what makes a true diff possible instead of a weekly summary that repeats itself.",
        whyBuildIt:
          "The hard part of staying current isn't gathering information, it's noticing change. A diff against last week's state surfaces exactly the delta — what's new, what moved, what quietly died — and ignores the stable background. This is also a gentle introduction to stateful skills: the state file pattern (skill remembers its last run) unlocks a whole class of recurring workflows.",
        whatYouNeed: [
          "A defined set of inputs to watch; pairs well with Current-Information Search for external signals",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "weekly-signal-diff", stored wherever
my harness loads skills from.

The skill's job: when I run it, compare a defined set of inputs against the state from
its last run and report only meaningful changes — new signals, shifted assumptions,
threads that died, patterns emerging.

Before writing it, interview me for: which inputs to watch (folders, notes files,
topics to search, project states), what counts as "meaningful" in my work, and where
the report should go.

The skill must include: (1) a state file the skill maintains, recording what it
observed each run, so diffs are real rather than re-summaries; (2) the input list and
how to check each one; (3) an output format ordered by importance of change, not by
source; (4) a rule that no-change is a valid and short answer — never pad a quiet
week; (5) a closing section suggesting at most three follow-ups based on the diff.

After writing it, do an initial baseline run to populate the state file, and tell me
what you recorded.`,
      },
      {
        id: "assumption-checker",
        title: "Assumption Checker",
        whatItDoes:
          "Audits a plan, argument, or strategy doc for world-model problems: unstated assumptions, missing evidence, internal contradictions, and gaps between what the document claims and what it actually demonstrates. The output is a structured diagnostic — each assumption listed, rated by how load-bearing it is and how well-supported, with the single most dangerous assumption flagged.",
        whyBuildIt:
          'Agents are excellent at making plans sound coherent, which is precisely the danger. A dedicated adversarial pass — run as its own skill with its own posture, not as an afterthought in the same conversation that produced the plan — reliably catches the "we assumed the API does X" and "this only works if users behave like Y" failures before they cost you a week.',
        whatYouNeed: ["Nothing"],
        setupPrompt: `Create a new skill for my AI coding agent called "assumption-checker", stored wherever
my harness loads skills from.

The skill's job: adversarially audit a plan, argument, or strategy document for
unstated assumptions, missing evidence, contradictions, and world-model gaps.

The skill must include: (1) trigger conditions — when I ask you to check, stress-test,
or red-team a plan or document; (2) a posture rule: in this mode you are a skeptic,
not a collaborator — do not soften findings or balance them with praise; (3) an output
format: each assumption stated plainly, rated for how load-bearing it is and how
well-evidenced, with the single most dangerous assumption called out at the top;
(4) a rule to check claims against the actual sources or code when they're available,
not just against internal consistency; (5) a closing section: the three questions that
would most reduce risk if answered.

After writing it, test it on any plan or doc I give you — or on one of your own recent
plans from this session.`,
      },
      {
        id: "reading-pack-builder",
        title: "Reading Pack Builder",
        whatItDoes:
          'Takes a pile of local documents — docs, SOPs, change requests, research notes, review materials — and builds a controlled reading surface: a local HTML reading pack that presents one document at a time, in a deliberate order, with an index and progress tracking. Instead of "here are 14 files, good luck," you get a guided review experience your agent assembled.',
        whyBuildIt:
          "Review is a workflow, not a folder. When you (or a collaborator) actually need to read and sign off on a set of materials, structure matters: order, one-at-a-time focus, and a record of what's been covered. This skill is also a nice demonstration that agent output doesn't have to be text in a chat — it can be a purpose-built interface, generated in seconds.",
        whatYouNeed: ["Nothing; builds on HTML Artifact Builder's conventions if you have it"],
        setupPrompt: `Create a new skill for my AI coding agent called "reading-pack-builder", stored
wherever my harness loads skills from.

The skill's job: given a set of local documents to review, build a self-contained
local HTML reading pack that presents them one at a time in a deliberate order, with
an index page and simple progress tracking.

Before writing it, interview me for: where reading packs should be saved, and my
visual preferences if I don't already have an html-artifact-builder skill to inherit from.

The skill must include: (1) trigger conditions — when I have a pile of documents to
review or ask for a "reading pack"; (2) conversion of each source document to clean
HTML, preserving structure; (3) an index page with one-line summaries and a suggested
reading order with reasoning; (4) one-at-a-time navigation (previous/next) and a
simple read/unread marker stored locally; (5) self-containment — everything works
offline as local files.

After writing it, test it on 3 or more documents I point you to and open the result.`,
      },
    ],
  },
  {
    id: "writing-voice-content",
    number: "04",
    title: "Writing, Voice & Content",
    description:
      "Skills that make agent writing specific: a real voice, a real audience, current facts, branded images, and publishing formats that keep content from sliding back into generic AI prose.",
    skills: [
      {
        id: "personal-voice-skill",
        installName: "personal-voice",
        title: "Personal Voice Skill",
        whatItDoes:
          "Encodes how you actually write — across contexts, not as a single tone preset. The skill captures your voice along multiple registers (direct/instructional, warm/relational, analytical, business-formal), with real samples of each, plus the rules of when to use which: when you're blunt, when you soften, what words and constructions you never use, how your emails differ from your posts. The agent then writes drafts that need light edits instead of rewrites.",
        whyBuildIt:
          'Generic AI prose is the most recognizable writing style on the internet right now, and "write this in a friendly tone" doesn\'t fix it. A voice skill built from your actual writing samples — with explicit anti-patterns ("never open with \'I hope this finds you well\'", "never use \'delve\'") — is the difference between an agent that drafts for you and one that drafts as you. This is consistently one of the highest-leverage skills for anyone who publishes or sends a lot of words.',
        whatYouNeed: [
          "5–10 samples of your real writing across different contexts (emails, posts, docs, messages)",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "personal-voice", stored wherever
my harness loads skills from.

The skill's job: write in my authentic voice across contexts — not a single tone
preset, but a model of how I actually write and when I shift registers.

Before writing it, ask me for 5–10 real writing samples across different contexts
(emails, posts, documentation, casual messages). Then analyze them and propose:
(1) my distinct registers (e.g. directive, relational, analytical, business) with what
distinguishes each; (2) sentence-level patterns I actually use; (3) anti-patterns —
words, openers, and constructions I never use, plus common AI-prose tells to
explicitly avoid; (4) rules for when to use which register based on audience and
stakes. Review your analysis with me before finalizing the skill.

The skill must include: trigger conditions (whenever I ask you to write, rewrite, or
review something in my voice), the register model with one short sample of each, the
anti-pattern list, and a rule that for technical content, accuracy beats voice — never
bend facts to sound like me.

After writing it, test it by drafting one short email and one short post on topics I
give you, and let me grade them.`,
      },
      {
        id: "new-release-briefing",
        installName: "release-briefing",
        title: "New Release Briefing",
        whatItDoes:
          "When something significant ships in your field — a new AI model, a major tool release, a platform change — this skill turns gathered release data into a publish-ready briefing package: a structured summary of what actually changed, an analysis post in your voice, a standardized title/subtitle, and image prompts for a matching thumbnail. It assumes the research happened upstream (via Current-Information Search) and focuses on transforming raw release material into a publishable artifact with a consistent format readers learn to expect.",
        whyBuildIt:
          "Release-day content is a race where accuracy usually loses. A briefing skill encodes your quality bar — primary sources, dated claims, a fixed structure — so speed stops costing correctness. The consistent package format is the compounding part: your tenth briefing looks like your first, and your audience knows exactly what they're getting.",
        whatYouNeed: [
          "Current-Information Search (or equivalent research input)",
          "Personal Voice Skill makes the output dramatically better",
          "Image Generation Gateway for thumbnails",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "release-briefing", stored wherever
my harness loads skills from.

The skill's job: turn gathered release data about a new model, tool, or platform
change into a publish-ready briefing package.

Before writing it, interview me for: where I publish (newsletter, blog, internal
doc), my audience's sophistication level, and my title/format conventions if I have
them.

The skill must include: (1) trigger conditions — when I say "brief me up on <release>"
or hand you release research to package; (2) a fixed package structure: what actually
changed (facts with dates and sources), why it matters for my audience, what to do
about it, a standardized title and subtitle, and 2–3 thumbnail image prompts matched
to the subject's brand colors; (3) a rule that every factual claim carries a date and
source, and unverified claims are labeled as such; (4) if I have a voice skill, write
the post through it; (5) a rule that this skill packages — if the research is missing
or stale, stop and run current-info search first.

After writing it, test it on the most recent significant release in my field.`,
      },
      {
        id: "audience-calibrated-content-system",
        installName: "audience-content-system",
        title: "Audience-Calibrated Content System",
        whatItDoes:
          "Generates content for a specific publication targeting a specific audience level — for example, a beginner-focused newsletter. The skill encodes the publication's content formats (e.g. a quick \"snack,\" a concept explainer, a step-by-step tutorial), the audience's assumed knowledge floor and ceiling, banned jargon with required substitutions, and the weekly cadence. Given a theme, it plans and drafts a full content batch in the right voice at the right level.",
        whyBuildIt:
          'Writing down a sophistication level is much harder than it looks — expertise leaks in as unexplained jargon and skipped steps. Encoding the audience contract once (what they know, what they don\'t, what formats serve them) means every piece starts calibrated instead of needing a "make this simpler" revision pass. For anyone running a publication with a defined audience, this turns content production from artisanal to systematic.',
        whatYouNeed: [
          "A defined publication and audience",
          "Personal Voice Skill if the publication has a named author voice",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "audience-content-system", stored
wherever my harness loads skills from.

The skill's job: generate content for my publication, calibrated precisely to my
audience's level, in my established formats.

Before writing it, interview me for: the publication and its audience (who they are,
what they already know, what they definitely don't), my content formats (e.g. short
tip, concept explainer, tutorial) with length and structure for each, my publishing
cadence, and 2–3 examples of pieces that landed well.

The skill must include: (1) trigger conditions — planning or drafting anything for
this publication; (2) the audience contract: knowledge floor, knowledge ceiling,
banned jargon with plain-language substitutions; (3) a template per content format;
(4) a batch-planning mode: given a theme, propose a full week/cycle of pieces across
formats before drafting; (5) a calibration check before delivering any draft: "would
my least technical reader follow every step?"

After writing it, test it by planning one content batch on a theme I give you and
drafting the shortest piece from the plan.`,
      },
      {
        id: "branded-image-prompting-guide",
        installName: "branded-image-prompting",
        title: "Branded Image Prompting Guide",
        whatItDoes:
          "A complete prompting guide for generating images in your visual brand — your colors, typography direction, composition style, and recurring formats (thumbnails, infographics, diagrams, photoreal scenes, UI mockups). It includes brand guidelines the agent applies automatically, techniques for both natural-language and JSON-structured prompting on current image models, a library of proven prompt templates for your common formats, and corrective prompting recipes for when models drift off-brand.",
        whyBuildIt:
          'Image models can hold a brand — but only if the brand is written down in prompt-shaped form. Without this skill, every image is a fresh negotiation and your visual output looks like ten different people made it. With it, "make me a thumbnail about X" returns something on-brand on the first try, and the prompt library compounds: every prompt that works gets added.',
        whatYouNeed: [
          "Image Generation Gateway (or any image model access)",
          "Your brand basics (colors, type direction, visual references)",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "branded-image-prompting", stored
wherever my harness loads skills from.

The skill's job: generate on-brand images by encoding my visual identity as prompting
guidance plus a reusable prompt library.

Before writing it, interview me for: my brand colors (hex), typography direction,
overall visual style (with reference images if I have them), and my most common image
formats (thumbnails, diagrams, infographics, social images, mockups).

The skill must include: (1) trigger conditions — any branded or recurring-format image
request; (2) brand guidelines in prompt-ready language the agent applies by default;
(3) both natural-language and JSON-structured prompt patterns for current image
models, with notes on when each works better; (4) a starter library of 10+ prompt
templates covering my common formats; (5) corrective prompting recipes for typical
drift (wrong colors, mangled text, off-style); (6) a rule to route actual generation
through my image-gateway skill and add successful prompts back to the library.

After writing it, test it by generating one thumbnail and one diagram in my brand and
let me judge them.`,
      },
    ],
  },
  {
    id: "web-publishing-frontend",
    number: "05",
    title: "Web Publishing & Frontend",
    description:
      "Skills for turning agent output into public, inspectable web work: better frontend taste, clean publishing, share previews, comparison pages, and verification before anything is called shipped.",
    skills: [
      {
        id: "frontend-taste-system",
        installName: "frontend-taste",
        title: "Frontend Taste System",
        whatItDoes:
          "Replaces your agent's default frontend instincts with a much stronger taste system: deliberate layout variance instead of the same hero-and-three-cards page, stricter component decisions, real typography, restrained color, and mandatory visual verification (screenshot, inspect, fix, repeat) before any frontend work is called done. Structurally, it's a bundle — a core skill with nested sub-skills for specific directions (minimalist editorial UI, data-dense dashboard UI, premium landing pages, mobile app concepts, redesigning existing projects) the agent loads as relevant.",
        whyBuildIt:
          "Agent-generated frontend has a recognizable look — and it isn't a compliment. The fix isn't \"make it prettier\" in the moment; it's a standing taste system the agent applies to every frontend task. The nested-bundle structure also teaches a key skill-architecture pattern: a core philosophy skill that routes to specialized sub-skills, instead of one unloadable mega-document.",
        whatYouNeed: [
          "Nothing required; a screenshot-capable browser tool (most harnesses have one) for visual verification",
        ],
        setupPrompt: `Create a new skill bundle for my AI coding agent called "frontend-taste", stored
wherever my harness loads skills from.

The job: replace your default frontend design instincts with a stronger taste system
that applies to all websites, apps, landing pages, and UI work.

Structure it as a core skill plus nested sub-skills. The core skill must include:
(1) trigger conditions — all frontend design and implementation work; (2) layout
rules: deliberate variance, no default hero-plus-three-cards pattern, real grids,
generous whitespace used intentionally; (3) typography rules: a real type scale,
restrained pairings, no default-stack sloppiness; (4) color rules: restrained
palettes, one accent doing real work, no purple-gradient-on-white clichés;
(5) mandatory visual verification: screenshot the result, inspect it critically, fix
what's weak, repeat before calling it done.

Create nested sub-skills for: minimalist/editorial UI, data-dense dashboard UI,
premium marketing/landing pages, and redesigning existing projects without breaking
them. The core skill routes to these based on the task.

Interview me first for my taste references — 2–3 sites or apps whose design I admire
and why. After writing the bundle, test it by building one landing page section and
running your own visual verification loop on it.`,
      },
      {
        id: "personal-site-publisher",
        installName: "site-publisher",
        title: "Personal Site Publisher",
        whatItDoes:
          'Publishes a finished page to your personal or company website as a real, share-ready URL — handling everything that separates "an HTML file" from "a published page": the design language, a clean slug and URL route, a page-specific Open Graph preview image (1200×630) so links unfurl properly, share title and description, indexing controls (public vs. unlisted), local verification before deploy, and the deploy itself. The skill encodes your site\'s stack and conventions so publishing is a procedure, not a project.',
        whyBuildIt:
          'The gap between "the agent made a great page" and "that page is live at a clean URL with a proper link preview" is where most agent web output stalls. Encoding the full publish path once — including the unglamorous parts like OG images and noindex flags — means anything your agent produces is one sentence away from shippable. This skill is the final step of half the runbooks in this library.',
        whatYouNeed: [
          "A website you control with a deploy path your agent can run (static site, framework site, or hosting CLI)",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "site-publisher", stored wherever my
harness loads skills from.

The skill's job: take a finished page or artifact and publish it to my website as a
real shareable URL, end to end.

Before writing it, explore my website repo and interview me for: the repo path and
stack, how routes/pages are added, my deploy command and any verification steps, my
design language (or which existing pages to match), and my default indexing preference
for one-off share pages (public vs. unlisted).

The skill must include: (1) trigger conditions — ONLY when I explicitly ask to
publish/ship/put something on the site, never auto-triggered; (2) the full procedure:
clean slug, page creation matching site conventions, a page-specific 1200x630 Open
Graph image (route generation through my image-gateway skill if I have one), share
title and description, indexing controls; (3) local verification before deploy — build
and view the page; (4) the deploy procedure; (5) post-publish checks: live URL loads,
OG preview renders correctly.

After writing it, test it by publishing one unlisted test page end to end, then walk
me through cleaning it up or keeping it.`,
      },
      {
        id: "image-model-comparison-arena",
        installName: "image-model-arena",
        title: "Image Model Comparison Arena",
        whatItDoes:
          "Builds and publishes comparison test pages for image-generation models: each model gets its own review page (same prompts, that model's outputs, cost and behavior notes), and all models share a side-by-side comparison viewer — all generated from a single config file. Adding a new model means adding a config entry and re-running; the skill handles generation, image optimization, page builds, and publishing. It maintains a registry of model costs and content-policy quirks discovered along the way.",
        whyBuildIt:
          "Beyond its direct use (genuinely useful model comparisons), this skill is the library's best example of composition as architecture: it doesn't generate images (it calls Image Generation Gateway) and it doesn't publish (it calls Personal Site Publisher). It owns exactly one thing — the comparison methodology and page generation — and delegates the rest. When a new image model drops, you can have a published, evidence-based comparison the same afternoon.",
        whatYouNeed: [
          "Image Generation Gateway and Personal Site Publisher built first",
          "Budget for generation costs (typically a few dollars per model)",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "image-model-arena", stored wherever
my harness loads skills from.

The skill's job: build and publish image-model comparison pages — one review page per
model plus a shared side-by-side viewer — generated from a single config.

This skill COMPOSES two skills I already have: image generation goes through my
image-gateway skill, and publishing goes through my site-publisher skill. It must
never reimplement either.

Before writing it, interview me for: my standard test prompt set (help me design 6–10
prompts covering photorealism, text rendering, diagrams, people, and style range), and
where comparison configs and generated images should live.

The skill must include: (1) trigger conditions — when I want to test a new image
model, compare models, or add a model to an existing comparison; (2) a single config
format defining models, prompts, and page metadata; (3) the pipeline: generate via
image-gateway, optimize images for web, build per-model pages and the shared
comparison viewer, publish via site-publisher; (4) a model registry tracking per-image
cost and content-policy quirks observed; (5) regeneration support — adding one model
must not require redoing the others.

After writing it, test it with two models on a 3-prompt subset before running anything
at full scale.`,
      },
      {
        id: "essay-illustration-gallery",
        title: "Essay Illustration Gallery",
        whatItDoes:
          "Takes a finished essay or long post and produces a complete illustration package: the agent reads the piece, selects ~15–20 image-worthy moments across the essay's full arc (not just the obvious opener), locks a single illustration style so every frame is visually consistent, generates the images, writes a short \"why this moment\" caption per frame, and assembles everything into a gallery page — plus a ready-to-paste social note announcing it in the author's voice.",
        whyBuildIt:
          "The hard part of illustrating an essay isn't generating images — it's editorial judgment (which moments deserve images) and consistency (twenty images that look like one artist made them). This skill encodes both. It's also a great study in multi-skill composition packaged as one skill: analysis, style-locking, generation, captioning, gallery assembly, and publishing in a single repeatable pipeline.",
        whatYouNeed: [
          "Image Generation Gateway",
          "Personal Site Publisher if you want the gallery published",
          "Personal Voice Skill for the social note",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "essay-illustration-gallery", stored
wherever my harness loads skills from.

The skill's job: turn a finished essay into a consistent illustration gallery —
selecting the moments, locking one style, generating the images, captioning each, and
assembling a gallery page.

This skill composes my image-gateway skill for generation and my site-publisher skill
for publishing (if I ask for the gallery to go live).

Before writing it, interview me for: my preferred illustration style direction (e.g.
hand-drawn editorial cartoon, photoreal, watercolor — help me write a precise style
descriptor we lock per gallery), and how many frames a typical essay should get.

The skill must include: (1) trigger conditions — when I share an essay and ask for
illustrations, images, or a gallery; (2) moment selection: choose frames across the
FULL arc of the piece, each tied to a specific passage, with a one-line rationale;
(3) style lock: one detailed style descriptor prepended to every prompt so all frames
match; (4) per-frame captions explaining why that moment was chosen; (5) gallery
assembly as a single page (use my html-artifact-builder conventions); (6) a short
ready-to-paste social note announcing the gallery, in my voice if I have a voice
skill.

After writing it, test it on one essay with a reduced frame count (5–6 frames) first.`,
      },
    ],
  },
  {
    id: "video-media-production",
    number: "06",
    title: "Video & Media Production",
    description:
      "Skills for the expensive parts of media work: transcript-first editing, motion graphics, timeline assembly, and NLE control. Build these after the simpler media primitives are working.",
    skills: [
      {
        id: "radio-edit",
        title: "Radio Edit",
        whatItDoes:
          "Creates a transcript-driven \"radio edit\" — a rough cut where the spoken narrative is fixed before any visuals are touched. Working from a timestamped transcript, the agent identifies false starts, repeated takes, filler, tangents, and flubbed lines; chooses the best take of each repeated section; and produces both a human-reviewable paper edit (what's kept, what's cut, why) and a timeline file (FCXML/EDL) your editing software imports directly, with all cuts already placed.",
        whyBuildIt:
          "The first hours of editing talking-head footage are mechanical: find the good takes, cut the failures, tighten the flow. That's exactly the work a transcript-literate agent does well — and the paper edit means you review its editorial choices before opening your editing app. Going from raw recording to a cuts-placed timeline without scrubbing footage by hand changes the economics of producing video.",
        whatYouNeed: [
          "Media Transcription (word-level timestamps are essential)",
          "An NLE that imports FCXML or EDL (DaVinci Resolve, Premiere, Final Cut)",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "radio-edit", stored wherever my
harness loads skills from.

The skill's job: produce a transcript-driven rough cut of talking-head footage — fix
the spoken flow first, before any visual work.

This depends on my media-transcription skill: input is a video plus its word-level
timestamped transcript.

Before writing it, interview me for: my editing software (for the right timeline
format — FCXML or EDL), how aggressive cuts should be by default (tight vs.
conversational), and whether anything must always be cut (profanity, specific
phrases, names).

The skill must include: (1) trigger conditions — when I ask for a rough cut, paper
edit, or cleaned-up edit of a recording; (2) edit-decision rules: detect false starts,
repeated takes (keep the best, with reasoning), filler, dead air, and tangents;
(3) a paper edit document for my review: every cut with timecodes, what was removed,
and why — delivered BEFORE the timeline file; (4) timeline export in my NLE's format
with cuts placed, including a small handle of frames on each cut for finesse;
(5) a revision loop: I mark up the paper edit, you regenerate the timeline.

After writing it, test it on a short recording (under 5 minutes) end to end, including
importing the timeline into my editor.`,
      },
      {
        id: "broll-pipeline",
        title: "B-Roll Pipeline",
        whatItDoes:
          "An end-to-end automated pipeline that turns a finished talking-head video into one with animated motion graphics: the transcript is analyzed by a scout agent that selects the moments deserving a graphic (applying density and spacing rules so the video isn't wallpapered), a builder agent generates animated graphic components in code (Remotion — React-based video — is the proven stack) against a strict shared visual contract so every graphic matches, the clips are rendered, and everything is composited onto the source video at the right timestamps, with platform-appropriate titling. One skill orchestrates the whole flow and tracks pipeline state so a multi-hour job can resume after interruption.",
        whyBuildIt:
          "This is the most complicated skill in the library and the strongest proof of the skills thesis: motion graphics work that costs an editor days happens in a supervised pipeline run. It teaches three advanced patterns at once — subagent decomposition (scout selects, builder builds; neither does the other's job), contract-first generation (the shared visual API is what keeps fifty generated graphics consistent), and resumable state (long pipelines must survive interruption). Build the earlier media skills first; build this when you're ready for the payoff.",
        whatYouNeed: [
          "Media Transcription",
          "Node.js with Remotion",
          "ffmpeg for compositing",
          "Real patience for the initial build — this one is a project, and worth it",
        ],
        setupPrompt: `Create a skill (plus two subagents) for my AI coding agent called "broll-pipeline",
stored wherever my harness loads skills from.

The job: an end-to-end pipeline that takes a finished talking-head video plus its
timestamped transcript and produces animated motion-graphic overlays composited onto
the video at the right moments.

Architecture — three pieces:
1. A SCOUT subagent: reads the chaptered transcript and selects which moments deserve
   a graphic, enforcing density and spacing rules (a target of graphics-per-minute and
   a minimum gap between them), and writes a manifest: timestamp in/out, concept, and
   the data or text each graphic should show.
2. A BUILDER subagent: takes 2–3 manifest entries at a time and generates Remotion
   (React video) components for them against a SHARED VISUAL CONTRACT — one TypeScript
   file defining the palette, typography, animation primitives, and layout components
   every graphic must use. The contract is what keeps all graphics consistent.
3. The ORCHESTRATOR skill: runs scout → builder batches → render each clip → composite
   clips onto the source video at manifest timestamps with ffmpeg → final output. It
   keeps a pipeline state file so a long run can resume from any stage after
   interruption.

Before building, interview me for: my brand palette and typography for the visual
contract, my target graphic density, and output specs (resolution, platforms).

Build it in stages and verify each before moving on: contract first, then one
hand-written reference graphic we approve together, then the scout, then the builder
(validated against the contract), then rendering and compositing. Test the full
pipeline on a short video (2–3 minutes) before any real footage.`,
      },
      {
        id: "ai-editing-assistant",
        installName: "nle-assistant",
        title: "AI Editing Assistant (NLE Integration)",
        whatItDoes:
          "Connects your agent directly to your video editing software (DaVinci Resolve is the proven target — it has a Python scripting API) so the agent operates inside the editor: analyzing transcripts, removing silences, extracting subclips, making editorial decisions, and building timelines programmatically in your real project rather than handing you files to import. Where Radio Edit produces a timeline file, this skill manipulates the editor live.",
        whyBuildIt:
          'This is the deepest level of media automation — agent as editing assistant rather than file generator. "Cut the silences out of this interview," "pull every clip where she mentions pricing," "build a rough timeline of the best moments" become sentences you say instead of sessions you spend. It also teaches the general pattern of driving any scriptable desktop application from an agent, which extends far beyond video.',
        whatYouNeed: [
          "DaVinci Resolve (free version includes the scripting API) or another scriptable NLE",
          "Media Transcription",
          "Comfort letting an agent operate real software (the skill must work on duplicated timelines, never originals)",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "nle-assistant", stored wherever my
harness loads skills from.

The skill's job: operate my video editing software directly through its scripting API
to do transcript-driven editing — silence removal, subclip extraction, and timeline
building — inside my real projects.

Before writing it, check what's available: I use DaVinci Resolve (its Python scripting
API ships with the app). Verify you can connect to a running instance and read a
project before building anything else.

The skill must include: (1) trigger conditions — editing requests that should happen
inside the editor: remove silences, extract clips matching a description, build a
rough timeline from footage; (2) the connection procedure and its failure modes (app
not running, project not open); (3) a hard safety rule: ALWAYS duplicate the timeline
and work on the copy — never modify an original timeline or delete media; (4) core
operations, each verified individually: import media, read/mark clips, cut at
timecodes, assemble timelines from a transcript-derived edit list; (5) integration
with my media-transcription skill so transcripts drive the edits.

After writing it, test against a throwaway project: duplicate a timeline, remove
silences from one clip, and show me the result in the app before touching anything
real.`,
      },
    ],
  },
  {
    id: "testing-quality",
    number: "07",
    title: "Testing & Quality",
    description:
      "Skills that make agent-built work trustworthy: repeatable QA, browser evidence, repo-local testing memory, and the habit of leaving verification knowledge where the next session can use it.",
    skills: [
      {
        id: "testing-runbook-creator",
        title: "Testing Runbook Creator",
        whatItDoes:
          "Enforces one rule: testing discoveries must not die in chat. Whenever your agent tests, QAs, smoke-tests, or verifies anything in a repo, this skill makes it leave behind a repo-local runbook entry — how to test that page or workflow, which actions are safe vs. destructive, setup and seed data requirements, cleanup steps, and the exact verification commands. The runbook lives in the repo, accumulates over time, and every future agent session reads it before re-testing.",
        whyBuildIt:
          "Without this, every agent session rediscovers your app from scratch — which test account, which route, which actions are safe — and the discoveries evaporate when the session ends. With it, testing knowledge compounds: session twenty inherits everything sessions one through nineteen learned. This is the single highest-leverage habit-skill in the library, and the purest expression of the principle that agent work should leave durable artifacts.",
        whatYouNeed: ["Nothing. Works in any repo from day one."],
        setupPrompt: `Create a new skill for my AI coding agent called "testing-runbook-creator", stored
wherever my harness loads skills from.

The skill's job: whenever you test, verify, smoke-test, QA, or debug anything in a
repo, capture what you learned as a repo-local runbook entry so future sessions don't
rediscover it.

The skill must include: (1) trigger conditions — ANY testing or verification activity
in a repo, not just when I say "runbook"; (2) a standard runbook location (suggest
docs/testing-runbook.md or similar) and entry format: the page/workflow/feature, how
to test it step by step, safe actions vs. destructive actions, setup/seed
requirements, cleanup steps, and exact verification commands with expected output;
(3) a read-first rule: before testing anything, check whether the runbook already
covers it and follow the existing recipe; (4) an update rule: when reality differs
from the runbook, fix the runbook in the same session; (5) a rule to record
discoveries as you go, not as an end-of-session afterthought.

After writing it, test it by smoke-testing one workflow in a project I point you to
and showing me the runbook entry it produces.`,
      },
      {
        id: "page-testing-memory",
        title: "Page Testing Memory",
        whatItDoes:
          "The architectural partner to Testing Runbook Creator, encoding a specific split: the global skill teaches the page-QA process (how to approach testing any web page — routes, states, forms, auth, responsive checks), while page-specific facts — selectors, test accounts, magic URLs, cleanup quirks — belong in repo-local runbooks. The skill teaches your agent which knowledge goes where, keeping global skills lean and portable while repo knowledge stays with the repo.",
        whyBuildIt:
          "The most common failure mode in a growing skill library is global skills bloated with project specifics — selectors from one client's app baked into a skill that loads in every session. This skill is the antidote, and the global-process/local-facts split it teaches generalizes to your whole library. It's a skill about how to structure skills, disguised as a QA skill.",
        whatYouNeed: ["Testing Runbook Creator (they're designed as a pair)"],
        setupPrompt: `Create a new skill for my AI coding agent called "page-testing-memory", stored
wherever my harness loads skills from. It partners with my testing-runbook-creator
skill.

The skill's job: teach the general page-QA process globally, while keeping all
page-specific knowledge in repo-local runbooks — never in this skill.

The skill must include: (1) trigger conditions — QA or verification of any web page or
UI; (2) the general process: identify the page's states (empty, loaded, error,
loading), test forms with valid/invalid/edge input, verify auth boundaries, check
responsive behavior at standard breakpoints, capture screenshots as evidence; (3) the
knowledge split, stated explicitly: process lives here; selectors, routes, test
accounts, seed data, and cleanup quirks live in the repo's testing runbook; (4) a rule
that when you learn a page-specific fact during QA, it goes into the repo runbook
immediately — and if you find yourself wanting to add a project detail to THIS skill,
that's the signal it belongs in the repo instead.

After writing it, test it by QAing one page in a project I choose, and show me both
the QA findings and what got written to the repo runbook.`,
      },
      {
        id: "browser-automation-qa",
        installName: "browser-qa",
        title: "Browser Automation QA",
        whatItDoes:
          'Professional-grade web testing through browser automation (the Chrome DevTools Protocol, exposed to agents via MCP, is the proven route): performance traces and Core Web Vitals measurement (LCP, INP, CLS), network request monitoring, console error capture, device emulation for responsive testing, accessibility checks, and scripted multi-page workflows — with screenshots and metrics as evidence. The skill encodes which checks to run for which kind of change, and what "passing" means for your projects.',
        whyBuildIt:
          '"It looks fine" is not verification. This skill upgrades your agent from eyeballing pages to measuring them — and because it produces evidence (metrics, screenshots, console output), you can trust a report without re-checking it yourself. Combined with the two skills above, it completes a QA stack: process (Page Testing Memory), institutional memory (Testing Runbook Creator), and instrumentation (this).',
        whatYouNeed: [
          "Chrome plus a DevTools MCP server connected to your harness (your agent can set this up — that's step one of the prompt)",
        ],
        setupPrompt: `Set up browser automation QA for my AI coding agent, then create a skill called
"browser-qa" that uses it, stored wherever my harness loads skills from.

Step 1: Set up a Chrome DevTools MCP server for my harness so you can drive a real
browser — navigate, screenshot, read console and network activity, run performance
traces, and emulate devices. Walk me through any installation steps you can't do
yourself, and verify the connection works before writing the skill.

Step 2: The skill must include: (1) trigger conditions — when I ask to verify a web
change, check performance, audit a page, or test responsive behavior; (2) check
recipes by change type: layout changes get screenshots at desktop/tablet/mobile
breakpoints; performance-relevant changes get a trace with Core Web Vitals (LCP, INP,
CLS) against stated thresholds; new features get console-error and failed-request
checks during a scripted walkthrough; (3) an evidence rule: every finding ships with
its screenshot, metric, or log excerpt — no unevidenced "looks fine"; (4) a standard
short report format: what was checked, what passed with evidence, what failed with
reproduction steps; (5) integration: findings about how to test a page get written to
the repo's testing runbook per my testing-runbook-creator skill.

After writing it, test it by auditing one live page of mine and showing me the report.`,
      },
    ],
  },
  {
    id: "agent-operations",
    number: "08",
    title: "Agent Operations",
    description:
      "Meta-skills for running agents without becoming the bottleneck: goal prompts, visible delegation, operating maps, merge discipline, stakeholder updates, and skill-library compounding.",
    skills: [
      {
        id: "goal-prompt-generator",
        title: "Goal Prompt Generator",
        whatItDoes:
          "Transforms a fuzzy implementation plan into a bounded, autonomous objective for an agent: a goal prompt with an explicit definition of done, repo constraints (what may be touched, what must not be), verification gates the agent must pass before claiming completion, and stop conditions for when to halt and ask rather than improvise. The output is a prompt you hand to a fresh agent session — or a different agent entirely — that can be pursued without supervision and checked cleanly afterward.",
        whyBuildIt:
          'The difference between an agent that works autonomously and one that wanders is almost entirely in how the objective is specified. "Definition of done + constraints + verification gates" is the specification pattern that works, and this skill makes producing it a procedure instead of an art. It\'s also the natural bridge between agents: one agent plans, this skill packages, another agent executes.',
        whatYouNeed: ["Nothing"],
        setupPrompt: `Create a new skill for my AI coding agent called "goal-prompt-generator", stored
wherever my harness loads skills from.

The skill's job: turn an implementation plan or task description into a bounded goal
prompt another agent session can pursue autonomously and be checked against.

The skill must include: (1) trigger conditions — when I ask you to package work for
another session, write a goal prompt, or prepare a task for autonomous execution;
(2) a required structure for every goal prompt: the objective in one paragraph; an
explicit DEFINITION OF DONE as a checklist of verifiable statements; repo constraints
(files/areas that may be modified, files/areas that must NOT be touched); verification
gates — the exact commands to run and expected results before claiming completion; and
stop conditions — situations where the agent must halt and ask instead of improvising;
(3) a self-containment rule: the receiving session has none of our conversation
context, so the prompt must include exact paths and all needed background; (4) a
quality check before delivering: "could a competent agent with zero context execute
this and could I verify the result without re-deriving the plan?"

After writing it, test it by packaging the next real task I describe into a goal
prompt.`,
      },
      {
        id: "visible-delegation",
        title: "Visible Delegation",
        whatItDoes:
          "Lets one agent orchestrate another while keeping the delegated work visible — running the delegate in a shared terminal session (tmux is the proven mechanism) instead of a hidden background process, so you can watch, interrupt, and course-correct in real time. The skill covers launching the delegate with a packaged goal prompt, monitoring its progress, when the orchestrator should intervene versus wait, and how results get verified on the way back.",
        whyBuildIt:
          "Multi-agent setups usually fail on supervision: hidden background agents drift for twenty minutes before anyone notices. Keeping delegation observable preserves the leverage of parallel agents without surrendering oversight — and watching how a delegated session goes wrong is also how you learn to write better goal prompts. Pairs directly with Goal Prompt Generator: one packages the work, this runs and supervises it.",
        whatYouNeed: ["tmux (or equivalent)", "Two agent harnesses or two sessions of one"],
        setupPrompt: `Create a new skill for my AI coding agent called "visible-delegation", stored wherever
my harness loads skills from.

The skill's job: delegate work to another agent session while keeping it visible and
supervisable — shared terminal sessions, never hidden background runs.

Before writing it, check that tmux is installed (install it if not) and confirm which
agent CLI(s) I use for delegate sessions.

The skill must include: (1) trigger conditions — when I ask you to delegate, run
something in parallel, or hand work to another agent; (2) the launch procedure: create
a named tmux session, start the delegate agent in it, and pass a goal prompt (built
with my goal-prompt-generator skill if available) — then tell me how to attach and
watch; (3) monitoring rules: check the session at sensible intervals, and define what
warrants intervention (stuck loops, scope drift, destructive commands) versus patience;
(4) a results protocol: when the delegate claims completion, run the verification
gates from the goal prompt yourself before reporting success to me; (5) cleanup —
sessions get closed, not abandoned.

After writing it, test it by delegating one small real task end to end while I watch.`,
      },
      {
        id: "session-operating-map",
        title: "Session Operating Map",
        whatItDoes:
          "Sets up and maintains a per-project map of your parallel agent sessions: which session/thread owns which lane of work, naming conventions so lanes are identifiable at a glance, where coordination state lives (a small repo-local map file), how blockers between lanes get recorded, and rules for archiving finished lanes and promoting durable lessons into the project's docs or skills. It's the answer to \"which conversation was that in?\"",
        whyBuildIt:
          "Past two or three concurrent sessions on a project, you become the bottleneck — re-explaining state, losing decisions in closed threads, duplicating work across lanes. A repo-local operating map externalizes that coordination so any session (or any future you) can read what's in flight, what's blocked, and what's been decided. This is project management for agent work, kept lightweight enough to actually maintain.",
        whatYouNeed: ["Nothing; matters once you run multiple concurrent sessions per project"],
        setupPrompt: `Create a new skill for my AI coding agent called "session-operating-map", stored
wherever my harness loads skills from.

The skill's job: set up and maintain a repo-local operating map for projects where I
run multiple agent sessions in parallel — which lane owns what, current state,
blockers, and decisions.

The skill must include: (1) trigger conditions — when I start parallel workstreams in
a project, ask "what's in flight," or ask you to set up coordination for a repo;
(2) the map file: a single repo-local doc (suggest docs/operating-map.md) listing each
lane with a short name, its objective, owning session, current state, and blockers;
(3) lane discipline: one lane per concern, named so its purpose is obvious; (4) update
rules: a lane's entry gets updated when its state meaningfully changes — start, block,
handoff, done — not as a journal; (5) archive rules: finished lanes move to a done
section with a one-line outcome, and lessons worth keeping get promoted into the
project's docs or skills rather than dying with the lane; (6) a read-first rule: any
session joining the project reads the map before starting work.

After writing it, set up the map for my current project and populate it with what's
actually in flight.`,
      },
      {
        id: "self-authored-pr-merge",
        installName: "self-pr-merge",
        title: "Self-Authored PR Merge",
        whatItDoes:
          "A clean workflow for reviewing and merging pull requests you authored yourself — the daily reality of solo developers and agent-heavy workflows, which GitHub's approval model doesn't really accommodate (you can't approve your own PR). The skill runs a genuine self-review pass (diff inspection with fresh eyes, not a rubber stamp), checks CI status and mergeability, handles the merge with the right strategy, and finishes with branch and worktree-safe cleanup.",
        whyBuildIt:
          "Solo shipping needs more review discipline, not less — nobody else is going to catch the bug. Encoding the review-check-merge-cleanup sequence as a skill means it happens the same way every time, including the steps that get skipped when you're moving fast (actually reading the diff; actually deleting the branch). It also handles the practical GitHub friction honestly instead of pretending the approval model works differently than it does.",
        whatYouNeed: ["The GitHub CLI (gh) authenticated"],
        setupPrompt: `Create a new skill for my AI coding agent called "self-pr-merge", stored wherever my
harness loads skills from.

The skill's job: review and merge pull requests I authored myself, with real review
discipline despite GitHub not allowing self-approval.

Before writing it, confirm the gh CLI is authenticated and ask me for my merge
strategy preference (squash, merge, rebase) and my branch cleanup preference.

The skill must include: (1) trigger conditions — when I ask to merge my own PR or
review-and-merge something I wrote; (2) a genuine review pass FIRST: read the full
diff with fresh eyes, list anything questionable (bugs, debug leftovers, missing
tests, scope creep) and show me findings before merging — finding nothing must be a
conclusion, never a default; (3) pre-merge checks: CI status, mergeability, conflicts,
and an honest note about the self-approval limitation rather than working around it;
(4) the merge with my preferred strategy; (5) cleanup: delete the remote branch per my
preference, and if local worktrees are involved, use worktree-safe removal — never
plain branch deletion under a worktree; (6) a stop rule: any failing check or
unresolved review finding halts the merge and comes back to me.

After writing it, test it on my next real PR.`,
      },
      {
        id: "stakeholder-update-email",
        title: "Stakeholder Update Email",
        whatItDoes:
          "After work ships, sends (or drafts) a short, truthful update email to the person who needs to know — a client, a producer, a collaborator, your team. The skill encodes the discipline: updates go out only when something stakeholder-visible actually changed; the email describes shipped behavior in the recipient's vocabulary, not implementation details; nothing unverified gets called done; the format stays consistent (what changed, what it means for you, what's next); and you're CC'd or shown a draft first, per your preference.",
        whyBuildIt:
          "Communication is the half of client and team work that agent workflows usually drop. The skill's real content isn't email mechanics — it's the rules: only when shipped, only what's true, only in their language. A consistent, honest update cadence after real changes builds more trust than any amount of polish, and making it a skill means it actually happens instead of being the thing you'll do after lunch.",
        whatYouNeed: [
          "An email path your agent can use — a sending API like Resend, your mail provider's API, or just draft-for-you mode (no setup at all)",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "stakeholder-update-email", stored
wherever my harness loads skills from.

The skill's job: after work ships with stakeholder-visible impact, send or draft a
short, truthful update email to the right person.

Before writing it, interview me for: who my recurring stakeholders are and what each
cares about, whether you should send directly (and through what — e.g. a Resend API
key in an env file) or always draft for my review, and whether I should be CC'd on
sends.

The skill must include: (1) trigger conditions — when work merges or ships with
visible impact for a stakeholder, or when I ask for an update email; (2) a gate: if
nothing stakeholder-visible changed, say so and send nothing; (3) writing rules:
describe shipped behavior in the recipient's vocabulary, not implementation detail;
never call anything done that wasn't verified; if something shipped partially, say
which part; (4) a consistent short format: what changed, what it means for them,
what's next; (5) the send/draft mechanics per my preference, with send requiring my
explicit confirmation.

After writing it, test it by drafting an update for the most recent thing I shipped.`,
      },
      {
        id: "session-to-skill-extractor",
        title: "Session-to-Skill Extractor",
        whatItDoes:
          "A continuous-learning loop for your skill library: at the end of substantial work sessions, this skill reviews what happened and asks whether any pattern is worth preserving — a workflow you'd repeat, a hard-won API discovery, a debugging path, a decision procedure. When a pattern clears the bar (recurring, non-obvious, codifiable), it drafts the new skill or updates an existing one, then files it for your review. Your library grows out of your actual work instead of requiring dedicated authoring time.",
        whyBuildIt:
          "Every skill in this library started as a session where someone solved a problem and refused to let the solution evaporate. This skill automates that refusal. It has a high bar built in — most sessions yield nothing, and that's correct — but compounding is the point: six months of extraction produces a library shaped precisely like your work. This is the skill that makes all the other skills self-multiplying.",
        whatYouNeed: [
          "Nothing — except a willingness to review what it proposes rather than auto-accepting",
        ],
        setupPrompt: `Create a new skill for my AI coding agent called "session-to-skill-extractor", stored
wherever my harness loads skills from.

The skill's job: at the end of substantial work sessions, evaluate whether anything we
did is worth preserving as a new skill or an update to an existing one — and if so,
draft it.

The skill must include: (1) trigger conditions — when I say "wrap up," "anything worth
keeping?", or at the natural end of a session where we solved something non-trivially;
(2) a high extraction bar, stated explicitly: the pattern must be RECURRING (I'll
plausibly need it again), NON-OBVIOUS (a fresh session wouldn't just derive it), and
CODIFIABLE (it can be written as a procedure) — most sessions yield nothing, and
"nothing worth extracting" is a good answer; (3) a check against my existing skill
library first: if an existing skill covers 80% of the pattern, propose an update, not
a new skill; (4) drafts follow my skills' standard format with trigger conditions, and
land somewhere for my review — never silently into the live library; (5) a sanitize
rule: extracted skills generalize the pattern and strip project/client specifics,
which stay in repo-local runbooks.

After writing it, test it on THIS session: evaluate whether our setup work contains an
extractable pattern, and show me your reasoning either way.`,
      },
      {
        id: "agentic-harness-designer",
        title: "Agentic Harness Designer",
        whatItDoes:
          'A design-review skill for building agent-powered products and systems: when the problem is "how should this AI system actually work," it walks the real architecture questions — tool-use design, permission and approval models, workflow state and durability, context and memory strategy, evaluation approach, observability, and operator visibility — and produces a phased implementation plan. It encodes the hard-won principle that most "AI product" problems are agent-system problems: the model matters less than the harness around it.',
        whyBuildIt:
          "If you build anything agent-powered — internal tools, products, even sophisticated personal automations — the failure modes live in the harness: missing approval gates, no durable state, no evaluation plan, no way to see what the agent did. A skill that forces those questions in order, every time, is the difference between a demo and a system. It's the most conceptual skill in the library, and for builders, frequently the most valuable.",
        whatYouNeed: ["Nothing"],
        setupPrompt: `Create a new skill for my AI coding agent called "agentic-harness-designer", stored
wherever my harness loads skills from.

The skill's job: when I'm designing or reviewing an agent-powered system or product,
walk the real architecture questions and produce a phased plan — treating the problem
as an agent-SYSTEM problem, not a model-choice problem.

The skill must include: (1) trigger conditions — designing, evaluating, or debugging
any AI-agent-powered product, tool, or serious automation; (2) the design walk, in
order: what tools the agent gets and their exact contracts; the permission model
(what's autonomous, what needs approval, what's forbidden); workflow state and
durability (what survives a crash or restart); context and memory strategy (what the
agent knows, from where, and what it must not accumulate); evaluation (how we'll know
it works — concrete checks, not vibes); observability (what's logged, what the
operator can see mid-run); (3) failure-mode review against the common killers: missing
approval gates, non-durable state, unbounded context growth, no evals, invisible
execution; (4) output: a design doc with decisions and rationale, plus a phased
implementation plan where each phase is independently shippable and testable.

After writing it, test it by reviewing an agent system or automation I describe — or
one we've already built — and showing me the design doc.`,
      },
    ],
  },
];

const SOURCE_RUNBOOKS = [
  {
    id: "talk-to-published",
    number: "01",
    title: "Talk to Published",
    chain: [
      "Media Transcription",
      "Brain Dump Processor",
      "Personal Voice",
      "HTML Artifact Builder",
      "Personal Site Publisher",
    ],
    description:
      "You record a voice memo on a walk. Transcription turns it into clean text; the Brain Dump Processor separates and evaluates the ideas in it; you pick the one worth writing; the Voice skill drafts the piece as you'd write it; the Artifact Builder lays it out; the Site Publisher ships it to a clean URL with a proper link preview.",
    payoff: "A voice memo becomes a published page.",
  },
  {
    id: "release-day",
    number: "02",
    title: "Release Day",
    chain: [
      "Current-Information Search",
      "New Release Briefing",
      "Branded Image Prompting",
      "Image Generation Gateway",
      "Personal Site Publisher",
      "Stakeholder Update Email",
    ],
    description:
      "Something big ships in your field at 10am and you want an accurate, on-brand briefing live by noon. Search gathers primary-source facts with dates (this step is what keeps you from publishing training-data hallucinations); the Briefing skill packages them into your standard format; the image skills produce a matching branded thumbnail; the Publisher ships it; the Update Email tells your list or team it's live.",
    payoff:
      "An accurate, on-brand briefing published the same day with speed that never costs correctness.",
  },
  {
    id: "video-production-line",
    number: "03",
    title: "The Video Production Line",
    chain: [
      "Media Transcription",
      "Radio Edit",
      "B-Roll Pipeline",
      "AI Editing Assistant",
      "Stakeholder Update Email",
    ],
    description:
      "Raw talking-head footage in, finished video with motion graphics out. Transcription produces the timestamped foundation everything else reads. Radio Edit fixes the spoken narrative and hands you a paper edit to approve — the editorial decisions happen here, on paper, where they're cheap to change. The B-Roll Pipeline scouts the approved cut for graphic-worthy moments and generates consistent animated overlays. The NLE Assistant assembles it in your editor. The Update Email tells your editor or client it's ready for review.",
    payoff:
      "A raw video becomes a finished, graphics-laden edit with the editorial work front-loaded and cheap to change.",
  },
  {
    id: "ship-a-page-you-can-trust",
    number: "04",
    title: "Ship a Page You Can Trust",
    chain: [
      "Frontend Taste System",
      "Personal Site Publisher",
      "Browser Automation QA",
      "Testing Runbook Creator",
    ],
    description:
      "The difference between shipping a page and shipping a page you'd bet on. The Taste System builds it well; the Publisher takes it live; Browser QA then verifies the live page with instruments rather than vibes — screenshots across breakpoints, Core Web Vitals, console and network checks — and everything QA learned about testing this page lands in the repo's runbook, so the next deploy verifies in minutes.",
    payoff:
      "A personal site with a regression-test habit — every page shipped with verified quality.",
  },
  {
    id: "the-research-engine",
    number: "05",
    title: "The Research Engine",
    chain: [
      "Heavy File Ingestion",
      "Current-Information Search",
      "Assumption Checker",
      "Meeting Synthesis",
      "HTML Artifact Builder",
      "Reading Pack Builder",
    ],
    description:
      "For real research questions with messy inputs: a folder of PDFs, some meeting recordings, and a claim you're not sure you believe. Ingestion converts the heavy sources into clean artifacts first (this ordering is the whole trick — analysis over converted text is faster, cheaper, and reusable). Search fills the gaps with current information. The Assumption Checker runs adversarially against the emerging conclusions — a separate skill with a skeptic's posture, not the same conversation grading its own homework. The output ships as a styled artifact, and when the material needs human review, the Reading Pack presents it in order.",
    payoff:
      "Research with a chain of custody: every claim traceable to an artifact, every conclusion stress-tested.",
  },
  {
    id: "delegate-and-verify",
    number: "06",
    title: "Delegate and Verify",
    chain: [
      "Session Operating Map",
      "Goal Prompt Generator",
      "Visible Delegation",
      "Self-Authored PR Merge",
      "Stakeholder Update Email",
    ],
    description:
      "How one person runs parallel engineering lanes without becoming the bottleneck. The Operating Map records what each lane owns, so no session needs you to explain the project. The Goal Prompt Generator packages a task with a definition of done and verification gates; Visible Delegation runs it in a watchable session; when the delegate finishes, its work is verified against the gates it was given — the goal prompt is also the acceptance test. The PR Merge skill reviews and lands it; the Update Email closes the loop with whoever's waiting.",
    payoff:
      "Parallel engineering lanes with you only touching the two decisions that need you: what 'done' means, and whether the diff is good.",
  },
  {
    id: "the-flywheel",
    number: "07",
    title: "The Flywheel",
    chain: [
      "Session-to-Skill Extractor",
      "Testing Runbook Creator",
      "Page Testing Memory",
      "Session Operating Map",
    ],
    description:
      "This one is different: it's not a pipeline you run, it's a posture that runs under every other runbook. The Extractor watches your sessions for patterns worth keeping and drafts new skills from them. The Runbook Creator banks every testing discovery in the repo it belongs to. Page Testing Memory keeps the global/local boundary clean as both libraries grow. The Operating Map preserves coordination state across sessions.",
    payoff: "No useful discovery dies in chat — the mechanism by which a skill library compounds.",
  },
  {
    id: "claim-appeal-packet",
    number: "08",
    title: "Claim Appeal Packet",
    chain: [
      "PDF / Document Ingestion",
      "Document Chunking and Tagging",
      "Case Data Normalization",
      "SQLite Case Store",
      "Deterministic Retrieval Map",
      "Citation Guard",
      "Packet Export",
      "Human Gate",
    ],
    description:
      "A denied claim becomes a grounded appeal packet. Ingestion converts plan docs and the denial into citeable artifacts. Chunking and tagging makes the plan sections addressable. Normalization extracts dates, denial reason, claim lines, and deadline, then reconciles each claim's fields across the denial letter and EOB: codes, dates, and amounts; mismatches become named review questions in the packet. The case store keeps the evidence queryable. Deterministic retrieval maps denial type to plan language before the agent drafts. Citation Guard rejects unsupported claims and blocks export until every failure is fixed or converted to a named review question. Packet Export produces the review folder. Human Gate stops before filing or sending.",
    payoff: "A denial letter becomes an editable, cited appeal packet a human can review and send.",
  },
  {
    id: "tax-prep-packet",
    number: "09",
    title: "Tax Prep Packet",
    chain: [
      "PDF / Document Ingestion",
      "Document Chunking and Tagging",
      "Case Data Normalization",
      "SQLite Case Store",
      "Open Brain Case Store (optional · OB1 path)",
      "Deterministic Retrieval Map",
      "Citation Guard",
      "Packet Export",
      "Human Gate",
    ],
    description:
      "A pile of tax documents becomes a CPA-ready review packet. Ingestion converts forms, receipts, and CSVs. Chunking and tagging makes the form boxes, receipt lines, and statement rows addressable evidence. Normalization merges receipt and bank evidence so one transaction is one ledger row, cross-checks every W-2 and 1099 against deposits, and turns unmatched payers into named missing-document items. SQLite is the beginner store; Open Brain is the OB1 path for people with durable context already running. Deterministic retrieval maps income, expense, and missing-document types to the right review rules. Citation Guard keeps tax-rule claims grounded and blocks export while any claim fails. Packet Export creates summaries, ledgers, questions, and PDF. Human Gate stops before filing.",
    payoff:
      "A messy tax folder becomes a structured prep packet with evidence, questions, and clean handoff artifacts.",
  },
  {
    id: "email-follow-up-packet",
    number: "10",
    title: "Email Follow-Up Packet",
    chain: [
      "PDF / Document Ingestion",
      "Document Chunking and Tagging",
      "Case Data Normalization",
      "SQLite Case Store",
      "Open Brain Case Store (optional · OB1 path)",
      "Deterministic Retrieval Map",
      "Citation Guard",
      "Packet Export",
      "Human Gate",
    ],
    description:
      "A mailbox export becomes a commitments ledger and a folder of cited drafts. Ingestion converts an mbox export, Sent folder included, into citeable messages anchored by message-id. Chunking strips quoted history, signatures, and disclaimers so evidence anchors to the message where a sentence first appeared. Normalization reconstructs threads from headers, resolves sender identities, and extracts commitments and waiting-on rows with owners and due dates, then reconciles restated promises into single rows and closes any loop the Sent mail already answered. Deterministic retrieval maps thread state, dropped commitment, waiting-on-them, or dispute, to the evidence a draft needs. Citation Guard rejects any draft claim that lacks an anchoring message. Packet Export produces drafts with full headers, every one marked pending. Human Gate is the send boundary: fixture runs hold no mail credentials, the live loop ingests through a read-and-draft connector with no send verb, and an ignored draft means no.",
    payoff:
      "A neglected inbox becomes an urgency-ordered ledger and ready-to-send cited drafts, and nothing sends itself.",
  },
];

const OPEN_SKILLS_ORIGIN: SkillBlueprint["sourceUrl"] =
  "https://unlock-ai.natebjones.com/open-skills";

export const SKILL_BLUEPRINT_CATEGORIES: readonly SkillBlueprintCategory[] =
  SOURCE_SKILL_CATEGORIES.map((category) => ({
    id: category.id,
    number: category.number,
    title: category.title,
    description: category.description,
    sourceUrl: OPEN_SKILLS_ORIGIN.concat("/", category.id) as SkillBlueprintCategory["sourceUrl"],
  }));

export const SKILL_BLUEPRINTS: readonly SkillBlueprint[] = SOURCE_SKILL_CATEGORIES.flatMap(
  (category) =>
    category.skills.map((skill) => ({
      ...skill,
      category: category.id,
      categoryNumber: category.number,
      categoryTitle: category.title,
      categoryDescription: category.description,
      sourceUrl: OPEN_SKILLS_ORIGIN.concat(
        "/",
        category.id,
        "#",
        skill.id,
      ) as SkillBlueprint["sourceUrl"],
    })),
);

export const RUNBOOK_BLUEPRINTS: readonly RunbookBlueprint[] = SOURCE_RUNBOOKS.map((runbook) => ({
  ...runbook,
  sourceUrl: OPEN_SKILLS_ORIGIN.concat("/runbooks#", runbook.id) as RunbookBlueprint["sourceUrl"],
}));

export function blueprintInstallName(
  blueprint: Pick<SkillBlueprint, "id" | "installName">,
): string {
  return blueprint.installName ?? blueprint.id;
}
