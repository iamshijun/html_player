<template>
    <div class="dlna-player">
        <!-- 设备选择 -->
        <div class="device-list">
            <h3>可用设备</h3>
            <select v-model="selectedDevice" @change="onDeviceSelect">
                <option value="1">选择设备</option>
                <option v-for="device in devices" :key="device.location" :value="device">
                    {{ device.name }} - {{ device.searchTarget }}
                </option>
            </select>
        </div>

        <!-- 播放控制 -->
        <div class="player-controls" v-if="selectedDevice">
            <div class="progress-bar" @click="handleScrubClick">
                <div class="progress" :style="{ width: progress + '%' }"></div>
                <div class="scrubber" :style="{ left: scrubPosition + '%' }">
                </div>
                <!-- <div class="srubber-time-tooltip" v-show="isHovering" :style="{ left: scrubPosition + 'px' }">
                    {{ hoverTime }}
                </div> -->
            </div>
            <span class="time-display">
                {{ currentTime }} / {{ duration }}
            </span>
            <div class="controls">
                <button @click="play" :disabled="playState == 'PLAYING' ">播放</button>
                <button @click="pause" :disabled="playState =='STOPPED' ">暂停</button>
                <button @click="stop" :disabled="playState =='STOPPED' ">停止</button>
                <input type="range" v-model="volume" @change="setVolume" min="0" max="100" />
            </div>
            <div style="margin:10px;" ref="dplayerContainer" >
                <!-- <video controls ref="videoPlayer" style="height: 50vh;" ></video> -->
            </div>
        </div>
    </div>
</template>



<script lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios';
import { DLNAService } from '@/services/DLNAService';   
import DPlayer from 'dplayer';  
import Hls from 'hls.js';
import flvjs from 'flv.js';


const testDevices = {
    "success": false,
    "data": [
        {
            "location": "http://192.168.101.5:1647/",
            "server": "UPnP/1.0 DLNADOC/1.50 Platinum/1.0.5.13",
            "searchTarget": "urn:schemas-upnp-org:service:AVTransport:1",
            "uniqueServiceName": "uuid:4224cf6c-e2ba-b24c-39a2-79ce3273bbdf::urn:schemas-upnp-org:service:AVTransport:1",
            "name": "Kodi (192.168.101.5)",
            "manufacturer": "XBMC Foundation",
            "modelDescription": "Kodi - Media Renderer",
            "modelName": "Kodi"
        },
        {
            location: "http://192.168.101.34:53097/description.xml",
            manufacturer: "xfangfang",
            modelDescription: "AVTransport Media Renderer",
            modelName: "Macast",
            name: "Macast(iamshijun.local)",
            searchTarget: "urn:schemas-upnp-org:service:AVTransport:1",
            server: "Darwin/19.6.0 UPnP/1.0 Macast/0.7",
            uniqueServiceName: "uuid:07603c37-d9b6-400a-82ab-50aa83592eed::urn:schemas-upnp-org:service:AVTransport:1",
        },
        {
            "location": "http://192.168.101.24:9999/a483563d-ea67-4df5-99ae-37daabfd2b66.xml",
            "server": "Linux/4.9.61 UPnP/1.0 GUPnP/1.0.2",
            "searchTarget": "urn:schemas-upnp-org:service:AVTransport:1",
            "uniqueServiceName": "uuid:a483563d-ea67-4df5-99ae-37daabfd2b66::urn:schemas-upnp-org:service:AVTransport:1",
            "name": "小爱音箱-2807",
            "manufacturer": "Mi, Inc.",
            "modelDescription": "The Mi AI SoundBox",
            "modelName": "S12"
        }
    ]
}

interface DeviceInfo {
    controlURL: string
    eventURL: string
}

interface AVTransportInfo extends DeviceInfo{
    transportInfo : TransportInfo
    positionInfo : PositionInfo
    mediaInfo?: MediaInfo
}

interface TransportInfo {
    currentSpeed: number
    currentTransportState: string // STOPPED,PLAYING
    currentTransportStatus : string // OK ,..
}
interface PositionInfo {
    absCount: number
    absTime: string
    relCount: number
    relTime: string
    track: number
    trackDuration: string
    trackMetaData: MediaMetadata
}

interface MediaMetadata {
    item : MetadataItem
}
interface MetadataItem {
    longDescription: string
    title : string //!
    res : {
        protocolInfo: string
        value: string
    },
    storageMedium: string
}

interface MediaInfo { 
    currentURI : string
    currentURIMetaData: MediaMetadata
    nextURI : string
    nextURIMetaData: MediaMetadata,
    playMedium: string
}

interface UpnpDevice { 
    location: string
    searchTarget:string
    name: string 
}

interface PlayBackStateEvent {
    currentPlayMode: string
    currentTrack: number
    currentTrackDuration: string
    currentTrackMetaData: MediaMetadata
    currentTrackURI:string
    currentTransportActions: string // "Next,Previous,Seek,Play"
    numberOfTracks: number
    relativeTimePosition: string
    transportState: string // "STOPPED" , "PLAYING"  ,"PAUSED_PLAYBACK"-seek
}

function timeStringToSeconds(timeString : string) {
    // 按 ":" 分割字符串
    const [hours, minutes, seconds] = timeString.split(':').map(Number);

    // 计算总秒数
    return hours * 3600 + minutes * 60 + seconds;
}

function formatTime(time: number|string) {
    if(typeof time === 'string'){
        if(time.length != 8){//保证统一的格式
            const [hours, minutes, secs] = time.split(':');
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return time
    }else{
        const seconds = time
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
} 

const dlnaProxy = "http://192.168.101.34:8082"

export default {
    name: 'DLNAPlayer',
    setup() {
        const devices = ref<UpnpDevice[]>([])
        const selectedDevice = ref<UpnpDevice | null>(null)  
        const volume = ref(50)
        const dlnaService = ref<DLNAService|null>(null)

        const currentTrackUrl = ref<string|undefined>(undefined) 

        const playState = ref<string>("STOPPED")
        const progress = ref<number>(0)
        const currentTimeInSeconds = ref<number>(0)
        const durationInSeconds = ref<number>(0)
        const scrubPosition = ref<number>(0)

        const currentTime = ref<string>("00:00:00")//view
        const duration = ref<string>("00:00:00")//view

        const videoPlayer = ref<HTMLVideoElement|undefined>()
        const dplayerContainer = ref<HTMLDivElement|undefined>()
        const eventSource = ref<EventSource|null>(null)
        // 搜索 DLNA 设备
        const searchDevices = () => {
            // axios.get(`${dlnaProxy}/dlna/listDevices`)
            //     .then(response => response.data)
            //     .then(response => { 
            //         devices.value = response.data as UpnpDevice[]
            //     })

            devices.value = testDevices.data
            // devices.value = []
            // eventSource.value = new EventSource(`${dlnaProxy}/dlna/listDevicesStream`);

            // eventSource.value.onmessage = (event:MessageEvent<string>) => {
            //     //console.log(event)
            //     if(event.data == "DONE"){
            //         eventSource.value?.close();
            //     }else{
            //         const result = JSON.parse(event.data)
            //         devices.value.push(result)
            //     }
            // };

            // eventSource.value.onerror = (error) => {
            //     console.error('EventSource failed:', error);
            //     eventSource.value?.close();
            // };


            console.log('Searching for DLNA devices...')
        }

        // 选择设备
        const onDeviceSelect = () => {
            // 连接到选定的设备
            if (selectedDevice.value) {
                connectToDevice(selectedDevice.value!)
            }
        }
        const updateProgressScheduler = ref<number|undefined>(undefined)
        const startPlay = () => {
            if(updateProgressScheduler.value){
                stopPlay() //reset
            }
            playState.value = 'PLAYING'
            updateProgressScheduler.value = setInterval (() => {
                const nextTime = currentTimeInSeconds.value + 1
                //durationInSeconds.value == 0 可能是直播-流(有些dlna设备不会更新大小,有些会)
                if(durationInSeconds.value != 0 && nextTime > durationInSeconds.value){
                    stopPlay()
                    return
                }
                updatePlayingTime(nextTime)
            },1000,"")
        }
        const stopPlay = () => {
            clearInterval(updateProgressScheduler.value)
            playState.value = 'STOPPED'//本来有一个PAUSED的 但是小爱音箱 pause的时候同时发一个stopped过来 就很难受!
        }
        //重置播放 如果指定了seekTarget跳转到指定的位置 重新开启新的播放(+ update scheduler)
        const resetPlay = (seekTarget: number|string|undefined) => {
            if(seekTarget){
                updatePlayingTime(seekTarget)
                updateProgress()
            }
            clearInterval(updateProgressScheduler.value)
            startPlay()
        }
        //更新当前播放的时间 + 更新进度
        const updatePlayingTime = (nextTime: number|string|undefined|null) => {
            if(nextTime){
                if(typeof nextTime === 'string'){
                    currentTime.value = formatTime(nextTime)
                    currentTimeInSeconds.value = timeStringToSeconds(nextTime)
                }else{
                    currentTimeInSeconds.value  = nextTime
                    currentTime.value = formatTime(currentTimeInSeconds.value)
                }
            }

            updateProgress()
        }
        //更新进度和scrubber
        const updateProgress = () => {
            progress.value = (currentTimeInSeconds.value / durationInSeconds.value) * 100; 
            scrubPosition.value = progress.value
        }

        //更新 总时长，当前播放时间
        const resetTime = (trackDuration:string,relTime:string|undefined=undefined) => {
            //console.log(trackDuration, relTime)

            duration.value = formatTime(trackDuration)
            durationInSeconds.value = timeStringToSeconds(duration.value)

            updatePlayingTime(relTime)//or absTime?
        }

        // 连接设备
        const connectToDevice = async (device: UpnpDevice) => {
            try {
                if(dlnaService.value){
                    dlnaService.value.disconnect()
                } 
                if(!device.location){
                    return
                }
                console.log('Connecting to device:', device)
                //获取当前设备 (avTransport所有信息 媒体信息,位置信息,播放状态信息)
                const avTransportInfo = await axios.get("http://192.168.101.34:8082/dlna/selectDevice",{
                    params: { location: device.location  }
                }).then(response => {
                        const resp = response.data
                        if(!resp.success){
                            console.log(response)
                            return
                        }
                        return resp.data as AVTransportInfo
                    }) 

                if(!avTransportInfo){
                    return
                } 

                console.log("Device AVTransport Info",avTransportInfo)
                const positionInfo = avTransportInfo.positionInfo
                const currentTransportState = avTransportInfo.transportInfo.currentTransportState

                // playState.value = currentTransportState
                resetTime(positionInfo.trackDuration,positionInfo.relTime)
                if(currentTransportState == "PLAYING"){
                    startPlay()
                }
                if(currentTrackUrl.value != avTransportInfo.mediaInfo?.currentURI){
                    let uri = avTransportInfo.mediaInfo?.currentURI ?? ""
                    //改用chrome插件来完成 去掉指定host的 Referer请求头 
                    // if(uri.indexOf("http://61.240.206.7") == 0){
                    //     uri = uri.replace("http://61.240.206.7","http://localhost:8080")
                    // }
                    currentTrackUrl.value = uri
                }

                selectedDevice.value = device
              
                const service = new DLNAService(dlnaProxy, avTransportInfo.controlURL)
                await service.connect()
                
                dlnaService.value = service
                subscribeUpnpEvent()
            } catch (error) {
                console.error('Failed to connect to device:', error)
            }
        }
 

        const subscribeUpnpEvent = () => {
            if(!dlnaService.value){
                return 
            }
            const service = dlnaService.value
            service.subscribePlaybackState(async (data) => {
                console.log(data)
                const event = data.data.event as PlayBackStateEvent

                const currentTrackDuration = event.currentTrackDuration
                const relTimePosition = event.relativeTimePosition
                
                if(event.currentTrackURI){
                    currentTrackUrl.value = event.currentTrackURI
                }
                const transportState = event.transportState
                if(transportState == 'STOPPED'){//pause
                    //relativeTimePosition 看这个有没有重置为0 
                    stopPlay()
                }else if(transportState == "PLAYING" || transportState == "PAUSED_PLAYBACK"){
                    if(currentTrackDuration && relTimePosition){
                        resetTime(currentTrackDuration,relTimePosition)
                    }else{
                        const response = await service.getPositionInfo().then(response=> response.data)
                        const positionInfo = response.data
                        resetTime(positionInfo.trackDuration,positionInfo.relTime)
                    }
                    if(transportState == "PLAYING"){
                        if(playState.value != "PLAYING"){
                            startPlay()
                        }
                    }else{
                        stopPlay()
                    }
                }else if(!transportState) { //没有state -直播的会不断更新当前视频进度
                    if(currentTrackDuration){
                        resetTime(currentTrackDuration)
                    } 
                }
                //playState.value = transportState
            })
        }

        const  handleScrubClick = (event:MouseEvent) =>{

            const progressBar = event.currentTarget as HTMLElement
            const rect = progressBar.getBoundingClientRect()
            const offsetX = event.clientX - rect.left
            const percent = offsetX / rect.width

            const targetInSeconds = durationInSeconds.value * percent
            const seekTarget = formatTime(targetInSeconds)
            resetPlay(seekTarget)

            seek(seekTarget)
        }
        // 播放控制函数
        const play = () => {
            if(dlnaService.value){
                startPlay() //先执行,后面如果订阅事件没问题 会有一个回调调整当前的时间和进度
                dlnaService.value?.play()
            }
        }

        const pause = () => {
            stopPlay()
            dlnaService.value?.pause()
        }

        const stop = () => {
            stopPlay()
            dlnaService.value?.pause()
        }

        const seek = (seekTarget:string) => {
            dlnaService.value?.seek(seekTarget)
        }

        const setVolume = () => { //TODO
            if (dlnaService.value) {
                // 实现音量控制逻辑
                console.log('Setting volume to:', volume.value)
            }
        }

        // 生命周期钩子
        onMounted(() => {
            searchDevices()
        })

        onUnmounted(() => {
            // 清理资源
            if (dlnaService.value) {
                dlnaService.value.disconnect()
            }
            if(eventSource.value){
                eventSource.value.close()
            }
            dp?.destroy()
        })
        watch(currentTrackUrl,(newUrl,_oldUrl) => {
            if(newUrl){
                console.log(newUrl)
                initDPlayer(newUrl)
            }
        })


        const checkMIME = async (url:string) => {
            const pathname = new URL(url).pathname
            // 检查扩展名
            if (pathname.endsWith('.flv')) {
                return "flv"
            }else if(pathname.endsWith('.m3u8')){
                return "hls"
            }
            // 检查 Content-Type
            try {
                const response = await fetch(url, { method: 'HEAD' });
                const contentType = response.headers.get('Content-Type');

                if(contentType === 'video/x-flv'){
                    return "flv"
                }else if(contentType == 'application/vnd.apple.mpegurl'){
                    return "hls"
                }
            } catch (error) {
                console.error('请求失败:', error);
            }
        }

        let dp : DPlayer|undefined;
        const initDPlayer = async (url:string) => {
            dp?.destroy()
            
            const type = await checkMIME(url) 
            console.log("MIME type",type)
            dp = new DPlayer({
                container: dplayerContainer.value,
                video: {
                    url: url,
                    type: type ?? 'auto',
                    customType: {
                        hls: function(video:HTMLVideoElement, _player:DPlayer) {
                            const hls = new Hls();
                            hls.loadSource(video.src);
                            hls.attachMedia(video);
                        },
                        flv: function(video:HTMLVideoElement, _player:DPlayer) {
                            if (flvjs.isSupported()) {
                                const flvPlayer = flvjs.createPlayer({
                                    type: 'flv',
                                    url: video.src
                                });
                                flvPlayer.attachMediaElement(video);
                                flvPlayer.load();
                            }
                        }
                    },
                    volume: 0,
                },
                pluginOptions: {
                    flv: {
                        // refer to https://github.com/bilibili/flv.js/blob/master/docs/api.md#flvjscreateplayer
                        mediaDataSource: {
                            // mediaDataSource config
                        },
                        config: {
                            // config
                        },
                    },
                },
            });
        }
         
        return {
            videoPlayer,dplayerContainer,
            devices,
            selectedDevice, 
            volume,
            onDeviceSelect,
            play, pause, stop,seek,
            setVolume,
            currentTrackUrl,
            //进度，时间信息
            progress,scrubPosition,playState,currentTime,duration ,handleScrubClick
        }
    }
}
</script>

<style scoped>
.dlna-player {
    padding: 20px;
}

.device-list {
    margin-bottom: 20px;
}

.device-list select {
    width: 100%;
    padding: 8px;
    margin-top: 10px;
}

.player-controls {
    border: 1px solid #ddd;
    padding: 15px;
    border-radius: 4px;
}

.controls {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 15px;
}

.controls button {
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.controls button:hover {
    background-color: #45a049;
}

.controls button:disabled {
    background-color: #cccccc;
    color: #666666;
    cursor: not-allowed;
    opacity: 0.7;
}

.controls button:disabled:hover {
    background-color: #cccccc;
}

input[type="range"] {
    width: 200px;
}


.progress-bar {
    position: relative;
    height: 8px;
    background: #444;
    margin-bottom: 12px;
    cursor: pointer;
}

.progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: #007bff;
}

.scrubber {
    position: absolute;
    top: -2px;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    transform: translateX(-50%);
    transition: transform 0.1s ease, width 0.1s ease, height 0.1s ease;
    cursor: pointer;
}

.scrubber:hover {
    transform: translateX(-50%) scale(1.2);
}

</style>