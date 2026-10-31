# Gera docs/videos.json e CREDITS.md a partir dos vídeos já enviados para a release.
# Uso: python3 make-videos.py <pasta com os .mp4>
import json, os, re, subprocess, sys

REL = "https://github.com/FeMotta/bike-tv/releases/download/videos-v1/"
RIDES = {
    "tohOX3TnC-8": ("Brenner → Vipiteno", "Alpes do Sul do Tirol, Itália", "Shared Spaces"),
    "ozdojmyHkRU": ("Dolomitas no outono — Val Badia", "Dolomitas, Itália", "Shared Spaces"),
    "Ty5EgbqmIiE": ("Costa dei Trabocchi", "Mar Adriático, Itália", "Shared Spaces"),
    "rLGKv6Ec5_4": ("Ciclovia Alpe Adria — Grado → Palmanova", "Friuli, Itália", "Shared Spaces"),
    "3TDVBJs-Pks": ("Bressanone → Bolzano", "Sul do Tirol, Itália", "Shared Spaces"),
    "QCLjgc_qaU8": ("Brixen → Brunico no inverno", "Sul do Tirol, Itália", "Shared Spaces"),
    "C7NvPveIbMM": ("Mallorca — Llucmajor", "Espanha", "LM Hinojosa"),
    "Btjm0UKbqD0": ("Kyoto no outono", "Japão", "VIRTUAL KYOTO"),
    "fNubHQiqbXA": ("Interior e paisagens", "Campo", "Her Journeys Diary"),
    "nsUbivnzNec": ("Interior do Japão — Nagano", "Japão", "4K Japan Walk"),
    "qoPGs1xSzx4": ("Key West", "Flórida, EUA", "You Are Here"),
}

def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)

def fmt(sec):
    m = round(sec / 60)
    return f"{m} min" if m < 60 else f"{m // 60}h{m % 60:02d}"

folder = sys.argv[1]
files = sorted(f for f in os.listdir(folder) if f.endswith(".mp4"))
videos = []
for vid, (title, place, author) in RIDES.items():
    parts = [f for f in files if re.fullmatch(re.escape(vid) + r"(_p\d+)?\.mp4", f)]
    parts.sort(key=lambda f: int(re.search(r"_p(\d+)", f).group(1)) if "_p" in f else 0)
    for i, f in enumerate(parts, 1):
        t = title if len(parts) == 1 else f"{title} ({i}/{len(parts)})"
        videos.append({"url": REL + f, "title": t, "place": place, "length": fmt(duration(os.path.join(folder, f))),
                       "credit": f"{author} · CC BY", "source": f"https://www.youtube.com/watch?v={vid}"})

here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "docs", "videos.json"), "w") as fh:
    json.dump(videos, fh, ensure_ascii=False, indent=2)

lines = ["# Créditos", "",
         "Os vídeos de pedal usados no Bike TV têm licença [Creative Commons Attribution (CC BY)](https://creativecommons.org/licenses/by/3.0/)",
         "e foram copiados sem alterações (apenas divididos em partes para caber na release).", ""]
for vid, (title, place, author) in RIDES.items():
    lines.append(f"- **{title}** ({place}) — {author}, https://www.youtube.com/watch?v={vid}")
lines += ["", "As músicas tocam pelo player oficial do SoundCloud, direto dos perfis dos artistas; nada é copiado."]
with open(os.path.join(here, "CREDITS.md"), "w") as fh:
    fh.write("\n".join(lines) + "\n")
print(f"{len(videos)} vídeos")
