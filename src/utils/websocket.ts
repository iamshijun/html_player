import SockJS from 'sockjs-client'; 
import { Client, Frame, Message ,StompSubscription } from "@stomp/stompjs" 

type SubscriptionCallback<T = any> = (payload: T) => void;
type MessageCallback = (data: any) => void;

//source code client.ts => https://github.com/stomp-js/stompjs/blob/develop/src/client.ts
class WebSocketClient {
    private readonly url: string;
    private stompClient: Client | null;
    private subscriptions: Map<string, StompSubscription>;
    private listeners: Map<string, MessageCallback[]>;

    private reconnectAttempts: number;
    private readonly maxReconnectAttempts: number;

    constructor(url: string,maxReconnectAttempts:number=5) {
        this.url = url;
        this.stompClient = null;
        this.subscriptions = new Map();
        this.reconnectAttempts = 0;//unused
        this.maxReconnectAttempts = maxReconnectAttempts;
        this.listeners = new Map();
    }

    connect(): Promise<WebSocketClient> {
        return new Promise((resolve, reject) => {
 
            this.stompClient = new Client({
                webSocketFactory: () => {
                   return new SockJS(this.url)
                }, 
                //brokerURL: this.url,
                reconnectDelay: 0, //0禁止内置的重试机制 ; 3000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                beforeConnect : () => {

                },
                onConnect: () => {
                    console.log('STOMP连接成功');
                    this.reconnectAttempts = 0;
                    this.emit('connected', null);
                    resolve(this)
                },
                onStompError: (frame: Frame) => {
                    console.error('STOMP错误:', frame);
                    this.emit('error', frame);
                    //reject(error); 
                    reject("STOMP Error")
                },
                onDisconnect: (e) => { //由服务器端主动关闭? #check
                    console.log('STOMP连接关闭',e);
                    this.emit('disconnected', null);
                },
                onWebSocketError : (e) => {
                    console.log('WebSocket连接错误',e);
                },
                onWebSocketClose : (e: CloseEvent) => { 
                    if(e.code === 1000){ //正常关闭
                        //wasClean:true, code=1000,
                        console.log(`WebSocket连接关闭 : ${e.reason}`,e);
                        return
                    }
                    if(e.code === 1001){ //服务器端主动关闭 (服务器down)
                        //wasClean:true , code:1001 , reason:"" , timeStamp:1737702648411 , type:"close" , 
                        console.warn('WebSocket连接主动关闭...',e);
                        this.reconnect(); 
                    }else if(e.code === 1002){
                        //e.wasClean == false 连接失败 /... code=1002, reason="Cannot connect to server"                   
                        console.warn(`WebSocket连接失败...${e.reason}`,e);
                        this.reconnect(); 
                    }
                    if(this.maxReconnectAttempts == 0){//不重试的直接reject
                        reject(e.reason)
                    }
                }
            });
            this.stompClient.activate(); 
        });
    }
    connected(): boolean {
        return this.stompClient !== null && this.stompClient.connected
    }
    close() {  
       this.disconnect() 
    }
    disconnect() {
        if (this.stompClient === null) {
            console.debug('Client is not initialized');
            return;
        }
        //取消所有订阅
        this.subscriptions.forEach((subscription) => {
            subscription.unsubscribe()
        })
        this.subscriptions.clear();

        // if (!this.stompClient.connected) {
        //     console.debug('Client is disconnected already')
        // }
        this.stompClient.deactivate();
        //这里没有暂时deactivate的需求 直接disconnect
        this.stompClient.forceDisconnect()

        console.debug("Disconnected");
    }

    private reconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const baseDelay = 1000; // 初始延迟1秒
            const delay = Math.min(60000, baseDelay * Math.pow(2, this.reconnectAttempts - 1));//最长1分钟一次
            console.log(`尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) 下次重试间隔: ${delay}ms`);
            setTimeout(() => this.connect(), delay);
        }
    }

    send<T = any>(destination: string, body: T): void {
        if (!this.stompClient?.connected) {
            console.error('STOMP client is not connected');
            return;
        }
        this.stompClient.publish({
            destination,
            body: JSON.stringify(body)
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


    subscribe<T = any>(destination: string, callback: SubscriptionCallback<T>) {
        //TODO 判断是否已经subscribe过 防止重复订阅 /or 根据选择是否检测重复订阅
        if (!this.stompClient?.connected) {
            console.error('STOMP client is not connected');
            return;
        }
        // 避免重复订阅
        if (this.subscriptions.has(destination)) {
            console.debug(`Already subscribed to ${destination}`);
            return;
        }

        const subscription = this.stompClient.subscribe(destination, (message: Message) => {
            const payload = JSON.parse(message.body);
            callback(payload);
        });
        this.subscriptions.set(destination, subscription)
        return subscription

    }
    unsubscribe(destination: string): boolean {
        return this.subscriptions.delete(destination)
    }
}

// 管理多个 WebSocketClient 实例
const clients: Record<string, WebSocketClient> = {};

export function createWebSocketClient(id: string, url: string): WebSocketClient {
    if (!clients[id]) {
        console.debug(`Creating WebSocket client ${id}`);
        clients[id] = new WebSocketClient(url);
    }
    return clients[id];
}

export function getWebSocketClient(id: string): WebSocketClient | null {
    return clients[id] || null;
}

export function disconnectWebSocketClient(id: string) {
    const client = clients[id];
    if (client) {
        if (client?.connected()) {//对于新的stompjs 正在
            console.debug(`Disconnecting WebSocket client ${id}`);
            client.disconnect();
        }
        delete clients[id]; // 可选：在断开连接后移除实例
    }
}

export default WebSocketClient