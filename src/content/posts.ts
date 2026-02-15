import type { BlogPost } from '@/types/blog'

export const blogPosts: BlogPost[] = [
  {
    id: 'vite-build-performance',
    title: 'Vite 构建提速: 从 42s 到 9s 的拆解记录',
    summary:
      '把依赖预构建、路由分包、图片策略和产物分析串成一条流水线，快速定位前端构建中的真正瓶颈。',
    lead:
      '构建慢并不是单点问题，而是依赖、代码组织、资源策略叠加后的系统性结果。先量化再优化，才能稳定复现收益。',
    tags: ['Vite', 'Performance', 'Build', 'DX'],
    category: '工程效能',
    highlight: 'Hot',
    views: 3678,
    comments: 52,
    noticeTitle: '构建优化快照',
    noticeLines: ['构建时间下降 78%', '按路由分包后首屏体积下降 34%'],
    quote: 'console.log("欢迎体验")',
    publishedAt: '2026-01-22',
    readingMinutes: 8,
    contentSections: [
      {
        id: 'build-baseline',
        title: '先做基线，避免“感觉快了”',
        paragraphs: [
          '优化前先收集可对比指标：冷启动构建时间、热更新响应、产物体积、最大路由包体。没有基线，优化结果无法复盘。',
          '我把每次构建日志写入同一份记录，按日期对比，先锁定占比最大的阶段，再开始逐段削减。',
        ],
        highlights: ['记录冷启动 / 增量构建双指标', '构建日志入库，避免口头结论'],
      },
      {
        id: 'build-chunking',
        title: '分包策略要围绕“访问路径”',
        paragraphs: [
          '原先把所有业务组件打进一个入口包，导致首页首屏加载了大量不会立刻使用的逻辑。改成路由级分包后，首屏明显变轻。',
          '公共依赖只抽真正高复用且稳定的库，避免过度切分造成请求碎片化。',
        ],
        snippet: {
          language: 'ts',
          code: "manualChunks(id) {\n  if (id.includes('node_modules')) return 'vendor'\n  if (id.includes('/views/')) return 'route'\n}",
        },
      },
      {
        id: 'build-assets',
        title: '资源策略决定了上线后的体感',
        paragraphs: [
          '图片按场景分层：首屏关键图保真，其余延迟加载并限制尺寸。配合长期缓存策略，首访和回访都能受益。',
          '构建提速不是一次性动作，要把分析脚本和阈值校验放进 CI，避免后续迭代把收益吃回去。',
        ],
        highlights: ['首屏资源优先级排序', '包体阈值超限自动告警'],
        images: [
          {
            src: '/media/build-dashboard.svg',
            alt: '构建链路仪表盘示意图',
            caption: '构建耗时、包体和缓存命中率统一在同一看板追踪。',
          },
        ],
      },
    ],
  },
  {
    id: 'vue-component-boundary',
    title: 'Vue 组件边界: 让重构不再是一场赌博',
    summary:
      '用容器组件与展示组件分层、事件语义规范和 props 类型约束，把复杂页面的改动风险降到可控范围。',
    lead:
      '组件边界不是文件切割，而是职责建模。边界清晰后，重构影响面可预测，测试也更容易补齐。',
    tags: ['Vue', 'Architecture', 'TypeScript', 'Refactor'],
    category: '架构设计',
    views: 3286,
    comments: 39,
    publishedAt: '2026-01-15',
    readingMinutes: 7,
    contentSections: [
      {
        id: 'boundary-layer',
        title: '容器层与展示层分离',
        paragraphs: [
          '容器组件负责请求、聚合状态和副作用，展示组件只接收纯数据与回调。这样做后，UI 重构不会牵动业务流程。',
          '当页面变复杂时，先画数据流图再拆组件，优先沿数据边界切分而不是沿视觉块切分。',
        ],
        highlights: ['容器层禁止写样式细节', '展示层禁止发请求'],
      },
      {
        id: 'boundary-events',
        title: '事件语义统一，避免“万能回调”',
        paragraphs: [
          '我把事件命名统一为动作语义，比如 openDetail、submitDraft，而不是 clickItem 这类 UI 语义。',
          '语义稳定后，交互形态变化不会影响上层订阅逻辑，重构成本明显降低。',
        ],
      },
      {
        id: 'boundary-types',
        title: '类型约束是边界的守门员',
        paragraphs: [
          '在 props 和 emits 上加明确类型，让组件在编译期就暴露边界破坏。',
          '配合最小可用单测，能快速验证“替换组件实现但不改接口”是否成立。',
        ],
        snippet: {
          language: 'ts',
          code: "defineEmits<{\n  openDetail: [id: string]\n  submitDraft: [payload: DraftPayload]\n}>()",
        },
      },
    ],
  },
  {
    id: 'pinia-single-store',
    title: '单模块 Pinia: 小团队最实用的状态管理解法',
    summary:
      '当业务规模可控时，用一个 store 集中管理筛选、排序与统计，避免过早模块化带来的心智负担。',
    lead:
      '小团队最怕“结构先行”。单模块 store 的重点不是偷懒，而是把状态、衍生数据和动作放在一处，降低协作摩擦。',
    tags: ['Pinia', 'State', 'Best Practice', 'Team'],
    category: '状态管理',
    highlight: 'Editor Choice',
    views: 3565,
    comments: 43,
    noticeTitle: '流水线功能',
    noticeLines: ['支持在发布后追加固定内容', '支持按事件注入扩展逻辑'],
    quote: 'Powered By VanBlog',
    publishedAt: '2025-12-28',
    readingMinutes: 6,
    contentSections: [
      {
        id: 'single-source',
        title: '把状态源固定在一个入口',
        paragraphs: [
          '搜索词、标签筛选、分页信息本质上都在描述“当前列表视图”，因此统一进一个 store 更容易维护。',
          '页面只消费 getter 和 action，不直接改局部状态，能显著减少状态漂移。',
        ],
        highlights: ['单一状态来源', '页面组件保持无状态倾向'],
      },
      {
        id: 'single-derived',
        title: '衍生数据集中计算',
        paragraphs: [
          '标签频率、分类统计、时间线数据都属于可计算结果，不应重复落到多个组件中手写。',
          '把这些逻辑放在 computed 中，既提升复用，也便于后续加缓存策略。',
        ],
      },
      {
        id: 'single-action',
        title: '动作要短小、确定、可组合',
        paragraphs: [
          'setKeyword、setActiveTag、setPage 这类 action 保持单职责，调用者能够自由组合而不会引入副作用黑盒。',
          '当业务复杂度继续增加，再考虑按领域拆分 store，而不是提前模块化。',
        ],
      },
    ],
  },
  {
    id: 'css-system-design',
    title: '可扩展 CSS 体系: Token + Base + Feature 三段式',
    summary:
      '采用设计变量、基础层、功能层三段式组织方式，让样式在迭代中保持复用性、扩展性和可维护性。',
    lead:
      'CSS 可维护性取决于分层策略。把“变量、基础规则、页面特性”解耦后，视觉升级不会演变成全局样式事故。',
    tags: ['CSS', 'Design System', 'Scalability', 'Frontend'],
    category: '视觉系统',
    highlight: 'New',
    views: 2740,
    comments: 28,
    publishedAt: '2025-12-14',
    readingMinutes: 9,
    contentSections: [
      {
        id: 'css-token',
        title: 'Token 层只做抽象，不做语义猜测',
        paragraphs: [
          'Token 文件只定义颜色、字号、半径、阴影等设计原子，不掺杂业务语义，确保跨页面复用。',
          '当品牌色升级时，修改 token 即可全局生效，不必大范围搜改。',
        ],
      },
      {
        id: 'css-base',
        title: 'Base 层保持克制',
        paragraphs: [
          'Base 只放重置规则、排版基础、通用交互状态。越少越稳，避免“全局类过载”。',
          '不要把页面特定样式塞到 Base，否则越迭代越难以拆解。',
        ],
        highlights: ['Base 规则可解释', '避免全局样式污染'],
      },
      {
        id: 'css-feature',
        title: 'Feature 层面向页面和组件',
        paragraphs: [
          '每个页面独立样式文件，配合语义化 class 命名，样式边界天然清晰。',
          '新页面上线时只增量添加，不需要修改旧页面样式，即可保证迭代稳定性。',
        ],
        snippet: {
          language: 'css',
          code: '.article-shell {\n  border-radius: var(--radius-xl);\n  background: rgba(255, 255, 255, 0.84);\n}',
        },
      },
    ],
  },
  {
    id: 'animation-without-library',
    title: '不用动画库也能做出灵动前端的 5 个技巧',
    summary:
      '通过关键帧、层级阴影、滚动触发和错峰过渡，在不引入额外依赖的前提下构建更有生命力的界面。',
    lead:
      '灵动感不等于动得多。节奏、层次和反馈时机比复杂曲线更重要，原生 CSS 动画足够完成大部分高级体验。',
    tags: ['CSS', 'Motion', 'UX'],
    category: '交互动效',
    views: 2651,
    comments: 31,
    publishedAt: '2025-11-30',
    readingMinutes: 5,
    contentSections: [
      {
        id: 'motion-priority',
        title: '先确定动效优先级',
        paragraphs: [
          '我把动画分成三层：页面转场、模块入场、控件反馈。每层职责不同，避免所有元素同时争抢注意力。',
          '页面层动效强调方向感，控件层动效强调反馈速度，两者节奏必须区分。',
        ],
        images: [
          {
            src: '/media/motion-grid.svg',
            alt: '动效层级节奏板示意图',
            caption: '将页面、模块、控件三层动效拆分后，更容易控制节奏与优先级。',
          },
        ],
      },
      {
        id: 'motion-stagger',
        title: '错峰入场提升秩序感',
        paragraphs: [
          '同一列表项通过轻微延迟顺序出现，用户会自然形成浏览路径。延迟过大则会拖慢感知速度，需要控制在 40ms 到 120ms 区间。',
          '列表项入场最好同时配合透明度和位移，避免单纯位移造成突兀。',
        ],
      },
      {
        id: 'motion-reduced',
        title: '保留 reduced motion 兜底',
        paragraphs: [
          '在 prefers-reduced-motion 场景下关闭大多数关键帧，保留必要的状态变化，兼顾可访问性和审美一致性。',
          '动效系统必须可降级，否则在低性能设备上会反向伤害体验。',
        ],
        highlights: ['动效时长控制在 200ms - 500ms', '必须提供无动画回退'],
      },
    ],
  },
  {
    id: 'content-driven-ui',
    title: '内容驱动 UI: 前端如何为写作体验服务',
    summary:
      '将内容模型作为 UI 设计输入，通过字段抽象和语义结构提升可读性、检索效率与信息密度。',
    lead:
      '内容型产品最常见的问题是“先做 UI 再塞内容”。倒过来思考，把内容结构先定义清楚，界面才会稳定且可扩展。',
    tags: ['Content', 'UI', 'Information'],
    category: '内容策略',
    views: 2410,
    comments: 24,
    publishedAt: '2025-11-18',
    readingMinutes: 6,
    contentSections: [
      {
        id: 'content-model',
        title: '字段模型先于组件模型',
        paragraphs: [
          '先定义标题、摘要、段落、引用、标签等内容实体，再设计组件树，能避免“组件绑死内容”的后期返工。',
          '结构化内容还可以直接服务搜索、推荐、摘要生成等能力。',
        ],
      },
      {
        id: 'content-density',
        title: '信息密度和呼吸感并存',
        paragraphs: [
          '文章页不应该只有纯文本堆叠。通过段间节奏、重点块、代码片段和元信息分区，让阅读路径更自然。',
          '密度高不代表压迫感强，关键是分层展示和视觉停顿点。',
        ],
        highlights: ['摘要先行，正文分段', '元信息集中在可扫读区域'],
        images: [
          {
            src: '/media/content-map.svg',
            alt: '内容结构流转图示意',
            caption: '先设计内容结构，再映射组件层，能显著降低后续改版成本。',
          },
        ],
      },
      {
        id: 'content-evolve',
        title: '内容结构要支持迭代',
        paragraphs: [
          '当后续新增“系列文章”“更新日志”“关联阅读”时，已有内容模型应该可平滑扩展，而不是重写页面。',
          '前端越早和内容建模协同，后续功能迭代成本越低。',
        ],
      },
    ],
  },
]
