import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";

export const TECHNOLOGY_LESSON_02: ImportedStorybookManifest = importedStorybookManifestSchema.parse({
  "schemaVersion": 1,
  "id": "technology-lesson-02",
  "moduleId": "core-lab",
  "lessonNumber": 2,
  "stage": "lower_primary",
  "title": "星宝核心实验室 分类小卫士",
  "summary": "星宝在核心实验室按照颜色和形状给能量水晶分组，学习寻找共同特征并用不同规则进行分类。",
  "source": {
    "originalFileName": "核心实验室第五绘本.docx",
    "documentSha256": "E5AC2C2A6D2251931498863A356CE57C36F46379BABD357142799DE86FBB2BFA",
    "contentVersion": "2026-08-24"
  },
  "knowledgePointIds": [
    "分类",
    "共同特征",
    "颜色分类",
    "形状分类",
    "多种分类规则"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "title": "开启水晶研究",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-01.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 1 页：开启水晶研究",
        "width": 1200,
        "height": 900
      },
      "narration": "实验室里的桌子上摆满五颜六色的能量水晶，星宝和机器人准备开启水晶研究，身后的屏幕显示着能量晶体数据表。",
      "dialogue": [
        {
          "id": "p01-starbao-1",
          "speaker": "starbao",
          "text": "哇，好多漂亮的水晶呀！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p01-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "我们一起来研究这些能量水晶吧。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "该怎么整理水晶",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-02.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 2 页：该怎么整理水晶",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝看着桌上三颗不一样的水晶，脑袋冒出大大的问号，机器人伸手指着水晶，准备提出问题。",
      "dialogue": [
        {
          "id": "p02-starbao-1",
          "speaker": "starbao",
          "text": "这些水晶看起来各不相同，我们该怎么整理它们呢？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p02-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "想一想，你可以用什么办法给水晶分一分？",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 3,
      "title": "按颜色来分组",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-03.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 3 页：按颜色来分组",
        "width": 1200,
        "height": 900
      },
      "narration": "桌上摆放蓝、紫、黄三种颜色的水晶，旁边飘着纸张，星宝和机器人想到第一个办法：按照水晶的颜色来分组。",
      "dialogue": [
        {
          "id": "p03-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "有啦！我们可以根据颜色，把一样颜色的水晶放在一起。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p03-starbao-2",
          "speaker": "starbao",
          "text": "这个办法听起来很简单！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 4,
      "title": "两种分类方式对比",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-04.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 4 页：两种分类方式对比",
        "width": 1200,
        "height": 900
      },
      "narration": "画面分成左右两半，左边是按颜色分组的水晶，右边是按形状分组的水晶，星宝和机器人站在中间，对比两种分类方式。",
      "dialogue": [
        {
          "id": "p04-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "除了颜色，我们还能看水晶的外形，按照形状来分组。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p04-starbao-2",
          "speaker": "starbao",
          "text": "原来同一个东西，可以用好几种方法分类！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 5,
      "title": "外表相同真的相同吗",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-05.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 5 页：外表相同真的相同吗",
        "width": 1200,
        "height": 900
      },
      "narration": "桌子上摆着两堆看起来一模一样的蓝色水晶，星宝满脸疑惑，头上冒出问号，分不清两组水晶的差别。",
      "dialogue": [
        {
          "id": "p05-starbao-1",
          "speaker": "starbao",
          "text": "咦？这两堆都是蓝色水晶，外表看着一样，它们完全相同吗？",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p05-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "光看外表可不够，我们要仔细检查内部。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 6,
      "title": "光照发现内部差异",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-06.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 6 页：光照发现内部差异",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝拿起一块蓝色水晶，灯光照射在水晶上，照出水晶里面藏着不一样的物质，机器人在一旁安静观察。",
      "dialogue": [
        {
          "id": "p06-starbao-1",
          "speaker": "starbao",
          "text": "光照过来啦！快看，水晶里面还有不一样的东西！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p06-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "没错，不能只看外表，还要观察内部细节。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 7,
      "title": "按颜色分类完成",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-07.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 7 页：按颜色分类完成",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝把蓝色水晶放进蓝色收纳盒，紫色、黄色水晶也分别放进对应颜色的盒子，完成按颜色分类。",
      "dialogue": [
        {
          "id": "p07-starbao-1",
          "speaker": "starbao",
          "text": "蓝色放蓝色盒子，紫色放紫色盒子，黄色放黄色盒子！",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p07-ai_sprite-2",
          "speaker": "ai_sprite",
          "text": "太棒了，按颜色的分类完成咯。",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 8,
      "title": "按形状分类",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-08.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 8 页：按形状分类",
        "width": 1200,
        "height": 900
      },
      "narration": "桌面被分成两块，左边摆放棱角尖尖的水晶，右边摆放圆圆的水晶，分别贴上棱角形、圆弧形的标签。",
      "dialogue": [
        {
          "id": "p08-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "接下来，我们试试按照形状来分类。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p08-starbao-2",
          "speaker": "starbao",
          "text": "尖尖的放一边，圆圆的放另一边！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 9,
      "title": "总结分类规则",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-09.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 9 页：总结分类规则",
        "width": 1200,
        "height": 900
      },
      "narration": "星宝和机器人身前摆放两块大大的提示板，一块写着按颜色分类，一块写着按形状分类，总结两种分类规则。",
      "dialogue": [
        {
          "id": "p09-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "分类有小诀窍，找相同的特点，就可以归为一类。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p09-starbao-2",
          "speaker": "starbao",
          "text": "既可以看颜色，也可以看形状！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    },
    {
      "pageNumber": 10,
      "title": "学会分类小知识",
      "image": {
        "src": "/assets/storybooks/technology-lesson-02/page-10.jpeg",
        "alt": "星宝核心实验室 分类小卫士第 10 页：学会分类小知识",
        "width": 1200,
        "height": 900
      },
      "narration": "实验室飘起彩色的礼花，两块展板展示更多颜色、形状的分类例子，星宝和机器人开心地站在一起，学会分类小知识。",
      "dialogue": [
        {
          "id": "p10-ai_sprite-1",
          "speaker": "ai_sprite",
          "text": "生活里很多东西，都能用分类的方法整理。",
          "order": 1,
          "displayMode": "bubble"
        },
        {
          "id": "p10-starbao-2",
          "speaker": "starbao",
          "text": "学会分类，整理东西就变简单啦！",
          "order": 2,
          "displayMode": "bubble"
        }
      ]
    }
  ]
});
