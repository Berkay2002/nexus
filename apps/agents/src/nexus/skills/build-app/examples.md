# Build App — Task Description Examples

These are ready-to-use templates for spawning sub-agents. Copy and adapt for your specific project.

## Web Application (Code Agent)

```
Build a {framework} application that {description of features}.

Tech stack: {framework} + {language} + {key libraries}
Write to {workspaceRoot}/code/task_{id}/

Requirements:
1. {Feature 1}
2. {Feature 2}
3. {Feature 3}

Create build-log.md documenting:
- What was built and key features
- How to run: exact commands to start the app
- Dependencies installed
- Any known limitations

Verify the app starts successfully before reporting completion.
```

## Script / CLI Tool (Code Agent)

```
Write a {language} script that {what it does}.

Input: {what it reads / accepts}
Output: {what it produces}
Write to {workspaceRoot}/code/task_{id}/

Make the script executable and test it with sample data.
Create build-log.md with usage instructions and examples.
```

## API Discovery (Research Agent — use before Code)

```
Research the {API/library name} API:
- Authentication method and required keys
- Key endpoints/methods for {specific use case}
- Rate limits and pricing
- Code examples in {language}

Write findings to {workspaceRoot}/research/task_{id}/
Create findings.md with API documentation summary and code snippets.
```

## Visual Assets (Creative Agent — use after Code)

```
The app at {workspaceRoot}/code/task_{id}/ needs visual assets:
1. {Image 1 description}
2. {Image 2 description}

Style: {style guidance matching the app's theme}
Write to {workspaceRoot}/creative/task_{id}/
Use descriptive filenames. Document prompts in prompt-log.md.
```
