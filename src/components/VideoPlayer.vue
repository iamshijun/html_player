<template>
    <div class="video-player">
        <video ref="videoPlayer" controls 
            @loadedmetadata="onLoadedMetadata"
            @ended="onPlayPausedEnded"
            @pause="onPlayPausedEnded"
            @play="onPlayStarted"

            @dblclick="handleDoubleClick"
            @mousedown="handleMouseDown"
            @mouseup="handleMouseUp" 
            @mouseleave="handleMouseLeave"
            @mousemove="handleMouseMove($event)" 

            @touchstart.prevent="handleTouchStart($event)"
            @touchmove.prevent="handleTouchMove($event)" 
            @touchend="handleTouchEnd"
            >
            <source :src="fileUrl" :type="mimeType">
            您的浏览器不支持视频播放
        </video>
        <div class="media-settings-menu" v-if="showSettings">
            <div class="media-setting-item">
                <label>双击跳转秒数：</label>
                <input type="number" v-model.number="jumpSeconds" min="1" max="60">
            </div>
        </div>
        <div class="media-settings-icon" @click="toggleSettings">
            <span>⚙️</span>
        </div>
        <input type="file" accept="video/*,audio/*" @change="handleFileChange" />
        <div class="url-input">
            <input type="text" v-model="videoUrl" placeholder="输入视频URL">
            <button @click="loadUrl">加载</button>
        </div>
    </div>
</template>

<script>
import NoSleep from 'nosleep.js';
import {ref} from 'vue';
import '/src/backport.js'

export default {
    props : {
        eventbus: {
            type:String,
            required:false
        }
    },
    watch: { 
        eventbus(newValue,oldValue) {
            console.log(newValue,oldValue)
            if(this.isLoaded){
                const video = this.videoPlayer
                if(video.paused || video.ended){
                    video.play()
                }else{
                    vide.pause()
                }
            }
        } 
    },
    data() {
        return {
            fileUrl: '',
            mimeType: '',
            isLoaded: false,
            isVideo: true,
            isMouseDown: false,
            lastTapTime: 0,
            tapTimeout: null,
            touchStartX: 0,
            deltaX: 0,
            noSleep: null,
            showSettings: false,
            jumpSeconds: 5, // 默认跳转秒数
            videoUrl: '' // URL输入
        }
    },
    setup() {
        const videoPlayer = ref(null)
        return {
            videoPlayer
        }
    },
    mounted() {
        if (this.isMobile()) {
            this.noSleep = new NoSleep()
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
            console.log('play started')
            // 启用防止屏幕关闭
            if (this.noSleep) {
                this.noSleep.enable()
            }
        },
        onPlayPausedEnded() {
            if (this.noSleep) {
                this.noSleep.disable()
            }
        },
        async handleFileChange(event) {
            const file = event.target.files[0]
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
                const fileData = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result)
                    reader.onerror = reject
                    reader.readAsArrayBuffer(file)
                })

                // 创建Blob URL
                const blob = new Blob([fileData], { type: file.type })
                this.fileUrl = URL.createObjectURL(blob)
                this.mimeType = file.type

                // 确保视频元素加载完成
                const video = this.videoPlayer
                video.src = this.fileUrl
                video.load()

                // 等待媒体准备好
                await new Promise((resolve) => {
                    video.oncanplay = resolve
                    video.onerror = (err) => {
                        console.error('媒体加载失败:', err)
                        alert('无法播放此文件')
                        resolve()
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
        handleTouchStart(event, longPress = false) {
            if (!this.isMobile()) {
                return
            }
            this.showSettings = false
            this.touchStartX = event.touches[0].clientX

            // 双击检测
            const currentTime = new Date().getTime()
            const tapLength = currentTime - this.lastTapTime
            const doubleClick = tapLength < 300 && tapLength > 0


            if (doubleClick || longPress) {
                const video = this.videoPlayer
                const rect = video.getBoundingClientRect()
                const touchX = this.touchStartX - rect.left
                const width = rect.width

                if (touchX < width / 2) {//left
                    if (longPress) {
                        video.playbackRate = 0.8
                    } else {
                        video.currentTime = Math.max(0, video.currentTime - this.jumpSeconds)
                    }
                } else {//right
                    if (longPress) {
                        video.playbackRate = 2.5
                    } else {
                        video.currentTime = Math.min(video.duration, video.currentTime + this.jumpSeconds)
                    }
                }
                this.clearTapTimeout()
            } else {
                this.tapTimeout = setTimeout(() => {
                    this.handleTouchStart(event, true)
                }, 300)
            }

            this.lastTapTime = currentTime
        },
        handleTouchMove(event) {
            if (!this.isMobile()) {
                return
            }
            this.clearTapTimeout()
            const deltaX = event.touches[0].clientX - this.touchStartX
            const video = this.videoPlayer

            if (this.isLoaded) {
                if (video.playbackRate != 1) {
                    const speedDelta = deltaX * 0.01
                    video.playbackRate = Math.max(0.5, Math.min(4.0, video.playbackRate + speedDelta))
                } else {
                    this.deltaX = deltaX
                }
            }
        },
        handleTouchEnd() {
            this.clearTapTimeout()
            if (this.isLoaded) {
                const video = this.videoPlayer
                if (video.playbackRate != 1) {//如果当前是进入的是 设置倍速播放的模式
                    video.playbackRate = 1
                } else if(this.deltaX != 0) {
                    const jumpSeconds = Math.floor(this.deltaX / 10) * 1
                    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + jumpSeconds))
                }
            }
            this.touchStartX = 0 //reset tap startX
            this.deltaX = 0
        },
        handleDoubleClick(event) {
            if (this.isMobile()) {
                return
            }
            
            const video = this.videoPlayer
            const rect = video.getBoundingClientRect()
            const clickX = event.clientX - rect.left
            const width = rect.width

            if(this.isLoaded){
                if (clickX < width / 2) {
                    // 左半边双击：后退
                    video.currentTime = Math.max(0, video.currentTime - this.jumpSeconds)
                } else {
                    // 右半边双击：快进
                    video.currentTime = Math.min(video.duration, video.currentTime + this.jumpSeconds)
                }
            }
        },
        handleMouseLeave() {
            this.handleMouseUp()
        },
        handleMouseUp() {
            if (this.isMobile()) return
            this.isMouseDown = false

            if(this.isLoaded){
               this.videoPlayer.playbackRate = 1.0
            }            
        },
        handleMouseDown(event) {
            if (this.isMobile()) return
            
            this.videoPlayer.playbackRate = 2.0
            this.isMouseDown = true
        },
        handleMouseMove(event) {
            if (this.isMobile()) return
            if (!this.isMouseDown) return

            const deltaX = event.movementX
            //const direction = deltaX > 0 ? 'right' : 'left'
            //console.log(`Mouse moving ${direction}`)
            const speedDelta = deltaX * 0.01

            const video = this.videoPlayer
            if(this.isLoaded){
                video.playbackRate = Math.max(0.5, Math.min(4.0, video.playbackRate + speedDelta))
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
                console.log(this.mimeType)

                // 确保视频元素加载完成
                const video = this.videoPlayer
                video.src = this.fileUrl
                video.load()

                // 等待媒体准备好
                await new Promise((resolve) => {
                    video.oncanplay = resolve
                    video.onerror = (err) => {
                        console.error('媒体加载失败:', err)
                        alert('无法播放此URL')
                        resolve()
                    }
                })

                // 尝试播放
                await video.play()
            } catch (error) {
                console.error('播放失败:', error)
                alert('播放失败，请检查URL格式或浏览器支持')
            }
        },

        getMimeTypeFromUrl(url) {
            const extension = url.split('.').pop().toLowerCase()
            switch(extension) {
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
.video-player {
    /* max-width: 800px; */
    margin: 0 auto;
    position: relative;
}

video, audio {
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
    min-width: 200px;
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
    width: 60px;
    padding: 4px;
    border-radius: 2px;
    border: 1px solid #666;
    background: #333;
    color: #fff;
}

.url-input {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

.url-input input {
    flex: 1;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #666;
    background: #333;
    color: #fff;
}

.url-input button {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    background: #007bff;
    color: #fff;
    cursor: pointer;
}

.url-input button:hover {
    background: #0056b3;
}
</style>
