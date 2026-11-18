"""Record the Hirely job story loop to two MP4 files: 16:9 (1920x1080) and 9:16 (1080x1920).

Run the web dev server first (cd web && npm run dev), then from the repo root:

    python marketing/record-story.py

Optional: --url (default http://localhost:5173/story), --ffmpeg (path to ffmpeg).
The HIRELY_FFMPEG environment variable does the same as --ffmpeg.

How it works
- The story runs on a fake clock (Playwright's page.clock), so every frame lands on an exact
  time. Frames are taken at 30 fps.
- Two passes of the 13 second loop are captured. The MP4 is the second pass, so it starts
  in the steady state and is exactly one loop long (390 frames at 30 fps).
- Frames are piped straight into ffmpeg (H.264, yuv420p, 30 fps). No PNG files are kept.
"""

import argparse
import os
import pathlib
import shutil
import subprocess
import sys

from playwright.sync_api import Browser, sync_playwright

LOOP_SECONDS = 13
FPS = 30
PASSES = 2
FRAMES_PER_LOOP = LOOP_SECONDS * FPS
DEFAULT_URL = "http://localhost:5173/story"
FFMPEG_FALLBACK = r"C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe"

OUT_DIR = pathlib.Path(__file__).resolve().parent
OUTPUTS = [
    ("16x9", 1920, 1080, OUT_DIR / "hirely-story-16x9.mp4"),
    ("9x16", 1080, 1920, OUT_DIR / "hirely-story-9x16.mp4"),
]


def find_tool(name: str, explicit: str | None, fallback: str | None) -> str:
    """Looks for a tool on PATH, then at the given fallback location."""
    for candidate in (explicit, os.environ.get("HIRELY_FFMPEG") if name == "ffmpeg" else None, shutil.which(name), fallback):
        if candidate and (shutil.which(candidate) or pathlib.Path(candidate).exists()):
            return candidate
    sys.exit(f"Could not find {name}. Install it, or pass --ffmpeg with the full path.")


def launch(p) -> Browser:
    """Uses Playwright's own Chromium. If it is not installed, falls back to the Chrome on this machine."""
    try:
        return p.chromium.launch()
    except Exception:
        return p.chromium.launch(channel="chrome")


def record(browser: Browser, url: str, width: int, height: int, out_path: pathlib.Path, ffmpeg: str) -> None:
    """Captures PASSES loops of the story at the given size and writes the second pass to out_path."""
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        color_scheme="light",
        reduced_motion="no-preference",  # the story must animate, even on a machine set to reduce motion
    )
    page = context.new_page()
    # The fake clock must be running before the page loads, or the animation starts from the wrong time.
    page.clock.install(time=0)
    page.clock.pause_at(1000)
    page.goto(url)
    page.wait_for_selector(".story-svg")

    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "png", "-i", "-",
        # keep only the second pass (frames 390 onward)
        "-vf", f"select=gte(n\\,{FRAMES_PER_LOOP}),setpts=N/FRAME_RATE/TB",
        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-movflags", "+faststart", str(out_path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        total = FRAMES_PER_LOOP * PASSES
        previous_ms = 0
        for i in range(total):
            target_ms = round(i * 1000 / FPS)
            if target_ms > previous_ms:
                page.clock.run_for(target_ms - previous_ms)
                previous_ms = target_ms
            proc.stdin.write(page.screenshot(type="png"))
    finally:
        proc.stdin.close()
        proc.wait()
        context.close()
    if proc.returncode != 0:
        sys.exit(f"ffmpeg failed for {out_path.name} (exit {proc.returncode})")


def check(ffprobe: str, path: pathlib.Path) -> str:
    """Reads the stream details back, so the result is confirmed rather than assumed."""
    out = subprocess.run(
        [ffprobe, "-v", "error", "-select_streams", "v:0", "-count_frames",
         "-show_entries", "stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_read_frames,duration",
         "-of", "default=noprint_wrappers=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return " ".join(line.strip() for line in out.stdout.splitlines())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--ffmpeg", default=None)
    args = parser.parse_args()

    ffmpeg = find_tool("ffmpeg", args.ffmpeg, FFMPEG_FALLBACK)
    ffprobe_guess = str(pathlib.Path(ffmpeg).with_name("ffprobe.exe")) if pathlib.Path(ffmpeg).exists() else "ffprobe"
    ffprobe = ffprobe_guess if pathlib.Path(ffprobe_guess).exists() else (shutil.which("ffprobe") or "ffprobe")

    with sync_playwright() as p:
        browser = launch(p)
        try:
            for label, width, height, out_path in OUTPUTS:
                print(f"Recording {label} ({width}x{height}) ...", flush=True)
                record(browser, args.url, width, height, out_path, ffmpeg)
                print(f"  wrote {out_path}", flush=True)
                print(f"  {check(ffprobe, out_path)}", flush=True)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
