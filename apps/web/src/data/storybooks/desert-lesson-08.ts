import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const DESERT_LESSON_08: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "desert-lesson-08",
  "moduleId": "desert-temple",
  "lessonNumber": 8,
  "stage": "lower_primary",
  "title": "哪条证据更可靠",
  "summary": "星宝在沙漠神殿从来源、时间和一致性三个维度判断证据的可靠性。",
  "source": {
    "originalFileName": "第8课时_哪条证据更可靠.docx",
    "documentSha256": "1C6BE53B71D201EEDA74F72FB8705F1C322D02064E3B985DE69535864D52B333",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "证据来源",
    "时效性",
    "内容一致性",
    "原始记录",
    "交叉验证"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "神秘的档案室",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-01.png",
        "alt": "哪条证据更可靠第 1 页：神秘的档案室",
        "width": 1024,
        "height": 572
      },
      "narration": "通过了第一道考验，石像守卫带领星宝来到神殿深处的档案室。这里存放着石碑拓印、神殿公告和游客转述三类资料，记录着神殿的各种信息。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "哇，档案室里有这么多资料！这些都是证据吗？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p01-guardian-2",
          "speaker": "guardian",
          "text": "是的，但证据也有可靠程度之分。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "三类不同资料",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-02.png",
        "alt": "哪条证据更可靠第 2 页：三类不同资料",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫指着三个石架：左边是石碑拓印——直接从古代石碑上拓下来的原始记录；中间是神殿公告——官方发布的通知；右边是游客转述——游客口口相传的说法。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "这三类资料看起来都很有道理，哪一类更可靠呢？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-guardian-2",
          "speaker": "guardian",
          "text": "要判断证据可不可信，有三个判断小窍门。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "第一招：看信息来源",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-03.png",
        "alt": "哪条证据更可靠第 3 页：第一招：看信息来源",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫伸出第一根手指：第一招，看证据来自哪里。原始记录和负责机构发布的信息，通常比没有出处的转述更容易核对，因为你能找到源头去验证。",
      "dialogue": [
        {
          "id": "p03-starbao-1",
          "speaker": "starbao",
          "text": "哦！所以石碑拓印和神殿公告比游客转述更容易核对对不对？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-guardian-2",
          "speaker": "guardian",
          "text": "没错，来源越清楚、越权威，证据就越可靠。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "第二招：看发布时间",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-04.png",
        "alt": "哪条证据更可靠第 4 页：第二招：看发布时间",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫伸出第二根手指：第二招，看发布时间。旧资料可能曾经是正确的，但不一定适合判断今天发生的事情。比如去年的开放时间表，不能直接用来判断今天开不开放。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "原来证据还要看新不新！太旧的资料可能已经过时了。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-guardian-2",
          "speaker": "guardian",
          "text": "对，时效性也是判断证据可靠性的重要标准。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "第三招：看内容一致性",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-05.png",
        "alt": "哪条证据更可靠第 5 页：第三招：看内容一致性",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫伸出第三根手指：第三招，看不同来源的说法是不是一致。如果好几个独立来源都说了同样的事，那可信度就大大提升了；如果只有一个来源这么说，就要小心。",
      "dialogue": [
        {
          "id": "p05-starbao-1",
          "speaker": "starbao",
          "text": "多个来源说法一致才更可信，就像多人作证一样！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-guardian-2",
          "speaker": "guardian",
          "text": "很聪明，交叉验证是非常重要的判断方法。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "原始记录最可靠",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-06.png",
        "alt": "哪条证据更可靠第 6 页：原始记录最可靠",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫带着星宝来到石碑前：你看，石碑是古人直接刻上去的，是最原始的记录。像这样的原始记录，还有负责机构的正式发布，通常比二手转述要可靠得多。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "原来越接近事情本身的来源就越可靠！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-guardian-2",
          "speaker": "guardian",
          "text": "对，经过的转手越少，信息失真的可能性就越小。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "矛盾消息怎么办",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-07.png",
        "alt": "哪条证据更可靠第 7 页：矛盾消息怎么办",
        "width": 1024,
        "height": 572
      },
      "narration": "星宝突然发现两张公告说的不一样：一张说上午开放，一张说下午开放。守卫说：两条消息互相矛盾时，要回到更接近事情本身的来源继续查找，不能随便选一个就信。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "那我们应该去查最原始的石碑记录对不对？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-guardian-2",
          "speaker": "guardian",
          "text": "正确，回到源头去寻找答案。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 8,
      "title": "可靠性大排序",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-08.png",
        "alt": "哪条证据更可靠第 8 页：可靠性大排序",
        "width": 1024,
        "height": 572
      },
      "narration": "弄懂了三个判断小窍门，守卫给星宝布置了新任务：把石碑拓印、神殿公告和游客转述三类资料，按照可靠程度从高到低排顺序，还要说明理由。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "让我来排一排！石碑拓印第一，神殿公告第二，游客转述第三……对吗？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-guardian-2",
          "speaker": "guardian",
          "text": "说说你的理由，为什么这么排？",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "完成排序任务",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-09.png",
        "alt": "哪条证据更可靠第 9 页：完成排序任务",
        "width": 1024,
        "height": 572
      },
      "narration": "星宝认真地在排序卡上写下理由：石碑拓印是原始记录，来源最清楚；神殿公告是官方发布，也很可靠；游客转述经过多人传话，可能不准确。守卫看了满意地点点头。",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "排好啦！原始记录最可靠，官方公告次之，转述最需要核对。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-guardian-2",
          "speaker": "guardian",
          "text": "非常好，你已经掌握了判断证据可靠性的方法。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "获得可靠性徽章",
      "image": {
        "src": "/assets/storybooks/desert-lesson-08/page-10.png",
        "alt": "哪条证据更可靠第 10 页：获得可靠性徽章",
        "width": 1024,
        "height": 572
      },
      "narration": "石桌上又浮现出一张《证据可靠性排序卡》，还有证据判断徽章的第二片碎片。星宝小心地收好，她知道离完成全部考验又近了一步。",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "又获得了一片徽章！判断证据可靠性的三个小窍门我都记住啦！",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
