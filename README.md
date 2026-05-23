# makeugc-mcp

MCP server for [MakeUGC.ai](https://makeugc.ai) — automate AI UGC video and image creation directly from Claude Code.

Built by [@hvmudvlab](https://instagram.com/hvmudvlab).

---

## What it does

Control MakeUGC from inside Claude Code:

```
makeugc_list_actors         — browse available AI actors
makeugc_create_video        — generate a UGC video (Talking Actors mode)
makeugc_create_image        — generate an image (Image Generator mode)
makeugc_animate_seedance    — animate an image into video (Seedance 2.0 mode)
makeugc_list_videos         — see all videos in your workspace
makeugc_get_video           — get video URL / download link
```

No API key needed. Uses browser automation against your logged-in session.

---

## Install

```bash
git clone https://github.com/hvmudvlab/makeugc-mcp
cd makeugc-mcp
npm install
npx playwright install chromium
```

---

## Setup (one time)

Run the setup wizard. It opens a browser for you to log in, then saves your session:

```bash
npm run setup
```

After logging in, press Enter in the terminal. Done.

---

## Register with Claude Code

```bash
claude mcp add makeugc node /path/to/makeugc-mcp/src/index.js
```

Restart Claude Code. You now have `makeugc_*` tools available.

---

## Connect to your running Chrome (advanced)

If you want to use your existing logged-in Chrome instead of a separate browser:

1. Launch Chrome with remote debugging:
   ```bash
   # Mac
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```

2. Set the env variable:
   ```bash
   CHROME_WS_ENDPOINT=http://localhost:9222 node src/index.js
   ```

---

## Usage in Claude Code

### List actors
```
makeugc_list_actors(gender: "female")
```

### Create a UGC video (Talking Actors)
```
makeugc_create_video(
  actorName: "Camille",
  script: "Brands pay $2,000 for UGC videos. I just made one in 5 minutes using AI.",
  voice: "nova"
)
```

### Generate an image (text-to-image)
```
makeugc_create_image(
  prompt: "Gym selfie, athletic woman, olive skin, holding protein shake, studio lighting"
)
```

### Generate an image (image-to-image)
```
makeugc_create_image(
  prompt: "Same person, luxury fashion editorial, marble background",
  imageFile: "/path/to/reference.jpg"
)
```

### Animate an image with Seedance 2.0
```
makeugc_animate_seedance(
  imageFile: "/path/to/model.jpg",
  prompt: "Subtle natural breathing, slight head turn toward camera, hair strands shift gently. Static camera.",
  quality: "best"
)
```

### Check results
```
makeugc_list_videos()
makeugc_get_video(index: 0)
```

---

## Script tips

- Keep under 150 words for best lip sync
- Use `[laughs]`, `[sighs]`, `[excited]` for emotion
- Start with the hook — first 3 seconds matter most
- End with a CTA

## Seedance prompt tips

- Use `@Image1` to reference your uploaded image
- Specify camera: "Static camera" / "Slow push in" / "Orbit shot"
- Break into time segments for 10s+ videos: `0–3s: ... 3–6s: ...`
- Add sound design: "Background music: ambient, warm"

---

## Troubleshooting

**"Script textarea not found"** — make sure you are on a project page in MakeUGC before running create_video.

**"Add Actors not found"** — the page might not be fully loaded. Run makeugc_list_videos first to navigate to the right page.

**"Mode not found in dropdown"** — the page may not be on a project editor. Run makeugc_list_videos first to navigate.

**Browser not opening** — run `npx playwright install chromium` to install the browser binary.

---

## License

MIT — use freely, give credit if you make a tutorial.
