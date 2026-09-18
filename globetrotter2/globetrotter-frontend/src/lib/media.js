// =============================================================================
// lib/media.js  -  AUTOMATICALLY FIND YOUR PHOTOS AND VIDEOS
//
// WHAT PROBLEM THIS SOLVES
// -------------------------
// You want to drop your own phone photos and videos into the project and
// have them just show up on the right destination page - no config file to
// edit, no list to update by hand, no risk of forgetting a step.
//
// HOW IT WORKS: import.meta.glob
// --------------------------------
// Vite (our build tool) has a special feature called `import.meta.glob`.
// You give it a pattern like "every jpg/mp4 inside src/assets/media", and
// at BUILD TIME it scans the folder and turns whatever it finds into a
// list of importable files - automatically, no manual registration.
//
// So the whole "pipeline" is: you put a file at
//     src/assets/media/dest_religious_01/photo1.jpg
// and the next time the app is built (which run.bat/run.sh now do every
// time they start - see the project README), this file scans that folder,
// notices the new photo, and groups it under "dest_religious_01".
//
// eager: true means "load them all immediately" rather than lazily, which
// is fine here since photos/videos are only loaded on the site detail page
// people actually open, and there aren't thousands of them.
// =============================================================================

// The path here must be written literally (not built from a variable) -
// that's a Vite requirement, because it has to be able to read the pattern
// at build time before any code actually runs.
const files = import.meta.glob(
  "/src/assets/media/*/*.{jpg,jpeg,png,webp,mp4,mov,webm}",
  { eager: true, import: "default" }
);

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);

// Turn the flat list Vite gives us into a lookup by destination id:
//   { dest_religious_01: { photos: [...], videos: [...] }, ... }
// Built once when the app loads, then reused - no repeated work.
const mediaByDestination = {};

for (const [path, url] of Object.entries(files)) {
  // A path looks like: /src/assets/media/dest_religious_01/photo1.jpg
  // Splitting on "/" and reading backwards gets us the folder name (the
  // destination id) and the file extension without a regular expression.
  const parts = path.split("/");
  const destinationId = parts[parts.length - 2];
  const filename = parts[parts.length - 1];
  const extension = filename.split(".").pop().toLowerCase();

  if (!mediaByDestination[destinationId]) {
    mediaByDestination[destinationId] = { photos: [], videos: [] };
  }

  const bucket = VIDEO_EXTENSIONS.has(extension) ? "videos" : "photos";
  mediaByDestination[destinationId][bucket].push({ url, filename });
}

// Sort by filename within each destination, so photo1, photo2, photo3
// appear in that order rather than in whatever order the filesystem
// happened to return them.
for (const entry of Object.values(mediaByDestination)) {
  entry.photos.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  entry.videos.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
}

// The function every screen actually calls. Returns { photos, videos },
// both empty arrays if nothing has been added for this destination yet -
// callers never need to check for undefined.
export function getMediaFor(destinationId) {
  return mediaByDestination[destinationId] || { photos: [], videos: [] };
}
