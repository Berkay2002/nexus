# Introducing advanced tool use on the Claude Developer Platform

**Published Nov 24, 2025**

We've added three new beta features that let Claude discover, learn, and execute tools dynamically. Here’s how they work.

The future of AI agents is one where models work seamlessly across hundreds or thousands of tools. To build effective agents, they need to work with unlimited tool libraries without stuffing every definition into context upfront. 

Today, we're releasing three features that make this possible:
1. **Tool Search Tool**: Allows Claude to access thousands of tools without consuming its context window.
2. **Programmatic Tool Calling**: Allows Claude to invoke tools in a code execution environment, reducing the impact on the context window.
3. **Tool Use Examples**: Provides a universal standard for demonstrating how to effectively use a given tool.

---

## Tool Search Tool

### The challenge
MCP tool definitions provide important context, but as more servers connect, tokens add up. A typical five-server setup (GitHub, Slack, Sentry, Grafana, Splunk) can consume approximately 55K tokens before the conversation starts. Adding more servers like Jira can quickly push this overhead past 100K tokens.

### Our solution
Instead of loading all tool definitions upfront, the Tool Search Tool discovers tools on-demand. Claude only sees the tools it actually needs for the current task.

* **Traditional approach**: All definitions loaded upfront (~72K tokens for 50+ tools).
* **Tool Search Tool**: Only the search tool is loaded (~500 tokens). Tools are discovered as needed (~3K tokens). This preserves 95% of the context window.

### How it works
You provide all tool definitions to the API but mark specific tools with `defer_loading: true`. These tools are excluded from the initial prompt. When Claude needs a specific capability, it searches for relevant tools. The search returns references that get expanded into full definitions only when needed.

```json
{
  "tools": [
    {"type": "tool_search_tool_regex_20251119", "name": "tool_search_tool_regex"},
    {
      "name": "github.createPullRequest",
      "description": "Create a pull request",
      "input_schema": {...},
      "defer_loading": true
    }
  ]
}
```

---

## Programmatic Tool Calling (PTC)

### The challenge
Traditional tool calling creates context pollution from intermediate results and inference overhead. Each tool call requires a full model inference pass, and large datasets (like 10MB log files) must enter the context window for Claude to analyze them.

### Our solution
Programmatic Tool Calling enables Claude to orchestrate tools through code (Python) rather than individual API round-trips. Claude writes code that calls multiple tools and processes their outputs in a sandboxed environment. Only the final, summarized result enters Claude's context window.

**Example: Budget compliance check**
Instead of 20+ tool calls and 2,000+ expense line items entering context, Claude writes a Python script to:
1. Fetch team members.
2. Fetch budgets for each level.
3. Fetch all expenses in parallel.
4. Calculate totals and filter for violators.

Claude only sees the final list of names who exceeded their budget, reducing consumption from ~200KB to ~1KB.

### How it works
1. **Mark tools as callable**: Add `code_execution` to tools and set `allowed_callers`.
2. **Claude writes code**: Claude generates Python code to orchestrate the workflow.
3. **Internal execution**: Tools execute and results are processed in the environment, not the LLM context.

---

## Tool Use Examples

### The challenge
JSON Schema defines structure but not usage patterns. It can't show which date format is preferred, what naming conventions an API expects, or how optional parameters correlate with specific priorities.

### Our solution
You can now provide sample tool calls directly in your tool definitions. This shows Claude concrete usage patterns instead of relying solely on schema.

```json
{
  "name": "create_ticket",
  "input_schema": { ... },
  "input_examples": [
    {
      "title": "Login page returns 500 error",
      "priority": "critical",
      "labels": ["bug", "authentication"],
      "due_date": "2024-11-06"
    }
  ]
}
```

This clarifies format ambiguities (e.g., YYYY-MM-DD) and demonstrates how to populate nested structures correctly.

---

## Best Practices

* **Layer features**: Start with your biggest bottleneck (e.g., context bloat -> Tool Search Tool) and layer others as needed.
* **Tool Search**: Use clear, descriptive names and descriptions to improve discovery accuracy. Keep your 3–5 most-used tools always loaded and defer the rest.
* **PTC**: Clearly document return formats so Claude can write accurate parsing logic.
* **Examples**: Use realistic data and focus on areas where usage isn't obvious from the schema alone.

### Getting Started
These features are available in beta. To enable them, add the beta header: `advanced-tool-use-2025-11-20`.

```python
client.beta.messages.create(
    betas=["advanced-tool-use-2025-11-20"],
    model="claude-sonnet-4-5-20250929",
    tools=[...]
)
```