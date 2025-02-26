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
        <!-- 配置选项 -->
        <div class="player-config">
            <label class="config-item">
                <input type="checkbox" v-model="checkProgressLocal">
                在本地模拟进度
            </label>
            <label class="config-item">
                <input type="checkbox" v-model="displayDeviceMedia">
                在本地播放DLNA媒体
            </label>
        </div>

        <!-- 播放控制 -->
        <div class="player-controls" v-if="selectedDevice">
            <div class="url-input-container">
                <input 
                    type="text" 
                    v-model="inputUrl" 
                    placeholder="请输入媒体URL"
                    class="url-input"
                />
                <button @click="setMediaUrl" class="url-button">设置</button>
            </div>
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
                <button @click="pause" :disabled="playState == 'PAUSED_PLAYBACK' ">暂停</button>
                <button @click="stop" :disabled="playState =='STOPPED' ">停止</button>
                <input type="range" v-model="volume" @change="updateVolume" min="0" max="100" />
            </div>
            <div style="margin:10px;" ref="dplayerContainer" v-if="displayDeviceMedia">
                <!-- <video controls ref="videoPlayer" style="height: 50vh;" ></video> -->
            </div>
        </div>
    </div>
</template>



<script lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { DLNAProxy } from '@/services/DLNAProxy';   
import { DLNAClient } from '@/services/DLNAClient';   
import { checkMediaType } from '@/utils/http';
import axios from 'axios';
import DPlayer from 'dplayer';  
import Hls from 'hls.js';
import flvjs from 'flv.js';
import { AVTransportInfo, IAVTransportService, IRenderingControlService, MediaInfo, PlayBackStateEvent, PlayStatus, UpnpDevice } from "@/types/upnp"

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
            "location": "http://192.168.101.34:53097/description.xml",
            "manufacturer": "xfangfang",
            "modelDescription": "AVTransport Media Renderer",
            "modelName": "Macast",
            "name": "Macast(iamshijun.local)",
            "searchTarget": "urn:schemas-upnp-org:service:AVTransport:1",
            "server": "Darwin/19.6.0 UPnP/1.0 Macast/0.7",
            "uniqueServiceName": "uuid:07603c37-d9b6-400a-82ab-50aa83592eed::urn:schemas-upnp-org:service:AVTransport:1",
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
        },
        {
            "location": "http://192.168.101.12:49152/description.xml",
            "manufacturer": "LEBO",
            "modelDescription": "Lebo Media Render",
            "modelName": "HappyCast",
            "name": "TV(192.168.101.12)",
            "searchTarget": "urn:schemas-upnp-org:service:AVTransport:1",
            "server": "Linux/3.0.8+, UPnP/1.0, Portable SDK for UPnP devices/1.6.13",
            "uniqueServiceName": "uuid:F7CA5454-3F48-4390-8009-0c52e285c268::urn:schemas-upnp-org:service:AVTransport:1"
        }
    ]
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
        const minutes = Math.floor((seconds / 60) % 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
} 

const dlnaDelegator = "http://192.168.101.34:8082" //中继服务base url
const dlnaProxyURL = "http://192.168.101.34:8080/upnp" //代理服务(e.g:nginx 主要负责处理cors)

export default {
    props : {
        local: {
            type:Boolean,
            default:false
        }
    },
    name: 'DLNAPlayer',
    setup(props) {
        const devices = ref<UpnpDevice[]>([])
        const selectedDevice = ref<UpnpDevice | null>(null)  
        const volume = ref(50)

        const dlnaService = ref<DLNAProxy|DLNAClient|null>(null)
        const avTransportService = ref<IAVTransportService|null>(null)
        const renderingControlService = ref<IRenderingControlService|null>(null)
        const currentTrackUrl = ref<string|undefined>(undefined) 

        const playState = ref<string|PlayStatus>(PlayStatus.STOPPED)
        const progress = ref<number>(0)
        const currentTimeInSeconds = ref<number>(0)
        const durationInSeconds = ref<number>(0)
        const scrubPosition = ref<number>(0)

        const currentTime = ref<string>("00:00:00")//view
        const duration = ref<string>("00:00:00")//view 

        const checkProgressLocal = ref<boolean>(true) //是否在本地模拟进度 -由device响应来更新实际进度(对与seek的时候不会响应的false较好)
        const displayDeviceMedia = ref<boolean>(true) //是否本地播放dlna媒体
        const videoPlayer = ref<HTMLVideoElement|undefined>()
        const dplayerContainer = ref<HTMLDivElement|undefined>()
        const eventSource = ref<EventSource|null>(null)
        // 搜索 DLNA 设备
        const searchDevices = () => {
            // axios.get(`${dlnaDelegator}/dlna/listDevices`)
            //     .then(response => response.data)
            //     .then(response => { 
            //         devices.value = response.data as UpnpDevice[]
            //     })

            devices.value = testDevices.data

            // devices.value = []
            // eventSource.value = new EventSource(`${dlnaDelegator}/dlna/listDevicesStream`);

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
            playState.value = PlayStatus.PLAYING
            updateProgressScheduler.value = setInterval (async () => {
                if(checkProgressLocal.value){
                    const nextTime = currentTimeInSeconds.value + 1
                    //durationInSeconds.value == 0 可能是直播-流(有些dlna设备不会更新大小,有些会)
                    if(durationInSeconds.value != 0 && nextTime > durationInSeconds.value){
                        stopPlay()
                        return
                    }
                    updatePlayingTime(nextTime)
                }else{
                    const positionInfo = await avTransportService.value!.getPositionInfo()
                    resetTime(positionInfo.trackDuration,positionInfo.relTime)
                }
            },1000,"")
        }
        const pausePlay = () => {
            clearInterval(updateProgressScheduler.value)
            playState.value = PlayStatus.PAUSED_PLAYBACK
        }
        const stopPlay = () => {
            clearInterval(updateProgressScheduler.value)
            playState.value = PlayStatus.STOPPED
            resetTime()
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
        const resetTime = (trackDuration:string|undefined=undefined,relTime:string|undefined=undefined) => {
            //console.log(trackDuration, relTime)
            if(trackDuration){
                duration.value = formatTime(trackDuration)
                durationInSeconds.value = timeStringToSeconds(duration.value)
            }

            updatePlayingTime(relTime)//or absTime?
        }

        watch(checkProgressLocal,async (newValue,_oldValue)=>{
            if(newValue){ //如果改成本地 先查一次进度信息
                const positionInfo = await avTransportService.value!.getPositionInfo()
                currentTimeInSeconds.value = timeStringToSeconds(positionInfo.relTime)
                currentTime.value = formatTime(currentTimeInSeconds.value)
            }
        })
        watch(displayDeviceMedia,async (newValue,_oldValue)=>{
            if(newValue){
                if(currentTrackUrl.value){
                    initDPlayer(currentTrackUrl.value)
                } 
            }else{
                videoPlayer.value?.pause()
            }
        })

        const getMediaUrl = (mediaInfo?: MediaInfo) => {
            if(!mediaInfo){
                return ""
            }
            const { currentURI = '', currentURIMetaData } = mediaInfo;
            const mediaUri = currentURI.trim();
            const metaResValue = currentURIMetaData?.item?.res?.value;
            return mediaUri.length === 0 ? metaResValue : mediaUri;
        }

        const adjustWithAVTransportInfo = (avTransportInfo?:AVTransportInfo|null) => {
                if(!avTransportInfo){
                return
            } 
            console.log("Device AVTransport Info",avTransportInfo) 
            const positionInfo = avTransportInfo.positionInfo
            if( avTransportInfo.transportInfo){
                const currentTransportState = avTransportInfo.transportInfo.currentTransportState

                // playState.value = currentTransportState
                resetTime(positionInfo.trackDuration,positionInfo.relTime)
                if(currentTransportState == PlayStatus.PLAYING){
                    startPlay()
                }
            }
            const mediaUri = getMediaUrl(avTransportInfo.mediaInfo)
            if(currentTrackUrl.value != mediaUri){
                let uri = mediaUri
                //改用chrome插件来完成 去掉指定host的 Referer请求头 
                // if(uri.indexOf("http://61.240.206.7") == 0){
                //     uri = uri.replace("http://61.240.206.7","http://localhost:8080")
                // }
                currentTrackUrl.value = uri
            }
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
                stopPlay()
                console.log('Connecting to device:', device)

                let avTransportInfo ;
                if(props.local){
                    const client = new DLNAClient(dlnaProxyURL, device.location)
                    await client.initDeviceInfo()
                    const avtservice = client.getAVTransportService()
                    const rcservice = client.getRenderingControlService()

                    avTransportService.value = avtservice
                    renderingControlService.value = rcservice

                    volume.value = await rcservice.getVolume()

                    const transportInfo = await avtservice.getTransportInfo()
                    const positionInfo = await avtservice.getPositionInfo()
                    const mediaInfo = await avtservice.getMediaInfo()

                    avTransportInfo = {
                        transportInfo, positionInfo, mediaInfo,
                        controlURL: avtservice.controlURL,
                        eventURL: avtservice.eventURL,
                        soap11: true
                    } satisfies AVTransportInfo

                    dlnaService.value = client
                }else{
                    avTransportInfo = await axios.get(`${dlnaDelegator}/dlna/selectDevice`,{//FIXME 改为deviceinfo
                        params: { location: device.location  }
                    }).then(response => {
                        const resp = response.data
                        if(!resp.success){
                            console.log(response)
                            return
                        }
                        return resp.data as AVTransportInfo
                    }) 

                    if(avTransportInfo){
                        const client = new DLNAProxy(dlnaDelegator, avTransportInfo.controlURL,avTransportInfo.soap11)
                        avTransportService.value = client.avTransportService
                        await client.connect()
                        
                        dlnaService.value = client
                      
                    }
                }
                subscribeUpnpEvent()

                adjustWithAVTransportInfo(avTransportInfo)

                selectedDevice.value = device
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
                if(transportState == PlayStatus.STOPPED){//pause
                    //我当前的小爱音箱S12 没有pause只有stop 但是它也不是真正的停止 这里可以根据播放的时间来判断
                    if(currentTrackDuration && currentTrackDuration != relTimePosition){
                        pausePlay()
                    }else{
                        stopPlay()
                    }
                    
                }else if(transportState == PlayStatus.PLAYING || transportState == PlayStatus.PAUSED_PLAYBACK){
                    if(currentTrackDuration && relTimePosition){
                        resetTime(currentTrackDuration,relTimePosition)
                    }else{
                        const positionInfo = await avTransportService.value!.getPositionInfo()
                        resetTime(positionInfo.trackDuration,positionInfo.relTime)
                    }
                    if(transportState == PlayStatus.PLAYING){
                        if(playState.value != PlayStatus.PLAYING){
                            startPlay()
                        }
                    }else{
                        pausePlay()
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

            seek(seekTarget)
        }
        // 播放控制函数
        const play = () => {
            if(avTransportService.value){
                seek(currentTime.value) //主要给小爱音箱S12 调用play有响应但是不会恢复播放
                startPlay() //先执行,后面如果订阅事件没问题 会有一个回调调整当前的时间和进度
                avTransportService.value?.play()
            }
        }

        const pause = () => {
            pausePlay()
            avTransportService.value?.pause()
        }

        const stop = () => {
            stopPlay()
            avTransportService.value?.stop()
        }

        const seek = (seekTarget:string) => {
            resetPlay(seekTarget)
            avTransportService.value?.seek(seekTarget)
        }
        const setVolume = (vol:number) => {
            const volValue = Math.min(100,vol)
            if (dlnaService.value) {
                volume.value = volValue
                // 实现音量控制逻辑
                console.log('Setting volume to:', volValue)
                renderingControlService.value?.setVolume(volValue)
            }
        }
        const updateVolume = () => { //给input type=range 更新/响应用(like:watch)
            setVolume(volume.value)
        }

        // 生命周期钩子
        onMounted(() => {
            searchDevices()
            stopPlay()
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

        const handleKeyEvent = (event: KeyboardEvent ) => {
            if(!selectedDevice.value){
                return
            }
            if(event.key == 'ArrowRight'){
                seek(formatTime(currentTimeInSeconds.value + 10))
            }else if(event.key == 'ArrowLeft'){
                seek(formatTime(currentTimeInSeconds.value - 10))
            }else if(event.key == 'ArrowUp'){
                setVolume(Number(volume.value) + 5)
            }else if(event.key == 'ArrowDown'){
                setVolume(Number(volume.value) - 5)
            }else if(event.key == ' '){ //空格播放暂停
                if(playState.value == PlayStatus.PLAYING){
                    pause()
                }else{
                    play()
                }
            }
        }

        onMounted(() => {
            document.addEventListener('keydown', handleKeyEvent);
        });
        onUnmounted(() => {
            document.removeEventListener('keydown', handleKeyEvent);
        });


        let dp : DPlayer|undefined;
        const initDPlayer = async (url:string) => {
            dp?.destroy()
            
            const type = await checkMediaType(url) 
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

        const inputUrl = ref('')
        const setMediaUrl = async () => {
            if (!inputUrl.value) {
                return
            }
            try {
                currentTrackUrl.value = inputUrl.value
                await avTransportService.value?.setAVTransportURI(inputUrl.value)
                console.log('媒体URL设置成功')
            } catch (error) {
                console.error('设置媒体URL失败:', error)
            }
        }
         
        return {
            videoPlayer,dplayerContainer,
            devices,selectedDevice, onDeviceSelect,
            play, pause, stop,seek,updateVolume,
            currentTrackUrl,
            //进度，时间信息
            volume,progress,scrubPosition,playState,currentTime,duration ,handleScrubClick,
            checkProgressLocal,displayDeviceMedia,
            inputUrl,setMediaUrl,
        }
    }
}
</script>

<style scoped>
.player-config {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    gap: 20px;
    margin: 15px 0;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f9f9f9;
}

.config-item {
    display: flex;
    align-items: center;
    margin: 0;
    cursor: pointer;
}

.config-item input[type="checkbox"] {
    margin-right: 8px;
}

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

.url-input-container {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    width: 100%;
}

.url-input {
    flex: 1;
    min-width: 0; /* 防止输入框溢出容器 */
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.url-button {
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap; /* 防止按钮文字换行 */
}

.url-button:hover {
    background-color: #45a049;
}

</style>@/services/DLNAProxy