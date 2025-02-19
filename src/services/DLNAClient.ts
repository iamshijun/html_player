import { IAVTransportService, PositionInfo, MediaMetadata, TransportInfo, MediaInfo, IRenderingControlService } from '@/types/upnp';
import axios, { AxiosInstance } from 'axios';  

interface UpnpService {
    serviceType: string
    serviceId: string
    controlURL: string
    eventSubURL: string
    SCPDURL: string
}

const soapBodyTmpl = `
    <?xml version="1.0" encoding="utf-8"?>
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" 
        s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
        <s:Body>
            <u:%ACTION% xmlns:u="%ST%">
                <InstanceID>0</InstanceID>
                %PARAMS%
            </u:%ACTION%>
        </s:Body>
    </s:Envelope>
    `
function getSoapBody(
    st: string,
    action: string, 
    params?: Record<string, string>
) {
    let paramsXml = '';
    if (params) {
        paramsXml = Object.entries(params)
           .map(([key, value]) => `\n            <${key}>${value}</${key}>`)
           .join('');
    }
    return soapBodyTmpl
        .replace(/%ST%/g, st)
        .replace(/%ACTION%/g, action)
        .replace(/%PARAMS%/g, paramsXml);
}

//deprecated
export class DLNAClient {
    private device: AxiosInstance;
    private baseURL: string;
    private serviceList: UpnpService[] = []
    constructor(private proxyURL:string,descritpionUrl: string) { 
        this.device = axios.create({
            baseURL: proxyURL + "?url=" + descritpionUrl
        })
        this.baseURL = new URL(descritpionUrl).origin + "/"
    } 
    async connect () {
        return true
    }
    disconnect() {
        return true
    }
    public async initDeviceInfo() {
        const res = await this.device.get('')
        const xml = res.data
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const serviceList = xmlDoc.getElementsByTagName('serviceList')[0];
        const services = serviceList.getElementsByTagName("service")
        for(const service of services) {
           
            const serviceType = service.getElementsByTagName('serviceType')[0].textContent!;
            const serviceId = service.getElementsByTagName('serviceId')[0].textContent!;
            const SCPDURL = service.getElementsByTagName('SCPDURL')[0].textContent!;
            
            const controlURL = service.getElementsByTagName('controlURL')[0].textContent?.replace(/^\//, '') ?? ""
            const eventSubURL = service.getElementsByTagName('eventSubURL')[0].textContent?.replace(/^\//, '') ?? ""
            
            this.serviceList.push({
                serviceType,
                serviceId,
                controlURL,
                eventSubURL,
                SCPDURL
            })
        }  
    }

    public getRenderingControlService() {
        const service = this.serviceList.find((service) => {
            return service.serviceType.includes('RenderingControl')
        })
        if(service == undefined) {
            throw Error("RenderingControl service not found")
        }
        return new RenderingControl(
            this.proxyURL,
            this.baseURL + service.controlURL
        )
    }
    public getAVTransportService() {

        const service = this.serviceList.find((service) => {
            return service.serviceType.includes('AVTransport')
        })
        if(service == undefined) {
            throw Error("AVTransport service not found")
        }
        return new AVTransportService(
            this.proxyURL,
             this.baseURL + service.controlURL,
             this.baseURL + service.eventSubURL )
    }


    subscribePlaybackState(_callback: (data: any) => void): void {
        //throw Error("Not supported")
    }
}

export class RenderingControl implements IRenderingControlService {
    private renderingApi: AxiosInstance;
    private st : string = 'urn:schemas-upnp-org:service:RenderingControl:1'
    constructor(proxyURL:string,public controlURL: string) {
        this.renderingApi = axios.create({
            baseURL: proxyURL + "?url=" + controlURL
        })
    }
    async isMute(): Promise<boolean> {
        const response = await this.sendCommand('GetMute');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response, "text/xml");
        const responseNode = xmlDoc.getElementsByTagName('u:GetMuteResponse')[0];
        if (!responseNode) {
            console.warn('Invalid GetMute response')
            return false;
        }
        const currentMute = responseNode.getElementsByTagName('CurrentMute')[0].textContent;
        return currentMute === '1';
    }
    setMute(mute: boolean): Promise<any> {
        return this.sendCommand('SetMute', {
            Channel: 'Master',
            DesiredMute: mute ? '1' : '0'
        });
    }
    async setVolume(volume: number) {
        return this.sendCommand('SetVolume', {
            Channel: 'Master',
            DesiredVolume: volume.toString()
        });
    }
    async getVolume() {
        const response = await this.sendCommand('GetVolume');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response, "text/xml");
        const responseNode = xmlDoc.getElementsByTagName('u:GetVolumeResponse')[0];
        if(!responseNode){
            console.warn('Invalid GetVolume response')
            return 50;
        }
        const currentVolume = responseNode.getElementsByTagName('CurrentVolume')[0].textContent;
        console.log(currentVolume) 
        return Number(currentVolume)
    }

    async sendCommand(action: string, params?: Record<string, string>) {
        const soapBody = getSoapBody(this.st, action, params);
        return this.renderingApi.post('', soapBody, {
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': `"${this.st}#${action}"`
            }
        }).then(response => response.data);
    }
}

export class AVTransportService implements IAVTransportService {  
    private transportApi: AxiosInstance;
    private st : string = 'urn:schemas-upnp-org:service:AVTransport:1'

    constructor(proxyURL:string,public controlURL: string,public eventURL:string) { 
        this.transportApi = axios.create({
            baseURL: proxyURL + "?url=" + controlURL
        })
    }

   
    async sendCommand(action: string, params?: Record<string, string>) {
        const soapBody = getSoapBody(this.st, action, params);
        return this.transportApi.post('', soapBody, {
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': `"${this.st}#${action}"`
            }
        }).then(response => response.data);
    }

    async play() {
        return this.sendCommand('Play', { Speed: '1' });
    }

    async pause() {
        return this.sendCommand('Pause');
    }

    async stop() {
        return this.sendCommand('Stop');
    }

    async seek(position: string) {
        return this.sendCommand('Seek', {
            Unit: 'REL_TIME',
            Target: position
        });
    }

    async setAVTransportURI(uri: string) {
        return this.sendCommand('SetAVTransportURI', {
            CurrentURI: uri,
            CurrentURIMetaData: ''
        });
    }

    async getTransportInfo() {
        const response = await this.sendCommand('GetTransportInfo');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response, "text/xml");
        const responseNode = xmlDoc.getElementsByTagName('u:GetTransportInfoResponse')[0];
        if (!responseNode) {
            throw new Error('Invalid GetTransportInfo response');
        }
 
        return {
            currentSpeed: Number(this.getNodeText(responseNode, 'CurrentSpeed') ?? "1"),
            currentTransportState: this.getNodeText(responseNode, 'CurrentTransportState') ?? "STOPPED",
            currentTransportStatus: this.getNodeText(responseNode, 'CurrentTransportStatus') ?? "OK"
        } satisfies TransportInfo
    }

    async getMediaInfo() {
        const response = await this.sendCommand('GetMediaInfo');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response, "text/xml");
        const responseNode = xmlDoc.getElementsByTagName('u:GetMediaInfoResponse')[0];
        if (!responseNode) {
            throw new Error('Invalid GetMediaInfo response');
        }
        return {
            currentURI : this.getNodeText(responseNode, 'CurrentURI') ?? '',
            currentURIMetaData: this.parseMetadata(this.getNodeText(responseNode, 'CurrentURIMetaData')),
            nextURI : this.getNodeText(responseNode, 'NextURI') ?? '',
            nextURIMetaData: this.parseMetadata(this.getNodeText(responseNode, 'NextURIMetaData')),
            playMedium: this.getNodeText(responseNode, 'PlayMedium')?? '',
        } satisfies MediaInfo
    }


    async getPositionInfo(): Promise<PositionInfo> {
        const response = await this.sendCommand('GetPositionInfo');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response, "text/xml");
        
        // 获取 GetPositionInfoResponse 节点下的所有数据
        const responseNode = xmlDoc.getElementsByTagName('u:GetPositionInfoResponse')[0];
        if (!responseNode) {
            throw new Error('Invalid GetPositionInfo response');
        }
        const metadataXml = this.getNodeText(responseNode, 'TrackMetaData')

        return {
            track: Number(this.getNodeText(responseNode, 'Track')),
            trackDuration: this.getNodeText(responseNode, 'TrackDuration') ?? "00:00",
            trackMetaData: this.parseMetadata(metadataXml),
            trackURI: this.getNodeText(responseNode, 'TrackURI') ?? '',
            relTime: this.getNodeText(responseNode, 'RelTime') ?? '',
            absTime: this.getNodeText(responseNode, 'AbsTime') ?? '',
            relCount: Number(this.getNodeText(responseNode, 'RelCount')),
            absCount: Number(this.getNodeText(responseNode, 'AbsCount'))
        };
    }

    private parseMetadata(metadataXml: string|null): MediaMetadata|null {
        if (!metadataXml || metadataXml === '') {
            return null;
        }
        try {
            const metadataParser = new DOMParser();
            const metadataDoc = metadataParser.parseFromString(metadataXml, "text/xml");
            
            // 获取 item 节点
            const item = metadataDoc.querySelector('item');
            if (!item) {
                return null;
            }
            // 使用命名空间获取元数据
            const upnp = 'urn:schemas-upnp-org:metadata-1-0/upnp/';
            const dc = 'http://purl.org/dc/elements/1.1/';
            //const didl = 'urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/';

            const metadata: MediaMetadata = {
                item : {
                    res: {
                        protocolInfo: '',
                        value : ''
                    },
                    title: ''
                }
            };
            metadata.item.title = this.getNodeText(item, 'dc:title',dc) || 
                                this.getNodeText(item, 'upnp:title',upnp) || 
                                'Unknown Title'
            // 获取可选字段
            const artist = this.getNodeText(item, 'upnp:artist',upnp) || 
                          this.getNodeText(item, 'dc:creator',dc);
            metadata.item.artist = artist;

            const album = this.getNodeText(item, 'upnp:album',upnp);
            metadata.item.album = album;

            const genre = this.getNodeText(item, 'upnp:genre',upnp);
            metadata.item.genre = genre;

            const duration = this.getNodeText(item, 'upnp:duration',upnp);
            metadata.item.duration = duration;

            const albumArtURI = this.getNodeText(item, 'upnp:albumArtURI',upnp);
            metadata.item.albumArtURI = albumArtURI;

            const size = this.getNodeText(item, 'size');
            if (size) metadata.item.size = parseInt(size, 10);

            const resolution = this.getNodeText(item, 'upnp:resolution');
            metadata.item.resolution = resolution;

            const res = item.querySelector('res');
            if (res) {  
                 metadata.item.res!.protocolInfo = res.getAttribute('protocolInfo') ?? '';
                 metadata.item.res!.value = res.getAttribute('value') ?? '';
            }
            return metadata;
        } catch (error) {
            console.error('Error parsing metadata:', error);
            return null;
        }
    }

    private getNodeText(parent: Element, tagName: string , namespaceURI?:string): string | null {
        // 处理带命名空间的标签
        const nameParts = tagName.split(':');
        let element: Element | null;
        
        // if (nameParts.length > 1) {
        //     element = parent.querySelector(`*[\\:${nameParts[1]}]`);
        // } else {
        //     element = parent.querySelector(tagName);
        // }
         if (nameParts.length > 1 && namespaceURI) {
            element = parent.getElementsByTagNameNS(namespaceURI, tagName)[0];
        } else {
            element = parent.getElementsByTagName(tagName)[0];
        }
        return element?.textContent || null;
    }

    // async getAVTransportInfo() {
    //     const response =  await this.getTransportInfo()
    //     console.log(response)
    //     //  await this.getPositionInfo()
    //     //  await this.getMediaInfo()
    // }

}