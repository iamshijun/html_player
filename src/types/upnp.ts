export interface IAVTransportService {
    play() : Promise<any>
    pause() : Promise<any>
    stop() : Promise<any>
    seek(position: string) : Promise<any>
    setAVTransportURI(uri: string): Promise<any>
    getTransportInfo() : Promise<TransportInfo>
    getPositionInfo() : Promise<PositionInfo>
    getMediaInfo() : Promise<MediaInfo>
}

export interface DeviceInfo {
    services: ServiceInfo[]
}

export interface ServiceInfo {
    controlURL: string
    eventURL: string
    soap11: boolean
}

export interface AVTransportInfo extends ServiceInfo{
    transportInfo : TransportInfo
    positionInfo : PositionInfo
    mediaInfo?: MediaInfo
}

export interface TransportInfo {
    currentSpeed: number
    currentTransportState: string // STOPPED,PLAYING
    currentTransportStatus : string // OK ,..
}
export interface PositionInfo {
    absCount: number
    absTime: string
    relCount: number
    relTime: string
    track: number
    trackURI: string
    trackDuration: string
    trackMetaData?: MediaMetadata|null
}

export interface MediaMetadata {
    item : MetadataItem
}
export interface MetadataItem {
    longDescription?: string
    title : string //!
    res? : {
        protocolInfo: string
        value: string
    },
    storageMedium?: string
    artist?: string
    album?: string
    resolution?: string
    genre?: string
    duration?: string
    albumArtURI?: string
    size?: number
}

export interface MediaInfo { 
    currentURI : string
    currentURIMetaData: MediaMetadata|null
    nextURI? : string|null
    nextURIMetaData?: MediaMetadata|null,
    playMedium: string
}

export interface UpnpDevice { 
    location: string
    searchTarget:string
    name: string 
    manufacturer: string,
    modelDescription: string,
    modelName: string, 
    server: string,
    uniqueServiceName: string,
}

export enum PlayStatus { //TransportState
    PLAYING = "PLAYING",
    PAUSED_PLAYBACK = "PAUSED_PLAYBACK",
    // PAUSED_RECORDING = "PAUSED_RECORDING",
    // RECORDING = "RECORDING",
    // TRANSITIONING = "TRANSITIONING",
    // NO_MEDIA_PRESENT = "NO_MEDIA_PRESENT",
    STOPPED = "STOPPED"
}

export interface PlayBackStateEvent {
    currentPlayMode: string
    currentTrack: number
    currentTrackDuration: string
    currentTrackMetaData: MediaMetadata
    currentTrackURI:string
    currentTransportActions: string // "Next,Previous,Seek,Play"
    numberOfTracks: number
    relativeTimePosition: string
    transportState: PlayStatus // "STOPPED" , "PLAYING"  ,"PAUSED_PLAYBACK"-seek
}