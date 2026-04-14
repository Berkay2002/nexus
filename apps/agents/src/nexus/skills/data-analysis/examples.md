# Data Analysis — Task Description Examples

These are ready-to-use templates for spawning sub-agents. Copy and adapt.

## Analyze Existing Data (Code Agent)

```
Analyze the data at {workspaceRoot}/{path-to-data}

Questions to answer:
1. {Question 1 — e.g., "What are the monthly revenue trends?"}
2. {Question 2 — e.g., "Which categories show the highest growth?"}
3. {Question 3 — e.g., "Are there seasonal patterns?"}

Write to {workspaceRoot}/code/task_{id}/
Use Python with pandas and matplotlib. Install with: pip install pandas matplotlib seaborn
Generate a visualization for each finding (save as .png in charts/).
Create analysis-report.md summarizing all findings with references to charts.
```

## Gather and Analyze (Research Agent first, then Code Agent)

Research task:
```
Find publicly available data about {topic}. Look for:
- CSV or JSON datasets from government, academic, or reputable sources
- Data tables on web pages that can be extracted
- API endpoints that provide the data

Write to {workspaceRoot}/research/task_{id}/
Save any found datasets as files. Create findings.md listing data sources and their formats.
```

Code task (after research):
```
Analyze the data gathered by the research agent at {workspaceRoot}/research/task_{id}/

{Same pattern as "Analyze Existing Data" above}
Research findings are at {workspaceRoot}/research/task_{id}/findings.md
```

## Statistical Analysis (Code Agent)

```
Perform statistical analysis on the data at {workspaceRoot}/{path}

Analysis required:
- Descriptive statistics (mean, median, std dev, quartiles)
- {Specific test — e.g., "Correlation between columns X and Y"}
- {Specific test — e.g., "Trend analysis with linear regression"}

Write to {workspaceRoot}/code/task_{id}/
Use Python with pandas, scipy, and matplotlib.
Create analysis-report.md with statistical results, p-values where applicable, and interpretations.
Generate charts for visual representation of key findings.
```
