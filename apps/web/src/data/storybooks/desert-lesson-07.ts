import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const DESERT_LESSON_07: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "desert-lesson-07",
  "moduleId": "desert-temple",
  "lessonNumber": 7,
  "stage": "lower_primary",
  "title": "线索和证据一样吗",
  "summary": "星宝在沙漠神殿学习区分说法、证据和猜测，理解线索与证据的不同。",
  "source": {
    "originalFileName": "第7课时_线索和证据一样吗.docx",
    "documentSha256": "A8AAC1D82F6F111EA98A0A2E6C2B1E1B335272A9AB70DE284DF988DD9DC3BC22",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "说法",
    "证据",
    "猜测",
    "线索与证据",
    "证据范围"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "神殿入口的消息墙",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-01.png",
        "alt": "线索和证据一样吗第 1 页：神殿入口的消息墙",
        "width": 1024,
        "height": 572
      },
      "narration": "漫漫黄沙中，古老的沙漠神殿静静矗立。好奇的星宝推开厚重的石门，发现入口的墙壁上贴满了各式各样的消息纸条，有的写着开放时间，有的画着通道方向。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "哇！神殿门口有这么多消息，到底哪些是真的呢？",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "石像守卫的第一道考验",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-02.png",
        "alt": "线索和证据一样吗第 2 页：石像守卫的第一道考验",
        "width": 1024,
        "height": 572
      },
      "narration": "就在星宝对着消息墙发呆时，神殿中央的巨型石像缓缓睁开了金色双眼。它就是沙漠石像守卫，向星宝抛出第一个问题：这些消息里，哪些是说法？哪些是证据？",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "说法？证据？这两个词听起来差不多，它们有什么不一样吗？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-guardian-2",
          "speaker": "guardian",
          "text": "小访客，先弄清楚什么是说法、什么是证据吧。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "什么是说法",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-03.png",
        "alt": "线索和证据一样吗第 3 页：什么是说法",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫挥动手指，几张消息卡飘到空中。守卫解释：说法就是需要我们判断对错的内容，比如\"神殿今天开放\"就是一个说法，它可能是真的，也可能是假的。",
      "dialogue": [
        {
          "id": "p03-starbao-1",
          "speaker": "starbao",
          "text": "原来需要判断对错的句子就是说法呀！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-guardian-2",
          "speaker": "guardian",
          "text": "对，说法是等待验证的句子，不能直接当真。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "什么是证据",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-04.png",
        "alt": "线索和证据一样吗第 4 页：什么是证据",
        "width": 1024,
        "height": 572
      },
      "narration": "接着，守卫又拿出另一叠卡片：证据是能够支持或者反对某个说法的资料和事实。比如门口当天的正式告示，就可以作为\"神殿今天开放\"这个说法的证据。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "有了证据，我们才能判断说法是对还是错！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-guardian-2",
          "speaker": "guardian",
          "text": "没错，证据是判断说法的依据。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "什么是猜测",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-05.png",
        "alt": "线索和证据一样吗第 5 页：什么是猜测",
        "width": 1024,
        "height": 572
      },
      "narration": "星宝指着一张写着\"我猜今天不开门\"的纸条问守卫：那这个呢？守卫笑着说：这是猜测。个人猜测可以帮助我们提出问题，但不能单独证明说法成立。",
      "dialogue": [
        {
          "id": "p05-starbao-1",
          "speaker": "starbao",
          "text": "原来猜测不能当证据呀，我以前可不知道！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-guardian-2",
          "speaker": "guardian",
          "text": "猜测是想法，证据是事实，二者可不一样。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "说法、证据、猜测大不同",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-06.png",
        "alt": "线索和证据一样吗第 6 页：说法、证据、猜测大不同",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫把十二张神殿消息卡铺在石桌上，让星宝试着分成三组：说法、证据和猜测。星宝皱着小眉头，一张一张仔细地看。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "让我来分一分，这个是说法……这个是证据……这个好像是猜测！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-guardian-2",
          "speaker": "guardian",
          "text": "慢慢来，仔细想想每一张的作用是什么。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "有线索不等于有证据",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-07.png",
        "alt": "线索和证据一样吗第 7 页：有线索不等于有证据",
        "width": 1024,
        "height": 572
      },
      "narration": "分到一半，星宝遇到了难题：一张纸条上写着\"昨天有游客进去过\"。星宝觉得这应该能证明今天也开放吧？守卫摇摇头：这只是线索，有线索不等于已经有足够证据。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "原来线索和证据不一样呀！昨天开放不代表今天也开放。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-guardian-2",
          "speaker": "guardian",
          "text": "对，要看证据具体说明了什么，不能想当然。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 8,
      "title": "证据能支持什么",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-08.png",
        "alt": "线索和证据一样吗第 8 页：证据能支持什么",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫进一步解释：同一条证据可能只支持说法的一部分。比如\"门口有告示\"能证明有通知，但不能证明通知内容一定正确。要看清楚证据具体说明了什么。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "原来证据不是万能的，每条证据有它能证明的范围！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-guardian-2",
          "speaker": "guardian",
          "text": "说得好，要对应清楚证据和说法之间的关系。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "完成分类任务",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-09.png",
        "alt": "线索和证据一样吗第 9 页：完成分类任务",
        "width": 1024,
        "height": 572
      },
      "narration": "弄懂了这些道理，星宝重新开始分类。她把十二张消息卡仔细分成了三组：说法组、证据组、猜测组，每一组都写上了判断理由。",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "分好啦！说法是要判断的句子，证据是能证明的事实，猜测是个人的想法！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-guardian-2",
          "speaker": "guardian",
          "text": "不错不错，你已经掌握了基本的分类方法。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "获得分类徽章",
      "image": {
        "src": "/assets/storybooks/desert-lesson-07/page-10.png",
        "alt": "线索和证据一样吗第 10 页：获得分类徽章",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫满意地点点头，石桌上浮现出一张闪闪发光的《说法与证据分类表》，还有一枚证据判断徽章的第一片碎片。星宝开心地接过，知道后面还有更多考验等着她。",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "太棒了！我获得了第一枚徽章碎片！接下来继续加油！",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
