import { createRouter, createWebHashHistory } from 'vue-router'
import HtmlVideoPlayer from '../components/HtmlVideoPlayer.vue'
import DLNAPlayer from '../components/DLNAPlayer.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'html',
      component: HtmlVideoPlayer
    },
    {
      path: '/dlna',
      name: 'dlna',
      component: DLNAPlayer,
      props: {
        local: false
      }
    }
  ]
})

export default router