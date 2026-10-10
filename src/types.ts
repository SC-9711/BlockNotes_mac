export type Doc={type:string;text?:string;attrs?:Record<string,unknown>;marks?:{type:string;attrs?:Record<string,unknown>}[];content?:Doc[]}
export type Note={id:string;title:string;doc:Doc;plain:string;tags:string[];shelfId:string;status:'active'|'archived'|'deleted';previousStatus:'active'|'archived';revision:number;createdAt:string;updatedAt:string}
export type Shelf={id:string;name:string;color:string}
export type Snapshot={notes:Note[];shelves:Shelf[];settings:{parallax?:number;lastNoteId?:string;soundVolume?:number;musicVolume?:number;musicTrack?:string};dataPath:string;backupWarning?:string}
export type ResourceState={ready:boolean;busy:boolean;phase:string;done:number;total:number;error:string}
declare global {interface Window {blocknotes?:{call:(operation:string,input?:unknown)=>Promise<any>;onResources:(cb:(state:ResourceState)=>void)=>()=>void;onClose:(cb:()=>void)=>()=>void;readyToClose:()=>void}}}
