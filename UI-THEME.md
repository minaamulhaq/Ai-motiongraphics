# AI Vid design system

AI Vid is a dark motion studio. Build each screen around the artwork and one clear next action. The production tokens live in `app/studio.css` and map to the existing shadcn theme.

## Color

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | background | #101110 | Page and recessed fields |
| Surface | card | #191A18 | Composer and dialogs |
| Raised surface | popover | #20211F | Menus and popovers |
| Control | secondary | #262724 | Secondary buttons and selects |
| Text | foreground | #F5F2EB | Titles, prompts and labels |
| Supporting text | muted-foreground | #B5B5AC | Descriptions, hints and metadata |
| Stroke | border | #383934 | Dividers and image outlines |
| Control outline | input | #474840 | Input and button edges |
| Action | primary | #FF8048 | Generate, brand and selected markers |
| Action text | primary-foreground | #20150E | Text and icons on orange |
| Focus | ring | #FFA978 | Keyboard focus and action hover |
| Error | destructive | #FF9990 | Errors accompanied by explanatory text |

Use violet, moss green and blue in artwork and charts. Keep product actions orange throughout the app.

## Type and layout

Use Inter when installed, followed by Segoe UI and Arial. Use Georgia italic for one emphasized word in the landing headline. Reserve Consolas or Courier New for short frame labels, runtimes and clip settings. Keep body text at 14–16 px with 1.5–1.6 line height. Give long titles room to wrap in dialogs.

Center the desktop content within 1,192 px. Arrange the header in three columns so navigation stays centered. Pair hero copy with a landscape reel and use a three-column project gallery. Below 580 px, stack the reel and gallery, move navigation to a second row and wrap composer controls. Use 6–7 px radii for controls and 9–14 px for artwork and grouped surfaces.

## Interaction

- Give each composer a visible label, multiline prompt field, duration and ratio selects, and a primary action on the right. Enter adds a line. Control or Command + Enter submits.
- Keep duration choices at 5, 10 and 20 seconds. Keep ratio labels at 10:19, 16:9 and 19:6. Use the actual chosen proportions in playback.
- Show a short example or writing tip below the composer. Keep errors beside the relevant action and preserve prompt text after validation or sign-in.
- Use text alongside icons for main actions. Label icon-only buttons and give keyboard focus a visible ring. Native dialogs contain focus and support Escape.
- Start artwork playback on request. Use a gentle fade for reduced-motion preferences.
- Guests see the studio collection and projects their creators shared. Signed-in users see their own library. Start new projects as private and let the creator explicitly choose community sharing.
- Distinguish a browser motion study from output rendered by a video model. Only show a saved state after the server confirms it.

## Project workspace

Use a 68 px header and a 350 px left panel at desktop sizes. Keep Chat and Themes in shadcn Tabs. Scroll the conversation independently and anchor its labeled multiline composer at the bottom. Place the send action at the lower right of the composer.

Show the selected video proportions on the right. Pair each render stage with a text status and icon, and derive progress from real preparation, capture and encoding work. Support cancellation, retry, native playback controls and download. Keep loading and failed database states visible with a route back to the studio.

Below 680 px, place the video area above a full-width conversation panel. Theme choices use labeled radio controls with previews. Preserve the shared orange action color, charcoal surfaces and keyboard focus ring.

