# Deep Research — Task Description Examples

These are ready-to-use templates for spawning Research sub-agents. Copy and adapt for your specific sub-questions.

## Single Sub-Question Research

```
Research: {sub-question}

Write outputs to {workspaceRoot}/research/task_{id}/
Create findings.md with your synthesis of what you found.
Create sources.json as an array: [{"title": "...", "url": "...", "relevance": "..."}]
Store any raw extracted content in raw/ subdirectory.

Strategy:
1. Use tavily_search with search_depth "advanced" to find comprehensive results
2. Use tavily_map on any documentation sites to understand their structure
3. Use tavily_extract on the 3-5 most relevant URLs for detailed content
4. Synthesize into findings.md with inline source citations
```

## Comparative Research

```
Research: Compare {option A} vs {option B} on the following dimensions: {dim1}, {dim2}, {dim3}.

Write outputs to {workspaceRoot}/research/task_{id}/
Create findings.md with a comparison table and prose analysis.
Create sources.json with all sources used.

Strategy:
1. Search for each option separately to get unbiased results
2. Search for direct comparisons (e.g., "{A} vs {B}")
3. Extract detailed specs/features from official sources
4. Structure findings as: overview of each, comparison matrix, recommendation
```

## News/Current Events Research

```
Research: What are the latest developments in {topic} from the past {timeframe}?

Write outputs to {workspaceRoot}/research/task_{id}/
Create findings.md with chronological findings.
Create sources.json with all sources, including publication dates.

Strategy:
1. Use tavily_search with topic "news" and appropriate time_range
2. Cross-reference across multiple news sources
3. Distinguish between confirmed facts and speculation
4. Note the dates of all findings for timeline accuracy
```
