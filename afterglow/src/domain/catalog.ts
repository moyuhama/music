import type {Track} from './types';
const retiredIds=new Set(['scott-buckley-undertow','scott-buckley-hiraeth','scott-buckley-solace','sample-evening','sample-city','sample-moon']);
// These were app-provided examples, never user library entries to auto-install again.
export function mergeCatalog(tracks:Track[],knownIds:string[]){
 return {tracks:tracks.filter(track=>!retiredIds.has(track.id)),catalogIds:[...new Set([...knownIds,...retiredIds])]};
}
