<template>
    <div class="video-container">
        <div class="video-player">
            <video ref="videoPlayer" 
                @loadedmetadata="onLoadedMetadata" 
                @ended="onPausedOrEnded"
                @pause="onPausedOrEnded" 
                @play="onPlayStarted" 
                @dblclick.prevent
                @click.prevent
                @contextmenu.prevent
                playsinline
                webkit-playsinline
                x5-playsinline
                x-webkit-airplay="allow"
                x5-video-player-type="h5"
                x5-video-player-fullscreen="true"
                style="pointer-events: none;">  
                <source :src="fileUrl" :type="mimeType">
                您的浏览器不支持视频播放
            </video>

            <div class="subtitle-layer" :style="subtitleStyle" v-show="currentSubtitle">
                {{ currentSubtitle?.text }}
            </div>

            <div class="video-interaction-layer" ref="videoInteractionPlayer"
                @dblclick="handleDoubleClick"
                @mousedown="handleMouseDown"
                @mouseup="handleMouseUp"
                @mouseleave="handleMouseLeave"
                @mousemove="handleMouseMove($event)"

                @touchstart="handleTouchStart($event)"
                @touchmove="handleTouchMove($event)" 
                @touchend="handleTouchEnd">

            </div>

            <!-- Custom Controls -->
            <div class="custom-controls" v-show="showControls || !isLoaded">
                <div class="progress-bar" @mousemove="handleScrubHover" @mouseleave="handleScrubLeave"
                    @click="handleScrubClick">
                    <div class="progress" :style="{ width: progress + '%' }"></div>
                    <div class="scrubber" v-show="isScrubbing || isHovering" :style="{ left: scrubPosition + '%' }">
                    </div>
                    <div class="srubber-time-tooltip" v-show="isHovering" :style="{ left: scrubPosition + 'px' }">
                        {{ hoverTime }}
                    </div>
                </div>
                <div class="control-buttons">
                    <button @click="togglePlay()">
                        {{ isPlaying ? '❚❚' : '▶' }}
                    </button>
                    <span class="padding"></span>
                    <span class="time-display">
                        {{ currentTime }} / {{ duration }}
                    </span>
                    <button class="fullscreen-btn" @click="toggleFullscreen">
                        {{ isFullscreen ? '⤢' : '⤡' }}
                    </button>
                </div>
            </div>

            <div class="media-settings-menu" v-if="showSettings">
                <div class="media-setting-item">
                    <label>双击跳转秒数：</label>
                    <input type="number" v-model.number="jumpSeconds" min="1" max="60">
                </div>
                <div class="media-setting-item">
                    <label>双击行为：</label>
                    <select v-model="doubleClickBehavior">
                        <option value="seek">快进/后退</option>
                        <option value="toggle">停止/播放</option>
                    </select>
                </div>

                <div class="media-setting-item">
                    <label>本地播放：</label>
                    <button class="file-input-button" @click="fileInput!.click()">选择文件</button>
                    <input
                        ref="fileInput"
                        type="file"
                        accept="video/*,audio/*"
                        @change="handleFileChange"
                        style="display: none"
                    />
                </div>

                <div class="url-input-container">
                    <button @click="loadUrl">加载</button>
                    <input type="text" v-model="videoUrl" placeholder="输入视频URL">
                </div>

                <div class="media-setting-item">
                    <label>字幕文件：</label>
                    <button class="file-input-button" @click="subtitleInput!.click()">选择字幕</button>
                    <input
                        ref="subtitleInput"
                        type="file"
                        accept=".srt,.vtt"
                        @change="handleSubtitleChange"
                        style="display: none"
                    />
                </div>
            </div>
            <div class="media-settings-icon" @click="toggleSettings">
                <span>⚙️</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import NoSleep from 'nosleep.js'; 
import { ref } from 'vue';
import {checkMediaType} from "@/utils/http";
import Hls from 'hls.js';
// import flvjs from 'flv.js';

interface Subtitle {
    startTime: number;
    endTime: number;
    text: string;
}

export default {
    props :{
        playUrl: {
            type:[String ,null] ,
            required: false
        }
    },
    watch : {
        playUrl (newValue,_oldValue) {
            const video = this.videoPlayer;
            if(video == null){
                return 
            }
            video.src = newValue
            video.load()
        }
    },
    data() {
        return {
            fileUrl: '',//选择的本地系统文件
            videoUrl: '', // URL输入

            mimeType: '',
            isLoaded: false,//媒体文件是否加载完成
            isVideo: true,
            /* 用户motion动作信息记录 */
            isMouseDown: false,
            isLongPress: false,
            hasMove: false,
            lastTapTime: 0,
            tapTimeout: undefined as number | undefined,
            touchStartX: 0,
            deltaX: 0,

            noSleep: null as NoSleep|null,

            showSettings: false,
            jumpSeconds: 5, // 默认跳转秒数
            doubleClickBehavior: 'toggle', // 双击行为：seek-快进后退，toggle-停止播放

            showControls: false,
            isPlaying: false,
            progress: 0,
            currentTime: '00:00',
            duration: '00:00',
            isScrubbing: false,
            scrubPosition: 0,
            isHovering: false,
            hoverTime: '00:00',
            tooltipPosition: 0,
            controlsTimeout: undefined as number|undefined, //hideControl timeout
            isFullscreen: false,
            hls: null as Hls | null,  // 添加 hls 实例
            subtitleUrl: '', // 字幕文件URL
            subtitles: [] as Subtitle[],
            currentSubtitle: null as Subtitle | null,
            subtitlePosition: 'bottom',
            subtitleSize: 24,
        }
    },
    computed : {
        subtitleStyle() {
            return {
                fontSize: `${this.subtitleSize}px`,
                bottom: this.subtitlePosition === 'bottom' ? '10%' : 'auto',
                top: this.subtitlePosition === 'top' ? '10%' : 'auto',
            }
        }
    },
    setup() {
        const videoPlayer = ref<HTMLVideoElement|undefined>(undefined)
        const videoInteractionPlayer = ref<HTMLDivElement|undefined>(undefined)
        const fileInput = ref<HTMLInputElement|undefined>(undefined)
        const subtitleInput = ref<HTMLInputElement|undefined>(undefined)
        return {
            videoPlayer,videoInteractionPlayer,fileInput,subtitleInput
        }
    },
    mounted() {
        // adjustSafeArea()
        const video = this.videoPlayer;
        if(video == null) return
        // Initialize controls
       
        video.addEventListener('timeupdate', this.updateProgress);
        // video.addEventListener('timeupdate', this.updateSubtitle);
        // video.addEventListener('fullscreenchange', function() { });

        // 添加全屏变化事件监听
        video.addEventListener('webkitbeginfullscreen', () => {
            this.isFullscreen = true;
        });
        video.addEventListener('webkitendfullscreen', () => {
            this.isFullscreen = false;
        });
        
        if (this.isMobile()) {
            this.noSleep = new NoSleep();
        }
    },
    beforeDestroy() {
        if (this.noSleep) {
            this.noSleep.disable()
        }
    },
    methods: {
        toggleSettings() {
            this.showSettings = !this.showSettings
        },
        onLoadedMetadata() {
            console.log('视频元数据加载完成');
            this.isLoaded = true;
        },
        onPlayStarted() {
            // 启用防止屏幕关闭
            if (this.noSleep) {
                this.noSleep.enable()
            }
            this.isPlaying = true
        },
        onPausedOrEnded() {
            if (this.noSleep) {
                this.noSleep.disable()
            }
            this.isPlaying = false
        },
        async handleFileChange(event:Event) {
            const target = event.target as HTMLInputElement
          
            const file = target?.files?.[0]
            if (!file) return

            // 释放之前的URL
            if (this.fileUrl) {
                URL.revokeObjectURL(this.fileUrl)
            }

            // 检查文件类型
            const supportedTypes = ['video/mp4', 'video/webm', 'video/ogg',
                'audio/mpeg', 'audio/ogg', 'audio/wav']
            if (!supportedTypes.includes(file.type)) {
                alert('不支持的媒体格式')
                return
            }

            try {
                // 创建文件读取器
                const reader = new FileReader()

                // 等待文件读取完成
                const fileData = await new Promise<string | ArrayBuffer | null>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result)
                    reader.onerror = reject
                    reader.readAsArrayBuffer(file)
                })
                if(fileData == null){
                    alert("读取文件失败")
                    return
                }
                // 创建Blob URL
                const blob = new Blob([fileData], { type: file.type })
                this.fileUrl = URL.createObjectURL(blob)
                this.mimeType = file.type

                // 确保视频元素加载完成
                const video = this.videoPlayer
                if(!video) return
                video.src = this.fileUrl
                video.load()

                // 等待媒体准备好
                await new Promise((resolve) => {
                    video.oncanplay = resolve
                    video.onerror = (err) => {
                        console.error('媒体加载失败:', err)
                        alert('无法播放此文件')
                        resolve(true)
                    }
                })

                // 尝试播放
                await video.play()
            } catch (error) {
                console.error('播放失败:', error)
                alert('播放失败，请检查文件格式或浏览器支持')
            }
        },
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        },
        clearTapTimeout() { 
            clearTimeout(this.tapTimeout)
        },

        handleTouchStart(event:TouchEvent) {
            this.showSettings = false
            if (!this.isMobile()) return

            clearTimeout(this.controlsTimeout);

            this.showSettings = false
            this.touchStartX = event.touches[0].clientX

            // 双击检测
            const currentTime = new Date().getTime()

            const tapLength = currentTime - this.lastTapTime
            const doubleClick = tapLength < 250 && tapLength > 0
            const longPress = this.isLongPress 

            if (doubleClick || longPress) {
                const video = this.videoPlayer
                if(!video) {
                    return
                }
                const rect = this.videoInteractionPlayer!.getBoundingClientRect()
                const touchX = this.touchStartX - rect.left
                const width = rect.width

                if (!this.isLoaded){
                    return
                }
                const toggle = doubleClick && this.doubleClickBehavior == 'toggle'
                if (touchX < width / 2) {//left
                    if(toggle) {
                        this.togglePlay()
                    }else if (longPress) {
                        video.playbackRate = 0.8
                    } else {
                        video.currentTime = Math.max(0, video.currentTime - this.jumpSeconds)
                    }
                } else {//right
                    if(toggle) {
                        this.togglePlay()
                    }else if (longPress) {
                        video.playbackRate = 2.5
                    } else {
                        video.currentTime = Math.min(video.duration, video.currentTime + this.jumpSeconds)
                    }
                }
                
                this.clearTapTimeout()
            } else {
                this.tapTimeout = setTimeout(() => {
                    console.log("tapTimeout !")
                    this.isLongPress = true
                    this.handleTouchStart(event)
                }, 250, null)

            }

            this.lastTapTime = currentTime
        },
        handleTouchMove(event:TouchEvent) {
            if (!this.isMobile()) return
            this.hasMove = true
            this.isHovering = true

            this.clearTapTimeout()

            const deltaX = event.touches[0].clientX - this.touchStartX
            const video = this.videoPlayer

            if (video && this.isLoaded) {
                if (video.playbackRate != 1) {
                    const speedDelta = deltaX * 0.01
                    video.playbackRate = Math.max(0.5, Math.min(4.0, video.playbackRate + speedDelta))
                } else {
                    this.deltaX = deltaX
                    const jumpSeconds = Math.floor(this.deltaX / 10) * 1
                    this.hoverTime = this.formatTime(Math.max(0, Math.min(video.duration, video.currentTime + jumpSeconds)))
                }
            }
        },
        isClick() {
            return !(this.isLongPress || this.hasMove)
        },
        handleTouchEnd() {
            if (this.isClick()) {
                this.toggleControl()
            }
            if (this.showControls) {
                this.resetControlsTimeout();
            }

            this.isHovering = false
            this.isLongPress = false //clear status
            this.hasMove = false
            //this.doubleClick = false
            this.clearTapTimeout()

            const video = this.videoPlayer
            if (video && this.isLoaded) {
                if (video.playbackRate != 1) {//如果当前是进入的是 设置倍速播放的模式
                    video.playbackRate = 1
                } else if (this.deltaX != 0) {
                    const jumpSeconds = Math.floor(this.deltaX / 10) * 1
                    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + jumpSeconds))
                }
            }
            this.touchStartX = 0 //reset tap startX
            this.deltaX = 0
        },
        handleDoubleClick(event:MouseEvent) {
            this.showSettings = false
            if (this.isMobile()) return

            const video = this.videoPlayer
            if(!video){
                return
            }
            const rect = this.videoInteractionPlayer!.getBoundingClientRect()
            const clickX = event.clientX - rect.left
            const width = rect.width

            if (!this.isLoaded) return;
            if (this.doubleClickBehavior == 'toggle') {
                this.togglePlay()
                return;
            }

            if (clickX < width / 2) {
                // 左半边双击：后退
                video.currentTime = Math.max(0, video.currentTime - this.jumpSeconds)
            } else {
                // 右半边双击：快进
                video.currentTime = Math.min(video.duration, video.currentTime + this.jumpSeconds)
            }
        },
        handleMouseLeave() {
            this.handleMouseUp()
        },
        handleMouseUp() {
            if (this.isMobile()) return
            this.isMouseDown = false

            if (this.videoPlayer && this.isLoaded) {
                this.videoPlayer.playbackRate = 1.0
            }
        },
        handleMouseDown() {
            this.showSettings = false

            if (this.isMobile()) return
            if (this.videoPlayer && this.isLoaded) {
                this.videoPlayer.playbackRate = 2.0
            }
            this.isMouseDown = true
            this.toggleControl()
            if (this.showControls) {
                this.resetControlsTimeout();
            }
        },
        handleMouseMove(event:MouseEvent) {
            if (this.isMobile()) return
            if (!this.isMouseDown) return

            const deltaX = event.movementX
            const speedDelta = deltaX * 0.01

            const video = this.videoPlayer
            if (video && this.isLoaded) {
                video.playbackRate = Math.max(0.5, Math.min(4.0, video.playbackRate + speedDelta))
            }
        },

        handleScrubHover(event:MouseEvent) {
            this.isHovering = true
            clearTimeout(this.controlsTimeout);

            const progressBar = event.currentTarget as HTMLElement
            const rect = progressBar.getBoundingClientRect()
            const offsetX = event.clientX - rect.left
            const percent = offsetX / rect.width

            const video = this.videoPlayer
            if (video && this.isLoaded) {
                this.hoverTime = this.formatTime(video.duration * percent)
                this.tooltipPosition = offsetX
                this.scrubPosition = percent * 100
            }
        },

        handleScrubLeave() {
            this.isHovering = false
            if (this.showControls) {
                this.resetControlsTimeout();
            }
        },

        handleScrubClick(event:MouseEvent) {

            const progressBar = event.currentTarget as HTMLElement
            const rect = progressBar.getBoundingClientRect()
            const offsetX = event.clientX - rect.left
            const percent = offsetX / rect.width

            const video = this.videoPlayer
            if (video && this.isLoaded) {
                video.currentTime = video.duration * percent
            }
        },

        formatTime(seconds: number) {
            if(isNaN(seconds)){
                return '00:00:00'
            }
            // const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            // if(minutes >= 60){ //超过1小时
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds / 60) % 60); 
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            // }
            // return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        },

        togglePlay() {    
            const video = this.videoPlayer;
            if (video && this.isLoaded) {
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
                const time = video.currentTime
                if(this.isFullscreen){ //因为全屏模式下默认的控制条又出来,并且双击还是跳转+10秒，这里恢复一下
                    setTimeout(() => {
                        video.currentTime = time
                    },100, undefined)
                }
            }
        },
        toggleControl() {
            this.showControls = !this.showControls
        },

        updateProgress() {
            const video = this.videoPlayer;
            if(video){
                this.progress = (video.currentTime / video.duration) * 100;
                this.currentTime = this.formatTime(video.currentTime);
                this.duration = this.formatTime(video.duration);
                //this.scrubPosition = this.progress
            }
        },


        resetControlsTimeout() { 
            if (this.controlsTimeout) {
                clearTimeout(this.controlsTimeout);
            }
            this.controlsTimeout = setTimeout(() => {
                this.showControls = false;
            }, 3000, undefined);
        },

        async toggleFullscreen() {
            const video = this.videoPlayer
            if(!video){
                return
            } 
            const container = video.closest('.video-container') as HTMLElement
            // 添加 iOS Safari 全屏支持
            if (video.webkitEnterFullscreen) {
                // iOS Safari 的特殊处理
                video.webkitEnterFullscreen();
                this.isFullscreen = true;
                return;
            }

            // 检查当前是否已经在全屏模式
            if (!document.fullscreenElement) {
                // 由 video-interaction-layer 请求进入全屏模式
                await container.requestFullscreen();

                this.isFullscreen = true
                // 锁定屏幕方向为横屏
                if (screen.orientation && screen.orientation.lock) {
                    await screen.orientation.lock('landscape');
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
                // 解锁屏幕方向
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                }
                this.isFullscreen = false
            }
        },

        async loadUrl() {
            if (!this.videoUrl) return

            // 释放之前的URL
            if (this.fileUrl) {
                URL.revokeObjectURL(this.fileUrl)
            }
            if (this.hls) {
                this.hls.destroy()
                this.hls = null
            }

            try {
                // 确保视频元素加载完成
                const video = this.videoPlayer
                if(!video){
                    return
                }
                const mediaType = await checkMediaType(this.videoUrl)
                if(mediaType === 'hls'){
                     // 检查浏览器是否原生支持HLS
                     if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = this.videoUrl
                    } else if (Hls.isSupported()) {
                        this.hls = new Hls({
                            // xhrSetup: (xhr) => {
                            //     xhr.timeout = 20000; // 设置10秒超时
                            // },
                            // manifestLoadingTimeOut: 20000,    // manifest加载超时时间
                            // manifestLoadingMaxRetry: 3,       // manifest加载重试次数
                            // levelLoadingTimeOut: 10000,       // level加载超时时间
                            // levelLoadingMaxRetry: 3,          // level加载重试次数
                            // fragLoadingTimeOut: 20000,        // 分片加载超时时间
                            // fragLoadingMaxRetry: 3            // 分片加载重试次数
                        });
                        this.hls.loadSource(this.videoUrl)
                        this.hls.attachMedia(video)
                        
                        await new Promise((resolve, reject) => {
                            this.hls!.on(Hls.Events.MANIFEST_PARSED, resolve)
                            this.hls!.on(Hls.Events.ERROR, reject)
                        })
                    } else {
                        alert('您的浏览器不支持HLS播放')
                        return
                    }
                }else{
                    // 非HLS流的原有处理逻辑
                    this.fileUrl = this.videoUrl
                    this.mimeType = this.getMimeTypeFromUrl(this.videoUrl) 
                    video.src = this.fileUrl
                    video.load()
                } 

                // 等待媒体准备好
                await new Promise((resolve) => {
                    video.oncanplay = resolve
                    video.onerror = (err) => {
                        console.error('媒体加载失败:', err)
                        alert('无法播放此URL')
                        resolve(true)
                    }
                })

                // 尝试播放
                await video.play()
            } catch (error) {
                console.error('播放失败:', error)
                alert('播放失败，请检查URL格式或浏览器支持')
            }
        },

        getMimeTypeFromUrl(url:string) {
            const extension = url.split('.').pop()?.toLowerCase()
            switch (extension) {
                case 'mp4': return 'video/mp4'
                case 'webm': return 'video/webm'
                case 'ogg': return 'video/ogg'
                case 'mp3': return 'audio/mpeg'
                case 'wav': return 'audio/wav'
                default: return ''
            }
        },

        async handleSubtitleChange(event: Event) {
            const target = event.target as HTMLInputElement
            const file = target?.files?.[0]
            if (!file) return

            try {
                const text = await file.text()
                const fileExt = file.name.split('.').pop()?.toLowerCase()
                
                if (fileExt === 'srt') {
                    this.subtitles = this.parseSRT(text)
                } else if (fileExt === 'vtt') {
                    this.subtitles = this.parseVTT(text)
                } else {
                    alert('不支持的字幕格式')
                    return
                }
            } catch (error) {
                console.error('字幕加载失败:', error)
                alert('字幕加载失败')
            }
        },

        updateSubtitle() {
            const video = this.videoPlayer
            if (!video || this.subtitles.length === 0) return

            const currentTime = video.currentTime
            this.currentSubtitle = this.subtitles.find(subtitle => 
                currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
            ) || null
        },

        timeToSeconds(timeStr: string): number {
            const [hours, minutes, seconds] = timeStr.split(':').map(Number)
            return hours * 3600 + minutes * 60 + seconds
        },

        parseSRT(srtContent: string): Subtitle[] {
            const subtitles: Subtitle[] = []
            const blocks = srtContent.trim().split(/\n\s*\n/)

            blocks.forEach(block => {
                const lines = block.trim().split('\n')
                if (lines.length < 3) return

                const times = lines[1].split(' --> ')
                const startTime = this.timeToSeconds(times[0].replace(',', '.'))
                const endTime = this.timeToSeconds(times[1].replace(',', '.'))
                const text = lines.slice(2).join('\n')

                subtitles.push({ startTime, endTime, text })
            })

            return subtitles
        },

        parseVTT(vttContent: string): Subtitle[] {
            const subtitles: Subtitle[] = []
            const blocks = vttContent.trim().split(/\n\s*\n/)
            
            // 跳过WEBVTT头
            blocks.slice(1).forEach(block => {
                const lines = block.trim().split('\n')
                if (lines.length < 2) return

                let timeLineIndex = lines[0].includes('-->') ? 0 : 1
                const times = lines[timeLineIndex].split(' --> ')
                const startTime = this.timeToSeconds(times[0])
                const endTime = this.timeToSeconds(times[1])
                const text = lines.slice(timeLineIndex + 1).join('\n')

                subtitles.push({ startTime, endTime, text })
            })

            return subtitles
        },
    }
}
</script>

<style scoped>
.video-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    /*但是安全区域 safe-area-inset-* 只有在ios中有  */
    height: 100vh;
    margin: 0;
    padding: 0;
    /* overflow: auto; */
    /* background: #000; */
    z-index: 1;
}

.video-player {
    position: relative;
    width: 100%;
    height: 100%;
}

.video-interaction-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    /* 或者你想要的背景色 */
    /* background-color: #000;  */
    z-index: 1;
}
.subtitle-layer {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
    text-align: center;
    padding: 10px;
    z-index: 2;
    pointer-events: none;
    white-space: pre-line;
    max-width: 80%;
}

video,
audio {
    /* display: none;  */
    width: 100%;
    height: 100%;

     /* 禁用默认控件 */
    user-select: none;
    -webkit-touch-callout: none;
    object-fit: contain;
    /* 尝试隐藏默认控件 */
    ::-webkit-media-controls {
        display: none !important;
    }
    ::-webkit-media-controls-enclosure {
        display: none !important;
    }
} 

.media-settings-icon {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    z-index: 3;
    background: rgba(0, 0, 0, 0.5);
    padding: 5px;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.media-settings-menu {
    position: absolute;
    top: 40px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 3;
    min-width: 300px;
}

.media-setting-item {
    margin-bottom: 8px;
    display: flex;
    align-items: center;
}

.media-setting-item label {
    color: #fff;
    font-size: 14px;
    margin-right: 8px;
    min-width: 100px; /* 确保所有标签宽度一致 */
    text-align: left;
}

.media-setting-item input,
.media-setting-item select {
    flex: 1;
    max-width: 150px;
    padding: 4px;
    border-radius: 2px;
    border: 1px solid #666;
    background: #333;
    color: #fff;
}

.file-input-wrapper {
    flex: 1;
    max-width: 150px;
}

.file-input-button {
    width: 100%;
    padding: 4px 4px;
    border-radius: 4px;
    border: 1px solid #666;
    background: #333;
    color: #fff;
    cursor: pointer;
    text-align: center;
}

.file-input-button:hover {
    background: #444;
}

.url-input-container {
    display: flex;
    gap: 7px;
    flex: 1;
    margin-bottom:8px;
}

.url-input-container input {
    flex: 1;
    padding: 3px;
    border-radius: 4px;
    border: 1px solid #666;
    background: #333;
    color: #fff;
}

.url-input-container button {
    padding: 3px 8px;
    border-radius: 4px;
    border: none;
    background: #007bff;
    color: #fff;
    cursor: pointer;
}

.url-input-container button:hover {
    background: #0056b3;
}

.custom-controls {
    /* position: absolute; */
    /* bottom: var(--safe-area-bottom, 0); */
    position: fixed;
    bottom: var(--safe-area-bottom, 0);
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    padding: 15px;
    box-sizing: border-box;
    transition: opacity 0.3s;
    z-index: 100;
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

.srubber-time-tooltip {
    color: white;
}

.control-buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.control-buttons .padding {
    flex: 1 1 auto;
}

.time-display {
    color: #fff;
    font-size: 14px;
    margin-left: 10px;
    margin-right: 10px;
}

.fullscreen-btn { 
    background: none;
    border: none;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    padding: 0 8px;
}

.fullscreen-btn:hover {
    color: #007bff;
}
</style>
