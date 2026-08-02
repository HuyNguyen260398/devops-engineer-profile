import type { ClusterBlueprint, ConnectorRoute, GraphBlueprint } from "./blueprint";

const TOPIC = { width: 300, height: 52 } as const;
const SUBTOPIC = { width: 220, height: 44 } as const;
const FRAME_PADDING = 18;

const FRAME_LABELS = {
  "programming-options": "Languages & automation",
  "linux-building-blocks": "Linux building blocks",
  "networking-primitives": "Network protocols & diagnostics",
  "version-control-workflow": "Version control workflow",
  "cloud-platform": "Cloud platform & primitives",
  "container-toolchain": "Container toolchain",
  "kubernetes-building-blocks": "Kubernetes building blocks",
  "infrastructure-as-code": "Provisioning & configuration",
  "delivery-toolchain": "Delivery engines & practices",
  "gitops-reconciliation": "GitOps reconciliation",
  "observability-signals": "Signals & observability tooling",
  "supply-chain-security": "Software supply-chain security",
  "ai-engineering-controls": "AI engineering & review controls",
  "llm-foundations": "LLM foundations for operations",
  "mcp-tooling": "MCP tools & permissions",
  "aiops-operations": "AIOps signals & guardrails",
  "ai-platform": "Model platform & serving",
  "ai-security-governance": "AI security & governance",
  "platform-product": "Platform as a product",
  "reliability-practice": "Reliability engineering practice",
  "cost-engineering": "Cloud cost engineering",
  "resilient-architecture": "Resilient architecture",
  "engineering-leadership": "Technical leadership",
} as const;

type FrameId = keyof typeof FRAME_LABELS;

function cluster(
  stageId: string,
  topicId: string,
  x: number,
  y: number,
  subtopicX: number,
  route: ConnectorRoute,
  frameId?: FrameId,
  columns: 1 | 2 = 2,
): ClusterBlueprint {
  return {
    stageId,
    topicId,
    topic: { x, y, ...TOPIC },
    subtopics: {
      x: subtopicX,
      y: y - TOPIC.height,
      columns,
      columnWidth: SUBTOPIC.width,
      rowHeight: SUBTOPIC.height,
      columnGap: 12,
      rowGap: 10,
    },
    ...(frameId
      ? { frame: { id: frameId, label: FRAME_LABELS[frameId], padding: FRAME_PADDING } }
      : {}),
    route,
  };
}

export const roadmapBlueprint: GraphBlueprint = {
  width: 1440,
  height: 7900,
  root: { x: 570, y: 40, width: 300, height: 68 },
  legend: { x: 40, y: 24, width: 340, height: 138 },
  stages: [
    { stageId: "foundations", x: 40, y: 190, width: 240, height: 42 },
    { stageId: "modern-devops", x: 1160, y: 1710, width: 240, height: 42 },
    { stageId: "ai-layer", x: 40, y: 4060, width: 240, height: 42 },
    { stageId: "senior-impact", x: 1160, y: 6200, width: 240, height: 42 },
  ],
  clusters: [
    cluster("foundations", "programming", 540, 220, 930, "curve", "programming-options"),
    cluster("foundations", "linux", 600, 500, 40, "orthogonal", "linux-building-blocks"),
    cluster("foundations", "networking", 520, 800, 930, "curve", "networking-primitives"),
    cluster("foundations", "git", 580, 1100, 40, "orthogonal", "version-control-workflow"),
    cluster("foundations", "cloud-fundamentals", 550, 1400, 930, "curve", "cloud-platform"),

    cluster("modern-devops", "containers", 620, 1750, 40, "curve", "container-toolchain"),
    cluster(
      "modern-devops",
      "kubernetes",
      530,
      2050,
      930,
      "orthogonal",
      "kubernetes-building-blocks",
    ),
    cluster("modern-devops", "iac", 590, 2370, 40, "curve", "infrastructure-as-code"),
    cluster("modern-devops", "cicd", 560, 2690, 930, "orthogonal", "delivery-toolchain"),
    cluster("modern-devops", "gitops", 610, 3010, 40, "curve", "gitops-reconciliation"),
    cluster("modern-devops", "observability", 540, 3330, 930, "orthogonal", "observability-signals"),
    cluster("modern-devops", "devsecops", 580, 3650, 40, "curve", "supply-chain-security"),

    cluster(
      "ai-layer",
      "ai-assisted-engineering",
      520,
      4100,
      930,
      "curve",
      "ai-engineering-controls",
    ),
    cluster("ai-layer", "llm-fundamentals", 600, 4390, 40, "orthogonal", "llm-foundations"),
    cluster("ai-layer", "mcp", 550, 4680, 930, "curve", "mcp-tooling"),
    cluster("ai-layer", "aiops", 620, 4970, 40, "orthogonal", "aiops-operations"),
    cluster("ai-layer", "llmops", 530, 5260, 930, "curve", "ai-platform"),
    cluster("ai-layer", "ai-security", 590, 5550, 40, "orthogonal", "ai-security-governance"),
    cluster("ai-layer", "ai-limits", 560, 5840, 1020, "curve", undefined, 1),

    cluster("senior-impact", "platform-engineering", 610, 6240, 40, "curve", "platform-product"),
    cluster("senior-impact", "sre", 520, 6540, 930, "orthogonal", "reliability-practice"),
    cluster("senior-impact", "finops", 580, 6840, 40, "curve", "cost-engineering"),
    cluster("senior-impact", "architecture", 550, 7140, 930, "orthogonal", "resilient-architecture"),
    cluster("senior-impact", "leadership", 600, 7440, 40, "curve", "engineering-leadership"),
  ],
};
