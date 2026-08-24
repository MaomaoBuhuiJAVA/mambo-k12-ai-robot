export type StorybookImportStatus = "ready" | "pending" | "review_required";

export interface StorybookSourceRecord {
  readonly contentId: string;
  readonly originalFileName: string;
  readonly documentSha256: string;
  readonly pageCount: number;
  readonly imageCount: number;
  readonly status: StorybookImportStatus;
  readonly notes?: string;
  readonly supersedes?: readonly {
    originalFileName: string;
    documentSha256: string;
  }[];
}

export const STORYBOOK_SOURCE_REGISTRY: readonly StorybookSourceRecord[] = [
  {
    contentId: "castle-lesson-01",
    originalFileName: "城堡第一绘本.docx",
    documentSha256: "E645A86E42F10DA63C2A80899BE0663DD02677E4864CF41D7A232E67525DB8DE",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
  {
    contentId: "lava-lesson-01",
    originalFileName: "熔岩第一绘本.docx",
    documentSha256: "0331C4DD9514A3605D95E462E9D0E5BFDEA36A800EF71D666B37E40F14A01951",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
  {
    contentId: "lava-lesson-02",
    originalFileName: "熔岩第二绘本.docx",
    documentSha256: "DAAE578777231F18A2DC3F136C01EDDB4D52E2A80BB07E8BBA93D7330D63D287",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
    notes: "第 5 页含选项和答案，但源文档没有明确题干；该页互动题保持禁用。",
  },
  {
    contentId: "lava-lesson-03",
    originalFileName: "熔岩第三绘本(1).docx",
    documentSha256: "805D1A15E176485D51D83236E5828429A9C98E5FEB55627818A5F17616109B75",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
    supersedes: [{
      originalFileName: "熔岩第三绘本.docx",
      documentSha256: "17B410734E66DB9D6F28B87BF518D72FFC72982C32E739097E7E5BEF9C7DC2DD",
    }],
  },
  {
    contentId: "forest-lesson-01",
    originalFileName: "第7课时绘本无拼音.docx",
    documentSha256: "20ABF52F8279F12BD6C736FC611A10606B2B9B3749E9C0102FB91BA6C6434B44",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
  {
    contentId: "forest-lesson-02",
    originalFileName: "第8课时绘本无拼音.docx",
    documentSha256: "8898C1D989F448097EB6B7EC326801BF1D5C7C1152D607D99D287A38594473AE",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
  {
    contentId: "forest-lesson-03",
    originalFileName: "第9课时绘本无拼音.docx",
    documentSha256: "B1CE587EE1807C33B455C912268924BE9EE5A98A042E85FA4291CD7D6FD30D49",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
  {
    contentId: "desert-lesson-07",
    originalFileName: "第7课时_线索和证据一样吗.docx",
    documentSha256: "A8AAC1D82F6F111EA98A0A2E6C2B1E1B335272A9AB70DE284DF988DD9DC3BC22",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
  {
    contentId: "desert-lesson-08",
    originalFileName: "第8课时_哪条证据更可靠.docx",
    documentSha256: "1C6BE53B71D201EEDA74F72FB8705F1C322D02064E3B985DE69535864D52B333",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
  {
    contentId: "desert-lesson-09",
    originalFileName: "第9课时_证据不够时怎样判断.docx",
    documentSha256: "731D5B94B98B003EA7934BB5830F3B32FDFC06426E4BD2497DA4E294096496B6",
    pageCount: 10,
    imageCount: 10,
    status: "ready",
  },
] as const;

export function getStorybookSource(contentId: string): StorybookSourceRecord | undefined {
  return STORYBOOK_SOURCE_REGISTRY.find((source) => source.contentId === contentId);
}
