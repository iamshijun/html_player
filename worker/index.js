import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

async function handleRequest(event) {
  try {
    // 尝试从 KV 存储获取静态资源
    return await getAssetFromKV(event, {
      // 如果访问根路径，默认返回 index.html
      mapRequestToAsset: req => {
        let url = new URL(req.url)
        if (url.pathname === '/') {
          return new Request(`${url.origin}/index.html`, req)
        }
        return req
      },
    })
  } catch (e) {
    // 如果资源不存在，返回 404
    return new Response('Not Found', { status: 404 })
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event))
})