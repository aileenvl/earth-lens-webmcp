# Demo script — target 2:35

## Setup before recording

- Use Chrome with WebMCP enabled and a fresh Earth Lens session.
- Sign in with ChatGPT so the embedded assistant is ready.
- Keep DevTools closed; zoom so the map, evidence panel, and agent are legible.
- Confirm all three live-source checks are green.
- Record system audio/microphone and show the URL once.

## 0:00–0:20 — Problem and promise

“Environmental maps contain valuable public evidence, but agents normally have
to guess their way through a visual interface. Earth Lens gives the website a
semantic tool layer, so a person and an agent can investigate the same map.”

Show Monterrey, the three live signals, and their source labels.

## 0:20–0:45 — Human establishes context

Change the investigation radius or time window in the visible UI.

“I provide the local context. This selection is the shared source of truth—not
hidden chat state.”

Type **“What is happening around Monterrey right now?”** in the visible
assistant and show that it answers from the current evidence without changing
the map.

## 0:45–1:10 — Agent reads structured evidence

Ask the browser agent: **“Use Earth Lens tools to inspect my current selection, list the sources,
and explain evidence coverage and limitations.”**

Show the tool calls and the source-aware result. Point out empty versus
unavailable and modelled versus observed evidence.

## 1:10–1:35 — Agent visibly changes the app

Ask: **“Expand the area to a 250 km radius and use the 7-day window.”**

Show the map circle and time control change visibly. Mention that the agent used
typed tools rather than clicking guessed coordinates.

## 1:35–1:55 — Human correction changes the next result

Use the human controls to return to a 100 km radius. Then ask:
**“Query the selected area again. What changed?”**

Show that the result follows the corrected human state. If useful, call undo and
show that it does not overwrite the newer correction.

## 1:55–2:20 — Collaborative artifact

Ask: **“Create a situation lens draft called ‘Monterrey environmental check’.”**

Show the draft status, area, window, gaps, citations, and timestamp.

“It stays a draft. Earth Lens cannot publish, message, or invent a risk score;
the person remains responsible for interpretation.”

## 2:20–2:35 — Close

“WebMCP turns a complex map into a reliable collaboration surface while keeping
the map visible and the human in control. That is Earth Lens.”

## Recording acceptance checklist

- Under 3:00, audible, and no jump cuts hiding tool execution.
- Browser visibly discovers and calls WebMCP tools.
- At least one read, mutation, human correction, second read, and draft appear.
- All displayed evidence is live or clearly labelled; no prototype footage.
- Public URL and repository are legible once.
