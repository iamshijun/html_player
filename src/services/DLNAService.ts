import WebSocketClient from '../utils/websocket';

export class DLNAService {
    private ws: WebSocketClient;

    constructor() {
        this.ws = new WebSocketClient('ws://your-server-url/dlna');
        this.ws.connect();
    }

    play(): void {
        this.ws.send('/app/dlna/play', {});
    }

    pause(): void {
        this.ws.send('/app/dlna/pause', {});
    }

    stop(): void {
        this.ws.send('/app/dlna/stop', {});
    }

    seek(position: number): void {
        this.ws.send('/app/dlna/seek', { position });
    }

    subscribeProgress(callback: (data: any) => void): void {
        this.ws.subscribe('/topic/progress', callback);
    }

    subscribeMediaInfo(callback: (data: any) => void): void {
        this.ws.subscribe('/topic/mediaInfo', callback);
    }

    subscribePlaybackState(callback: (data: any) => void): void {
        this.ws.subscribe('/topic/playbackState', callback);
    }
}