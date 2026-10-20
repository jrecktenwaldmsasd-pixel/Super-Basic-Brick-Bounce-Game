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

const playlist = [];
let currentTrackIndex = -1;

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

    button.type = "button";
    button.setAttribute("aria-current", String(index === currentTrackIndex));
    button.addEventListener("click", () => selectTrack(index, true));
    name.className = "track-name";
    name.textContent = track.file.name;
    duration.textContent = track.duration ? formatTime(track.duration) : "MP3";

    button.append(name, duration);
    item.append(button);
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
  musicStatus.textContent = `${playlist.length} track${playlist.length === 1 ? "" : "s"} in playlist.`;
  renderPlaylist();

  if (autoplay) {
    musicAudio.play().catch(() => {
      musicStatus.textContent = "This MP3 could not be played by your browser.";
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
    musicAudio.play().catch(() => {
      musicStatus.textContent = "This MP3 could not be played by your browser.";
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
  musicStatus.textContent = "This MP3 could not be loaded. Try another file.";
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
window.addEventListener("beforeunload", () => {
  for (const track of playlist) {
    URL.revokeObjectURL(track.url);
  }
});