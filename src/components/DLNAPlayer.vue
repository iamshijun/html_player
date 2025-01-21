<template>
    <div class="dlna-player">
        <!-- 设备选择 -->
        <div class="device-list">
            <h3>可用设备</h3>
            <select v-model="selectedDevice" @change="onDeviceSelect">
                <option value="1">选择设备</option>
                <option v-for="device in devices" :key="device.location" :value="device">
                    {{ device.name }}
                </option>
            </select>
        </div>

        <!-- 播放控制 -->
        <div class="player-controls" v-if="selectedDevice">
            <div class="media-info" v-if="currentMedia">
                <h4>{{ currentMedia.title }}</h4>
                <p>{{ currentMedia.artist }}</p>
            </div>
            <div class="controls">
                <button @click="play">播放</button>
                <button @click="pause">暂停</button>
                <button @click="stop">停止</button>
                <input type="range" v-model="volume" @change="setVolume" min="0" max="100" />
            </div>
        </div>
    </div>
</template>


<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios';

interface MediaInfo {
    title: string;
    artist: string;
}

interface UpnpDevice {
    name: string;
    location: string,
}

export default {
    name: 'DLNAPlayer',
    setup() {
        const devices = ref<UpnpDevice[]>([])
        const selectedDevice = ref<UpnpDevice|null>(null)
        const currentMedia = ref<MediaInfo|null>(null)
        const volume = ref(50)
        // let ssdpClient = null

        // 搜索 DLNA 设备
        const searchDevices = () => {
            // 这里需要使用 node-ssdp 或类似库来实现设备发现
            // 由于浏览器限制，可能需要通过后端服务来实现
            devices.value = [
                { name:'xiaomi music',location: "http://192.168.101.24:9999/a483563d-ea67-4df5-99ae-37daabfd2b66.xml"}
            ]

            console.log('Searching for DLNA devices...')
        }

        // 选择设备
        const onDeviceSelect = () => {
            // 连接到选定的设备
            if(selectedDevice.value){
                connectToDevice(selectedDevice.value!)
            }
        }

        // 连接设备
        const connectToDevice = async (device:UpnpDevice) => {
            try {
                axios.get(device.location).then(resp => {
                    console.log(resp.data)
                })
                // 实现设备连接逻辑
                console.log('Connecting to device:', device)
            } catch (error) {
                console.error('Failed to connect to device:', error)
            }
        }

        // 播放控制函数
        const play = () => {
            if (selectedDevice.value) {
                // 实现播放逻辑
                console.log('Playing media')
            }
        }

        const pause = () => {
            if (selectedDevice.value) {
                // 实现暂停逻辑
                console.log('Pausing media')
            }
        }

        const stop = () => {
            if (selectedDevice.value) {
                // 实现停止逻辑
                console.log('Stopping media')
            }
        }

        const setVolume = () => {
            if (selectedDevice.value) {
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
            // if (ssdpClient) {
            //     ssdpClient.stop()
            // }
        })

        return {
            devices,
            selectedDevice,
            currentMedia,
            volume,
            onDeviceSelect,
            play,
            pause,
            stop,
            setVolume
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

input[type="range"] {
    width: 200px;
}
</style>