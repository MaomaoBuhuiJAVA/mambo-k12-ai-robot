import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const LAVA_LESSON_01: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "lava-lesson-01",
  "moduleId": "lava-cavern",
  "lessonNumber": 1,
  "stage": "lower_primary",
  "title": "星宝熔岩山 AI 隐私小卫士",
  "summary": "星宝在熔岩山探索时，学会识别个人隐私、拒绝隐私索取，并安全地使用 AI。",
  "source": {
    "originalFileName": "熔岩第一绘本.docx",
    "documentSha256": "0331C4DD9514A3605D95E462E9D0E5BFDEA36A800EF71D666B37E40F14A01951",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "个人隐私",
    "隐私保护",
    "安全使用 AI",
    "拒绝不当索取"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "熔岩山的星宝",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-01.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 1 页：熔岩山的星宝",
        "width": 1265,
        "height": 944
      },
      "narration": "在滚烫神奇的熔岩山里，有一座大大的石头洞穴。勇敢的星宝来到这里，准备探索洞穴中的秘密。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "这座洞穴里，会藏着什么有趣的东西呢？",
          "stageDirection": "睁大眼睛，充满好奇",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "遇见神奇 AI 小精灵",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-02.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 2 页：遇见神奇 AI 小精灵",
        "width": 1265,
        "height": 944
      },
      "narration": "往前走，星宝遇见了神奇的 AI 精灵。AI 精灵懂得许许多多知识，愿意陪星宝聊天玩耍。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "你好呀！你就是传说中懂得很多知识的 AI 精灵吗？",
          "stageDirection": "开心微笑",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "你好星宝！我可以回答你的所有问题！",
          "stageDirection": "轻快飞舞",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "AI 精灵想要我的信息",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-03.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 3 页：AI 精灵想要我的信息",
        "width": 1265,
        "height": 944
      },
      "narration": "聊了一会儿，AI 精灵想要了解星宝更多的事情，开始打听星宝的个人信息。",
      "dialogue": [
        {
          "id": "p03-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "告诉我你的名字、学校和家住在哪里好不好？我想更加了解你！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-starbao-2",
          "speaker": "starbao",
          "text": "嗯…… 这些，是属于我的个人隐私呀。",
          "stageDirection": "歪着头，面露疑惑",
          "order": 2,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "AI 精灵向星宝询问住址、学校、爸妈电话，这些信息属于？",
        "options": [
          "科普知识",
          "个人隐私",
          "游戏内容"
        ],
        "answer": "个人隐私",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 4,
      "title": "什么是我们的隐私？",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-04.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 4 页：什么是我们的隐私？",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝陷入思考，不是所有信息，都可以随便告诉 AI。住址、电话、学校都属于我们的隐私。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "这些信息是我的隐私，不能够随便告诉别人。",
          "stageDirection": "神情严肃",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "隐私？那是什么东西呢？",
          "stageDirection": "不解地眨眨光点眼睛",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "不能上传私人照片",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-05.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 5 页：不能上传私人照片",
        "width": 1265,
        "height": 944
      },
      "narration": "AI 精灵又打开虚拟屏幕，希望星宝上传自己的照片，可照片同样是重要的隐私。",
      "dialogue": [
        {
          "id": "p05-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "把你的照片发给我吧，这样我就能记住你的样子！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-starbao-2",
          "speaker": "starbao",
          "text": "不行，我的私人照片，也是我的隐私，不能随便上传。",
          "stageDirection": "向后退一步",
          "order": 2,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "AI 精灵想要星宝的私人自拍照片，我们应当？",
        "options": [
          "直接发送给它",
          "果断拒绝不上传",
          "随意发别人照片"
        ],
        "answer": "果断拒绝不上传",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 6,
      "title": "勇敢对隐私索取说不",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-06.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 6 页：勇敢对隐私索取说不",
        "width": 1265,
        "height": 944
      },
      "narration": "遇到索要隐私的请求，我们要勇敢说不，不能轻易交出自己的秘密。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "不可以！隐私信息不能随便分享出去！",
          "stageDirection": "坚定摆手",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "为什么不能分享给我呢？",
          "stageDirection": "微微一愣",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "分清可分享与隐私内容",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-07.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 7 页：分清可分享与隐私内容",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝耐心向 AI 精灵解释，哪些内容可以分享，哪些内容需要好好保护。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "火山、星星、花草的知识可以尽情聊。但是照片、住址、电话，属于个人隐私，一定要保护好。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "原来是这样，我终于明白隐私的规则了。",
          "stageDirection": "认真倾听",
          "order": 2,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "下列哪一项内容可以放心告诉 AI 精灵？",
        "options": [
          "自家详细住址",
          "火山岩浆的科普知识",
          "爸爸妈妈的手机号"
        ],
        "answer": "火山岩浆的科普知识",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 8,
      "title": "牢记 AI 使用安全准则",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-08.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 8 页：牢记 AI 使用安全准则",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝坐下来，默默记住使用 AI 的小规则，使用 AI 的时候，先要想一想，这个信息能不能告诉它。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "和 AI 相处，一定要分清，什么可以说，什么必须守护。",
          "stageDirection": "内心思考",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "我会记住，不再索要你的隐私信息。",
          "stageDirection": "安静漂浮一旁",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "总结隐私守护小妙招",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-09.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 9 页：总结隐私守护小妙招",
        "width": 1265,
        "height": 944
      },
      "narration": "只要守住隐私的边界，AI 就是我们学习知识的好伙伴。",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "使用 AI 的时候，不泄露住址电话，不上传私人照片，学会分辨，学会拒绝。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "记住啦！保护好隐私，我们才可以安全相处！",
          "stageDirection": "光点闪烁",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "合格的 AI 隐私小卫士",
      "image": {
        "src": "/assets/storybooks/lava-lesson-01/page-10.png",
        "alt": "星宝熔岩山 AI 隐私小卫士第 10 页：合格的 AI 隐私小卫士",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝学会了保护隐私，成为熔岩山的 AI 安全小卫士。学会守护自己的隐私，就可以快乐安全地和 AI 做朋友。",
      "dialogue": [
        {
          "id": "p10-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "太棒啦星宝！我们可以安心一起学习探索！",
          "stageDirection": "欢快飞舞",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p10-starbao-2",
          "speaker": "starbao",
          "text": "保护好自己的隐私，就可以大胆探索 AI 的奇妙世界！",
          "stageDirection": "自信挺胸",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
