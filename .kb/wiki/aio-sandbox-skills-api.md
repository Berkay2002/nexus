---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, skill, persistence]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox Skills API

The AIO Sandbox exposes an HTTP skills registry under `/v1/skills/*` that lets callers register, list, retrieve, and delete [[skill-md-format|SKILL.md]]-based skills stored inside the running container. This is a server-side registry, distinct from the [[skills|DeepAgents `/skills/` filesystem pattern]] used by Nexus today. Skills registered here persist for the lifetime of the sandbox container and are accessible to any client that can reach the sandbox HTTP endpoint at `:8080`.

> **Note — Two distinct skills patterns:** The AIO Sandbox HTTP registry (this article) and the DeepAgents in-state `/skills/` filesystem pattern are independent systems. Nexus currently uses the DeepAgents pattern (`orchestrator.invoke({ files: nexusSkillFiles })`). Nothing is automatically shared between the two registries — a skill seeded into DeepAgents is NOT visible via `GET /v1/skills/metadatas`, and vice versa.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/skills/register` | Register one or more skills via multipart upload |
| GET | `/v1/skills/metadatas` | List metadata for all (or a filtered subset of) registered skills |
| GET | `/v1/skills/{name}/content` | Fetch the content of a single skill by name |
| DELETE | `/v1/skills/{name}` | Delete one skill by name |
| DELETE | `/v1/skills` | Clear all registered skills |

### POST /v1/skills/register

Registers one or more skills. The request body is `multipart/form-data` (see `Body_register_skills` below).

**Request fields (multipart):**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | binary | No | A skill archive or SKILL.md file to upload |
| `path` | string | No | Filesystem path inside the container to an existing skill directory |
| `name` | string | No | Override name for the registered skill |

Either `file` or `path` must be provided; both are technically optional in the schema, so validation is enforced server-side.

**Response `200`:** `Response_SkillRegistrationResult_` — wraps a `SkillRegistrationResult` with the count of registered skills and their metadata.

**Response `422`:** `HTTPValidationError` — field-level validation failure.

> **Note — Multipart encoding:** Use `Content-Type: multipart/form-data` with a proper boundary. When uploading a SKILL.md file, set the `file` part with `Content-Type: application/octet-stream`. HTTP clients that default to `application/json` will receive a `422`. The `@agent-infra/sandbox` SDK wraps this automatically if its higher-level skill helpers are used.

### GET /v1/skills/metadatas

Returns metadata for all registered skills. Supports optional name filtering.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `names` | string | No | Comma-separated list of skill names to filter by; omit to return all |

**Response `200`:** `Response_SkillMetadataCollection_` — wraps a `SkillMetadataCollection` containing an array of `SkillMetadata` entries.

### GET /v1/skills/{name}/content

Fetches the full content of a single skill by its registered name.

**Path parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | The registered skill name |

**Response `200`:** `Response_SkillContentResult_` — wraps a `SkillContentResult` with the skill name, absolute path inside the container, and its SKILL.md body (front matter stripped).

**Response `422`:** `HTTPValidationError`.

### DELETE /v1/skills/{name}

Removes a single skill from the registry. Returns the metadata of the deleted skill.

**Path parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | The registered skill name to delete |

**Response `200`:** `Response_SkillMetadata_` — wraps the `SkillMetadata` of the removed skill.

**Response `422`:** `HTTPValidationError`.

### DELETE /v1/skills

Removes all registered skills in one call.

**Response `200`:** `Response_dict_` — a generic `{ success, message, data }` envelope where `data` is a plain object (content varies).

> **Warning — Destructive operation:** `DELETE /v1/skills` wipes the entire skills registry. If multiple agents or orchestrator instances share a single AIO Sandbox container, any one of them calling this endpoint will destroy skills that others depend on. Coordinate sandbox lifecycle carefully before calling this endpoint, or prefer `DELETE /v1/skills/{name}` to remove skills individually.

## Skill metadata

`SkillMetadata` is the primary descriptor returned by most endpoints:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Registered skill name |
| `path` | string | Yes | Absolute path to the skill directory inside the container |
| `metadata` | object | No | Key/value pairs parsed from the SKILL.md front matter (e.g., `description`, `version`, `author`) |
| `dependency_commands` | `DependencyCommandResult[]` | No | Results of any dependency setup commands the skill declares |

`SkillMetadataCollection` wraps a list of these entries under a `skills` array.

### DependencyCommandResult

Captures the outcome of a single dependency setup command executed when the skill was registered:

| Field | Type | Required | Description |
|---|---|---|---|
| `command` | string[] | Yes | The command tokens that were executed |
| `success` | boolean | Yes | Whether the command exited successfully |
| `stdout` | string \| null | No | Captured standard output |
| `stderr` | string \| null | No | Captured standard error |

## Skill content

`SkillContentResult` is returned by `GET /v1/skills/{name}/content`:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Skill name |
| `path` | string | Yes | Absolute path to the skill directory inside the container |
| `content` | string | Yes | Full SKILL.md body with front matter stripped |

The `content` field contains the instructional body of the skill file — the portion an orchestrator or agent would read to understand how to execute the skill — without the YAML front matter block.

## Schemas

TypeScript sketches of the core types:

```typescript
// Multipart upload body for POST /v1/skills/register
interface Body_register_skills {
  file?: Blob | null;   // binary skill file upload
  path?: string | null; // path to skill dir inside container
  name?: string | null; // override name
}

// Result of a dependency setup command
interface DependencyCommandResult {
  command: string[];    // executed command tokens
  success: boolean;
  stdout?: string | null;
  stderr?: string | null;
}

// Metadata for one registered skill
interface SkillMetadata {
  name: string;
  path: string;         // absolute path inside container
  metadata?: Record<string, unknown>; // parsed front matter
  dependency_commands?: DependencyCommandResult[];
}

// Collection wrapper returned by GET /v1/skills/metadatas
interface SkillMetadataCollection {
  skills?: SkillMetadata[];
}

// Content of a single skill (front matter stripped)
interface SkillContentResult {
  name: string;
  path: string;
  content: string;      // SKILL.md body, front matter excluded
}

// Result of a registration operation
interface SkillRegistrationResult {
  count: number;                    // number of skills registered
  registered?: SkillMetadata[];     // metadata for each registered skill
}

// Generic API response envelope (all endpoints use this pattern)
interface Response<T> {
  success: boolean;     // default: true
  message: string | null; // default: "Operation successful"
  data: T | null;
}

// Specialised envelope aliases
type Response_SkillRegistrationResult_  = Response<SkillRegistrationResult>;
type Response_SkillMetadataCollection_  = Response<SkillMetadataCollection>;
type Response_SkillMetadata_            = Response<SkillMetadata>;
type Response_SkillContentResult_       = Response<SkillContentResult>;
type Response_dict_                     = Response<Record<string, unknown>>;
```

## Use from Nexus

Nexus currently seeds skills directly into DeepAgents via `orchestrator.invoke({ files: nexusSkillFiles })`, where `nexusSkillFiles` is a `FileData` map assembled by the `skills/index.ts` barrel export. This in-state approach is faster for cold starts because skills travel with the orchestrator invocation and require no additional HTTP round-trips. The AIO Sandbox HTTP registry is the alternative pattern: skills are uploaded once with `POST /v1/skills/register` and then remain available server-side for any subsequent orchestrator restart or agent that calls `GET /v1/skills/{name}/content`. The trade-off is that the HTTP registry survives orchestrator restarts but is destroyed when the sandbox container stops, whereas the DeepAgents in-state pattern is ephemeral per invocation but trivially reproducible by re-invoking the barrel export.

## Comparison with DeepAgents skills

| Aspect | DeepAgents `/skills/` | AIO Sandbox skills API |
|---|---|---|
| Storage | In-state `FileData` map or backend-routed filesystem | HTTP registry inside the sandbox container |
| Lifecycle | Per-orchestrator-invocation (or backend-persisted) | Per-sandbox-container |
| Format | `SKILL.md` + associated files in a virtual POSIX path | Multipart upload to `POST /v1/skills/register` |
| Discovery | Filesystem read of `/skills/` by DeepAgents middleware | `GET /v1/skills/metadatas` |
| Front matter access | Read by DeepAgents FilesystemMiddleware | Parsed and surfaced in `SkillMetadata.metadata` |
| Dependency execution | Not handled automatically | Executed on registration; results in `dependency_commands` |
| Current Nexus usage | Active (barrel export at `skills/index.ts`) | Not used |

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[agent-infra-sandbox-sdk]]
- [[skills]]
- [[skill-md-format]]

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/skills/*`; schemas: `Body_register_skills`, `SkillMetadata`, `SkillMetadataCollection`, `SkillContentResult`, `SkillRegistrationResult`, `DependencyCommandResult`, `Response_SkillRegistrationResult_`, `Response_SkillMetadataCollection_`, `Response_SkillMetadata_`, `Response_SkillContentResult_`, `Response_dict_`, `HTTPValidationError`, `ValidationError`
