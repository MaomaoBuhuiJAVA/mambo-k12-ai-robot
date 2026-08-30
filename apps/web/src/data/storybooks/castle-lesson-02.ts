import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const CASTLE_LESSON_02: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "castle-lesson-02",
  "moduleId": "castle-1",
  "lessonNumber": 2,
  "stage": "lower_primary",
  "title": "星宝的城堡图案规律奇遇记",
  "summary": "星宝来到天空之城城堡，学习从重复和变化中发现规律，分开观察颜色与形状，并用新位置验证规律。",
  "source": {
    "originalFileName": "第2课时_重复图案怎样接下去.docx",
    "documentSha256": "3BB13B18119773A886F36B6A26222D8A560B4796DB9A42F6A8D27A9E945221DA",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "重复规律",
    "多项观察",
    "颜色与形状",
    "规律验证",
    "唯一答案"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "神秘的城墙图案",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-01.png",
        "alt": "星宝的城堡图案规律奇遇记第 1 页：神秘的城墙图案",
        "width": 1024,
        "height": 572
      },
      "narration": "穿过城堡大厅，星宝来到了一段古老的城墙前。城墙上的砖石有着五彩斑斓的图案，可是有几处砖石不见了，只留下空空的凹槽。星宝好奇地歪着脑袋，想弄清楚这些图案到底有什么秘密。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "哇！城墙上的砖块好漂亮呀，可是中间缺了几块……它们是按什么顺序排的呢？",
          "order": 1,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "城堡守卫的考验",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-02.png",
        "alt": "星宝的城堡图案规律奇遇记第 2 页：城堡守卫的考验",
        "width": 1024,
        "height": 572
      },
      "narration": "这时，一位穿着银色盔甲的城堡守卫从城墙后走了出来。他告诉星宝：这段城墙是古代工匠按照特定规律修建的，只有找出规律，才能补上缺失的砖石，打开通往内城的大门。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "规律？我只要看看前一块砖是什么样子就能猜出来了吧？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-guardian-2",
          "speaker": "guardian",
          "text": "别急，找规律可没那么简单哦。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "只看一块可不够",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-03.png",
        "alt": "星宝的城堡图案规律奇遇记第 3 页：只看一块可不够",
        "width": 1024,
        "height": 572
      },
      "narration": "星宝盯着墙上的图案看：红、蓝、红……她想：\"下一块肯定是蓝色！\"可是当她把蓝色砖放上去，城墙却发出了\"错误\"的红光。原来，只看相邻的两块就下结论，很容易猜错。",
      "dialogue": [
        {
          "id": "p03-starbao-1",
          "speaker": "starbao",
          "text": "啊？不对吗？我明明看到红蓝红蓝交替的呀……",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-guardian-2",
          "speaker": "guardian",
          "text": "哈哈，只看一两块就下结论可不行，规律要能解释前面好多块才行！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "规律要能解释多项",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-04.png",
        "alt": "星宝的城堡图案规律奇遇记第 4 页：规律要能解释多项",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫指向更长的一段城墙：红方、蓝圆、红方、蓝圆、红方、蓝圆……他告诉星宝，一个真正的规律要能解释前面出现的每一项，而不是只碰巧对上一两个。要从左到右逐个比较，找出重复出现的部分。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "原来是这样！我得多看几块，找到重复出现的那一组！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-guardian-2",
          "speaker": "guardian",
          "text": "没错，规律就是在多次观察中反复出现的变化方式。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "颜色和形状分开看",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-05.png",
        "alt": "星宝的城堡图案规律奇遇记第 5 页：颜色和形状分开看",
        "width": 1024,
        "height": 572
      },
      "narration": "星宝又遇到了一段更复杂的城墙：红方、蓝圆、红三角、蓝方、红圆、蓝三角……看得她眼花缭乱。守卫笑着说：别着急，颜色和形状可能同时在变化，可以先分别观察颜色规律，再观察形状规律。",
      "dialogue": [
        {
          "id": "p05-starbao-1",
          "speaker": "starbao",
          "text": "颜色是红、蓝、红、蓝交替！那形状呢……方、圆、三角、方、圆、三角！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-guardian-2",
          "speaker": "guardian",
          "text": "太棒了！分开观察，问题就变得简单多啦！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "把两个变化合起来",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-06.png",
        "alt": "星宝的城堡图案规律奇遇记第 6 页：把两个变化合起来",
        "width": 1024,
        "height": 572
      },
      "narration": "星宝把颜色规律和形状规律合在一起：红色配\"方-圆-三角\"循环，蓝色也配\"方-圆-三角\"循环。这样一来，下一块砖应该是红色的方形！星宝小心翼翼地把红砖放上去，城墙发出了金色的光芒。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "成功啦！分开看再合起来，规律就清清楚楚了！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-guardian-2",
          "speaker": "guardian",
          "text": "说得好，复杂的规律往往是几个简单规律组合在一起的。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "用新位置验证规律",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-07.png",
        "alt": "星宝的城堡图案规律奇遇记第 7 页：用新位置验证规律",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫指了指城墙更远的地方，那里还有另一个空缺。他说：发现规律后，要用新的位置来验证。如果在新的位置上规律依然成立，那这个规律就更可信了。这就像科学家做实验一样，要反复检验。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "让我来试试！按照刚才的规律，空缺处应该是蓝色圆形……对啦！果然对上了！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-guardian-2",
          "speaker": "guardian",
          "text": "很好，能通过新位置检验的规律，才是真正可靠的规律。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 8,
      "title": "补全第一段城墙",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-08.png",
        "alt": "星宝的城堡图案规律奇遇记第 8 页：补全第一段城墙",
        "width": 1024,
        "height": 572
      },
      "narration": "掌握了找规律的方法，星宝开始认真地补全整段城墙。她一段一段地观察，先找重复单元，再分别看颜色和形状，最后用新位置验证。一块、两块、三块……空缺的砖石越来越少，城墙渐渐完整了。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "第一段城墙补好啦！原来找规律也有方法，不是靠瞎猜的！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-guardian-2",
          "speaker": "guardian",
          "text": "没错，有顺序地观察和验证，才能找到真正的规律。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "设计自己的图案挑战",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-09.png",
        "alt": "星宝的城堡图案规律奇遇记第 9 页：设计自己的图案挑战",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫又拿出了一堆彩色砖块，对星宝说：现在轮到你设计一段只有一个正确答案的新图案啦！设计的时候要保证规律清楚，不能让人有多种猜测。星宝想了想，开始认真地排列起砖块来。",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "我设计的规律是\"黄星、紫心、绿叶\"三个一组重复！下一块肯定是黄星，没有别的可能！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-guardian-2",
          "speaker": "guardian",
          "text": "哈哈，设计得真好，答案唯一，不会让人产生歧义！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "获得城墙规律挑战卡",
      "image": {
        "src": "/assets/storybooks/castle-lesson-02/page-10.png",
        "alt": "星宝的城堡图案规律奇遇记第 10 页：获得城墙规律挑战卡",
        "width": 1024,
        "height": 572
      },
      "narration": "守卫满意地点点头，石桌上浮现出一张闪闪发光的《城墙规律挑战卡》，还有\"线索发现徽章\"的第二片碎片。星宝开心地接过，她明白了：找规律要多看几项、分开观察、再用新位置验证，这样发现的规律才可靠。",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "太棒了！我又获得了一片徽章碎片！找规律的方法真有用！",
          "order": 1,
          "displayMode": "bubble"
        }
      ],
      "question": {
        "prompt": "找规律时，只看一两块砖就下结论，对吗？",
        "options": [
          "A. 对，看相邻的两块就够了",
          "B. 不对，规律要能解释前面的好多项才行"
        ],
        "answer": "B. 不对，规律要能解释前面的好多项才行",
        "correctFeedback": "答对啦！规律要能解释多项，还要用新位置验证哦～",
        "incorrectFeedback": "再想想看，只看一两项可能只是碰巧对上呢。"
      }
    }
  ]
});
