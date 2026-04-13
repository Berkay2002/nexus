---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, browser, tool-call, workspace]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox Browser API

The AIO Sandbox exposes a Chromium browser over the `/v1/browser/*` REST surface, using the Chrome DevTools Protocol (CDP) as the underlying transport. Four endpoints cover introspection, screen capture, input dispatch, and viewport configuration — giving agents a full GUI automation loop without any Playwright or Puppeteer dependency.

> **Note — not Playwright:** The browser is controlled directly via CDP. The API speaks in raw actions (coordinates, key names, scroll deltas), not in high-level Playwright/Puppeteer selectors. Agents must navigate by pixel coordinates obtained from screenshots.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/browser/info` | Return CDP URL, VNC URL, user agent, and viewport size |
| `GET` | `/v1/browser/screenshot` | Capture current display as a PNG binary stream |
| `POST` | `/v1/browser/actions` | Dispatch a single mouse/keyboard/wait action |
| `POST` | `/v1/browser/config` | Reconfigure the display resolution |

### GET /v1/browser/info

Returns metadata about the running browser instance. Response is `Response<BrowserInfoResult>` (JSON).

```
GET /v1/browser/info
→ 200 application/json
{
  "success": true,
  "data": {
    "user_agent": "...",
    "cdp_url": "ws://localhost:9222/...",   // Chrome DevTools Protocol WebSocket URL
    "vnc_url": "...",
    "viewport": { "width": 1280, "height": 720 }
  }
}
```

The `cdp_url` field exposes the CDP WebSocket endpoint — callers that need lower-level browser control (e.g., injecting JS via CDP directly) should use this URL.

### GET /v1/browser/screenshot

Captures the current display and returns a raw PNG byte stream. There are no query parameters. Dimensions are reported in response headers, not in the body.

```
GET /v1/browser/screenshot
→ 200 image/png   (binary body)
Headers:
  x-screen-width   — physical display width (px)
  x-screen-height  — physical display height (px)
  x-image-width    — actual PNG image width (px)
  x-image-height   — actual PNG image height (px)
```

> **Note — header vs body dimensions:** Screen and image dimensions may differ if the display resolution differs from the encoded PNG resolution. Always read coordinates against `x-image-width` / `x-image-height`, not the screen headers, when computing click targets from screenshot pixels.

### POST /v1/browser/actions

Dispatches a single action. The request body is a discriminated union — the `action_type` string field selects which schema is in use. See [Browser actions](#browser-actions) below for the full list.

```
POST /v1/browser/actions
Content-Type: application/json
{ "action_type": "CLICK", "x": 640, "y": 400 }

→ 200 application/json
{ "status": "...", "action_performed": "..." }
```

Returns `422 Unprocessable Entity` (with a `ValidationError` body) if the payload does not match any known action schema.

> **Note — one action per call:** The endpoint accepts a single action object, not an array. Sequential automation requires multiple POST calls.

### POST /v1/browser/config

Updates the display resolution. Resolution must be one of the pre-approved values (see `BrowserConfigRequest` schema below). Returns the generic `Response` envelope.

```
POST /v1/browser/config
Content-Type: application/json
{ "resolution": { "width": 1920, "height": 1080 } }

→ 200 application/json
{ "success": true, "message": "Operation successful" }
```

## Browser actions

All actions are sent to `POST /v1/browser/actions`. The `action_type` field (a SCREAMING_SNAKE_CASE string) is the discriminator. Each action object must include `action_type`; all other fields listed as required must also be present.

### Quick reference table

| `action_type` | Required fields | Optional/defaulted fields | Notes |
|--------------|-----------------|--------------------------|-------|
| `MOVE_TO` | `x`, `y` | — | Absolute coords |
| `MOVE_REL` | `x_offset`, `y_offset` | — | Relative to current cursor |
| `CLICK` | — | `x`, `y`, `button` (`left`), `num_clicks` (1) | `button`: left/right/middle; `num_clicks`: 1/2/3 |
| `DOUBLE_CLICK` | — | `x`, `y` | Convenience alias for `num_clicks=2` |
| `RIGHT_CLICK` | — | `x`, `y` | Convenience alias for `button=right` |
| `MOUSE_DOWN` | — | `button` (`left`) | Holds button down until `MOUSE_UP` |
| `MOUSE_UP` | — | `button` (`left`) | Releases a held button |
| `DRAG_TO` | `x`, `y` | — | Drag current selection to absolute coords |
| `DRAG_REL` | `x_offset`, `y_offset` | — | Drag relative to current position |
| `SCROLL` | — | `dx` (0), `dy` (0) | Integer pixel deltas |
| `TYPING` | `text` | `use_clipboard` (`true`) | Streams characters; clipboard path handles special chars |
| `PRESS` | `key` | — | Full key event (down + up) for a single key |
| `KEY_DOWN` | `key` | — | Holds key down (for modifier chords) |
| `KEY_UP` | `key` | — | Releases a held key |
| `HOTKEY` | `keys` (array) | — | Chord — all keys pressed simultaneously |
| `WAIT` | `duration` | — | Pause in seconds (float) |

### Mouse movement

**`MOVE_TO`** moves the cursor to absolute screen coordinates `(x, y)`.

**`MOVE_REL`** moves the cursor by `(x_offset, y_offset)` pixels relative to its current position.

> **Note — MOVE_TO vs MOVE_REL:** `MOVE_TO` takes `x`/`y` (absolute). `MOVE_REL` takes `x_offset`/`y_offset` (relative delta). Mixing up the field names causes a 422 validation error. Prefer `MOVE_TO` when you have screenshot-derived coordinates; prefer `MOVE_REL` for fine adjustments when the exact screen position is unknown.

### Mouse clicks

**`CLICK`** dispatches a left-click by default. `x`/`y` are optional — if omitted, the click lands at the current cursor position. The `button` enum accepts `left`, `right`, or `middle`. `num_clicks` accepts 1, 2, or 3.

**`DOUBLE_CLICK`** is a named shorthand with `action_type` `DOUBLE_CLICK`; `x`/`y` optional.

**`RIGHT_CLICK`** is a named shorthand for a right mouse button click; `x`/`y` optional.

**`MOUSE_DOWN` / `MOUSE_UP`** send the raw button-press and button-release events independently, allowing arbitrary hold intervals. The `button` field defaults to `left`.

### Drag

**`DRAG_TO`** drags from the current cursor position to absolute coordinates `(x, y)`.

**`DRAG_REL`** drags from the current cursor position by a relative offset `(x_offset, y_offset)`.

> **Note — DRAG_TO vs DRAG_REL:** Same absolute/relative split as the MOVE pair. `DRAG_TO` expects `x`/`y`; `DRAG_REL` expects `x_offset`/`y_offset`. Both require their fields (no defaults).

### Scroll

**`SCROLL`** scrolls the page by integer pixel deltas. `dx` scrolls horizontally, `dy` scrolls vertically. Both default to 0 if omitted. Positive `dy` scrolls down.

### Keyboard

There are four keyboard primitives — choosing the wrong one is a common mistake:

**`PRESS`** — sends a full key event (keydown + keyup) for a single key name (e.g., `"Return"`, `"Tab"`, `"Escape"`). Use this for single-key activations.

**`KEY_DOWN`** / **`KEY_UP`** — send the down and up events independently, allowing hold semantics. Use these to simulate modifier key chords manually (e.g., hold Shift while clicking).

**`HOTKEY`** — sends all keys in the `keys` array simultaneously as a chord. This is the correct action for shortcuts like `ctrl+c`, `ctrl+shift+p`, or `alt+F4`. The `keys` field is a required array of key name strings.

**`TYPING`** — types a string of text character by character. The `use_clipboard` flag (defaults to `true`) routes through the clipboard, which correctly handles special and non-ASCII characters. For plain ASCII text, direct typing is fine; for anything else, leave `use_clipboard` at its default.

> **Note — Hotkey vs Press vs KeyDown/KeyUp:** Use `HOTKEY` for multi-key chords (`ctrl+c`). Use `PRESS` for a single key stroke (`Return`). Use `KEY_DOWN` + `KEY_UP` only when you need explicit control over the hold timing (e.g., holding a modifier while dispatching mouse events between them). Do not use `HOTKEY` with a single-element `keys` array — use `PRESS` instead.

### Wait

**`WAIT`** pauses execution for `duration` seconds (float). Required field; no default.

## Schemas

### BrowserInfoResult

```typescript
interface BrowserInfoResult {
  user_agent: string;        // Browser user-agent string
  cdp_url: string;           // CDP WebSocket URL (ws://...)
  vnc_url: string;           // VNC viewer URL
  viewport: BrowserViewport; // Current viewport dimensions
}

interface BrowserViewport {
  width: number;   // Viewport width in pixels
  height: number;  // Viewport height in pixels
}
```

### BrowserConfigRequest

```typescript
interface BrowserConfigRequest {
  resolution?: Resolution | null;  // null leaves resolution unchanged
}

interface Resolution {
  width: number;   // Screen width in pixels
  height: number;  // Screen height in pixels
}
```

Allowed resolution values: `1920x1080`, `1920x1200`, `1680x1050`, `1600x1200`, `1400x1050`, `1360x768`, `1280x1024`, `1280x960`, `1280x800`, `1280x720`, `1024x768`, `800x600`, `640x480`.

> **Note — unsupported resolutions:** The API description lists a fixed enumeration of allowed resolutions. Submitting an arbitrary `width`/`height` pair that is not in this list is likely to return a validation error. Always use one of the listed values.

### ActionResponse

```typescript
interface ActionResponse {
  status: string;           // Action completion status
  action_performed: string; // Human-readable description of what was performed
}
```

### Response (generic envelope)

```typescript
interface Response<T = unknown> {
  success: boolean;          // Default: true
  message: string | null;    // Default: "Operation successful"
  data: T | null;            // Payload; null for void operations
}
```

`GET /v1/browser/info` returns `Response<BrowserInfoResult>`. `POST /v1/browser/config` returns the bare `Response` (data is null on success).

## Use from Nexus

The research sub-agent uses the browser API for live web automation when [[tavily-overview]] search tools are insufficient — for example, when a site requires login, renders content dynamically via JavaScript, or demands multi-step form interaction. The typical loop is: take a screenshot, parse coordinates from the image, dispatch click/type actions, screenshot again to verify state.

Screenshots captured during research tasks should be saved to `/home/gem/workspace/research/task_{id}/screenshots/` per the [[aio-sandbox-overview]] workspace convention. The `cdp_url` from `/v1/browser/info` can be used by tools that need to inject JavaScript or intercept network requests directly via CDP, without going through the action dispatch layer.

> **Note — coordinate space:** All click and move coordinates are in the PNG image's pixel space, not the browser's logical CSS pixel space. If `x-image-width` differs from `x-screen-width` (e.g., due to HiDPI scaling), compute coordinates against the image dimensions, not the screen dimensions.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-openapi-overview]]
- [[aio-sandbox-features]]
- [[aio-sandbox-shell-api]]
- [[tavily-overview]]

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/browser/info`, `/v1/browser/screenshot`, `/v1/browser/actions`, `/v1/browser/config`; schemas: `BrowserInfoResult`, `BrowserViewport`, `BrowserConfigRequest`, `Resolution`, `ActionResponse`, `Response`, `Response_BrowserInfoResult_`, `ClickAction`, `DoubleClickAction`, `RightClickAction`, `MouseDownAction`, `MouseUpAction`, `MoveToAction`, `MoveRelAction`, `DragToAction`, `DragRelAction`, `ScrollAction`, `TypingAction`, `PressAction`, `KeyDownAction`, `KeyUpAction`, `HotkeyAction`, `WaitAction`, `HTTPValidationError`, `ValidationError`
