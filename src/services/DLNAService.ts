import axios, { AxiosInstance } from 'axios';
import WebSocketClient from '../utils/websocket';

export class DLNAService {
    private ws: WebSocketClient
    private controlURL : string
    private dlnaServerHostname : string
    private dlnaApi : AxiosInstance
    constructor(apiUrl:string, controlURL: string) {
        this.controlURL = controlURL
        this.dlnaServerHostname = new URL(controlURL).hostname
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
        return this.dlnaApi.post('/dlna/play', { controlURL:this.controlURL  })
    }

    async pause() {
        return this.dlnaApi.post('/dlna/pause', { controlURL:this.controlURL  })
    }

    async stop() {
        return this.dlnaApi.post('/dlna/stop', { controlURL:this.controlURL  })
    }

    async getPositionInfo() {
        return this.dlnaApi.get(`/dlna/getPositionInfo?controlURL=${this.controlURL}`);
    }
    async setAVTransportURI(uri:string) {
        return this.dlnaApi.post('/dlna/setAVTransportURI', {
            controlURL: this.controlURL,
            params: {
                uri
            }
        });
    }

    async seek(position: string) {
        return this.dlnaApi.post('/dlna/seek', {
             controlURL: this.controlURL,
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