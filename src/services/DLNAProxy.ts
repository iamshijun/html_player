import axios, { AxiosInstance } from 'axios';
import WebSocketClient from '../utils/websocket';
import { IAVTransportService, PositionInfo } from '@/types/upnp';


class AVTransportService implements IAVTransportService {
    constructor(private dlnaApi : AxiosInstance , private controlURL: string,private soap11:boolean=false) { 
    }

    async getTransportInfo(){
        return this.sendCommand('GetTransportInfo')
    }
    async getMediaInfo() {
        return this.sendCommand('GetMediaInfo')
    }

    async sendCommand(command:string, params : Record<string, any> = {} ){
        return this.dlnaApi.post(`/dlna/${command}`, { 
            controlURL:this.controlURL, 
            soap11:this.soap11,
            ...params
         }).then(response => response.data.data)
    }

    async play() {
        return this.sendCommand('play')
    }

    async pause() {
        return this.sendCommand('pause')
    }

    async stop() {
        return this.sendCommand('stop')  
    }

    //TODO 统一为post得了!
    async getPositionInfo() : Promise<PositionInfo>{
        //return this.dlnaApi.get(`/dlna/getPositionInfo?controlURL=${this.controlURL}&soap11=${this.soap11}`)
        return this.sendCommand('getPositionInfo')
    }

    async setAVTransportURI(uri:string) {
        return this.sendCommand('setAVTransportURI', { params: { uri } })  
    }

    async seek(position: string) {
        return this.sendCommand('setAVTransportURI', { params: { position } })
    }

    // subscribeProgress(callback: (data: any) => void): void {
    //     this.ws.subscribe('/topic/progress', callback);
    // }

    // subscribeMediaInfo(callback: (data: any) => void): void {
    //     this.ws.subscribe('/topic/mediaInfo', callback);
    // }

}

export class DLNAProxy {
    private ws: WebSocketClient 
    private dlnaServerHostname : string
    private dlnaApi : AxiosInstance 
    readonly avTransportService: AVTransportService
    constructor(dlnaProxyBase:string, private controlURL: string,private soap11:boolean=false) { 
        this.dlnaServerHostname = new URL(this.controlURL).hostname
        this.ws = new WebSocketClient(dlnaProxyBase + '/ws');

        this.dlnaApi = axios.create({
            baseURL: dlnaProxyBase
        })
        this.avTransportService = new AVTransportService(this.dlnaApi, this.controlURL, this.soap11);
    }
    getAVTransportService() {
        return this.avTransportService
    }

    async connect () {
        await this.ws.connect();
    }
    disconnect() {
        this.ws.disconnect();
    }

    subscribePlaybackState(callback: (data: any) => void): void {
        this.ws.subscribe(`/topic/upnp/event/AVTransport/${this.dlnaServerHostname}`, callback);
    }
}