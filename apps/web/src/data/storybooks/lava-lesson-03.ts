import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const LAVA_LESSON_03: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "lava-lesson-03",
  "moduleId": "lava-cavern",
  "lessonNumber": 3,
  "stage": "lower_primary",
  "title": "星宝熔岩山 AI 安全小卫士",
  "summary": "星宝学习最小权限和安全规则，遇到危险内容时停止操作并向可信的大人求助。",
  "source": {
    "originalFileName": "熔岩第三绘本(1).docx",
    "documentSha256": "805D1A15E176485D51D83236E5828429A9C98E5FEB55627818A5F17616109B75",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "最小权限",
    "安全规则",
    "危险内容",
    "停止操作",
    "寻求帮助"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "第 1 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-01.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 1 页：第 1 页",
        "width": 1200,
        "height": 900
      },
      "narration": "神秘的熔岩洞穴深处，小精灵星宝怀揣闪闪发光的星星吊坠，开启了探索 AI 秘密的冒险。洞穴里岩浆流淌，前方藏着古老的神秘祭坛，可危险也潜藏在路途之中。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "哇，前面那个古老祭坛，听说可以召唤 AI 工具！我要过去看一看！",
          "stageDirection": "自言自语，好奇托腮",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "第 2 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-02.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 2 页：第 2 页",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝来到了古老的祭坛大厅。这座刻满符文的石台，就是开启 AI 工具的魔法台。但魔法的力量有好有坏，如果不加约束，就会带来麻烦。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "这就是 AI 祭坛！只要启动它，就能调用 AI 的力量，不过，使用它可要小心。",
          "stageDirection": "找到祭坛非常高兴",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "第 3 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-03.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 3 页：第 3 页",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝触碰祭坛，透明的 AI 控制面板凭空浮现。运行、设置的选项全部展现在眼前，马上就要启动 AI 工具了。",
      "dialogue": [
        {
          "id": "p03-starbao-1",
          "speaker": "starbao",
          "text": "马上就要开启 AI 啦！在运行之前，我得想好，要定下什么样的使用规则呢？",
          "stageDirection": "歪头思考",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "第 4 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-04.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 4 页：第 4 页",
        "width": 1200,
        "height": 900
      },
      "narration": "AI 工具发出了权限请求，它想要获取麦克风、定位位置的权限。面对申请，星宝开始认真权衡。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "咦？它想要我的麦克风和位置信息。我现在只是问问题，根本用不到这些，真的要全部允许吗？",
          "stageDirection": "皱起眉头，疑惑",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "第 5 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-05.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 5 页：第 5 页",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝记住了：只开放任务真正需要的权限，无关的权限直接关掉！不需要的功能，绝对不能随便放行。",
      "dialogue": [
        {
          "id": "p05-starbao-1",
          "speaker": "starbao",
          "text": "我现在用不上录音和定位！麦克风、位置，全部关闭！只保留我真正要用的能力。",
          "stageDirection": "坚定地指着弹窗",
          "order": 1,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "使用AI工具时，对于当前任务用不到的麦克风、位置权限，应该怎么做？",
        "options": [
          "全部打开方便使用",
          "不一定，按需开启",
          "关闭不需要的权限"
        ],
        "answer": "关闭不需要的权限",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 6,
      "title": "第 6 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-06.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 6 页：第 6 页",
        "width": 1200,
        "height": 900
      },
      "narration": "如果随便开放多余权限、不设定使用规则，危险就会找上门！一堆报错窗口疯狂涌出，系统出现错乱崩溃。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "不好！没有安全规则约束，AI 就乱套了！到处都是错误警告！",
          "stageDirection": "慌张往后跳，手足无措",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "第 7 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-07.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 7 页：第 7 页",
        "width": 1200,
        "height": 900
      },
      "narration": "遭遇故障之后，星宝明白，不能盲目使用 AI。他翻开书本，认真研究，思考该怎么制定靠谱的安全规则。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "看来我要提前想好规则，分清什么可以做，什么绝对不能做，不能等出问题才补救。",
          "stageDirection": "捧着书，小声研读",
          "order": 1,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "随便开启多余权限、不给AI设定安全规则，会出现什么情况？",
        "options": [
          "使用更安全",
          "容易出现安全风险",
          "没有任何影响"
        ],
        "answer": "容易出现安全风险",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 8,
      "title": "第 8 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-08.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 8 页：第 8 页",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝拿出虚拟纸笔，开始动手撰写属于自己的 AI 安全规则。规则不能只是空洞的口号，要写清楚实实在在的行动。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "我要写一份实实在在的 AI 使用规则！不能只写一句 “注意安全”，要写明白具体怎么做。",
          "stageDirection": "握笔构思",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "第 9 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-09.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 9 页：第 9 页",
        "width": 1200,
        "height": 900
      },
      "narration": "一条条清晰的规则被写了出来：要检查输入的内容；坚持最小权限，不给多余许可；阻挡危险的恶意内容；遇到异常要记录、懂得求助。",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "第一，要验证输入的内容；第二，坚持最小权限原则；第三，挡住恶意危险的内容；第四，遇到不对劲，记录情况，立刻向大人求助！ 遇到付钱、陌生人聊天、让我不舒服的内容，就要马上停下！",
          "stageDirection": "一条一条念出来",
          "order": 1,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "使用AI时，遇到支付、陌生人联系或让自己不舒服的内容，应该怎么做？",
        "options": [
          "继续操作不用管",
          "立刻停止并求助大人",
          "自己悄悄解决"
        ],
        "answer": "立刻停止并求助大人",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 10,
      "title": "第 10 页",
      "image": {
        "src": "/assets/storybooks/lava-lesson-03/page-10.jpeg",
        "alt": "星宝熔岩山 AI 安全小卫士第 10 页：第 10 页",
        "width": 1200,
        "height": 900
      },
      "narration": "一套完整的 AI 安全规则全部制定完成！盾牌光芒环绕星宝。懂得定好安全规则，我们就可以安心、安全地使用 AI 工具。 小朋友们，给 AI 工具定好安全规则，分清权限、懂得停止、学会求助，才能更好保护自己。",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "太好了！有了安全规则的保护，我就可以放心使用 AI 工具啦！",
          "stageDirection": "自信叉腰",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
