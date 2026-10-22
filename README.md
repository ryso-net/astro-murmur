# Murmur

Murmur 是一个以文字为主的 Astro 7 博客模板。页面、组件、样式、脚本、内容配置和站点集成都直接保存在本仓库中；创建博客时会复制一份完整源码到新项目，之后由博客仓库自行维护主题与内容。

## 开始使用

```sh
npm create astro@latest -- --template ryso-blog/astro-murmur
cd <your-project>
npm install
npm run dev
```

在 GitHub 仓库的 **Settings → General → Template repository** 中启用模板选项后，访问者也可以通过 “Use this template” 创建自己的副本。

已有 Astro 项目也可以把本模板的 `src/`、`astro.config.ts`、`murmur.config.ts`、`tsconfig.json` 和 `scripts/` 合并到项目中，再按本文配置站点。模板创建的是独立副本；模板仓库后续的更新不会自动覆盖你的博客。

## 本地开发

克隆本仓库后，在根目录运行 `npm install`，然后使用 `npm run dev` 启动站点。`npm run build` 会构建静态页面并生成 Pagefind 索引；也可运行 `npm run check` 检查 Astro 与 TypeScript 项目，运行 `npm run size` 查看 CSS gzip 体积。

构建后运行 `npm run size` 查看主题 CSS 的 gzip 体积；命令会汇总本地 CSS 文件和去重后的内联样式，排除 Pagefind 自带的可选 UI 样式，不包含外部 Artalk 资源。

搜索由 Pagefind 在静态构建后生成索引；运行 `npm run build` 会自动完成索引，之后通过 `npm run preview` 预览。点击页头搜索按钮可打开搜索窗口，输入关键词会实时显示结果。开发服务器没有生成索引，搜索需在构建后使用。

## 配置

在博客根目录的 `murmur.config.ts` 中，`title` 设置网站名称（也显示在页头导航栏前），`description` 设置全站默认描述；`description` 留空时沿用当前界面语言的默认文案。`author` 是默认作者，会显示在文章信息中，也可在单篇文章的 frontmatter 中用 `author` 覆盖。

```ts
title: "我的博客",
description: "记录技术、阅读和日常。",
author: "作者名称",
```

站点配置集中在博客根目录的 `murmur.config.ts`：站点标题、作者、部署地址、子路径、构建语言、导航和普通页面路由都从这里调整。`i18n.locale` 决定本次构建使用的界面语言；一次构建只输出一套无语言前缀的路由。例如将它改为 `en` 后重新构建，站点仍使用 `/about/` 等根路由，界面使用英文，并优先显示英文内容译文。`i18n.fallbackLocale` 标记内容根目录的语言，也是缺少译文时的回退语言。支持的语言由 `navigation` 的语言键推导；界面词条按语言分开放在 `src/i18n/locales/`，新增语言时添加导航映射并在 `src/i18n/ui.ts` 注册词条文件。部署前填写 `siteUrl`；发布在项目子路径时，把 `basePath` 改成对应路径，例如 `/murmur/`。

导航项和显示顺序在 `murmur.config.ts` 的 `navigation` 中按语言配置为“名称: 路由”映射。对象键是导航显示名称，值是相对该语言的站内路由；调整对象顺序即可调整导航顺序。默认导航包含首页和归档；搜索由页头按钮打开，不占导航路由。默认导航不包含标签页。例如：

```ts
const navigation = {
  "zh-CN": { "归档": "archive", "关于": "about" },
  en: { Archive: "archive", About: "about" },
};
```

要在导航显示标签页，可在对应语言映射中加入 `"标签": "tags"`（英文可写为 `Tags: "tags"`）。

首页、关于等普通页面使用同一套 Markdown 页面模板，路由在 `murmur.config.ts` 的 `pages` 中配置。默认语言（当前为简体中文）的内容直接放在 `src/content/pages/`；可选译文放进语言子目录，例如英文内容放在 `src/content/pages/en/`。文件名对应 `pages` 中的页面 ID，语言和页面 ID 都从路径推导，不需要在 frontmatter 重复填写。例如添加联系页时，在 `pages` 中加入 `contact: "contact"`，创建 `src/content/pages/contact.md`，只需填写 `title`；以后提供英文译文时，再创建 `src/content/pages/en/contact.md`。构建所选语言没有译文时会显示默认语言内容，并标出正文语言及回退提示。`home` 的路由必须为空字符串；`archive`、`posts`、`tags` 和 `404` 属于保留路由；配置 `siteUrl` 后也会保留 `rss.xml`、`atom.xml` 和 `sitemap.xml`。

资源路径 `robots.txt`、`pagefind` 和 `_astro` 也不可用作普通页面路由；路由中不允许查询参数、片段、编码转义、反斜杠、空白或 `.` / `..` 路径段。

文章放在 `src/content/posts/`，支持 `.md` 和 `.mdx`。默认语言文章直接放在该目录，其他语言文章放进对应语言子目录，例如 `src/content/posts/en/`。文章 URL 以 `/posts/` 为前缀，文件名决定 slug；不同语言的译文使用相同文件名。最少只需填写 `title` 和 `pubDate`；`description`、`tags`、`updatedDate` 可选，`draft` 默认为 `false`。

```md
---
title: "一篇文章"
pubDate: 2026-10-19
---

从正文开始写作。
```

文章可在 frontmatter 的 `tags` 列表中添加标签。文章页标签可点击；归档页会列出标签并链接到对应文章归档，也可按需把标签页加入导航。

标签页可以像 [Cactus](https://github.com/chrismwilliams/astro-theme-cactus#adding-posts-notes-and-tags) 一样为单个标签设置标题和描述。在 `src/content/tags/` 下创建与标签页 URL 末段同名的 Markdown 文件；例如标签页 `/tags/土豆/` 对应 `src/content/tags/土豆.md`：

```md
---
title: "土豆"
description: "关于土豆主题文章的简短介绍。"
---
```

`title` 和 `description` 都可省略；描述会显示在标签标题下方，并作为该页的 meta description。没有对应文件时，标签页仍使用默认标题和文章列表。

MDX 文章可以导入 Astro 组件。例如主题自带的 `Callout.astro` 输出静态 HTML，不需要客户端脚本：

```mdx
import Callout from "@/components/Callout.astro";

<Callout>需要强调的说明。</Callout>
```

Markdown 和 MDX 正文的各级标题自动带有 `#` 锚点链接，可点击定位，也可通过浏览器复制链接地址。链接沿用 Astro 生成的标题 ID，由默认 Sätteri 处理器在构建时输出，不需要客户端脚本。

文章目录只列出二级标题；桌面端显示在右侧，移动端通过原生 `popover` 面板展开，支持点击外部、拖动和 Escape 关闭。移动导航同样使用原生 `popover`，搜索使用 `dialog`，遮罩统一由 `::backdrop` 绘制；不支持 Popover API 的浏览器直接显示导航与目录。脚本增强当前章节提示。代码复制按钮仅在浏览器支持 Clipboard API 时显示；不支持时仍可手动选中复制。主题切换和页面布局过渡同样属于可选增强，并尊重系统的减少动态效果设置。

## 订阅、索引与分享

填写 `murmur.config.ts` 中的 `siteUrl` 后，静态构建会生成 `/rss.xml`、`/atom.xml` 和 `/sitemap.xml`，并在页面头部声明 Feed 与 Sitemap；`/robots.txt` 始终生成，配置域名后会包含 Sitemap 地址。RSS 和 Atom 收录所有已发布文章，包含标题、摘要、日期、标签和链接；草稿不会进入 Feed 或 Sitemap。未设置 `siteUrl` 时不会生成 RSS/Atom/Sitemap，因为这些文件需要站点绝对地址。

分享卡片可在配置中用 `socialImage` 指定全站默认图片（绝对 HTTP(S) URL 或 `public/` 下的路径），单篇文章可以用相对路径覆盖，例如：

```md
---
title: "一篇文章"
pubDate: 2026-10-19
socialImage: ./assets/images/share-cover.jpg
socialImageAlt: "文章分享图的替代文本"
---
```

文章分享图会在构建时输出为 1200 × 630 JPEG，并用于 Open Graph 和 Twitter 大图卡片。设置全站 `socialImage` 时，它也用于没有单篇图片的页面。

正文图片使用 Markdown `![替代文本](./assets/images/photo.jpg)` 语法，并将源文件放在 `src/content/posts/` 下。构建会输出优化后的 WebP、尺寸属性和响应式 `srcset`，并使用 Astro 的响应式图片样式；放在 `public/` 的图片或手写 `<img>` 不会进入这条处理流程。

## Artalk 评论

在根目录 `murmur.config.ts` 的 `artalk.server` 中填写 Artalk 服务端地址，`artalk.site` 必须与 Artalk 后台的站点名称一致。地址留空时不显示评论区，也不加载第三方资源。用户首次滚动后开始预热 Artalk 客户端与样式；评论区距离视口约 1000px 时初始化，待资源就绪后显示。`pageKey` 沿用文章路径，`pageTitle` 使用文章标题，`locale` 默认跟随构建语言；未设置 `options.darkMode` 时跟随 Murmur 的主题切换。

```ts
artalk: {
  server: "https://your-artalk-server.example",
  site: "My Blog",
  options: {},
},
```

`options` 对应 [Artalk 客户端配置](https://artalk.js.org/guide/frontend/config.html)。分页和验证码等设置可在 Artalk 服务端管理。服务端需创建同名站点，并将博客域名配置为可信来源。

## 目录

站点配置、内容和主题实现都由博客仓库维护：

```text
your-blog/
├── murmur.config.ts
├── astro.config.ts
└── src/
    ├── components/
    ├── layouts/
    ├── pages/
    ├── scripts/
    ├── styles/
    ├── i18n/
    ├── utils/
    ├── assets/
    ├── content.config.ts
    └── content/
        ├── pages/
        ├── posts/
        └── tags/
```

## 自定义页面中的近期文章

需要在首页或任意自定义页面插入近期文章时，将页面保存为 `.mdx`，并在希望显示的位置导入组件：

```mdx
import RecentPosts from "@/components/RecentPosts.astro";

<RecentPosts />
```

组件使用构建语言的界面词条，显示所有已发布文章：优先选择构建语言的译文，其次为回退语言，最后为其他可用语言，并标注回退内容。页面内容按 MDX 中的顺序渲染。普通 `.md` 页面仍支持基础 Markdown。

## 布局与动效

桌面端侧栏从页面标题区域之后开始：文章目录对齐正文起点，归档标签对齐最新年份标题。对齐由网格布局决定，标题、描述或元数据换行时会自动跟随，滚动后仍保留吸顶效果。

描述建议用一句短句概括。列表描述和桌面页头描述以一行显示，超长时省略，悬浮可查看完整文案；手机页头允许自然换行。单栏进入双栏时，标题、描述与元数据、主栏内容、侧栏条目分层出现；系统开启减少动态效果时关闭这些动画。

## 体积目标

语义 HTML 的基础排版和主题样式都由 `src/styles/global.css` 提供，使用系统字体，不加载外部字体或 CSS 框架。布局通过 Astro 的全局样式块引入共享 CSS，由 Astro 按默认策略决定是否内联；当前生产构建输出为可跨页缓存的外部 CSS 文件。主题偏好由 `<head>` 中的最小同步脚本在样式加载前恢复。Astro 客户端路由增强站内切页，关闭 JavaScript 时仍由普通链接导航，阅读和主题跟随系统照常工作。主题 CSS 上限为 **7 KiB gzip**，优先使用 Astro 原生能力，允许为此保留适量 CSS；其余样式仍在保证行为和可读性的前提下继续精简，不能用压缩前文件大小判断，以 `npm run size` 的实际输出为准。启用 Artalk 后另有第三方 CSS 和脚本开销，不计入主题本身的体积。新增交互时优先使用原生 HTML；确有需要时再添加小型、可选脚本。

只有首屏主题恢复使用同步内联脚本。客户端路由模块判断布局变化：单栏转双栏播放标题、主栏和侧栏的专属错峰动画，其他切页按页头、主栏、侧栏顺序淡入；动画由 CSS 根据少量语义标记处理，不需要遍历或清理 DOM。布局判断与页头交互由 Astro 打包为带内容哈希的共享模块，在头部提前下载、文档解析完成后执行。客户端路由切页后由 `astro:page-load` 生命周期重新绑定当前页面的交互。搜索界面脚本和样式在页面空闲时预热，Pagefind 核心和索引在搜索框聚焦后加载。构建还会生成适用于 Cloudflare Workers 静态资源和 Pages 的 `_headers` 文件，对当前 `basePath` 下的 `_astro/` 资源设置一年期 `immutable` 缓存；HTML 和使用固定文件名的 Pagefind 资源不套用这项长期缓存。其他托管平台需配置等效响应头。

CSS、JavaScript 和导入的图片使用哈希文件名，不包含源文件或组件名称；优化后的图片可能包含源文件哈希和变换哈希。favicon 位于 `src/assets/`，同样交由构建工具处理。新增需要隐藏原名的资源应放入 `src/` 并导入；`public/` 按 Astro 约定原样复制。Pagefind 自行管理的入口和索引文件名、页面路由、订阅与站点地图等公开地址保持各自的标准格式。文件名哈希用于命名和缓存，不隐藏可下载的资源内容。

直接打开页面和 Astro 客户端路由切页时，页头、主栏内容和侧栏依次上滑渐入；桌面端从单栏切换到双栏时播放标题位移及专属错峰动画。刷新首屏保持静止，反向切回单栏使用普通顺序上滑渐入。系统开启减少动态效果时关闭动画。

普通内容页和已发布文章均进入 Pagefind 索引，归档、标签目录和 404 不重复收录。搜索与评论需要 JavaScript；网络加载失败时显示当前语言的提示，主要导航和文章正文仍可用。

代码复制、目录等增强脚本统一输出为带哈希的外部文件，避免被 Astro 自动内联后重复传输。搜索界面脚本与样式在页面空闲时预热，Pagefind 核心和索引在搜索框聚焦后加载；Artalk 的第三方脚本和样式在首次滚动后预热，并在评论区距离视口约 1000px 时初始化。不支持 IntersectionObserver 时立即加载。
