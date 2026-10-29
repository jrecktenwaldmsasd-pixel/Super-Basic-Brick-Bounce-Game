# Super-Basic-Brick-Bounce-Game

Block Breaker runs in the browser. Move the paddle with the arrow keys or A/D, or drag/tap on the game area on touch devices. Press P to pause or resume.

Choose Easy, Normal, or Hard before starting a game. Brick types include armored bricks that need two hits, moving bricks, and power-up bricks. Use the Sound button in the HUD to mute or unmute audio.

Chain brick hits without touching the paddle to build a combo multiplier, up to 12x. The combo resets when the ball hits the paddle or a life is lost.

The music player accepts local MP3s and can load a shared playlist from Supabase Storage. Shared tracks are available to everyone who opens the game. Use **Save** beside any track to download a copy.

## Shared Music Setup

1. Create a Supabase project and a public Storage bucket named `game-music`.
2. In Supabase Authentication, create an account for the owner and disable public sign-ups. Use that account to upload tracks from the game's **Upload shared MP3s** panel.
3. In the Supabase SQL editor, run [`supabase-storage-policies.sql`](supabase-storage-policies.sql) after replacing `your-owner-email@example.com` with the owner's account email.
4. Put the project's Project URL and publishable/anon key in `shared-music-config.js`. The browser key is public by design; never put a service-role key in this file.
5. Serve the game over HTTP (locally or from your website), sign in to the upload panel, and upload MP3s. The playlist refreshes and visitors can play or save those files.

The bucket's read policy allows anyone to list and download tracks. The insert policy limits uploads to the configured owner email. Do not add public upload, update, or delete policies.