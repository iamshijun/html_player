
export interface DeviceInfo {
    controlURL: string
    eventURL: string
}

export interface AVTransportInfo extends DeviceInfo{
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
    trackDuration: string
    trackMetaData: MediaMetadata
}

export interface MediaMetadata {
    item : MetadataItem
}
export interface MetadataItem {
    longDescription: string
    title : string //!
    res : {
        protocolInfo: string
        value: string
    },
    storageMedium: string
}

export interface MediaInfo { 
    currentURI : string
    currentURIMetaData: MediaMetadata
    nextURI : string
    nextURIMetaData: MediaMetadata,
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

export enum PlayStatus {
    PLAYING = "PLAYING",
    PAUSED_PLAYBACK = "PAUSED_PLAYBACK",
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