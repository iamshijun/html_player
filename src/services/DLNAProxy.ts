import axios, { AxiosInstance } from 'axios';
import WebSocketClient from '../utils/websocket';

export class DLNAProxy {
    private ws: WebSocketClient 
    private dlnaServerHostname : string
    private dlnaApi : AxiosInstance 
    constructor(apiUrl:string, private controlURL: string,private soap11:boolean=false) { 
        this.dlnaServerHostname = new URL(this.controlURL).hostname
        this.ws = new WebSocketClient(apiUrl + '/ws');

        this.dlnaApi = axios.create({
            baseURL: apiUrl
        })
    }
    async connect () {
        await this.ws.connect();
    }
    disconnect() {
        this.ws.disconnect();
    }

    async play() {
        return this.dlnaApi.post('/dlna/play', { controlURL:this.controlURL, soap11:this.soap11 })
    }

    async pause() {
        return this.dlnaApi.post('/dlna/pause', { controlURL:this.controlURL, soap11:this.soap11 })
    }

    async stop() {
        return this.dlnaApi.post('/dlna/stop', { controlURL:this.controlURL, soap11:this.soap11 })
    }

    async getPositionInfo() {
        return this.dlnaApi.get(`/dlna/getPositionInfo?controlURL=${this.controlURL}&soap11=${this.soap11}`);
    }
    async setAVTransportURI(uri:string) {
        return this.dlnaApi.post('/dlna/setAVTransportURI', {
            controlURL: this.controlURL,
            soap11: this.soap11,
            params: {
                uri
            }
        });
    }

    async seek(position: string) {
        return this.dlnaApi.post('/dlna/seek', {
             controlURL: this.controlURL,
             soap11: this.soap11,
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

    subscribePlaybackState(callback: (data: any) => void): void {
        this.ws.subscribe(`/topic/upnp/event/AVTransport/${this.dlnaServerHostname}`, callback);
    }
}