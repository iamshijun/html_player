<template>
    <div class="video-container">
        <div class="video-player">
            <video ref="videoPlayer" 
                @loadedmetadata="onLoadedMetadata" 
                @ended="onPlayPausedEnded"
                @pause="onPlayPausedEnded" 
                @play="onPlayStarted" 
                
                @dblclick="handleDoubleClick"
                @mousedown="handleMouseDown"
                @mouseup="handleMouseUp"
                @mouseleave="handleMouseLeave"
                @mousemove="handleMouseMove($event)"

                @touchstart="handleTouchStart($event)"
                @touchmove="handleTouchMove($event)" 
                @touchend="handleTouchEnd"
                >
                <source :src="fileUrl" :type="mimeType">
                您的浏览器不支持视频播放
            </video>

            <!-- Custom Controls -->
            <div class="custom-controls" v-show="showControls">
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
                    <label>选择本地文件：</label>
                    <input type="file" accept="video/*,audio/*" @change="handleFileChange" />
                </div>

                <div class="media-setting-item url-input">
                    <button @click="loadUrl">加载</button>
                    <input type="text" v-model="videoUrl" placeholder="输入视频URL">
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

// function adjustSafeArea() {
//     const windowHeight = window.innerHeight;
//     const documentHeight = document.documentElement.clientHeight;
//     const safeAreaBottom = Math.max(0, windowHeight - documentHeight);
//     console.log(`windowHeight:${windowHeight} , documentHeight:${documentHeight}, safeAreaBottom:${safeAreaBottom}`)
//     document.documentElement.style.setProperty('--safe-area-bottom', `${safeAreaBottom}px`);
// }

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
            tapTimeout: null as number | null,
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
            controlsTimeout: null as number|null, //hideControl timeout
            isFullscreen: false
        }
    },
    setup() {
        const videoPlayer = ref<HTMLVideoElement|undefined>(undefined)
        return {
            videoPlayer
        }
    },
    mounted() {
        // adjustSafeArea()
        const video = this.videoPlayer;
        if(video == null) return
        // Initialize controls
       
        video.addEventListener('timeupdate', this.updateProgress);
        // video.addEventListener('fullscreenchange', function() {
        // });
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
        onPlayPausedEnded() {
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
            if (this.tapTimeout) {
                clearTimeout(this.tapTimeout)
            }
        },

        handleTouchStart(event:TouchEvent) {
            this.showSettings = false
            if (!this.isMobile()) return

            if (this.controlsTimeout) {
                clearTimeout(this.controlsTimeout);
            }

            this.showSettings = false
            this.touchStartX = event.touches[0].clientX

            // 双击检测
            const currentTime = new Date().getTime()

            const tapLength = currentTime - this.lastTapTime
            const doubleClick = tapLength < 200 && tapLength > 0
            const longPress = this.isLongPress 

            if (doubleClick || longPress) {
                const video = this.videoPlayer
                if(!video) {
                    return
                }
                const rect = video.getBoundingClientRect()
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
            const rect = video.getBoundingClientRect()
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
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
            video.style.width = '100vw';
            video.style.height = '100vh'; 

            if (!document.fullscreenElement) {
                // 请求进入全屏模式
                video.requestFullscreen();

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
                screen.orientation.unlock();
                this.isFullscreen = false
            }
        },

        async loadUrl() {
            if (!this.videoUrl) return

            // 释放之前的URL
            if (this.fileUrl) {
                URL.revokeObjectURL(this.fileUrl)
            }

            try {
                // 设置新的URL
                this.fileUrl = this.videoUrl
                this.mimeType = this.getMimeTypeFromUrl(this.videoUrl) 

                // 确保视频元素加载完成
                const video = this.videoPlayer
                if(!video){
                    return
                }
                video.src = this.fileUrl
                video.load()

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
        }
    }
}
</script>

<style scoped>
:root {
    --safe-area-bottom: 0px;
    /* 默认值 */
}

.video-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    /*但是安全区域 safe-area-inset-* 只有在ios中有  */
    height: calc(100vh - var(--safe-area-bottom, 0));
    margin: 0;
    padding: 0;
    /* overflow: auto; */
}

.video-player {
    position: relative;
    width: 100%;
    height: 100%;
}

video {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

video,
audio {
    width: 100%;
    margin-bottom: 1rem;
}

.media-settings-icon {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    z-index: 1;
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
    z-index: 2;
    min-width: 300px;
}

.media-setting-item {
    margin-bottom: 8px;
}

.media-setting-item label {
    color: #fff;
    font-size: 14px;
    margin-right: 8px;
}

.media-setting-item input {
    width: 70px;
    padding: 4px;
    border-radius: 2px;
    border: 1px solid #666;
    background: #333;
    color: #fff;
}

.url-input {
    display: flex;
    gap: 7px;
}

.url-input input {
    flex: 1;
    padding: 3px;
    border-radius: 4px;
    border: 1px solid #666;
    background: #333;
    color: #fff;
}

.url-input button {
    padding: 3px 8px;
    border-radius: 4px;
    border: none;
    background: #007bff;
    color: #fff;
    cursor: pointer;
}

.url-input button:hover {
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
