const musicFiles = document.getElementById("musicFiles");
const musicAudio = document.getElementById("musicAudio");
const musicPlayer = document.querySelector(".music-player");
const musicStatus = document.getElementById("musicStatus");
const currentTrackLabel = document.getElementById("currentTrack");
const trackList = document.getElementById("trackList");
const playbackButton = document.getElementById("togglePlayback");
const previousButton = document.getElementById("previousTrack");
const nextButton = document.getElementById("nextTrack");
const trackProgress = document.getElementById("trackProgress");
const elapsedTime = document.getElementById("elapsedTime");
const trackDuration = document.getElementById("trackDuration");
const musicVolume = document.getElementById("musicVolume");
const sharedMusicUploadPanel = document.getElementById("sharedMusicUploadPanel");
const sharedMusicLogin = document.getElementById("sharedMusicLogin");
const sharedMusicUpload = document.getElementById("sharedMusicUpload");
const sharedMusicEmail = document.getElementById("sharedMusicEmail");
const sharedMusicPassword = document.getElementById("sharedMusicPassword");
const sharedMusicFiles = document.getElementById("sharedMusicFiles");
const sharedMusicSignOut = document.getElementById("sharedMusicSignOut");
const sharedMusicUploadStatus = document.getElementById("sharedMusicUploadStatus");

const playlist = [];
const sharedTrackPaths = new Set();
const sharedMusicConfig = window.SHARED_MUSIC_CONFIG || {};
const sharedMusicUrl = (sharedMusicConfig.supabaseUrl || "").replace(/\/+$/, "");
const sharedMusicAnonKey = sharedMusicConfig.anonKey || "";
const sharedMusicBucket = sharedMusicConfig.bucket || "game-music";
let sharedMusicAccessToken = "";
let currentTrackIndex = -1;

function sharedMusicEndpoint(path) {
  return `${sharedMusicUrl}/storage/v1/${path}`;
}

async function readErrorMessage(response) {
  const payload = await response.json().catch(() => ({}));
  return payload.message || payload.msg || response.statusText;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function renderPlaylist() {
  trackList.replaceChildren();

  playlist.forEach((track, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const name = document.createElement("span");
    const duration = document.createElement("time");
    const saveLink = document.createElement("a");

    button.type = "button";
    button.className = "select-track";
    button.setAttribute("aria-current", String(index === currentTrackIndex));
    button.addEventListener("click", () => selectTrack(index, true));
    name.className = "track-name";
    name.textContent = track.file.name;
    duration.textContent = track.duration ? formatTime(track.duration) : "MP3";

    button.append(name, duration);
    saveLink.className = "save-track";
    saveLink.href = track.url;
    saveLink.download = track.file.name;
    saveLink.textContent = "Save";
    saveLink.setAttribute("aria-label", `Save ${track.file.name}`);
    if (track.isShared) {
      saveLink.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          const response = await fetch(track.url);
          if (!response.ok) {
            throw new Error("The shared MP3 could not be downloaded.");
          }

          const downloadUrl = URL.createObjectURL(await response.blob());
          const download = document.createElement("a");
          download.href = downloadUrl;
          download.download = track.file.name;
          download.click();
          URL.revokeObjectURL(downloadUrl);
        } catch (error) {
          musicStatus.textContent = error.message;
        }
      });
    }

    item.append(button, saveLink);
    trackList.append(item);
  });
}

function updatePlaybackButton() {
  const isPlaying = !musicAudio.paused;
  playbackButton.textContent = isPlaying ? "Pause" : "Play";
  playbackButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  playbackButton.title = isPlaying ? "Pause" : "Play";
  musicPlayer.classList.toggle("is-playing", isPlaying);
}

function showPlaybackError(error) {
  if (error?.name === "NotAllowedError") {
    musicStatus.textContent = "Playback was blocked. Press Play to start the track.";
  } else if (error?.name === "NotSupportedError") {
    musicStatus.textContent = "This file is not a supported MP3 audio stream.";
  } else {
    musicStatus.textContent = `Could not start playback${error?.message ? `: ${error.message}` : "."}`;
  }
}

function selectTrack(index, autoplay = false) {
  const track = playlist[index];
  if (!track) {
    return;
  }

  currentTrackIndex = index;
  musicAudio.src = track.url;
  currentTrackLabel.textContent = track.file.name;
  elapsedTime.textContent = "0:00";
  trackDuration.textContent = formatTime(track.duration);
  trackProgress.value = "0";
  trackProgress.disabled = false;
  playbackButton.disabled = false;
  previousButton.disabled = playlist.length < 2;
  nextButton.disabled = playlist.length < 2;
  musicStatus.textContent = `${playlist.length} track${playlist.length === 1 ? "" : "s"} loaded. Press Play to start.`;
  renderPlaylist();

  if (autoplay) {
    musicAudio.play().catch((error) => {
      showPlaybackError(error);
      updatePlaybackButton();
    });
  } else {
    updatePlaybackButton();
  }
}

function moveTrack(offset) {
  if (playlist.length === 0) {
    return;
  }

  const nextIndex = (currentTrackIndex + offset + playlist.length) % playlist.length;
  selectTrack(nextIndex, true);
}

async function loadSharedTracks() {
  if (!sharedMusicUrl || !sharedMusicAnonKey) {
    sharedMusicUploadPanel.hidden = true;
    if (playlist.length === 0) {
      musicStatus.textContent = "Choose local MP3s or configure shared music for everyone to hear.";
    }
    return;
  }

  sharedMusicUploadPanel.hidden = false;
  try {
    const response = await fetch(sharedMusicEndpoint(`object/list/${encodeURIComponent(sharedMusicBucket)}`), {
      method: "POST",
      headers: {
        apikey: sharedMusicAnonKey,
        Authorization: `Bearer ${sharedMusicAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } })
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const objects = await response.json();
    let addedCount = 0;
    for (const object of objects) {
      if (!object.name || !object.name.toLowerCase().endsWith(".mp3") || sharedTrackPaths.has(object.name)) {
        continue;
      }

      const encodedPath = object.name.split("/").map(encodeURIComponent).join("/");
      playlist.push({
        file: { name: object.name.split("/").pop() },
        url: `${sharedMusicUrl}/storage/v1/object/public/${encodeURIComponent(sharedMusicBucket)}/${encodedPath}`,
        duration: 0,
        isShared: true,
        sharedPath: object.name
      });
      sharedTrackPaths.add(object.name);
      addedCount += 1;
    }

    if (currentTrackIndex === -1 && playlist.length > 0) {
      selectTrack(0);
    } else {
      previousButton.disabled = playlist.length < 2;
      nextButton.disabled = playlist.length < 2;
      renderPlaylist();
    }

    musicStatus.textContent = addedCount > 0
      ? `${addedCount} shared MP3${addedCount === 1 ? "" : "s"} loaded. Select a track to listen.`
      : "No shared MP3s yet. Choose local files or upload shared tracks.";
  } catch (error) {
    console.error("Could not load the shared music playlist:", error);
    musicStatus.textContent = "Could not load shared MP3s. Local files are still available.";
  }
}

sharedMusicLogin.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = sharedMusicPassword.value;
  sharedMusicPassword.value = "";
  sharedMusicUploadStatus.textContent = "Signing in...";

  try {
    const response = await fetch(`${sharedMusicUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: sharedMusicAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: sharedMusicEmail.value, password })
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const session = await response.json();
    sharedMusicAccessToken = session.access_token;
    sharedMusicLogin.hidden = true;
    sharedMusicUpload.hidden = false;
    sharedMusicUploadStatus.textContent = "Signed in. Choose MP3 files to add them to the shared playlist.";
  } catch (error) {
    sharedMusicUploadStatus.textContent = `Sign-in failed: ${error.message}`;
  }
});

sharedMusicUpload.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...sharedMusicFiles.files].filter((file) =>
    file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3")
  );
  if (files.length === 0) {
    sharedMusicUploadStatus.textContent = "Choose one or more MP3 files to upload.";
    return;
  }

  const uploadButton = sharedMusicUpload.querySelector('button[type="submit"]');
  uploadButton.disabled = true;
  try {
    for (const [index, file] of files.entries()) {
      sharedMusicUploadStatus.textContent = `Uploading ${index + 1} of ${files.length}: ${file.name}`;
      const response = await fetch(sharedMusicEndpoint(`object/${encodeURIComponent(sharedMusicBucket)}/${encodeURIComponent(file.name)}`), {
        method: "POST",
        headers: {
          apikey: sharedMusicAnonKey,
          Authorization: `Bearer ${sharedMusicAccessToken}`,
          "Content-Type": file.type || "audio/mpeg",
          "x-upsert": "false"
        },
        body: file
      });
      if (!response.ok) {
        throw new Error(`${file.name}: ${await readErrorMessage(response)}`);
      }
    }

    sharedMusicFiles.value = "";
    sharedMusicUploadStatus.textContent = `Uploaded ${files.length} MP3${files.length === 1 ? "" : "s"}. Refreshing playlist...`;
    await loadSharedTracks();
    sharedMusicUploadStatus.textContent = `Uploaded ${files.length} MP3${files.length === 1 ? "" : "s"}. They are now in the shared playlist.`;
  } catch (error) {
    sharedMusicUploadStatus.textContent = `Upload failed: ${error.message}`;
  } finally {
    uploadButton.disabled = false;
  }
});

sharedMusicSignOut.addEventListener("click", () => {
  sharedMusicAccessToken = "";
  sharedMusicUpload.hidden = true;
  sharedMusicLogin.hidden = false;
  sharedMusicUploadStatus.textContent = "Signed out.";
});

musicFiles.addEventListener("change", () => {
  const selectedFiles = [...musicFiles.files].filter((file) =>
    file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3")
  );

  for (const file of selectedFiles) {
    playlist.push({ file, url: URL.createObjectURL(file), duration: 0 });
  }

  musicFiles.value = "";

  if (selectedFiles.length === 0) {
    musicStatus.textContent = "Select one or more MP3 files to add them to the playlist.";
    return;
  }

  if (currentTrackIndex === -1) {
    selectTrack(0);
  } else {
    previousButton.disabled = playlist.length < 2;
    nextButton.disabled = playlist.length < 2;
    musicStatus.textContent = `${playlist.length} tracks in playlist.`;
    renderPlaylist();
  }
});

playbackButton.addEventListener("click", () => {
  if (musicAudio.paused) {
    musicAudio.play().catch((error) => {
      showPlaybackError(error);
    });
  } else {
    musicAudio.pause();
  }
});

previousButton.addEventListener("click", () => moveTrack(-1));
nextButton.addEventListener("click", () => moveTrack(1));

musicAudio.addEventListener("loadedmetadata", () => {
  const track = playlist[currentTrackIndex];
  if (track) {
    track.duration = musicAudio.duration;
    trackDuration.textContent = formatTime(musicAudio.duration);
    renderPlaylist();
  }
});

musicAudio.addEventListener("timeupdate", () => {
  elapsedTime.textContent = formatTime(musicAudio.currentTime);
  trackProgress.value = musicAudio.duration
    ? String(Math.round((musicAudio.currentTime / musicAudio.duration) * 1000))
    : "0";
});

musicAudio.addEventListener("play", updatePlaybackButton);
musicAudio.addEventListener("pause", updatePlaybackButton);
musicAudio.addEventListener("ended", () => {
  if (playlist.length > 1) {
    moveTrack(1);
  } else {
    updatePlaybackButton();
  }
});
musicAudio.addEventListener("error", () => {
  const errorCode = musicAudio.error?.code;
  musicStatus.textContent = errorCode === MediaError.MEDIA_ERR_DECODE
    ? "The browser could not decode this file. It may be damaged or use an unsupported codec."
    : "The browser could not load this file. Try another MP3.";
  updatePlaybackButton();
});

trackProgress.addEventListener("input", () => {
  if (musicAudio.duration) {
    musicAudio.currentTime = (Number(trackProgress.value) / 1000) * musicAudio.duration;
  }
});

musicVolume.addEventListener("input", () => {
  musicAudio.volume = Number(musicVolume.value);
});

musicAudio.volume = Number(musicVolume.value);
loadSharedTracks();
window.addEventListener("beforeunload", () => {
  for (const track of playlist) {
    URL.revokeObjectURL(track.url);
  }
});