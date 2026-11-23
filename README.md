# Hou2Touch — Design System

The visual, motion and generative design language of the Hou2Touch course site,
extracted from its source so that other teams and AI agents can produce original
work — motion graphics, video, social content, posters, generative compositions —
that belongs to the same visual universe.

**Start here → [MASTER_DESIGN_SYSTEM.md](MASTER_DESIGN_SYSTEM.md)**

**Working with the system (any AI agent) → read [AGENT_GUIDE.md](AGENT_GUIDE.md)
before you produce anything.** It is the field guide: where the truth lives,
how to read the site's Russian decision comments, the "feel" checklist, the
known traps you must not "fix", and the two gates to run before you claim
work is done.

## What is in here

| Folder | Contents |
|---|---|
| `identity/` | colour tokens, typography, layout grid, composition principles |
| `generative/` | the WebGL engine: all 29 motifs with verbatim GLSL, algorithms, dithering, reusable components |
| `motion/` | easing vocabulary, animation timings, transitions, reproducible recipes |
| `technical/` | architecture, dependencies, rendering model, copy-paste code layer |
| `references/` | visual catalogue and negative catalogue |
| `production/` | video, social media, print and prompt guidelines |

## The five rules

1. The field is a **1-bit ordered Bayer 8×8 dither**, not a gradient and not noise.
2. Accent colour appears **only inside ink**, and only one family colour per composition.
3. **Never** resample. Render at cell resolution, upscale by an integer factor, nearest-neighbour.
4. Three voices never mix inside one line: display, text, mono.
5. Three named easings: `cubic-bezier(.19,1,.22,1)` general, `cubic-bezier(.22,1,.36,1)` entrance, `cubic-bezier(.2,0,0,1)` exit / state change. State-transition durations 0.3–1.4 s.

Full rules, the verification checklist and the list of known gaps are in
[MASTER_DESIGN_SYSTEM.md](MASTER_DESIGN_SYSTEM.md).

## Provenance

Everything here was extracted from the live source of the course site
(`src/template.html`, `tools/hero_index_mock.html`, `en/adapt_1611.py`,
`family/family.py`, `tools/pipeline/*`) and from the built pages. Every value is
marked `MEASURED` (read from source) or `ESTIMATED`. The site itself was not
modified.
