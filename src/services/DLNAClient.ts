import axios, { AxiosInstance } from 'axios';  

//deprecated
export class DLNAClient {
    private device: AxiosInstance;
    private baseURL: string;
    constructor(descritpionUrl: string) { 
        this.device = axios.create({
            baseURL: descritpionUrl
        })
        this.baseURL = new URL(descritpionUrl).origin + "/"
    } 
    public async getAVTransportService() {
        const res = await this.device.get('')
        const xml = res.data
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const serviceList = xmlDoc.getElementsByTagName('serviceList');
        let service ;
        for(var i = 0; i < serviceList.length; i++) {
            const serviceType = serviceList[i].getElementsByTagName('serviceType')[0].textContent;
            if (serviceType?.includes('AVTransport')) {
                service = serviceList[i].getElementsByTagName('service')[0];
                break;
            }
        } 
        if(service == undefined) {
            throw Error("AVTransport service not found")
        }
        const controlURL = service.getElementsByTagName('controlURL')[0].textContent?.replace(/^\//, '')
        const eventSubURL = service.getElementsByTagName('eventSubURL')[0].textContent?.replace(/^\//, '')
        return new AVTransportService(this.baseURL + controlURL!,this.baseURL + eventSubURL!)
    }
}

export class AVTransportService {  
    private transportApi: AxiosInstance;
    private soapBodyTmpl = `
    <?xml version="1.0" encoding="utf-8"?>
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" 
        s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
        <s:Body>
            <u:%ACTION% xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
                <InstanceID>0</InstanceID>
                %PARAMS%
            </u:%ACTION%>
        </s:Body>
    </s:Envelope>
    `

    constructor(controlURL: string, _eventSubURL: string) { 
        this.transportApi = axios.create({
            baseURL: controlURL
        })
    }

    private buildSoapBody(action: string, params?: Record<string, string>) {
        let paramsXml = '';
        if (params) {
            paramsXml = Object.entries(params)
                .map(([key, value]) => `\n            <${key}>${value}</${key}>`)
                .join('');
        }
        return this.soapBodyTmpl
            .replace(/%ACTION%/g, action)
            .replace(/%PARAMS%/g, paramsXml);
    }

    async sendCommand(action: string, params?: Record<string, string>) {
        const soapBody = this.buildSoapBody(action, params);
        return this.transportApi.post('', soapBody, {
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': `"urn:schemas-upnp-org:service:AVTransport:1#${action}"`
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
        return this.sendCommand('GetTransportInfo');
    }

    async getPositionInfo() {
        return this.sendCommand('GetPositionInfo');
    } 

    async getMediaInfo() {
        return this.sendCommand('GetMediaInfo');
    }

    async getAVTransportInfo() {
        const response =  await this.getTransportInfo()
        console.log(response)
        //  await this.getPositionInfo()
        //  await this.getMediaInfo()
    }

    subscribePlaybackState(_callback: (data: any) => void): void {
        throw Error("Not supported")
    }

}