import { Client, Frame, Message } from '@stomp/stompjs';

type MessageCallback = (data: any) => void;

export class WebSocketClient {
    private url: string;
    private stompClient: Client | null;
    private listeners: Map<string, MessageCallback[]>;
    private reconnectAttempts: number;
    private readonly maxReconnectAttempts: number;

    constructor(url: string) {
        this.url = url;
        this.stompClient = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect(): void {
        this.stompClient = new Client({
            brokerURL: this.url,
            reconnectDelay: 3000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            onConnect: () => {
                console.log('STOMP连接成功');
                this.reconnectAttempts = 0;
                this.emit('connected', null);
            },
            onStompError: (frame: Frame) => {
                console.error('STOMP错误:', frame);
                this.emit('error', frame);
            },
            onDisconnect: () => {
                console.log('STOMP连接关闭');
                this.emit('disconnected', null);
                this.reconnect();
            }
        });

        this.stompClient.activate();
    }

    private reconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), 3000);
        }
    }

    subscribe(destination: string, callback: MessageCallback): void {
        if (!this.stompClient?.connected) {
            console.error('STOMP客户端未连接');
            return;
        }

        this.stompClient.subscribe(destination, (message: Message) => {
            try {
                const payload = JSON.parse(message.body);
                callback(payload);
            } catch (error) {
                console.error('解析消息失败:', error);
            }
        });
    }

    on(event: string, callback: MessageCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);
    }

    private emit(event: string, data: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    send(destination: string, data: any): void {
        if (!this.stompClient?.connected) {
            console.error('STOMP客户端未连接');
            return;
        }

        this.stompClient.publish({
            destination,
            body: JSON.stringify(data)
        });
    }

    close(): void {
        if (this.stompClient?.connected) {
            this.stompClient.deactivate();
        }
    }
}

export default WebSocketClient;