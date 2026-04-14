---
name: data-analysis
description: Use when the user asks to analyze data, process a dataset, create visualizations, find patterns, run statistics, explore a CSV or spreadsheet, or perform any kind of data processing and insight extraction.
---

# Data Analysis

## Overview

Guide the orchestrator to analyze data using Python in the sandbox. Optionally gather data from the web first via Research agents, then process with Code agents using pandas/matplotlib/seaborn.

## When to Use

- User asks to "analyze", "process", "visualize", or "explore" data
- Request involves CSV, JSON, spreadsheet, or database data
- User wants charts, statistics, trends, or patterns extracted
- User says "find data about X and analyze it" (combines gathering + analysis)

## When NOT to Use

- User just wants to research a topic without data processing (use deep-research)
- User wants to build a full application (use build-app)
- User wants to create artistic images (use generate-image)

## Workflow

### Step 1: Assess Data Availability

Determine if data needs to be gathered or is already available:

**Data already available:** User uploaded a file or it's already in the sandbox → skip to Step 3.

**Data needs gathering:** User says "find data about X" or references a topic without providing data → proceed to Step 2.

### Step 2: Gather Data (Only If Needed)

Spawn a **research** sub-agent to find relevant datasets or data sources:
- Task description: what data to find, format preferences (CSV, JSON, API)
- Research agent uses tavily_search and tavily_extract to find public datasets or data tables
- For complex multi-source data gathering, consider loading the **deep-research** skill
- Wait for research results before spawning Code agent

See `examples.md` for data gathering task templates.

### Step 3: Analyze with Code Agent

Spawn a **code** sub-agent with a Python-first analysis task.

Each task description MUST include:
- What data to analyze (file path or description)
- What questions to answer / what insights to extract
- If Research gathered data: path to research outputs
- Workspace path: `{workspaceRoot}/code/task_{id}/`
- Python-first instruction: use pandas, matplotlib, seaborn
- Instruction to install libraries as needed (`pip install pandas matplotlib seaborn`)
- Output: `analysis-report.md` using the template at `templates/analysis-report.md` + visualizations when relevant

See `examples.md` for ready-to-use analysis task templates.

### Step 4: Produce Visualizations

The Code agent should generate charts when the data lends itself to visual representation:
- Time series → line charts
- Comparisons → bar charts
- Distributions → histograms
- Correlations → scatter plots
- Proportions → pie/donut charts

Skip visualizations for purely numerical, text, or categorical analysis where charts wouldn't add value.

### Step 5: Deliver

After the Code agent completes:
1. Read `analysis-report.md` to verify quality
2. Copy results and charts to `{workspaceRoot}/shared/`
3. Return a concise summary of key findings (under 500 words) with references to charts

## Complementary Skills

- **deep-research**: For complex data gathering from multiple sources, deep-research provides thorough multi-source research. Data-analysis can consume its findings.
- **write-report**: If the user wants a polished report from the analysis (not just raw findings), write-report can format the analysis results into a structured document.
- **build-app**: If the user wants an interactive dashboard from the data, build-app can create a web app using the analysis results.

## Output Format

```
{workspaceRoot}/shared/
├── analysis-report.md         # Findings and methodology (see templates/analysis-report.md)
├── charts/                    # Generated visualizations (when relevant)
│   ├── {descriptive-name}.png
│   └── {descriptive-name}.png
└── processed-data/            # Cleaned/transformed data (optional)
    └── {cleaned-data}.csv
```
