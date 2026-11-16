import type { Track } from "../domain/types";
export async function readMetadata(file: File): Promise<Partial<Track>> {
  try {
    const { parseBlob } = await import("music-metadata");
    const data = await parseBlob(file, { duration: true });
    const picture =
      data.common.picture?.find((p) => p.type === "Cover (front)") ??
      data.common.picture?.[0];
    let cover: string | undefined;
    if (
      picture &&
      picture.data.length < 4 * 1024 * 1024 &&
      ["image/jpeg", "image/png", "image/webp"].includes(picture.format)
    ) {
      cover = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(
          new Blob([new Uint8Array(picture.data)], { type: picture.format }),
        );
      });
    }
    return {
      title: data.common.title,
      artist: data.common.artist,
      album: data.common.album,
      duration: data.format.duration,
      cover,
    };
  } catch {
    return {};
  }
}
