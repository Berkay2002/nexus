# Write Report — Task Description Examples

These are ready-to-use templates for the multi-agent report pipeline. Copy and adapt.

## Research Phase (Research Agents — one per topic)

```
Research {topic area} for a report on {overall topic}:
Focus areas:
- {Specific aspect 1}
- {Specific aspect 2}
- {Specific aspect 3}

Write to /home/gem/workspace/research/task_{id}/
Create findings.md with detailed findings and inline citations.
Create sources.json as [{"title": "...", "url": "...", "relevance": "..."}]
Prioritize authoritative sources (official docs, peer-reviewed, reputable publications).
```

## Drafting Phase (Code Agent)

```
Write a report on {topic} using the research gathered by the research agents.

Report structure:
1. Executive Summary
2. {Section 1 title} — covers {what}
3. {Section 2 title} — covers {what}
4. {Section 3 title} — covers {what}
5. Conclusions and Recommendations
6. Sources

Research inputs:
- {Topic A}: /home/gem/workspace/research/task_{id1}/findings.md
- {Topic B}: /home/gem/workspace/research/task_{id2}/findings.md
- {Topic C}: /home/gem/workspace/research/task_{id3}/findings.md

Write to /home/gem/workspace/code/task_{id}/
Output: report.md

Instructions:
- Read ALL research findings before writing
- Synthesize across sources — don't just concatenate findings
- Cite sources inline as [Source Title](url)
- Keep tone {professional / conversational / technical} for {audience}
- Target length: {approximate word count}
```

## Visual Assets Phase (Creative Agent — optional)

```
Create visual assets for a report on {topic}:
1. Cover image — {style description}
2. {Diagram/illustration} — {what it shows}

The report is at /home/gem/workspace/code/task_{id}/report.md — read it for context.
Write to /home/gem/workspace/creative/task_{id}/
Use descriptive filenames. Document prompts in prompt-log.md.
```

## Format Conversion (Code Agent — only if requested)

```
Convert the markdown report at /home/gem/workspace/shared/report.md to {PDF/HTML}.

Use pandoc: pip install pandoc (or apt-get install pandoc)
Command: pandoc report.md -o report.{pdf/html} --standalone

If images are referenced, ensure they're in the correct relative paths.
Write output to /home/gem/workspace/shared/
```
