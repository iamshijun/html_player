
function getMimeTypeFromUrl(url:string) {
    const extension = url.split('.').pop()?.toLowerCase()
    switch (extension) {
        case 'mp4': return 'video/mp4'
        case 'webm': return 'video/webm'
        case 'ogg': return 'video/ogg'
        case 'mp3': return 'audio/mpeg'
        case 'wav': return 'audio/wav'
        case 'flv': return 'video/x-flv'
        case 'm3u8': return 'application/vnd.apple.mpegurl'  
        default: return ''
    }
}


 export async function checkMediaType(url:string){ //for dplayer
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
        }else if(contentType == 'application/vnd.apple.mpegurl' 
              || contentType == 'application/x-mpegURL'){
            return "hls"
        }
    } catch (error) {
        console.error('请求失败:', error);
    }
    return "stream"
}