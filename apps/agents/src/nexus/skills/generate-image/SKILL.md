---
name: generate-image
description: Use when the user asks to create images, generate illustrations, design graphics, make visual assets, create icons, or produce any kind of image content. Triggers on requests for visual creation, image generation, and graphic design.
---

# Generate Image

## Overview

Guide the Creative sub-agent to generate high-quality images using the generate_image tool (Gemini Imagen). Translate user requests into detailed prompts and deliver organized visual assets.

## When to Use

- User asks to "create", "generate", "design", or "make" images or visual content
- Request involves illustrations, icons, hero images, diagrams, or graphics
- Another skill needs visual assets as part of a larger workflow

## When NOT to Use

- User wants charts or data visualizations (use data-analysis — Code agent generates those with matplotlib)
- User wants to edit or modify existing images (not supported by generate_image)
- User wants text-heavy graphics like presentations (use Code agent with appropriate libraries)

## Workflow

### Step 1: Plan the Visual Assets

Before spawning Creative agents, plan what images to create:
- How many distinct images does the user need?
- What style should they share? (pick sensible defaults: clean, modern, professional)
- What filenames describe the content?

### Step 2: Spawn Creative Sub-Agent

Spawn a **creative** sub-agent for each batch of related images.

Each task description MUST include:
- Exactly what images to generate (subject, purpose, context)
- Style guidance: mood, color palette, composition style
- Workspace path: `/home/gem/workspace/creative/task_{id}/`
- Naming convention: descriptive filenames (e.g., `hero-banner-dark.png`, not `image1.png`)
- Instruction to document prompts in `prompt-log.md` using the template at `templates/prompt-log.md`

See `examples.md` for ready-to-use task description templates with prompt engineering patterns.

### Step 3: Prompt Engineering Guidelines

When crafting task descriptions, help the Creative agent write effective Imagen prompts by including:

- **Subject**: What is in the image (specific, not vague)
- **Style**: Art style (digital illustration, photograph, minimalist, watercolor, etc.)
- **Composition**: Layout, perspective, framing
- **Colors**: Dominant palette, mood (warm, cool, muted, vibrant)
- **Context**: Where will this image be used (hero banner, app icon, blog post)

### Step 4: Deliver

After the Creative agent completes:
1. Read the output directory to verify images were generated
2. Copy to `/home/gem/workspace/shared/` or integrate into an app directory if part of build-app
3. Return a summary listing each image with its filename and brief description

## Complementary Skills

- **build-app**: When building a web app, generate-image can produce hero images, icons, and illustrations. Build-app references this skill for the visual assets step.
- **write-report**: Reports can include generated images as figures or illustrations.

## Output Format

```
/home/gem/workspace/shared/
├── [descriptive-name].png    # Generated images with clear filenames
├── [descriptive-name].png
└── prompt-log.md             # Exact prompts used (see templates/prompt-log.md)
```
