export interface ResourceSource {
  id: string;
  name: string;
  url: string;
  group: string;
  description: string;
  multipleEpisodePages?: boolean;
}
export interface ResourcePackage {
  id: string;
  name: string;
  version: string;
  author: string;
  scripts: { name: string; code: string }[];
  sources: ResourceSource[];
  importedAt: number;
}
export interface ResourceBook {
  title: string;
  bookUrl: string;
  coverUrl?: string;
  artist?: string;
  intro?: string;
}
export interface ResourceEpisode { title: string; url: string; isFree?: boolean; lyricText?: string; subtitles?: {text:string;format:"lrc"|"srt"|"vtt"|"txt"}[] }
export interface ResourceDetail extends Partial<ResourceBook> { episodes: ResourceEpisode[] }
export interface ResourceMenu { title: string; tabs: { title: string; url: string }[] }
export interface ResourcePage { books: ResourceBook[]; currentPage?: number; totalPage?: number; nextUrl?: string }
export type ResourceMethod = "inspect" | "categoryMenus" | "categoryPage" | "search" | "bookDetail" | "audio";
