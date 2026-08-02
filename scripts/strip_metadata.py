"""Strip metadata and normalize all vocab MP3s to 32kbps mono 44.1kHz."""
import os
import subprocess
import shutil
import sys

VOCAB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "audio", "vocab")

def main():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        sys.exit("ffmpeg not found in PATH")

    files = [f for f in os.listdir(VOCAB_DIR) if f.lower().endswith(".mp3")]
    total = len(files)
    print(f"Processing {total} MP3 files in {VOCAB_DIR}\n")

    for i, fname in enumerate(sorted(files), 1):
        src = os.path.join(VOCAB_DIR, fname)
        tmp = src + ".tmp.mp3"
        size_before = os.path.getsize(src) / 1024

        result = subprocess.run(
            [ffmpeg, "-y", "-i", src, "-map_metadata", "-1",
             "-b:a", "32k", "-ar", "44100", "-ac", "1", tmp],
            capture_output=True
        )

        if result.returncode == 0 and os.path.exists(tmp):
            os.replace(tmp, src)
            size_after = os.path.getsize(src) / 1024
            print(f"[{i}/{total}] {fname}: {size_before:.1f}KB -> {size_after:.1f}KB")
        else:
            if os.path.exists(tmp):
                os.remove(tmp)
            print(f"[{i}/{total}] FAILED: {fname}")

    print("\nDone!")

if __name__ == "__main__":
    main()
