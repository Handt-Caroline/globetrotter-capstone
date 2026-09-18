# Your own photos and videos go here

## The rule

Make one folder per destination, named with that destination's `id` from
`backend/app/seed.py`. Drop your files straight into it. That's the whole
system — nothing else to configure, nothing to register anywhere else.

```
media/
├── dest_religious_01/       <- Basilique Marie-Reine-des-Apôtres
│   ├── photo1.jpg
│   ├── photo2.jpg
│   └── video1.mp4
├── dest_shopping_01/        <- Marché Central
│   ├── photo1.jpg
│   └── photo2.jpg
```

## Where do I find a destination's id?

Open `backend/app/seed.py` and search for the place by name. Each entry
starts with `"id": "dest_something_01"` — that exact string is the folder
name to use.

A few common ones:

| Place                                    | Folder name             |
|-------------------------------------------|--------------------------|
| Monument de la Réunification              | `dest_landmarks_01`     |
| Musée National du Cameroun                | `dest_museums_01`       |
| Basilique Marie-Reine-des-Apôtres         | `dest_religious_01`     |
| Marché Central de Yaoundé                 | `dest_shopping_01`      |
| Rue de la Joie, Elig-Essono               | `dest_nightlife_01`     |

## File naming

Name files `photo1.jpg`, `photo2.jpg`, `photo3.jpg`... and `video1.mp4`,
`video2.mp4`... in whatever order you want them shown. Numbers don't need
to be contiguous or start at 1 for every folder — the app just sorts
whatever it finds.

Supported: `.jpg` `.jpeg` `.png` `.webp` for photos, `.mp4` `.mov` `.webm`
for video.

## After adding files

Just start the app the normal way (`run.bat` / `./run.sh`). It rebuilds
the app automatically every time it starts, so your new photos show up
without you doing anything else.

## What if a destination has no folder?

It shows the app's default placeholder image instead — nothing breaks.
Add media gradually, one place at a time, whenever you have it.
