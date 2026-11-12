# Super-Basic-Brick-Bounce-Game

Block Breaker runs in the browser. Move the paddle with the arrow keys or A/D, or drag/tap on the game area on touch devices. Press P to pause or resume.

Choose Easy, Normal, or Hard before starting a game. Brick types include armored bricks that need two hits, moving bricks, and power-up bricks. Boss waves feature warning-marked focused and spread attacks; dodge the falling shots to avoid a temporary paddle shrink. Use the Sound button in the HUD to mute or unmute audio.

Chain brick hits without touching the paddle to build a combo multiplier, up to 12x. The combo resets when the ball hits the paddle or a life is lost.

After each non-boss level, choose one of three run upgrades: a wider paddle, an extra life, more laser charges, or faster laser shots. Upgrades last until the run ends.

For a visual-only effect, click **Rain tokens** to rain the shared image. Only the configured owner can upload or replace that image; visitors cannot choose or upload their own. The effect does not change gameplay.

Select **Daily Challenge** before starting to play that day's modifier on Normal difficulty. Modifiers rotate daily between a faster ball, a narrower paddle, and extra moving bricks. Challenge runs have a separate high score saved for each day.

The music player accepts local MP3s and can load a shared playlist from Supabase Storage. Shared tracks are available to everyone who opens the game. Use **Save** beside any track to download a copy.

## Shared Music Setup

1. Create a Supabase project and a public Storage bucket named `game-music`.
2. In Supabase Authentication, create an account for the owner and disable public sign-ups. Use that account to upload tracks from the game's **Upload shared MP3s** panel.
3. In [`shared-music-config.js`](shared-music-config.js), set `ownerEmail` to the owner's account email. In the Supabase SQL editor, run [`supabase-storage-policies.sql`](supabase-storage-policies.sql), replacing the owner email in the policies with the same address. The script creates the public `game-token` bucket.
4. Put the project's Project URL and publishable/anon key in `shared-music-config.js`. The browser key is public by design; never put a service-role key in this file.
5. Serve the game over HTTP (locally or from your website). Sign in to the shared music panel to upload MP3s. To set the token image, sign in under **Owner: manage token image** and upload a PNG, JPG, GIF, or WebP image up to 10 MB.

The `game-music` read policy allows anyone to list and download tracks; its insert policy limits uploads to the configured owner email. In `game-token`, anyone can read the single `pirate-token` image, while only the configured owner can upload or replace it. There is no delete policy. Do not add public upload, update, or delete policies.