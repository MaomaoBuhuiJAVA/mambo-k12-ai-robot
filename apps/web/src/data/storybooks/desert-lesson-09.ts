import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const DESERT_LESSON_09: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "desert-lesson-09",
  "moduleId": "desert-temple",
  "lessonNumber": 9,
  "stage": "lower_primary",
  "title": "证据不够时怎样判断",
  "summary": "星宝在沙漠神殿学习证据不足时暂不下结论，并根据新证据更新判断。",
  "source": {
    "originalFileName": "第9课时_证据不够时怎样判断.docx",
    "documentSha256": "731D5B94B98B003EA7934BB5830F3B32FDFC06426E4BD2497DA4E294096496B6",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "暂时不能确定",
    "事实核验",
    "结论更新",
    "AI 信息核验",
    "证据不足"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "最终考验大厅",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-01.png",
        "alt": "证据不够时怎样判断第 1 页：最终考验大厅",
        "width": 1024,
        "height": 572
      },
      "narration": "掌握了分类和可靠性判断的方法，星宝跟着守卫来到神殿最深处的考验大厅。这里摆放着三组神殿判断题，是石像守卫设置的最后一道难关。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "最终考验！我已经准备好了，放马过来吧！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p01-guardian-2",
          "speaker": "guardian",
          "text": "别急，在开始之前，还有一个重要的道理要教给你。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "判断不只两种结果",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-02.png",
        "alt": "证据不够时怎样判断第 2 页：判断不只两种结果",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫指着墙上三个发光的符号：很多人以为判断只有\"对\"和\"错\"两种答案，其实不是。判断可以分为三种：支持、反对，还有——暂时不能确定。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "啊？还有\"暂时不能确定\"？不是非要选对或错吗？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-guardian-2",
          "speaker": "guardian",
          "text": "证据不足的时候，强行下结论反而更容易出错。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "证据不足不勉强",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-03.png",
        "alt": "证据不够时怎样判断第 3 页：证据不足不勉强",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫认真地说：证据不足的时候，应该老老实实地写下\"暂时不能确定\"，然后继续寻找资料，而不是为了完成任务随便选一个答案。承认不知道，也是一种负责任的态度。",
      "dialogue": [
        {
          "id": "p03-starbao-1",
          "speaker": "starbao",
          "text": "原来不知道也没关系，继续找证据就好了！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-guardian-2",
          "speaker": "guardian",
          "text": "对，诚实面对不确定性，比瞎猜要靠谱得多。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "事实核验的方法",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-04.png",
        "alt": "证据不够时怎样判断第 4 页：事实核验的方法",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫拿出一张《说法—证据—结论核验表》：判断的时候，要把具体说法和能够找到的证据逐项对应，这个过程叫做事实核验。每一条说法都要找到对应的证据来支撑。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "说法、证据、结论……一项一项对应起来，就不容易出错了！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-guardian-2",
          "speaker": "guardian",
          "text": "没错，有条理地核对，比凭感觉判断要可靠。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "接受不确定性",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-05.png",
        "alt": "证据不够时怎样判断第 5 页：接受不确定性",
        "width": 1024,
        "height": 572
      },
      "narration": "星宝看着核验表，有些担心地问：那如果找来找去还是证据不够怎么办？守卫笑着说：那就坦然接受不确定性。根据现有信息还不能得到唯一结论的情况是很常见的。",
      "dialogue": [
        {
          "id": "p05-starbao-1",
          "speaker": "starbao",
          "text": "好吧，虽然有点不甘心，但暂时不确定总比说错了好！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-guardian-2",
          "speaker": "guardian",
          "text": "能这样想就对了，这才是理性判断的态度。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "结论可以修改",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-06.png",
        "alt": "证据不够时怎样判断第 6 页：结论可以修改",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫又补充了一个重要道理：等新的证据出现以后，原来的结论是可以修改的。修改结论不是失败，而是因为判断变得更有依据了。知错能改，也是一种能力。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "原来改答案不是丢脸的事，是变得更准确了！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-guardian-2",
          "speaker": "guardian",
          "text": "说得好，好的判断者会根据新证据不断更新自己的结论。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "AI信息也要核验",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-07.png",
        "alt": "证据不够时怎样判断第 7 页：AI信息也要核验",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫提醒星宝：查看 AI 提供的信息时，也要用同样的方法——把 AI 说的具体说法，和你能够找到的证据一项一项对应起来。AI 说的每一句话，都要找到证据才能相信。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "我记住了！就算是 AI 说的话，也要一条一条找证据核对！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-guardian-2",
          "speaker": "guardian",
          "text": "非常好，这就是安全使用 AI 的核心原则。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 8,
      "title": "三组判断题挑战",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-08.png",
        "alt": "证据不够时怎样判断第 8 页：三组判断题挑战",
        "width": 1024,
        "height": 572
      },
      "narration": "准备好了，星宝开始挑战三组神殿判断题。每一组她都认真填写：说法是什么、有哪些证据、结论是什么，还有还需要继续寻找什么资料。一笔一划，格外认真。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "第一组……支持！第二组……反对！第三组……暂时不能确定！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-guardian-2",
          "speaker": "guardian",
          "text": "做得不错，每一组都写上理由和下一步计划。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "完成全部核验",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-09.png",
        "alt": "证据不够时怎样判断第 9 页：完成全部核验",
        "width": 1024,
        "height": 572
      },
      "narration": "三组判断题全部完成了！星宝把三份《说法—证据—结论核验表》整整齐齐地摆放在石桌上。每一张都写得清清楚楚，证据和说法一一对应，结论也都有理有据。",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "全部完成啦！证据充分的我就下结论，证据不足的我就写暂时不确定！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-guardian-2",
          "speaker": "guardian",
          "text": "很好，你已经真正掌握了证据与判断的精髓。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "最终通关",
      "image": {
        "src": "/assets/storybooks/desert-lesson-09/page-10.png",
        "alt": "证据不够时怎样判断第 10 页：最终通关",
        "width": 1024,
        "height": 572
      },
      "narration": "石像守卫的双眼从金色变成明亮的绿色，石桌上浮现出完整的证据判断徽章——三片碎片合为一体！星宝开心地捧起徽章，她不仅通过了考验，更学会了理性判断的宝贵方法。",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "我获得完整的证据判断徽章啦！以后面对 AI 的信息，我一定会用证据说话，独立判断！",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
