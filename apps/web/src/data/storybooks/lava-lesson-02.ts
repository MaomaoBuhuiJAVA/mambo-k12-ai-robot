import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const LAVA_LESSON_02: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "lava-lesson-02",
  "moduleId": "lava-cavern",
  "lessonNumber": 2,
  "stage": "lower_primary",
  "title": "星宝熔岩山 AI 防骗小卫士",
  "summary": "星宝学习识别仿冒头像、合成语音和可疑链接，知道暂停、留证、核验和求助。",
  "source": {
    "originalFileName": "熔岩第二绘本.docx",
    "documentSha256": "DAAE578777231F18A2DC3F136C01EDDB4D52E2A80BB07E8BBA93D7330D63D287",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "深度合成",
    "可疑链接",
    "保存线索",
    "身份核验",
    "寻求帮助"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "星宝探索熔岩洞穴",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-01.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 1 页：星宝探索熔岩洞穴",
        "width": 1265,
        "height": 944
      },
      "narration": "滚烫蜿蜒的熔岩河流铺满石头洞穴，石壁火把静静燃烧，黄色小精灵星宝站在洞窟石路上，好奇打量四周，心里冒出一个小疑问。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "网上看到熟人头像、听到熟悉声音，一定是真朋友吗？",
          "stageDirection": "睁圆眼睛，歪头思考",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "有点像之前找到的熔岩洞穴",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-02.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 2 页：有点像之前找到的熔岩洞穴",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝往洞窟深处走去，整片熔岩洞窟全景铺开，橙红岩浆环绕刻着符文的石台，岩壁火把冒着暖光，蒸汽缓缓飘起，洞窟里藏着网络伪装的小陷阱。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "这个熔岩洞穴就像网络世界，看着熟悉的样子，说不定是伪装出来的！",
          "stageDirection": "四处张望",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "可疑消息出现",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-03.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 3 页：可疑消息出现",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝走到符文石台旁，空中突然弹出悬浮通讯弹窗，弹窗印着好朋友一模一样的头像，气泡文字不停催促星宝点击链接、转发消息，脚下熔岩缓缓流淌。 弹窗文字气泡：快点开链接！赶紧转发给我，别磨蹭！",
      "dialogue": [
        {
          "id": "p03-starbao-1",
          "speaker": "starbao",
          "text": "这是我的好朋友头像，难道是他找我帮忙？",
          "stageDirection": "伸手靠近弹窗，一脸惊喜",
          "order": 1,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "看到熟悉好友头像发来链接催促你点开，只靠头像就能确定是本人吗？",
        "options": [
          "完全可以",
          "不一定，头像能伪造",
          "肯定不是本人"
        ],
        "answer": "不一定，头像能伪造",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 4,
      "title": "星宝停下思考",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-04.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 4 页：星宝停下思考",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝脖子上的星星吊坠突然发光，他猛地收回伸出去的小手，停下动作认真思考，熔岩火光映在他脸上，弹窗还悬浮在一旁，头像可以被复制伪造。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "不对！头像能被复制，只看头像不能确定是本人！",
          "stageDirection": "皱起眉头，收回手",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "假声音出现",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-05.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 5 页：假声音出现",
        "width": 1265,
        "height": 944
      },
      "narration": "洞窟空中飘出发光喇叭图标，传来和好朋友完全一样的语音，是AI合成做出的假声音，星宝站在岩浆边，满脸困惑地听着虚假语音。",
      "dialogue": [
        {
          "id": "p05-system-1",
          "speaker": "system",
          "text": "快把你的账号信息发给我用一下！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-starbao-2",
          "speaker": "starbao",
          "text": "声音听着也好熟悉，可我总觉得哪里不对劲？",
          "stageDirection": "挠挠脑袋，十分疑惑",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "星宝拒绝点击",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-06.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 6 页：星宝拒绝点击",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝站在熔岩石台边，朝着悬浮弹窗用力摆手拒绝，不再靠近链接，心里牢牢记住，不能只靠头像、声音判断对方身份，洞窟岩浆静静流淌。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "我不能相信！头像和声音都能造假，我绝对不点链接！",
          "stageDirection": "神情坚定，后退一步",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "保存线索",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-07.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 7 页：保存线索",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝蹲在岩石平台上，拿出星光小盒子，小心保存好可疑弹窗的线索碎片，不再和这个可疑账号互动，一旁的熔岩泛着橙红微光。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "我先把证据存起来，不继续和这个奇怪账号聊天啦！",
          "stageDirection": "轻轻收好线索",
          "order": 1,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "遇到分不清真假的可疑账号消息，正确做法是？",
        "options": [
          "继续和对方聊天互动",
          "保存线索，不再互动",
          "直接删掉不留记录"
        ],
        "answer": "保存线索，不再互动",
        "correctFeedback": "回答正确，你观察得很认真！",
        "incorrectFeedback": "再看看这一页的内容，想一想。"
      }
    },
    {
      "pageNumber": 8,
      "title": "离开洞穴找大人",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-08.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 8 页：离开洞穴找大人",
        "width": 1265,
        "height": 944
      },
      "narration": "熔岩洞窟侧边石门打开，外面透出柔和天光，星宝握着发光线索碎片往洞口走，打算换一种方式线下、打电话核对好友身份，身后依旧能看见流动岩浆。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "我要当面打电话找好朋友，多重办法确认才靠谱！",
          "stageDirection": "抱着星光碎片往前走",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "在洞口学习核对方法",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-09.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 9 页：在洞口学习核对方法",
        "width": 1265,
        "height": 944
      },
      "narration": "星宝站在熔岩洞穴入口，遇见前来讲解的老师，空中浮现电话、线下见面、关闭弹窗的小图标，老师告诉星宝深度合成能伪造图像声音，规则要做到具体可执行。 老师：（温和笑着）只靠一种线索分不清真假，要多种信息互相确认，分不清就来找大人！",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "我记住啦，不能只看头像、听声音判断别人！",
          "stageDirection": "认真点头",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "星宝学会保护自己",
      "image": {
        "src": "/assets/storybooks/lava-lesson-02/page-10.png",
        "alt": "星宝熔岩山 AI 防骗小卫士第 10 页：星宝学会保护自己",
        "width": 1265,
        "height": 944
      },
      "narration": "熔岩洞窟平台上，星宝脖子的星星吊坠闪闪发光，身边漂浮安全盾牌、星星守护图标，远处流淌着平缓熔岩，星宝完全掌握分辨可疑链接、假声音的办法。 老师：遇到催促点链接、索要信息的消息，先暂停、存线索、找家长老师！",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "我学会分辨网络伪装，安心安全畅游数字世界",
          "stageDirection": "自信挺胸，笑容灿烂",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
