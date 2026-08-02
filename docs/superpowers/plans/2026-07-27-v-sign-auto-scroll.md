# V 手势自动滚动实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 两指 V 手势保持后按摄像头画面区域持续、匀速滚动当前页面，不再依赖手部移动距离。

**架构：** `GestureController` 继续负责将手势观测转换为滚动事件；V 手势稳定后，根据标准化纵坐标产生按时间归一化的正负滚动量。`RobotGestureProvider` 沿用现有 `scrollGesturePage`，因此保留当前页面滚动容器选择逻辑。

**技术栈：** TypeScript、React、Vitest。

---

### 任务 1：为 V 手势自动滚动编写失败测试

**文件：**
- 修改：`apps/web/src/components/robot/gesture-controller.test.ts`
- 测试：`apps/web/src/components/robot/gesture-controller.test.ts`

- [ ] **步骤 1：写入固定速度和区域方向的失败测试**

替换现有的“依据手部位移滚动”测试为以下测试。速度使用 `0.5` 个标准化页面单位每秒，便于精确断言。

```ts
it("scrolls upward at a fixed speed while a stable V sign stays in the upper zone", () => {
  const controller = new GestureController({ scrollVelocity: 0.5 });

  expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 0 }))).toEqual([]);
  expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 200 }))).toEqual([]);
  expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 260 }))).toEqual([
    { type: "scroll", deltaY: -0.03 },
  ]);
  expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 360 }))).toEqual([
    { type: "scroll", deltaY: -0.05 },
  ]);
});

it("scrolls downward below the lower zone and pauses in the center zone", () => {
  const controller = new GestureController({ scrollVelocity: 0.5 });

  controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 0 }));
  controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 200 }));
  expect(controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 260 }))).toEqual([
    { type: "scroll", deltaY: 0.03 },
  ]);
  expect(controller.update(observation({ gesture: "v_sign", y: 0.5, timestamp: 320 }))).toEqual([]);
  expect(controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 380 }))).toEqual([
    { type: "scroll", deltaY: 0.03 },
  ]);
});

it("stops V-sign auto scrolling immediately when tracking is lost", () => {
  const controller = new GestureController({ scrollVelocity: 0.5 });

  controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 0 }));
  controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 200 }));
  controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 260 }));
  expect(controller.update(observation({ gesture: "none", confidence: 0.1, timestamp: 320 }))).toEqual([
    { type: "tracking_lost" },
  ]);
  expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 380 }))).toEqual([]);
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```powershell
npm run test --workspace apps/web -- gesture-controller.test.ts
```

预期：测试失败，原因是 `GestureOptions` 尚不支持 `scrollVelocity`，且控制器仍按手部位移产生滚动事件。

### 任务 2：实现按时间归一化的 V 手势自动滚动

**文件：**
- 修改：`apps/web/src/components/robot/gesture-controller.ts:15-190`
- 测试：`apps/web/src/components/robot/gesture-controller.test.ts`

- [ ] **步骤 1：增加滚动速度选项和区域常量**

在 `GestureOptions` 中以 `scrollVelocity?: number` 替代 `scrollMaxDelta?: number`，并定义以下常量：

```ts
const V_SIGN_STABLE_MS = 200;
const V_SIGN_UPPER_ZONE = 0.4;
const V_SIGN_LOWER_ZONE = 0.6;
const DEFAULT_SCROLL_VELOCITY = 0.5;
const MAX_SCROLL_FRAME_MS = 100;
```

构造函数保存受限速度：

```ts
this.scrollVelocity = Math.max(0, options.scrollVelocity ?? DEFAULT_SCROLL_VELOCITY);
```

- [ ] **步骤 2：以时间和区域替换位移计算**

移除 `previousVSignY` 和 `scrollMaxDelta`，增加 `lastVSignTimestamp: number | null`。将
`resetVSign` 改为同时清空稳定开始时间和最后帧时间：

```ts
private resetVSign(): void {
  this.vSignStartedAt = null;
  this.lastVSignTimestamp = null;
}
```

将 `updateVSign` 替换为：

```ts
private updateVSign(point: { x: number; y: number }, timestamp: number, events: GestureEvent[]): GestureEvent[] {
  if (this.vSignStartedAt === null) {
    this.vSignStartedAt = timestamp;
    this.lastVSignTimestamp = timestamp;
    return events;
  }

  const previousTimestamp = this.lastVSignTimestamp ?? timestamp;
  this.lastVSignTimestamp = timestamp;
  if (timestamp - this.vSignStartedAt < V_SIGN_STABLE_MS) return events;

  const elapsedMs = Math.min(MAX_SCROLL_FRAME_MS, Math.max(0, timestamp - previousTimestamp));
  if (elapsedMs === 0 || point.y >= V_SIGN_UPPER_ZONE && point.y <= V_SIGN_LOWER_ZONE) return events;

  const direction = point.y < V_SIGN_UPPER_ZONE ? -1 : 1;
  events.push({ type: "scroll", deltaY: direction * this.scrollVelocity * elapsedMs / 1_000 });
  return events;
}
```

- [ ] **步骤 3：运行控制器测试确认通过**

运行：

```powershell
npm run test --workspace apps/web -- gesture-controller.test.ts
```

预期：`gesture-controller.test.ts` 全部通过；张开手掌、握拳和导航手势断言保持通过。

### 任务 3：验证页面滚动的消费链路

**文件：**
- 验证：`apps/web/src/components/robot/robot-gesture-provider.tsx:60-67,177-179`
- 验证：`apps/web/src/components/robot/robot-gesture-provider.test.tsx`

- [ ] **步骤 1：确认提供器继续将每个 `scroll` 事件交给现有滚动目标**

不改变以下处理逻辑，保证自动滚动仍优先滚动标记了
`data-gesture-scroll-container='true'` 的页面容器：

```ts
if (event.type === "scroll") {
  scrollGesturePage(event.deltaY);
  return;
}
```

- [ ] **步骤 2：运行页面提供器测试**

运行：

```powershell
npm run test --workspace apps/web -- robot-gesture-provider.test.tsx
```

预期：现有的滚动容器选择、物理指针和手势状态测试全部通过。

### 任务 4：在香橙派上验证持续滚动

**文件：**
- 修改：无

- [ ] **步骤 1：启动更新后的生产页面并打开手势面板**

确认 `/_mambo/hand/status` 返回 `status: "running"`，并打开“手势输入”面板。

- [ ] **步骤 2：人工验收**

在摄像头上半区保持 V 手势，确认页面持续向上匀速滚动；在下半区保持 V 手势，确认
页面持续向下匀速滚动；移到中间区域、松开手或让手离开画面时，确认滚动立即停止。
