import type { RoadmapNode, RoadmapStage } from "@/types/roadmap";

/**
 * Geometry for the roadmap.sh-style flowchart.
 *
 * The canvas is a fixed-size coordinate space: every box gets an absolute
 * x/y/width/height and every connector an SVG path in the same space. The
 * viewport scales the whole thing to fit, exactly like roadmap.sh does, so the
 * layout maths never has to know the real viewport width.
 *
 * Stages sit on the central spine as the big yellow topic boxes; their nodes
 * branch off to alternating sides as subtopics.
 */

const CANVAS_WIDTH = 1120;
const CANVAS_PADDING_BOTTOM = 72;

const TITLE = { width: 320, height: 74 } as const;
const LEGEND = { width: 336, height: 138 } as const;
const TOPIC = { width: 340, height: 66 } as const;
const SUBTOPIC = { width: 282, height: 46 } as const;

/** Gap between stacked subtopics inside one column. */
const SUBTOPIC_GAP = 12;
/** Horizontal gap between the topic box edge and its subtopic column. */
const BRANCH_GAP = 76;
/** Vertical gap between two stage blocks. */
const STAGE_GAP = 78;
/** Vertical gap between the header row and the first stage. */
const HEADER_GAP = 72;
/** Corner radius on the elbow connectors. */
const ELBOW_RADIUS = 16;

export type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutTopic = LayoutBox & {
  stage: RoadmapStage;
};

export type LayoutSubtopic = LayoutBox & {
  node: RoadmapNode;
  stageId: string;
  /** Which side of the spine the column sits on. */
  side: "left" | "right";
};

export type LayoutEdge = {
  id: string;
  d: string;
  kind: "spine" | "branch";
};

export type RoadmapLayout = {
  width: number;
  height: number;
  title: LayoutBox;
  legend: LayoutBox;
  topics: readonly LayoutTopic[];
  subtopics: readonly LayoutSubtopic[];
  edges: readonly LayoutEdge[];
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * A two-corner elbow from (sx, sy) to (ex, ey): out horizontally, down the
 * midline, then back out horizontally. Corners are rounded so the connectors
 * read as drawn rather than as a bar chart.
 */
export function elbowPath(sx: number, sy: number, ex: number, ey: number): string {
  const midX = round((sx + ex) / 2);
  const rise = ey - sy;

  if (Math.abs(rise) < 1) return `M ${round(sx)} ${round(sy)} L ${round(ex)} ${round(ey)}`;

  const hx = Math.sign(ex - sx) || 1;
  const vy = Math.sign(rise);
  const radius = Math.min(ELBOW_RADIUS, Math.abs(midX - sx), Math.abs(rise) / 2);

  return [
    `M ${round(sx)} ${round(sy)}`,
    `L ${round(midX - hx * radius)} ${round(sy)}`,
    `Q ${midX} ${round(sy)} ${midX} ${round(sy + vy * radius)}`,
    `L ${midX} ${round(ey - vy * radius)}`,
    `Q ${midX} ${round(ey)} ${round(midX + hx * radius)} ${round(ey)}`,
    `L ${round(ex)} ${round(ey)}`,
  ].join(" ");
}

export function buildRoadmapLayout(stages: readonly RoadmapStage[]): RoadmapLayout {
  const spineX = CANVAS_WIDTH / 2;

  const legend: LayoutBox = { x: 24, y: 0, ...LEGEND };
  const title: LayoutBox = {
    x: round(spineX - TITLE.width / 2),
    y: round((LEGEND.height - TITLE.height) / 2),
    ...TITLE,
  };

  const topics: LayoutTopic[] = [];
  const subtopics: LayoutSubtopic[] = [];
  const edges: LayoutEdge[] = [];

  let cursor = Math.max(legend.y + legend.height, title.y + title.height) + HEADER_GAP;
  // The spine starts at the bottom of the title box and hops from one topic to
  // the next.
  let spineFrom = title.y + title.height;

  stages.forEach((stage, index) => {
    const side = index % 2 === 0 ? "right" : "left";
    const count = stage.nodes.length;
    const columnHeight =
      count === 0 ? 0 : count * SUBTOPIC.height + (count - 1) * SUBTOPIC_GAP;
    const blockHeight = Math.max(TOPIC.height, columnHeight);

    const topicY = round(cursor + (blockHeight - TOPIC.height) / 2);
    const topicX = round(spineX - TOPIC.width / 2);
    topics.push({ stage, x: topicX, y: topicY, ...TOPIC });

    edges.push({
      id: `spine-${stage.id}`,
      kind: "spine",
      d: `M ${spineX} ${round(spineFrom)} L ${spineX} ${topicY}`,
    });
    spineFrom = topicY + TOPIC.height;

    const columnX =
      side === "right"
        ? round(topicX + TOPIC.width + BRANCH_GAP)
        : round(topicX - BRANCH_GAP - SUBTOPIC.width);
    const columnY = cursor + (blockHeight - columnHeight) / 2;

    const branchFromX = side === "right" ? topicX + TOPIC.width : topicX;
    const branchFromY = topicY + TOPIC.height / 2;

    stage.nodes.forEach((node, nodeIndex) => {
      const y = round(columnY + nodeIndex * (SUBTOPIC.height + SUBTOPIC_GAP));
      subtopics.push({ node, stageId: stage.id, side, x: columnX, y, ...SUBTOPIC });

      const branchToX = side === "right" ? columnX : columnX + SUBTOPIC.width;
      edges.push({
        id: `branch-${node.id}`,
        kind: "branch",
        d: elbowPath(branchFromX, branchFromY, branchToX, y + SUBTOPIC.height / 2),
      });
    });

    cursor = cursor + blockHeight + STAGE_GAP;
  });

  return {
    width: CANVAS_WIDTH,
    height: round(cursor - STAGE_GAP + CANVAS_PADDING_BOTTOM),
    title,
    legend,
    topics,
    subtopics,
    edges,
  };
}
