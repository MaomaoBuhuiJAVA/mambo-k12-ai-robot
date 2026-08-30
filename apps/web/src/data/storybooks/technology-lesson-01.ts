import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const TECHNOLOGY_LESSON_01: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "technology-lesson-01",
  "moduleId": "core-lab",
  "lessonNumber": 1,
  "stage": "lower_primary",
  "title": "星宝核心实验室 数据小卫士",
  "summary": "星宝在核心实验室认识能量晶体，学习制作数据表，记录颜色、形状、亮度和重量，并核对观察数据。",
  "source": {
    "originalFileName": "核心实验室第四绘本.docx",
    "documentSha256": "513C58CCF1CAA4C3240AEFBD82BB76DF8090A01299FED3FCD605C0FF469653C0",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "数据记录",
    "数据表",
    "可见特征",
    "观察对比",
    "数据核对"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "认识能量晶体",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-01.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 1 页：认识能量晶体",
        "width": 1200,
        "height": 900
      },
      "narration": "在科技实验室里，黄色小精灵星宝正好奇看着桌上五颜六色的能量晶体，白色机器人伸出手指，准备给星宝介绍晶体知识。",
      "dialogue": [
        {
          "id": "p01-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "星宝，我们一起来认识这些神奇的能量晶体吧！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p01-starbao-2",
          "speaker": "starbao",
          "text": "哇，好多亮晶晶的晶体，我好想了解它们！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "制作数据表",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-02.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 2 页：制作数据表",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝高高举起一块木牌子，牌子上面写着能量晶体数据表，一旁的机器人低头思考，想要整理晶体的信息。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "我们做一张数据表，把晶体的特点都记录下来好不好？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "好主意！有表格，就能看清每一种晶体的小特点。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "思考填写内容",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-03.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 3 页：思考填写内容",
        "width": 1200,
        "height": 900
      },
      "narration": "实验室的空中出现一块空白的蓝色电子表格，机器人伸手指向表格，星宝托着下巴认真思考，准备填写内容。",
      "dialogue": [
        {
          "id": "p03-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "表格可以记录颜色、形状这些信息，我们该填哪些内容呢？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-starbao-2",
          "speaker": "starbao",
          "text": "我想一想，要把晶体看得见摸得到的特点写进去！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "填好第一组数据",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-04.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 4 页：填好第一组数据",
        "width": 1200,
        "height": 900
      },
      "narration": "电子表格里已经填好了第一组数据，写着晶体的颜色、形状、亮度、重量，星宝开心伸手指向表格，机器人在对面讲解。",
      "dialogue": [
        {
          "id": "p04-starbao-1",
          "speaker": "starbao",
          "text": "你看！第一种晶体是蓝色，梭角形，很亮，重 30 克！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "没错，我们把观察到的信息，一条一条写进表格。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "对比不同晶体",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-05.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 5 页：对比不同晶体",
        "width": 1200,
        "height": 900
      },
      "narration": "表格里增加了两行晶体资料，机器人伸出手指，给星宝对比两种不一样晶体的特点。",
      "dialogue": [
        {
          "id": "p05-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "你看，不同的晶体，颜色、重量都不一样哦。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-starbao-2",
          "speaker": "starbao",
          "text": "原来它们看着很像，细节上却有这么多区别！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "用重量分辨晶体",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-06.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 6 页：用重量分辨晶体",
        "width": 1200,
        "height": 900
      },
      "narration": "桌面上摆放着好几块蓝色晶体，屏幕上高亮标出 \"30 克\" 和天平图标，机器人教星宝用重量来分辨晶体。",
      "dialogue": [
        {
          "id": "p06-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "除了看外表，我们还可以称重，来区分晶体。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-starbao-2",
          "speaker": "starbao",
          "text": "对！光看模样不够，还要测一测重量。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "仔细观察晶体",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-07.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 7 页：仔细观察晶体",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝拿起一块晶体，眯起眼睛，拿着虚拟放大镜仔细观察晶体，机器人站在身后看着星宝。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "我要仔细看一看，这块晶体到底有什么特征！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "观察的时候，要多多留意小细节，不要只看表面。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 8,
      "title": "核对表格信息",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-08.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 8 页：核对表格信息",
        "width": 1200,
        "height": 900
      },
      "narration": "电子表格上面打好了对勾，代表一组信息核对完成，星宝指着表格，机器人露出开心的表情。",
      "dialogue": [
        {
          "id": "p08-starbao-1",
          "speaker": "starbao",
          "text": "太好了！这一组晶体的信息我们核对完成啦！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "多条信息互相对照，才不容易判断出错。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "数据表整理完毕",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-09.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 9 页：数据表整理完毕",
        "width": 1200,
        "height": 900
      },
      "narration": "完整的数据表展示在空中，四周出现很多绿色对勾，星宝高兴举起双手，机器人竖起大拇指表示肯定。",
      "dialogue": [
        {
          "id": "p09-starbao-1",
          "speaker": "starbao",
          "text": "全部晶体的信息，我们都整理完毕！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "太棒啦！多方面收集信息，就能把事物了解清楚。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "观察任务圆满结束",
      "image": {
        "src": "/assets/storybooks/technology-lesson-01/page-10.jpeg",
        "alt": "星宝核心实验室 数据小卫士第 10 页：观察任务圆满结束",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝高高举好完整的能量晶体数据表，空中飘起彩色小碎片，机器人双手鼓掌，本次观察任务圆满结束。",
      "dialogue": [
        {
          "id": "p10-starbao-1",
          "speaker": "starbao",
          "text": "有了数据表，我们就能轻松看懂每一块晶体！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p10-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "学会记录和整理信息，会帮我们解决很多问题。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
