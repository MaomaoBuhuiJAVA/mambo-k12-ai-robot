import type { Stage } from "@/lib/domain";
import type { LabTemplateId } from "./lab-protocol";

export interface LabTemplate {
  id: LabTemplateId;
  label: string;
  title: string;
  task: string;
  hints: readonly string[];
  starterCode: string;
  knowledgePointId: string;
  challengeVersion: number;
  dataFormats?: readonly ("json" | "csv")[];
  datasetVersions?: Readonly<Partial<Record<"json" | "csv", string>>>;
}

export const H01_DATASET_VERSIONS = Object.freeze({
  json: "scores-json-v1",
  csv: "scores-csv-v1",
});

export const H06_MULTIMODAL_DATASET_VERSION = "multimodal-samples-v2";
export const H06_MULTIMODAL_INPUT_VERSION = "vision-inputs-v2";
export const H06_MODALITY_ORDER = Object.freeze([
  "text",
  "image",
  "structured",
  "combined",
] as const);

export const LAB_TEMPLATES: Record<LabTemplateId, LabTemplate> = {
  "bubble-sort": {
    id: "bubble-sort",
    label: "冒泡排序",
    title: "让相邻数字排好队",
    task: "补全 bubble_sort：返回从小到大排列的新列表，不修改输入列表。",
    hints: [
      "外层循环决定还要完成几轮比较。",
      "只比较相邻的 values[index] 和 values[index + 1]。",
      "左边更大时交换；一轮没有交换就可以提前结束。",
    ],
    starterCode: `def bubble_sort(values):
    result = values[:]
    # TODO: 在这里完成冒泡排序
    return result


print(bubble_sort([5, 1, 4, 2, 8]))`,
    knowledgePointId: "algorithm.bubble-sort",
    challengeVersion: 1,
  },
  "image-classifier": {
    id: "image-classifier",
    label: "图像分类",
    title: "用特征分数选择标签",
    task: "补全 classify_image：根据颜色、形状和纹理分数返回 leaf、ball 或 cup。",
    hints: [
      "先为三个标签建立从 0 开始的分数。",
      "green 对 leaf 加分，round 对 ball 加分，handle 对 cup 加分。",
      "用 max(scores, key=scores.get) 找到分数最高的标签。",
    ],
    starterCode: `def classify_image(features):
    scores = {"leaf": 0, "ball": 0, "cup": 0}
    # TODO: 根据 features 中的 color、shape、texture 更新分数
    return max(scores, key=scores.get)


sample = {"color": "green", "shape": "long", "texture": "veined"}
print(classify_image(sample))`,
    knowledgePointId: "ai.image-classification-features",
    challengeVersion: 1,
  },
  "middle-python-basics": {
    id: "middle-python-basics",
    label: "Python 编程入门",
    title: "筛选准备完成的器材",
    task: "补全 choose_ready_tools：返回 ready 为 True 的器材名称组成的新列表，不能修改原始器材记录。",
    hints: [
      "先创建一个空列表，用来保存筛选结果。",
      "用 for 逐个读取 tools 中的 tool，再检查 tool[\"ready\"]。",
      "条件成立时把 tool[\"name\"] 追加到结果，循环结束后 return 结果。",
    ],
    starterCode: `def choose_ready_tools(tools):
    ready_names = []
    # tools 的每项都是 {"name": string, "ready": bool}
    for tool in tools:
        # TODO: 只保留准备完成的器材名称
        pass
    return ready_names


print(choose_ready_tools([
    {"name": "sensor", "ready": True},
    {"name": "wire", "ready": False},
]))`,
    knowledgePointId: "middle.python-basics",
    challengeVersion: 1,
  },
  "python-data-basics": {
    id: "python-data-basics",
    label: "Python 数据基础",
    title: "读取、清洗与汇总 CSV / JSON",
    task: "补全 summarize_scores：分别解析固定 JSON 和 CSV，跳过 score 缺失的记录，返回总记录数、有效记录数、缺失数、均值和最大值，并准备有效/缺失柱状图数据。",
    hints: [
      "JSON 用 json.loads 还原记录列表，CSV 用 csv.DictReader 读取表头和行。",
      "score 为 None 或空字符串时按课程规则记为缺失，不要把它当作 0。",
      "统计前保留数据集版本和清洗规则；空数据也要返回结构完整的结果。",
      "图表只使用已经核对的 validRowCount 和 missingCount，不要从图表反推统计值。",
      "缺少 score 表头、JSON 无法解析或传入不支持的格式时要明确抛出错误，不要静默返回一个看似有效的结果。",
    ],
    starterCode: `import csv\nimport json\n\nDATASET_VERSIONS = {"json": "scores-json-v1", "csv": "scores-csv-v1"}\nJSON_DATA = '[{"score": "2"}, {"score": null}, {"score": "4"}, {"score": "6"}]'\nCSV_DATA = "score\\n2\\n\\"\\"\\n4\\n6\\n"\n\ndef summarize_scores(raw_data, input_format="json"):\n    # raw_data: JSON 文本或带 score 表头的 CSV 文本\n    # TODO: 解析、记录缺失值，再计算可复核统计量\n    pass\n\ndef prepare_chart_data(summary):\n    # 只把已经核对的统计结果转换成简单图表数据\n    return {"labels": ["有效", "缺失"], "values": [summary["validRowCount"], summary["missingCount"]]}\n\nprint("JSON", summarize_scores(JSON_DATA, "json"))\nprint("CSV", summarize_scores(CSV_DATA, "csv"))`,
    knowledgePointId: "high.python-data-basics",
    challengeVersion: 3,
    dataFormats: ["json", "csv"],
    datasetVersions: H01_DATASET_VERSIONS,
  },
  "bubble-sort-analysis": { id: "bubble-sort-analysis", label: "排序实验分析", title: "记录比较次数", task: "补全 count_comparisons，返回冒泡排序标准双层循环的比较次数。", hints: ["每次相邻比较才计数。", "外层 end 从 n - 1 递减。", "不需要真正交换数据。"], starterCode: `def count_comparisons(values):\n    # TODO\n    pass\n\nprint(count_comparisons([3, 1, 2]))`, knowledgePointId: "high.bubble-sort-analysis", challengeVersion: 1 },
  "dataset-split": { id: "dataset-split", label: "数据切分与基线", title: "冻结切分、建立基线并审计泄漏", task: "补全 build_pipeline：按 index % 5 固定切分记录，用指定来源形成基线预测，只允许 train 参与基线选择，并返回测试集预测、准确率和泄漏标记。", hints: ["不要随机打乱；index % 5 为 0、1、2 的记录进入 train，3 进入 validation，4 进入 test。", "baseline_source 为 train 时只能从训练集统计多数类；validation/test 不能参与选择。", "返回 baseline_predictions、baseline_accuracy 和 leakage_detected；baseline_source 不是 train 时应明确标记泄漏。"], starterCode: "def build_pipeline(rows, baseline_source=\"train\"):\n    # rows: [{\"label\": \"cat\"}, ...]\n    # baseline_source: 记录基线选择使用的切分，教学审计只允许 train\n    # TODO: 固定切分、训练集多数类基线、测试集核对\n    pass\n\nprint(build_pipeline([\n    {\"label\": \"cat\"}, {\"label\": \"cat\"}, {\"label\": \"dog\"}, {\"label\": \"cat\"}, {\"label\": \"dog\"},\n    {\"label\": \"cat\"}, {\"label\": \"cat\"}, {\"label\": \"dog\"}, {\"label\": \"dog\"}, {\"label\": \"cat\"},\n]))", knowledgePointId: "high.dataset-split", challengeVersion: 3 },
  "classification-metrics": { id: "classification-metrics", label: "分类/回归指标", title: "比较指标与错误代价", task: "补全 evaluate_metrics：统计混淆矩阵，计算二分类的 accuracy、precision、recall、F1 和多组回归样本的 MSE，并按漏检或误报代价选择指标。", hints: ["先统计 tp、fp、fn、tn，并在返回值的 confusion_matrix 中保留四个计数；任一分母为 0 时对应指标确定为 0。", "F1 是 precision 与 recall 的调和平均；precision、recall、F1 都要在没有正例或没有正预测时保持可解释的 0。", "连续数值任务使用所有 regression_rows 计算 MSE，并返回 regression_sample_count；漏检代价高选 recall，误报代价高选 precision。"], starterCode: `def evaluate_metrics(classification_rows, regression_rows, error_cost):\n    # classification_rows: [(actual, predicted), ...]\n    # regression_rows: [(actual_value, predicted_value), ...]\n    # 返回 classification、regression、error_cost 和 selected_metric；\n    # classification 还要包含 confusion_matrix，regression 要包含 regression_sample_count。\n    pass\n\nprint(evaluate_metrics(\n    [(True, True), (False, True), (True, False), (False, False)],\n    [(3.0, 2.0), (5.0, 4.0), (10.0, 7.0), (0.0, 0.0)],\n    "miss",\n))`, knowledgePointId: "high.classification-metrics", challengeVersion: 3 },
  "gradient-descent-demo": { id: "gradient-descent-demo", label: "训练曲线审计", title: "比较多轮训练与验证表现", task: "补全 analyze_training_curve：记录至少五轮训练/验证损失、步数、样本数、学习率和参数集版本，找出最佳验证损失并确定性判断过拟合。", hints: ["训练曲线和验证曲线必须等长且至少包含五轮；每个点都要原样保留，steps 等于曲线长度。", "返回 learning_rate、parameter_set_id、sample_count、train_curve 和 validation_curve，保证别人能按同一参数复现。", "best_validation_loss 取验证曲线最小值并记录 best_step；训练损失下降且最后验证损失高于最佳值时才标记 overfit_detected=True。"], starterCode: `def analyze_training_curve(train_losses, validation_losses, learning_rate, parameter_set_id="weights-init-v1", sample_count=8):\n    # 返回 steps、sample_count、learning_rate、parameter_set_id、两条曲线、\n    # final/best loss、best_step 和 overfit_detected。曲线长度不一致、为空或少于五轮时应抛出 ValueError。\n    pass\n\nprint(analyze_training_curve(\n    [0.95, 0.7, 0.45, 0.2, 0.1],\n    [1.0, 0.65, 0.4, 0.45, 0.55],\n    0.1,\n    "weights-init-v1",\n    8,\n))`, knowledgePointId: "high.gradient-descent", challengeVersion: 3 },
  "multimodal-input-audit": { id: "multimodal-input-audit", label: "多模态对照", title: "复现四种输入的对照结果", task: "补全 compare_modalities：在固定数据集和输入版本上，比较文本、图像、结构化和组合输入，保留失败样本以及未授权/受限输入边界。", hints: ["先校验 dataset_version=multimodal-samples-v2 和 input_version=vision-inputs-v2，并拒绝重复的 sample_id + modality。", "只有 available 且 authorized 的输入才计入 available/correct；不可用、未授权的样本要分别保留，不能删除。", "按 text、image、structured、combined 分组，计算准确率和失败样本；报告还要包含数据来源、授权策略和隐私边界。"], starterCode: `MULTIMODAL_DATASET_VERSION = "multimodal-samples-v2"\nMULTIMODAL_INPUT_VERSION = "vision-inputs-v2"\nMODALITIES = ["text", "image", "structured", "combined"]\n\ndef compare_modalities(rows, dataset_version, input_version):\n    # rows: 每行包含 sample_id、modality、available、correct、source_id、authorized、privacy_boundary\n    # 返回固定版本、四种模态的 available/correct/accuracy/failed_samples，\n    # 以及 source、未授权样本和受限隐私边界。\n    # TODO\n    pass\n\nprint(compare_modalities([\n    {"sample_id": "s1", "modality": "text", "available": True, "correct": True, "source_id": "text-s1-v2", "authorized": True, "privacy_boundary": "public"},\n], MULTIMODAL_DATASET_VERSION, MULTIMODAL_INPUT_VERSION))`, knowledgePointId: "high.multimodal-input", challengeVersion: 2 },
  "rag-citation-check": { id: "rag-citation-check", label: "RAG 检索对照", title: "复现无检索/固定知识库回答", task: "补全 compare_retrieval：在固定知识库和查询版本上比较无检索与有检索回答，核对引用匹配、未支持主张、失败回答和工具权限。", hints: ["先校验 knowledge_base_version= fixed-kb-v2、query_version=rag-query-v2 以及固定来源 [课程手册, 审核片段]；版本或来源范围不匹配时拒绝。", "分别对 claims、supported_claims 和 citations 做确定性核对：没有来源或未被支持的主张必须进入 unsupported_claims，未知引用进入 unmatched_citations，不能删除。", "只允许 fixed_retrieval；web_search、code_execution 等请求全部记录为 blocked。保留无检索与有检索两种回答的失败证据，不能只返回匹配数量。"], starterCode: `KNOWLEDGE_BASE_VERSION = "fixed-kb-v2"\nQUERY_VERSION = "rag-query-v2"\nALLOWED_SOURCES = ["课程手册", "审核片段"]\nALLOWED_TOOLS = ["fixed_retrieval"]\n\ndef compare_retrieval(without_retrieval, with_retrieval, knowledge_base_version, query_version, allowed_sources, requested_tools):\n    # 每个回答包含 claims、supported_claims、citations 三个列表。\n    # 返回无检索/有检索状态、matched/unmatched 引用、unsupported_claims、版本和工具权限证据。\n    # TODO\n    pass\n\nprint(compare_retrieval(\n    {"claims": ["实验室周末免费开放"], "supported_claims": [], "citations": []},\n    {"claims": ["课程手册说明工作日开放", "实验室周末免费开放"], "supported_claims": ["课程手册说明工作日开放"], "citations": ["课程手册", "未知网页"]},\n    KNOWLEDGE_BASE_VERSION, QUERY_VERSION, ALLOWED_SOURCES, ["web_search", "code_execution"],\n))`, knowledgePointId: "high.rag-citation-check", challengeVersion: 3 },
  "model-audit": { id: "model-audit", label: "模型审计", title: "按分组统计错误", task: "补全 audit_groups，返回每个组的 correct 和 total。", hints: ["输入每行包含 group、actual、predicted。", "每组单独累计。", "不要只返回总体准确率。"], starterCode: `def audit_groups(rows):\n    # TODO\n    pass\n\nprint(audit_groups([{"group":"A","actual":"cat","predicted":"cat"}]))`, knowledgePointId: "high.model-audit", challengeVersion: 1 },
};

export const DEFAULT_LAB_TEMPLATE_ID: LabTemplateId = "bubble-sort";

export function getLabTemplate(id: LabTemplateId): LabTemplate {
  const template = LAB_TEMPLATES[id];
  if (id === "rag-citation-check" && !template.starterCode.includes("unsupported_claims")) {
    return {
      ...template,
      starterCode: `${template.starterCode}\n# unsupported_claims must preserve every claim without a verified source.`,
    };
  }
  return template;
}

export function getLabGuidance(
  id: LabTemplateId,
  stage: Stage,
): Pick<LabTemplate, "task" | "hints"> {
  const template = getLabTemplate(id);
  if (stage === "lower_primary") {
    return id === "bubble-sort"
      ? {
          task: "帮助数字卡从小到大排队。每次只比较两个邻居，原来的数字卡要保留。",
          hints: [
            "先让第一张卡和第二张卡比大小。",
            "左边数字更大，就让两张卡交换位置。",
            "一轮结束后再从队头出发，直到整队都不需要交换。",
          ],
        }
      : {
          task: "给叶子、球和杯子分别计分，再选出分数最高的图片标签。",
          hints: [
            "绿色和叶脉是叶子的线索。",
            "圆形和条纹是球的线索，有把手是杯子的线索。",
            "每找到一条线索就给对应标签加分，最后选最高分。",
          ],
        };
  }
  if (stage === "upper_primary") {
    return id === "bubble-sort"
      ? {
          task: "补全相邻比较和交换，让函数返回有序的新列表。",
          hints: template.hints,
        }
      : {
          task: "把颜色、形状和纹理转成标签分数，返回最高分标签。",
          hints: template.hints,
        };
  }
  if (stage === "middle_school") {
    if (id === "middle-python-basics") {
      return {
        task: "用变量、条件、循环和函数筛选准备完成的器材，并用空列表和混合状态核对结果。",
        hints: [
          "结果列表从 [] 开始，不要直接改动 tools。",
          "每轮循环只处理一件器材，再用 if 判断 ready。",
          "测试时同时检查空列表、全部未完成和混合状态。",
        ],
      };
    }
    return id === "bubble-sort"
      ? {
          task: "实现 bubble_sort，并用 swapped 标记在已有序时提前结束。",
          hints: [
            "外层循环逐步缩小尚未确定的区间。",
            "内层循环比较 index 与 index + 1。",
            "本轮未交换说明列表已有序，可以 break。",
          ],
        }
      : {
          task: "设计可解释的特征计分规则，让三个测试样本得到正确标签。",
          hints: template.hints,
        };
  }
  if (id === "python-data-basics") {
    return {
      task: template.task,
      hints: template.hints,
    };
  }
  if (id === "multimodal-input-audit") {
    return {
      task: "固定数据集与输入版本，比较文本、图像、结构化和组合输入，并保留失败、未授权与受限样本。",
      hints: [
        "先校验 multimodal-samples-v2 与 vision-inputs-v2，再按 sample_id + modality 去重。",
        "只有 available 且 authorized 为 True 的输入才计入指标；不可用和未授权输入仍要留在边界摘要中。",
        "报告要同时写出四种模态的准确率、失败样本、source_id、授权策略和隐私边界。",
      ],
    };
  }
  if (id === "rag-citation-check") {
    return {
      task: "在 fixed-kb-v2/rag-query-v2 上比较无检索与固定知识库回答，保留引用匹配、失败主张和工具权限证据。",
      hints: [
        "先校验固定版本和 [课程手册, 审核片段] 白名单，版本或来源范围变化时拒绝。",
        "claims 中没有出现在 supported_claims 的主张进入 unsupported_claims；无检索回答的失败主张也要保留。",
        "只允许 fixed_retrieval，web_search/code_execution 等请求全部进入 blocked_tools。",
      ],
    };
  }
  return id === "bubble-sort"
    ? {
        task: "实现不修改输入的 bubble_sort，并加入提前退出以改善已有序输入。",
        hints: [
          "用循环不变量描述每轮结束后已经确定的后缀。",
          "内层比较范围应随 end 递减，避免重复检查确定区间。",
          "用 swapped 证明何时可以安全提前退出。",
        ],
      }
    : {
        task: "实现可审计的特征打分分类器，并说明平分时规则的确定性。",
        hints: [
          "把特征到类别权重的映射集中表达，便于审计。",
          "确保每个测试样本至少有一个区分度足够的强特征。",
          "检查 max 在分数相同时依赖的插入顺序是否符合既定策略。",
        ],
      };
}
