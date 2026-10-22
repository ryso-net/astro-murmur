# 页面动画

在现有 HTML 容器上使用 `data-enter` 声明动画阶段，时长、缓动和延迟统一由 `src/styles/motion.css` 管理，不需要为新页面添加 CSS 选择器。

```astro
<PageHeader title={title} description={description} />
<div data-enter="content">
  <!-- 正文或文章列表 -->
</div>
<aside data-enter="sidebar">
  <!-- 可选侧栏 -->
</aside>
```

`PageHeader` 自带页头动画标记。普通 Markdown/MDX 页面的正文也已在共享模板中标记，作者无需逐块设置。

| 标记 | 用途 |
| --- | --- |
| header | 页头，由 PageHeader 自动设置 |
| content | 整块正文、归档列表、标签列表 |
| sidebar | 桌面目录、归档标签侧栏 |
| after | 文章前后篇导航 |
| comments | 评论 |
| sequence | 普通内容页，直接子块按顺序入场 |

同一块内容只标记一层，避免父子区域重复播放动画。移动目录保留自己的打开和拖动效果，不参与页面入场。

动画触发条件保持不变：单列与双列切换，以及首页首次普通导航进入时播放；同布局跳转、刷新、前进后退不额外触发。系统开启“减少动态效果”时关闭正文动画、过渡和平滑滚动。
