> ## Documentation Index
> Fetch the complete documentation index at: https://exa.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Search

> The search endpoint lets you search the web and extract contents from the results.

<Card title="Get your Exa API key" icon="key" horizontal href="https://dashboard.exa.ai/api-keys" />


## OpenAPI

````yaml post /search
openapi: 3.1.0
info:
  version: 1.2.0
  title: Exa Search API
  description: >-
    A comprehensive API for internet-scale search, allowing users to perform
    queries and retrieve results from a wide variety of sources using
    embeddings-based and traditional search.
servers:
  - url: https://api.exa.ai
security:
  - apikey: []
paths:
  /search:
    post:
      summary: Search
      description: >-
        Perform a search with a Exa prompt-engineered query and retrieve a list
        of relevant results. Optionally get contents.
      operationId: search
      requestBody:
        required: true
        content:
          application/json:
            schema:
              allOf:
                - type: object
                  properties:
                    query:
                      type: string
                      example: Latest developments in LLM capabilities
                      default: Latest developments in LLM capabilities
                      description: The query string for the search.
                    additionalQueries:
                      type: array
                      items:
                        type: string
                      description: >-
                        Additional query variations for deep-search variants.
                        When provided, these queries are used alongside the main
                        query for more comprehensive results.
                      example:
                        - LLM advancements
                        - large language model progress
                    stream:
                      type: boolean
                      default: false
                      description: >-
                        If true, the response is returned as a server-sent
                        events stream of OpenAI-compatible chat completion
                        chunks.
                    outputSchema:
                      type: object
                      description: >-
                        JSON schema for synthesized output. When provided, the
                        response includes an output object and output.content
                        matches this schema.
                      additionalProperties: {}
                    systemPrompt:
                      type: string
                      description: >-
                        Instructions that guide synthesized output and, for
                        deep-search variants, search planning. Use this for
                        source preferences, novelty or duplication constraints;
                        use outputSchema to control the shape of output.content.
                      example: Prefer official sources and avoid duplicate results.
                    type:
                      type: string
                      enum:
                        - neural
                        - fast
                        - auto
                        - deep-lite
                        - deep
                        - deep-reasoning
                        - instant
                      description: >-
                        The type of search. Neural uses an embeddings-based
                        model, auto (default) intelligently combines neural and
                        other search methods, fast uses streamlined versions of
                        the search models, deep-lite is lightweight synthesized
                        output, deep is light deep search, deep-reasoning is
                        base deep search, and instant provides the lowest
                        latency search optimized for real-time applications.
                      example: auto
                      default: auto
                    category:
                      type: string
                      enum:
                        - company
                        - research paper
                        - news
                        - personal site
                        - financial report
                        - people
                      description: >-
                        A data category to focus on. The `people` and `company`
                        categories have improved quality for finding LinkedIn
                        profiles and company pages. Note: The `company` and
                        `people` categories only support a limited set of
                        filters. The following parameters are NOT supported for
                        these categories: `startPublishedDate`,
                        `endPublishedDate`, `startCrawlDate`, `endCrawlDate`,
                        `includeText`, `excludeText`, `excludeDomains`. For
                        `people` category, `includeDomains` only accepts
                        LinkedIn domains. Using unsupported parameters will
                        result in a 400 error.
                      example: research paper
                    userLocation:
                      type: string
                      description: The two-letter ISO country code of the user, e.g. US.
                      example: US
                  required:
                    - query
                - $ref: '#/components/schemas/CommonRequest'
      responses:
        '200':
          $ref: '#/components/responses/SearchResponse'
      x-codeSamples:
        - lang: bash
          label: Simple search and contents
          source: |
            curl -X POST 'https://api.exa.ai/search' \
              -H 'x-api-key: YOUR-EXA-API-KEY' \
              -H 'Content-Type: application/json' \
              -d '{
                "query": "Latest research in LLMs",
                "contents": {
                  "highlights": {
                    "maxCharacters": 4000
                  }
                }
              }'
        - lang: python
          label: Simple search and contents
          source: |
            # pip install exa-py
            from exa_py import Exa
            exa = Exa('YOUR_EXA_API_KEY')

            results = exa.search_and_contents(
                "Latest research in LLMs", 
                highlights={"max_characters": 4000}
            )

            print(results)
        - lang: javascript
          label: Simple search and contents
          source: |
            // npm install exa-js
            import Exa from 'exa-js';
            const exa = new Exa('YOUR_EXA_API_KEY');

            const results = await exa.searchAndContents(
                'Latest research in LLMs', 
                { highlights: { maxCharacters: 4000 } }
            );

            console.log(results);
        - lang: php
          label: Simple search and contents
          source: ''
        - lang: go
          label: Simple search and contents
          source: ''
        - lang: java
          label: Simple search and contents
          source: ''
        - lang: bash
          label: Advanced search with filters
          source: |
            curl --request POST \
              --url https://api.exa.ai/search \
              --header 'x-api-key: <token>' \
              --header 'Content-Type: application/json' \
              --data '{
              "query": "Latest research in LLMs",
              "type": "auto",
              "category": "research paper",
              "numResults": 10,
              "moderation": true,
              "contents": {
                "text": true,
                "summary": {
                  "query": "Main developments"
                },
                "subpages": 1,
                "subpageTarget": "sources",
                "extras": {
                  "links": 1,
                  "imageLinks": 1
                }
              }
            }'
        - lang: bash
          label: Deep search with query variations
          source: |
            curl --request POST \
              --url https://api.exa.ai/search \
              --header 'x-api-key: <token>' \
              --header 'Content-Type: application/json' \
              --data '{
              "query": "Who is the CEO of OpenAI?",
              "type": "deep",
              "systemPrompt": "Prefer official sources and avoid duplicate results",
              "outputSchema": {
                "type": "object",
                "properties": {
                  "leader": { "type": "string" },
                  "title": { "type": "string" },
                  "sourceCount": { "type": "number" }
                },
                "required": ["leader", "title"]
              },
              "contents": {
                "text": true
              }
            }'
        - lang: python
          label: Advanced search with filters
          source: |
            # pip install exa-py
            from exa_py import Exa
            exa = Exa('YOUR_EXA_API_KEY')

            results = exa.search_and_contents(
                "Latest research in LLMs",
                type="auto",
                category="research paper",
                num_results=10,
                moderation=True,
                text=True,
                summary={
                    "query": "Main developments"
                },
                subpages=1,
                subpage_target="sources",
                extras={
                    "links": 1,
                    "image_links": 1
                }
            )

            print(results)
        - lang: javascript
          label: Advanced search with filters
          source: >
            // npm install exa-js

            import Exa from 'exa-js';

            const exa = new Exa('YOUR_EXA_API_KEY');


            const results = await exa.searchAndContents('Latest research in
            LLMs', {
                type: 'auto',
                category: 'research paper',
                numResults: 10,
                moderation: true,
                contents: {
                    text: true,
                    summary: {
                        query: 'Main developments'
                    },
                    subpages: 1,
                    subpageTarget: 'sources',
                    extras: {
                        links: 1,
                        imageLinks: 1
                    }
                }
            });


            console.log(results);
        - lang: python
          label: Deep search with query variations
          source: |
            # pip install exa-py
            from exa_py import Exa
            exa = Exa('YOUR_EXA_API_KEY')

            results = exa.search(
                "Who is the CEO of OpenAI?",
                type="deep",
                system_prompt="Prefer official sources and avoid duplicate results",
                output_schema={
                    "type": "object",
                    "properties": {
                        "leader": {"type": "string"},
                        "title": {"type": "string"},
                        "source_count": {"type": "number"}
                    },
                    "required": ["leader", "title"]
                },
                contents={"text": True}
            )

            print(results)
        - lang: javascript
          label: Deep search with query variations
          source: |
            // npm install exa-js
            import Exa from 'exa-js';
            const exa = new Exa('YOUR_EXA_API_KEY');

            const results = await exa.search('Who is the CEO of OpenAI?', {
                type: 'deep',
                systemPrompt: 'Prefer official sources and avoid duplicate results',
                outputSchema: {
                    type: 'object',
                    properties: {
                        leader: { type: 'string' },
                        title: { type: 'string' },
                        sourceCount: { type: 'number' }
                    },
                    required: ['leader', 'title']
                },
                contents: {
                    text: true
                }
            });

            console.log(results);
        - lang: bash
          label: Streaming synthesized output
          source: |
            curl --no-buffer --request POST \
              --url https://api.exa.ai/search \
              --header 'x-api-key: <token>' \
              --header 'Content-Type: application/json' \
              --data '{
              "query": "Summarize the latest AI chip launches",
              "type": "fast",
              "stream": true,
              "outputSchema": {
                "type": "text",
                "description": "A short grounded summary in 3 bullets"
              }
            }'
        - lang: bash
          label: Instant search (lowest latency)
          source: |
            curl --request POST \
              --url https://api.exa.ai/search \
              --header 'x-api-key: <token>' \
              --header 'Content-Type: application/json' \
              --data '{
              "query": "What is the capital of France?",
              "type": "instant",
              "numResults": 10,
              "contents": {
                "text": {
                  "maxCharacters": 1000
                }
              }
            }'
        - lang: python
          label: Instant search (lowest latency)
          source: |
            # pip install exa-py
            from exa_py import Exa
            exa = Exa('YOUR_EXA_API_KEY')

            results = exa.search_and_contents(
                "What is the capital of France?",
                type="instant",
                num_results=10,
                text={"maxCharacters": 1000}
            )

            print(results)
        - lang: javascript
          label: Instant search (lowest latency)
          source: |
            // npm install exa-js
            import Exa from 'exa-js';
            const exa = new Exa('YOUR_EXA_API_KEY');

            const results = await exa.searchAndContents(
                'What is the capital of France?',
                {
                    type: 'instant',
                    numResults: 10,
                    text: { maxCharacters: 1000 }
                }
            );

            console.log(results);
        - lang: php
          label: Advanced search with filters
          source: ''
        - lang: go
          label: Advanced search with filters
          source: ''
        - lang: java
          label: Advanced search with filters
          source: ''
components:
  schemas:
    CommonRequest:
      type: object
      properties:
        numResults:
          type: integer
          maximum: 100
          default: 10
          description: >
            Number of results to return. Limits vary by search type:

            - With "neural": max 100 results

            - With deep-search variants like "deep-lite", "deep", or
            "deep-reasoning": max 100 results


            If you want to increase the num results beyond these limits, contact
            sales (hello@exa.ai)
          example: 10
        includeDomains:
          type: array
          maxItems: 1200
          items:
            type: string
          description: >-
            List of domains to include in the search. If specified, results will
            only come from these domains.
          example:
            - arxiv.org
            - paperswithcode.com
        excludeDomains:
          type: array
          maxItems: 1200
          items:
            type: string
          description: >-
            List of domains to exclude from search results. If specified, no
            results will be returned from these domains.
        startCrawlDate:
          type: string
          format: date-time
          description: >-
            Crawl date refers to the date that Exa discovered a link. Results
            will include links that were crawled after this date. Must be
            specified in ISO 8601 format.
          example: '2023-01-01T00:00:00.000Z'
        endCrawlDate:
          type: string
          format: date-time
          description: >-
            Crawl date refers to the date that Exa discovered a link. Results
            will include links that were crawled before this date. Must be
            specified in ISO 8601 format.
          example: '2023-12-31T00:00:00.000Z'
        startPublishedDate:
          type: string
          format: date-time
          description: >-
            Only links with a published date after this will be returned. Must
            be specified in ISO 8601 format.
          example: '2023-01-01T00:00:00.000Z'
        endPublishedDate:
          type: string
          format: date-time
          description: >-
            Only links with a published date before this will be returned. Must
            be specified in ISO 8601 format.
          example: '2023-12-31T00:00:00.000Z'
        includeText:
          type: array
          items:
            type: string
          description: >-
            List of strings that must be present in webpage text of results.
            Currently, only 1 string is supported, of up to 5 words.
          example:
            - large language model
        excludeText:
          type: array
          items:
            type: string
          description: >-
            List of strings that must not be present in webpage text of results.
            Currently, only 1 string is supported, of up to 5 words. Checks from
            the first 1000 words of the webpage text.
          example:
            - course
        context:
          oneOf:
            - type: boolean
              deprecated: true
              description: >-
                Deprecated: Use highlights or text instead. Returns page
                contents as a combined context string.
              example: true
            - type: object
              deprecated: true
              description: >-
                Deprecated: Use highlights or text instead. Returns page
                contents as a combined context string.
              properties:
                maxCharacters:
                  type: integer
                  description: Deprecated. Maximum character limit for the context string.
                  example: 10000
        moderation:
          type: boolean
          default: false
          description: >-
            Enable content moderation to filter unsafe content from search
            results.
          example: true
        contents:
          $ref: '#/components/schemas/ContentsRequest'
    ContentsRequest:
      type: object
      properties:
        text:
          oneOf:
            - type: boolean
              title: Simple text retrieval
              description: >-
                If true, returns full page text with default settings. If false,
                disables text return.
            - type: object
              title: Advanced text options
              description: >-
                Advanced options for controlling text extraction. Use this when
                you need to limit text length or include HTML structure.
              properties:
                maxCharacters:
                  type: integer
                  description: >-
                    Maximum character limit for the full page text. Useful for
                    controlling response size and API costs.
                  example: 1000
                includeHtmlTags:
                  type: boolean
                  default: false
                  description: >-
                    Include HTML tags in the response, which can help LLMs
                    understand text structure and formatting.
                  example: false
                verbosity:
                  type: string
                  enum:
                    - compact
                    - standard
                    - full
                  default: compact
                  description: >
                    Controls the verbosity level of returned content. Requires
                    livecrawl: "always" to take effect.

                    - compact: Most concise output, main content only (default)

                    - standard: Balanced content with more detail

                    - full: Complete content including all sections
                  example: standard
                includeSections:
                  type: array
                  items:
                    type: string
                    enum:
                      - header
                      - navigation
                      - banner
                      - body
                      - sidebar
                      - footer
                      - metadata
                  description: >
                    Only include content from these semantic page sections.
                    Requires livecrawl: "always" to take effect.
                  example:
                    - body
                    - header
                excludeSections:
                  type: array
                  items:
                    type: string
                    enum:
                      - header
                      - navigation
                      - banner
                      - body
                      - sidebar
                      - footer
                      - metadata
                  description: >
                    Exclude content from these semantic page sections. Requires
                    livecrawl: "always" to take effect.
                  example:
                    - navigation
                    - footer
                    - sidebar
        highlights:
          oneOf:
            - type: boolean
              title: Simple highlights retrieval
              description: >-
                If true, returns highlights with default settings. If false,
                disables highlights.
            - type: object
              title: Advanced highlights options
              description: >-
                Advanced options for controlling highlight extraction. Use this
                when you need to customize the character budget or provide a
                custom query.
              properties:
                numSentences:
                  type: integer
                  minimum: 1
                  description: >-
                    Deprecated and will be removed in a future release.
                    Currently mapped to a character budget (1 sentence ≈ 1333
                    characters). Use maxCharacters instead.
                  example: 1
                  deprecated: true
                highlightsPerUrl:
                  type: integer
                  minimum: 1
                  deprecated: true
                  description: >-
                    Deprecated and will be removed in a future release.
                    Currently ignored. Use maxCharacters instead.
                  example: 1
                query:
                  type: string
                  description: Custom query to direct the LLM's selection of highlights.
                  example: Key advancements
          description: Text snippets the LLM identifies as most relevant from each page.
          properties:
            maxCharacters:
              type: integer
              minimum: 1
              description: >-
                Maximum number of characters to return for highlights. Controls
                the total length of highlight text returned per URL.
              example: 2000
            numSentences:
              type: integer
              minimum: 1
              description: >-
                Deprecated and will be removed in a future release. Currently
                mapped to a character budget (1 sentence ≈ 1333 characters). Use
                maxCharacters instead.
              example: 1
              deprecated: true
            highlightsPerUrl:
              type: integer
              minimum: 1
              description: >-
                Deprecated and will be removed in a future release. Currently
                ignored. Use maxCharacters instead.
              deprecated: true
            query:
              type: string
              description: Custom query to direct the LLM's selection of highlights.
              example: Key advancements
        summary:
          type: object
          description: Summary of the webpage
          properties:
            query:
              type: string
              description: Custom query for the LLM-generated summary.
              example: Main developments
            schema:
              type: object
              description: >
                JSON schema for structured output from summary. 

                See https://json-schema.org/overview/what-is-jsonschema for JSON
                Schema documentation.
              example:
                $schema: http://json-schema.org/draft-07/schema#
                title: Title
                type: object
                properties:
                  Property 1:
                    type: string
                    description: Description
                  Property 2:
                    type: string
                    enum:
                      - option 1
                      - option 2
                      - option 3
                    description: Description
                required:
                  - Property 1
        livecrawl:
          type: string
          enum:
            - never
            - fallback
            - preferred
            - always
          deprecated: true
          description: >
            **Deprecated**: Use `maxAgeHours` instead for more precise control
            over content freshness.


            Options for livecrawling pages.

            'never': Disable livecrawling (default for neural search).

            'fallback': Livecrawl when cache is empty.

            'preferred': Always try to livecrawl, but fall back to cache if
            crawling fails.

            'always': Always live-crawl, never use cache. Only use if you cannot
            tolerate any cached content. This option is not recommended unless
            consulted with the Exa team.
          example: preferred
        livecrawlTimeout:
          type: integer
          default: 10000
          description: The timeout for livecrawling in milliseconds.
          example: 1000
        maxAgeHours:
          type: integer
          description: >
            Maximum age of cached content in hours. Controls when livecrawling
            is triggered based on content freshness.

            - Positive value (e.g. 24): Use cached content if it's less than
            this many hours old, otherwise livecrawl.

            - 0: Always livecrawl, never use cache.

            - -1: Never livecrawl, always use cache.

            - Omit (default): Livecrawl as fallback only when no cached content
            exists.
          example: 24
        subpages:
          type: integer
          default: 0
          description: >-
            The number of subpages to crawl. The actual number crawled may be
            limited by system constraints.
          example: 1
        subpageTarget:
          oneOf:
            - type: string
            - type: array
              items:
                type: string
          description: >-
            Term to find specific subpages of search results. Can be a single
            string or an array of strings, comma delimited.
          example: sources
        extras:
          type: object
          description: Extra parameters to pass.
          properties:
            links:
              type: integer
              default: 0
              description: Number of URLs to return from each webpage.
              example: 1
            imageLinks:
              type: integer
              default: 0
              description: Number of images to return for each result.
              example: 1
        context:
          oneOf:
            - type: boolean
              deprecated: true
              description: >-
                Deprecated: Use highlights or text instead. Returns page
                contents as a combined context string.
              example: true
            - type: object
              deprecated: true
              description: >-
                Deprecated: Use highlights or text instead. Returns page
                contents as a combined context string.
              properties:
                maxCharacters:
                  type: integer
                  description: Deprecated. Maximum character limit for the context string.
                  example: 10000
    ResultWithContent:
      allOf:
        - $ref: '#/components/schemas/Result'
        - type: object
          properties:
            text:
              type: string
              description: The full content text of the search result.
              example: >-
                Abstract Large Language Models (LLMs) have recently demonstrated
                remarkable capabilities...
            highlights:
              type: array
              items:
                type: string
              description: Array of highlights extracted from the search result content.
              example:
                - Such requirements have limited their adoption...
            highlightScores:
              type: array
              items:
                type: number
                format: float
              description: Array of cosine similarity scores for each highlighted
              example:
                - 0.4600165784358978
            summary:
              type: string
              description: Summary of the webpage
              example: >-
                This overview paper on Large Language Models (LLMs) highlights
                key developments...
            subpages:
              type: array
              items:
                $ref: '#/components/schemas/ResultWithContent'
              description: Array of subpages for the search result.
              example:
                - id: https://arxiv.org/abs/2303.17580
                  url: https://arxiv.org/pdf/2303.17580.pdf
                  title: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face
                  author: >-
                    Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                    Microsoft Research Asia, Xu  Tan, Microsoft Research Asia,
                    Dongsheng  Li, Microsoft Research Asia, Weiming  Lu,
                    Microsoft Research Asia, Yueting  Zhuang, Microsoft Research
                    Asia, yzhuang@zju.edu.cn, Zhejiang  University, Microsoft
                    Research Asia, Microsoft  Research, Microsoft Research Asia
                  publishedDate: '2023-11-16T01:36:20.486Z'
                  text: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face Date Published: 2023-05-25 Authors: Yongliang
                    Shen, Microsoft Research Asia Kaitao Song, Microsoft
                    Research Asia Xu Tan, Microsoft Research Asia Dongsheng Li,
                    Microsoft Research Asia Weiming Lu, Microsoft Research Asia
                    Yueting Zhuang, Microsoft Research Asia, yzhuang@zju.edu.cn
                    Zhejiang University, Microsoft Research Asia Microsoft
                    Research, Microsoft Research Asia Abstract Solving
                    complicated AI tasks with different domains and modalities
                    is a key step toward artificial general intelligence. While
                    there are abundant AI models available for different domains
                    and modalities, they cannot handle complicated AI tasks.
                    Considering large language models (LLMs) have exhibited
                    exceptional ability in language understanding, generation,
                    interaction, and reasoning, we advocate that LLMs could act
                    as a controller to manage existing AI models to solve
                    complicated AI tasks and language could be a generic
                    interface to empower t
                  summary: >-
                    HuggingGPT is a framework using ChatGPT as a central
                    controller to orchestrate various AI models from Hugging
                    Face to solve complex tasks. ChatGPT plans the task, selects
                    appropriate models based on their descriptions, executes
                    subtasks, and summarizes the results. This approach
                    addresses limitations of LLMs by allowing them to handle
                    multimodal data (vision, speech) and coordinate multiple
                    models for complex tasks, paving the way for more advanced
                    AI systems.
                  highlights:
                    - >-
                      2) Recently, some researchers started to investigate the
                      integration of using tools or models in LLMs  .
                  highlightScores:
                    - 0.32679107785224915
            extras:
              type: object
              description: Results from extras.
              properties:
                links:
                  type: array
                  items:
                    type: string
                  description: Array of links from the search result.
                  example: []
    CostDollars:
      type: object
      properties:
        total:
          type: number
          format: float
          description: Total dollar cost for your request
          example: 0.007
        breakDown:
          type: array
          description: Breakdown of costs by operation type
          items:
            type: object
            properties:
              search:
                type: number
                format: float
                description: Cost of your search operations
                example: 0.007
              contents:
                type: number
                format: float
                description: Cost of your content operations
                example: 0
              breakdown:
                type: object
                properties:
                  neuralSearch:
                    type: number
                    format: float
                    description: Cost of your neural search operations
                    example: 0.007
                  deepSearch:
                    type: number
                    format: float
                    description: Cost of your deep search operations
                    example: 0.012
                  contentText:
                    type: number
                    format: float
                    description: Cost of your text content retrieval
                    example: 0
                  contentHighlight:
                    type: number
                    format: float
                    description: Cost of your highlight generation
                    example: 0
                  contentSummary:
                    type: number
                    format: float
                    description: Cost of your summary generation
                    example: 0
        perRequestPrices:
          type: object
          description: Standard price per request for different operations
          properties:
            neuralSearch_1_10_results:
              type: number
              format: float
              description: >-
                Standard price for search with 1-10 results (contents for 10
                results included)
              example: 0.007
            neuralSearch_additional_result:
              type: number
              format: float
              description: Standard price per additional result beyond 10
              example: 0.001
            deepSearch:
              type: number
              format: float
              description: Standard price for deep search per request
              example: 0.012
            deepReasoningSearch:
              type: number
              format: float
              description: Standard price for deep-reasoning search per request
              example: 0.015
        perPagePrices:
          type: object
          description: Standard price per page for different content operations
          properties:
            contentText:
              type: number
              format: float
              description: >-
                Standard price per page for text content (included with search
                for first 10 results)
              example: 0.001
            contentHighlight:
              type: number
              format: float
              description: >-
                Standard price per page for highlights (included with search for
                first 10 results)
              example: 0.001
            contentSummary:
              type: number
              format: float
              description: Standard price per result for summaries
              example: 0.001
    Result:
      type: object
      properties:
        title:
          type: string
          description: The title of the search result.
          example: A Comprehensive Overview of Large Language Models
        url:
          type: string
          format: uri
          description: The URL of the search result.
          example: https://arxiv.org/pdf/2307.06435.pdf
        publishedDate:
          type:
            - string
            - 'null'
          description: >-
            An estimate of the creation date, from parsing HTML content. Format
            is YYYY-MM-DD.
          example: '2023-11-16T01:36:32.547Z'
        author:
          type:
            - string
            - 'null'
          description: If available, the author of the content.
          example: >-
            Humza  Naveed, University of Engineering and Technology (UET),
            Lahore, Pakistan
        id:
          type: string
          description: The temporary ID for the document. Useful for /contents endpoint.
          example: https://arxiv.org/abs/2307.06435
        image:
          type: string
          format: uri
          description: The URL of an image associated with the search result, if available.
          example: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
        favicon:
          type: string
          format: uri
          description: The URL of the favicon for the search result's domain.
          example: https://arxiv.org/favicon.ico
  responses:
    SearchResponse:
      description: OK
      content:
        application/json:
          schema:
            type: object
            properties:
              requestId:
                type: string
                description: Unique identifier for the request
                example: b5947044c4b78efa9552a7c89b306d95
              results:
                type: array
                description: >-
                  A list of search results containing title, URL, published
                  date, and author.
                items:
                  $ref: '#/components/schemas/ResultWithContent'
              searchType:
                type: string
                enum:
                  - neural
                  - deep
                  - deep-reasoning
                description: For auto searches, indicates which search type was selected.
                example: auto
              context:
                type: string
                description: >-
                  Deprecated. Combined context string from search results. Use
                  highlights or text instead.
              output:
                type: object
                description: Synthesized output. Returned when outputSchema is provided.
                properties:
                  content:
                    oneOf:
                      - type: string
                      - type: object
                        additionalProperties: {}
                    description: >-
                      Synthesized content. String by default, or object when
                      outputSchema is provided.
                  grounding:
                    type: array
                    description: Field-level grounding for synthesized output.
                    items:
                      type: object
                      required:
                        - field
                        - citations
                        - confidence
                      properties:
                        field:
                          type: string
                          description: >-
                            Field path in output.content (for example, content
                            or companies[0].funding).
                        citations:
                          type: array
                          description: Sources supporting this output field.
                          items:
                            type: object
                            required:
                              - url
                              - title
                            properties:
                              url:
                                type: string
                              title:
                                type: string
                        confidence:
                          type: string
                          enum:
                            - low
                            - medium
                            - high
                required:
                  - content
                  - grounding
              costDollars:
                $ref: '#/components/schemas/CostDollars'
        text/event-stream:
          schema:
            type: object
            description: >-
              OpenAI-compatible chat completion chunk. Read partial text from
              choices[0].delta.content.
            properties:
              id:
                type: string
                description: Stream or completion identifier.
              object:
                type: string
                enum:
                  - chat.completion.chunk
                description: OpenAI-compatible chunk object type.
              created:
                type: integer
                description: Unix timestamp when the chunk was created.
              model:
                type: string
                description: Model identifier for the streamed response.
              choices:
                type: array
                items:
                  type: object
                  properties:
                    index:
                      type: integer
                    delta:
                      type: object
                      properties:
                        role:
                          type: string
                          description: Role for the streamed delta, typically assistant.
                        content:
                          type: string
                          description: Partial streamed content.
                    finish_reason:
                      oneOf:
                        - type: string
                        - type: 'null'
  securitySchemes:
    apikey:
      type: apiKey
      name: x-api-key
      in: header
      description: >-
        API key can be provided either via x-api-key header or Authorization
        header with Bearer scheme

````

Built with [Mintlify](https://mintlify.com).