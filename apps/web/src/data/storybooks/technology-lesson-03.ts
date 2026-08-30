import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const TECHNOLOGY_LESSON_03: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "technology-lesson-03",
  "moduleId": "core-lab",
  "lessonNumber": 3,
  "stage": "lower_primary",
  "title": "星宝核心实验室 AI 规则小卫士",
  "summary": "星宝和 AI 机器人学习使用 AI 的安全规则，学会管理权限、写清规则，遇到危险内容及时停止并求助。",
  "source": {
    "originalFileName": "核心实验室第六绘本.docx",
    "documentSha256": "F0A8F22D7DF1E533E52AA5120FCD65AF8A88BD89604A10322B725E0EAB32EE4D",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "AI 使用规则",
    "权限管理",
    "清晰规则",
    "风险识别",
    "停止与求助"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "使用AI要先定规则",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-01.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 1 页：使用AI要先定规则",
        "width": 1200,
        "height": 900
      },
      "narration": "在科技实验室里，星宝和 AI 机器人站在桌子旁边，桌面上摆放着好多 AI 功能卡片，机器人伸出手指向卡片，准备告诉星宝使用 AI 的小知识。",
      "dialogue": [
        {
          "id": "p01-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "星宝，我们使用 AI 工具之前，要先想好安全规则哦。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p01-starbao-2",
          "speaker": "starbao",
          "text": "哇，规则要怎么定呢？",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "什么是权限",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-02.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 2 页：什么是权限",
        "width": 1200,
        "height": 900
      },
      "narration": "好多功能图标飘浮在空中，星宝脑袋冒出大大的问号，一脸疑惑地望着机器人，好奇这些图标都是什么用处。",
      "dialogue": [
        {
          "id": "p02-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "AI 会申请很多权限，麦克风、画笔、相机都属于权限。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-starbao-2",
          "speaker": "starbao",
          "text": "权限是什么呀？我有点听不懂。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "关掉不需要的权限",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-03.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 3 页：关掉不需要的权限",
        "width": 1200,
        "height": 900
      },
      "narration": "画面出现麦克风、位置、相机的图标，全部打上红色叉号，机器人正在讲解，不需要的权限要关掉。",
      "dialogue": [
        {
          "id": "p03-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "用不到的权限，我们就要把它关闭掉。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-starbao-2",
          "speaker": "starbao",
          "text": "哦，不用就关掉，这样会更安全！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "遇到危险马上停下",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-04.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 4 页：遇到危险马上停下",
        "width": 1200,
        "height": 900
      },
      "narration": "红色大大的 STOP 停止标识出现在画面，还有禁止支付、禁止坏情绪内容的图标，星宝皱起眉头，机器人伸手做出停止的手势。",
      "dialogue": [
        {
          "id": "p04-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "碰到要花钱、看着不舒服的内容，一定要马上停下来。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-starbao-2",
          "speaker": "starbao",
          "text": "遇到不好的东西，我就不能继续操作了对吗？",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "规则要写清楚",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-05.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 5 页：规则要写清楚",
        "width": 1200,
        "height": 900
      },
      "narration": "桌子上放着两块提示牌，一块写着 \"注意安全\"，另一块写着 \"不打开麦克风权限\"，机器人竖起一根手指认真讲解。",
      "dialogue": [
        {
          "id": "p05-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "规则要写清楚，不能只说简简单单的 \"注意安全\"。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-starbao-2",
          "speaker": "starbao",
          "text": "原来模糊的提醒是不够的，要写明白怎么做！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "只开需要的权限",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-06.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 6 页：只开需要的权限",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝脑袋旁边冒出闪闪的灯泡，代表正在思考，桌面上摆放三张打勾卡片：可以输入文字、可以打开相机、不打开位置。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "我明白啦！只打开我们真正需要的权限。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "没错，只开启任务需要的功能就可以。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "AI安全小规则",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-07.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 7 页：AI安全小规则",
        "width": 1200,
        "height": 900
      },
      "narration": "四张安全提示卡片悬浮在空中，分别是不打开支付、遇到危险停下、找爸爸妈妈帮忙、关掉不用权限，星宝抬起手指，开心地复述规则。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "我记住啦！不随便开支付，遇到危险就停下，找大人帮忙，关掉不用的权限！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "真棒，这些就是我们的 AI 安全小规则。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 8,
      "title": "使用AI安全三件事",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-08.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 8 页：使用AI安全三件事",
        "width": 1200,
        "height": 900
      },
      "narration": "屏幕上展示三条要点：权限许可、遵守规则、寻求帮助。星宝伸出手指指着屏幕上的清单。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "使用 AI，要记住三件事！管好权限、遵守规则、遇到困难找大人。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "这就是使用 AI 的安全小清单。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "先定规则再玩AI",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-09.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 9 页：先定规则再玩AI",
        "width": 1200,
        "height": 900
      },
      "narration": "实验室里挂着 \"先定规则再用 AI\" 的横幅，星宝和 AI 机器人并肩站在一起，神情坚定。",
      "dialogue": [
        {
          "id": "p09-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "一定要先定好安全规则，再去使用 AI 工具。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-starbao-2",
          "speaker": "starbao",
          "text": "对！先定规则，再玩 AI。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "安全快乐用AI",
      "image": {
        "src": "/assets/storybooks/technology-lesson-03/page-10.jpeg",
        "alt": "星宝核心实验室 AI 规则小卫士第 10 页：安全快乐用AI",
        "width": 1200,
        "height": 900
      },
      "narration": "空中飘着两张 AI 安全规则卡片，周围飘满彩色小彩带，星宝开心举起双手，机器人鼓掌，学习圆满结束。",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "学会 AI 安全规则，我就可以安心使用 AI 啦！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p10-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "希望你牢牢记住，安全快乐地使用 AI！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
