import axios, { AxiosInstance } from 'axios';
import WebSocketClient from '../utils/websocket';


class AVTransportService {
    constructor(private dlnaApi : AxiosInstance , private controlURL: string,private soap11:boolean=false) { 
    }

    async sendCommand(command:string, params : Record<string, any> = {} ){
        return this.dlnaApi.post(`/dlna/${command}`, { 
            controlURL:this.controlURL, 
            soap11:this.soap11,
            ...params
         })
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
    async getPositionInfo() {
        return this.dlnaApi.get(`/dlna/getPositionInfo?controlURL=${this.controlURL}&soap11=${this.soap11}`);
    }

    async setAVTransportURI(uri:string) {
        return this.sendCommand('setAVTransportURI', {
            params: {
                uri
            }
        })  
    }

    async seek(position: string) {
        return this.sendCommand('setAVTransportURI', {
            params: {
                position
            } 
        });
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
    constructor(apiUrl:string, private controlURL: string,private soap11:boolean=false) { 
        this.dlnaServerHostname = new URL(this.controlURL).hostname
        this.ws = new WebSocketClient(apiUrl + '/ws');

        this.dlnaApi = axios.create({
            baseURL: apiUrl
        })
        this.avTransportService = new AVTransportService(this.dlnaApi, this.controlURL, this.soap11);
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